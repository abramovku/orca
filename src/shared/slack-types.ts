export type SlackChannel = {
  id: string
  name: string
  isPrivate: boolean
  isMember: boolean
  topic: string | null
  memberCount: number | null
}

export type SlackMessage = {
  ts: string
  threadTs: string | null
  userId: string | null
  userName: string | null
  text: string
  replyCount: number
}

export type SlackSearchMatch = SlackMessage & {
  channelId: string | null
  channelName: string | null
  permalink: string | null
}

export type SlackPostResult = {
  channelId: string
  ts: string
  permalink: string | null
}

export type SlackUser = {
  id: string
  name: string
  realName: string | null
  isBot: boolean
}
