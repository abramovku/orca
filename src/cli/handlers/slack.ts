import type { PersonalTokenConnectionStatus } from '../../shared/personal-token-integrations'
import type {
  SlackChannel,
  SlackMessage,
  SlackPostResult,
  SlackSearchMatch,
  SlackUser
} from '../../shared/slack-types'
import { readCommandBody } from '../command-body-input'
import type { CommandHandler } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import {
  formatPersonalTokenConnection,
  formatSlackChannels,
  formatSlackMessages,
  formatSlackPost,
  formatSlackSearch,
  formatSlackUsers
} from '../personal-token-integration-format'
import { RuntimeClientError } from '../runtime-client'

// Slack caps chat.postMessage text at 40k characters.
const SLACK_MESSAGE_MAX_CHARACTERS = 40_000

export const SLACK_HANDLERS: Record<string, CommandHandler> = {
  'slack connection': async (context) => {
    const response = await context.client.call<PersonalTokenConnectionStatus>('slack.status')
    printResult(response, context.json, (status) => formatPersonalTokenConnection('Slack', status))
  },
  'slack channels': async (context) => {
    const response = await context.client.call<SlackChannel[]>('slack.listChannels', {
      query: getOptionalStringFlag(context.flags, 'query'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatSlackChannels)
  },
  'slack history': async (context) => {
    const response = await context.client.call<SlackMessage[]>('slack.history', {
      channel: getRequiredStringFlag(context.flags, 'channel'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatSlackMessages)
  },
  'slack thread': async (context) => {
    const response = await context.client.call<SlackMessage[]>('slack.thread', {
      channel: getRequiredStringFlag(context.flags, 'channel'),
      ts: getRequiredStringFlag(context.flags, 'ts'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatSlackMessages)
  },
  'slack send': async (context) => {
    const text = await readCommandBody(context.flags, context.cwd, {
      required: true,
      maximumCharacters: SLACK_MESSAGE_MAX_CHARACTERS,
      tooLargeCode: 'slack_message_too_large',
      label: 'Slack message'
    })
    if (!text.trim()) {
      throw new RuntimeClientError('invalid_argument', 'Message text cannot be blank.')
    }
    const response = await context.client.call<SlackPostResult>('slack.send', {
      channel: getRequiredStringFlag(context.flags, 'channel'),
      text,
      threadTs: getOptionalStringFlag(context.flags, 'thread-ts')
    })
    printResult(response, context.json, formatSlackPost)
  },
  'slack search': async (context) => {
    const response = await context.client.call<SlackSearchMatch[]>('slack.search', {
      query: getRequiredStringFlag(context.flags, 'query'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatSlackSearch)
  },
  'slack users': async (context) => {
    const response = await context.client.call<SlackUser[]>('slack.listUsers', {
      query: getOptionalStringFlag(context.flags, 'query'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatSlackUsers)
  }
}
