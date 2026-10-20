import type {
  ClickUpComment,
  ClickUpList,
  ClickUpSpace,
  ClickUpTask,
  ClickUpWorkspace
} from '../shared/clickup-types'
import type { PersonalTokenConnectionStatus } from '../shared/personal-token-integrations'
import type {
  SlackChannel,
  SlackMessage,
  SlackPostResult,
  SlackSearchMatch,
  SlackUser
} from '../shared/slack-types'

export function formatPersonalTokenConnection(
  service: string,
  status: PersonalTokenConnectionStatus
): string {
  if (status.credentialError) {
    return status.credentialError
  }
  if (!status.configured) {
    return `${service} is not connected. Connect it in Orca Settings > Integrations.`
  }
  const who = [status.account, status.workspace].filter(Boolean).join(' · ')
  return who ? `${service} connected: ${who}` : `${service} connected.`
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function formatSlackChannels(channels: SlackChannel[]): string {
  if (channels.length === 0) {
    return 'No channels.'
  }
  return channels
    .map(
      (channel) =>
        `${channel.id}\t#${channel.name}${channel.isPrivate ? '\t(private)' : ''}${channel.isMember ? '' : '\t(not a member)'}`
    )
    .join('\n')
}

export function formatSlackMessages(messages: SlackMessage[]): string {
  if (messages.length === 0) {
    return 'No messages.'
  }
  return messages
    .map((message) => {
      const author = message.userName ?? message.userId ?? 'unknown'
      const replies = message.replyCount > 0 ? ` [${message.replyCount} replies]` : ''
      return `${message.ts}\t${author}${replies}\t${oneLine(message.text)}`
    })
    .join('\n')
}

export function formatSlackSearch(matches: SlackSearchMatch[]): string {
  if (matches.length === 0) {
    return 'No matches.'
  }
  return matches
    .map(
      (match) =>
        `${match.ts}\t#${match.channelName ?? match.channelId ?? '?'}\t${match.userName ?? match.userId ?? 'unknown'}\t${oneLine(match.text)}`
    )
    .join('\n')
}

export function formatSlackPost(result: SlackPostResult): string {
  return result.permalink
    ? `Posted: ${result.permalink}`
    : `Posted ${result.ts} in ${result.channelId}`
}

export function formatSlackUsers(users: SlackUser[]): string {
  if (users.length === 0) {
    return 'No users.'
  }
  return users
    .map((user) => `${user.id}\t${user.name}${user.realName ? `\t${user.realName}` : ''}`)
    .join('\n')
}

export function formatClickUpWorkspaces(workspaces: ClickUpWorkspace[]): string {
  if (workspaces.length === 0) {
    return 'No workspaces.'
  }
  return workspaces.map((workspace) => `${workspace.id}\t${workspace.name}`).join('\n')
}

export function formatClickUpSpaces(spaces: ClickUpSpace[]): string {
  if (spaces.length === 0) {
    return 'No spaces.'
  }
  return spaces.map((space) => `${space.id}\t${space.name}`).join('\n')
}

export function formatClickUpLists(lists: ClickUpList[]): string {
  if (lists.length === 0) {
    return 'No lists.'
  }
  return lists
    .map((list) => `${list.id}\t${list.folderName ? `${list.folderName} / ` : ''}${list.name}`)
    .join('\n')
}

export function formatClickUpTasks(tasks: ClickUpTask[]): string {
  if (tasks.length === 0) {
    return 'No tasks.'
  }
  return tasks
    .map(
      (task) =>
        `${task.customId ?? task.id}\t${task.status ?? '-'}\t${task.assignees.join(', ') || 'unassigned'}\t${task.name}`
    )
    .join('\n')
}

export function formatClickUpTask(task: ClickUpTask): string {
  const lines = [
    `${task.customId ?? task.id} ${task.name}`,
    ...(task.url ? [`URL: ${task.url}`] : []),
    `Status: ${task.status ?? 'none'}`,
    `Priority: ${task.priority ?? 'none'}`,
    `Assignees: ${task.assignees.join(', ') || 'unassigned'}`,
    ...(task.listName ? [`List: ${task.listName}`] : []),
    ...(task.dueDate ? [`Due: ${task.dueDate}`] : []),
    ...(task.updatedAt ? [`Updated: ${task.updatedAt}`] : [])
  ]
  if (task.description) {
    lines.push('', task.description)
  }
  return lines.join('\n')
}

export function formatClickUpComments(comments: ClickUpComment[]): string {
  if (comments.length === 0) {
    return 'No comments.'
  }
  return comments
    .map(
      (comment) =>
        `${comment.createdAt ?? '-'}\t${comment.author ?? 'unknown'}\t${oneLine(comment.text)}`
    )
    .join('\n')
}
