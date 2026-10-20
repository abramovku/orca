import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import type {
  SlackChannel,
  SlackMessage,
  SlackPostResult,
  SlackSearchMatch,
  SlackUser
} from '../../shared/slack-types'
import { requirePersonalToken } from '../personal-token-integrations/personal-token-connection'
import { callSlackApi, type SlackApiRecord } from './slack-api'

const CHANNEL_PAGE_SIZE = 200
// Why: a name lookup walks pages; cap it so a huge enterprise grid cannot stall the CLI.
const MAX_CHANNEL_PAGES = 25
const MAX_USER_NAME_LOOKUPS = 25
const SLACK_ID_PATTERN = /^[CGD][A-Z0-9]{6,}$/

function stringField(record: SlackApiRecord, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberField(record: SlackApiRecord, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' ? value : null
}

function recordList(value: unknown): SlackApiRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function nextCursor(body: SlackApiRecord): string | null {
  const meta = body.response_metadata
  return isRecord(meta) ? stringField(meta, 'next_cursor') : null
}

function mapChannel(raw: SlackApiRecord): SlackChannel | null {
  const id = stringField(raw, 'id')
  if (!id) {
    return null
  }
  const topic = isRecord(raw.topic) ? stringField(raw.topic, 'value') : null
  return {
    id,
    name: stringField(raw, 'name') ?? id,
    isPrivate: raw.is_private === true,
    isMember: raw.is_member === true,
    topic,
    memberCount: numberField(raw, 'num_members')
  }
}

function mapMessage(raw: SlackApiRecord): SlackMessage | null {
  const ts = stringField(raw, 'ts')
  if (!ts) {
    return null
  }
  return {
    ts,
    threadTs: stringField(raw, 'thread_ts'),
    userId: stringField(raw, 'user') ?? stringField(raw, 'bot_id'),
    userName: stringField(raw, 'username'),
    text: typeof raw.text === 'string' ? raw.text : '',
    replyCount: numberField(raw, 'reply_count') ?? 0
  }
}

async function listChannelPage(
  token: string,
  cursor: string | null,
  limit: number
): Promise<{ channels: SlackChannel[]; cursor: string | null }> {
  const body = await callSlackApi(token, 'conversations.list', {
    types: 'public_channel,private_channel',
    exclude_archived: true,
    limit,
    cursor: cursor ?? undefined
  })
  return {
    channels: recordList(body.channels)
      .map(mapChannel)
      .filter((channel): channel is SlackChannel => channel !== null),
    cursor: nextCursor(body)
  }
}

export async function listSlackChannels(args: {
  query?: string
  limit?: number
}): Promise<SlackChannel[]> {
  const token = requirePersonalToken('slack')
  const limit = args.limit ?? 100
  const query = args.query?.trim().replace(/^#/, '').toLowerCase()
  const found: SlackChannel[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_CHANNEL_PAGES; page += 1) {
    const result = await listChannelPage(token, cursor, CHANNEL_PAGE_SIZE)
    for (const channel of result.channels) {
      if (!query || channel.name.toLowerCase().includes(query)) {
        found.push(channel)
      }
    }
    cursor = result.cursor
    if (!cursor || found.length >= limit) {
      break
    }
  }
  return found.slice(0, limit)
}

/** Accepts a channel ID or a `#name`; names resolve through conversations.list. */
export async function resolveSlackChannelId(token: string, channel: string): Promise<string> {
  const trimmed = channel.trim()
  if (SLACK_ID_PATTERN.test(trimmed)) {
    return trimmed
  }
  const name = trimmed.replace(/^#/, '').toLowerCase()
  let cursor: string | null = null
  for (let page = 0; page < MAX_CHANNEL_PAGES; page += 1) {
    const result = await listChannelPage(token, cursor, CHANNEL_PAGE_SIZE)
    const match = result.channels.find((candidate) => candidate.name.toLowerCase() === name)
    if (match) {
      return match.id
    }
    cursor = result.cursor
    if (!cursor) {
      break
    }
  }
  throw new Error(`Slack channel "${trimmed}" not found. Pass its channel ID instead.`)
}

// Fills display names for the authors on screen; cached per call so a busy thread costs one lookup per person.
async function attachUserNames(token: string, messages: SlackMessage[]): Promise<SlackMessage[]> {
  const ids = [
    ...new Set(messages.filter((m) => !m.userName && m.userId).map((m) => m.userId ?? ''))
  ]
  const names = new Map<string, string>()
  for (const id of ids.slice(0, MAX_USER_NAME_LOOKUPS)) {
    if (!id.startsWith('U') && !id.startsWith('W')) {
      continue
    }
    try {
      const body = await callSlackApi(token, 'users.info', { user: id })
      const user = isRecord(body.user) ? body.user : null
      const profile = user && isRecord(user.profile) ? user.profile : null
      const name =
        (profile && stringField(profile, 'display_name')) ??
        (profile && stringField(profile, 'real_name')) ??
        (user && stringField(user, 'name'))
      if (name) {
        names.set(id, name)
      }
    } catch {
      // A missing users:read scope only costs the name; the message itself still prints.
    }
  }
  return messages.map((message) =>
    message.userName || !message.userId
      ? message
      : { ...message, userName: names.get(message.userId) ?? null }
  )
}

export async function readSlackHistory(args: {
  channel: string
  limit?: number
}): Promise<SlackMessage[]> {
  const token = requirePersonalToken('slack')
  const channelId = await resolveSlackChannelId(token, args.channel)
  const body = await callSlackApi(token, 'conversations.history', {
    channel: channelId,
    limit: args.limit ?? 30
  })
  const messages = recordList(body.messages)
    .map(mapMessage)
    .filter((message): message is SlackMessage => message !== null)
  // Slack returns newest first; agents read a conversation top to bottom.
  return attachUserNames(token, messages.toReversed())
}

export async function readSlackThread(args: {
  channel: string
  ts: string
  limit?: number
}): Promise<SlackMessage[]> {
  const token = requirePersonalToken('slack')
  const channelId = await resolveSlackChannelId(token, args.channel)
  const body = await callSlackApi(token, 'conversations.replies', {
    channel: channelId,
    ts: args.ts,
    limit: args.limit ?? 100
  })
  const messages = recordList(body.messages)
    .map(mapMessage)
    .filter((message): message is SlackMessage => message !== null)
  return attachUserNames(token, messages)
}

export async function sendSlackMessage(args: {
  channel: string
  text: string
  threadTs?: string
}): Promise<SlackPostResult> {
  const token = requirePersonalToken('slack')
  const channelId = await resolveSlackChannelId(token, args.channel)
  const body = await callSlackApi(
    token,
    'chat.postMessage',
    { channel: channelId, text: args.text, thread_ts: args.threadTs },
    { post: true }
  )
  const ts = stringField(body, 'ts') ?? ''
  let permalink: string | null = null
  try {
    const link = await callSlackApi(token, 'chat.getPermalink', {
      channel: channelId,
      message_ts: ts
    })
    permalink = stringField(link, 'permalink')
  } catch {
    // The message is already posted; a missing link must not report the send as failed.
  }
  return { channelId: stringField(body, 'channel') ?? channelId, ts, permalink }
}

export async function searchSlackMessages(args: {
  query: string
  limit?: number
}): Promise<SlackSearchMatch[]> {
  const token = requirePersonalToken('slack')
  const body = await callSlackApi(token, 'search.messages', {
    query: args.query,
    count: args.limit ?? 20
  })
  const messages = isRecord(body.messages) ? recordList(body.messages.matches) : []
  return messages.flatMap((raw): SlackSearchMatch[] => {
    const message = mapMessage(raw)
    if (!message) {
      return []
    }
    const channel = isRecord(raw.channel) ? raw.channel : null
    return [
      {
        ...message,
        channelId: channel ? stringField(channel, 'id') : null,
        channelName: channel ? stringField(channel, 'name') : null,
        permalink: stringField(raw, 'permalink')
      }
    ]
  })
}

export async function listSlackUsers(args: {
  query?: string
  limit?: number
}): Promise<SlackUser[]> {
  const token = requirePersonalToken('slack')
  const limit = args.limit ?? 50
  const query = args.query?.trim().toLowerCase()
  const found: SlackUser[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_CHANNEL_PAGES; page += 1) {
    const body = await callSlackApi(token, 'users.list', {
      limit: CHANNEL_PAGE_SIZE,
      cursor: cursor ?? undefined
    })
    for (const raw of recordList(body.members)) {
      const id = stringField(raw, 'id')
      if (!id || raw.deleted === true) {
        continue
      }
      const profile = isRecord(raw.profile) ? raw.profile : null
      const user: SlackUser = {
        id,
        name: (profile && stringField(profile, 'display_name')) ?? stringField(raw, 'name') ?? id,
        realName: (profile && stringField(profile, 'real_name')) ?? stringField(raw, 'real_name'),
        isBot: raw.is_bot === true
      }
      const haystack = `${user.name} ${user.realName ?? ''}`.toLowerCase()
      if (!query || haystack.includes(query)) {
        found.push(user)
      }
    }
    cursor = nextCursor(body)
    if (!cursor || found.length >= limit) {
      break
    }
  }
  return found.slice(0, limit)
}
