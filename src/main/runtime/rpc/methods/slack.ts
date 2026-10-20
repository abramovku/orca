import { defineMethod } from '../core'
import {
  SlackHistory,
  SlackListChannels,
  SlackListUsers,
  SlackSearch,
  SlackSend,
  SlackThread
} from '../../../../shared/rpc-contract/slack-params'
import { getPersonalTokenConnectionStatus } from '../../../personal-token-integrations/personal-token-connection'
import {
  listSlackChannels,
  listSlackUsers,
  readSlackHistory,
  readSlackThread,
  searchSlackMessages,
  sendSlackMessage
} from '../../../slack/slack-agent-commands'

// Why no connect method: the token is pasted in desktop Settings; agents only read and post.
export const SLACK_METHODS = [
  defineMethod({
    name: 'slack.status',
    permission: 'workspace',
    params: null,
    handler: () => getPersonalTokenConnectionStatus('slack')
  }),
  defineMethod({
    name: 'slack.listChannels',
    permission: 'workspace',
    params: SlackListChannels,
    handler: (params) => listSlackChannels(params)
  }),
  defineMethod({
    name: 'slack.history',
    permission: 'workspace',
    params: SlackHistory,
    handler: (params) => readSlackHistory(params)
  }),
  defineMethod({
    name: 'slack.thread',
    permission: 'workspace',
    params: SlackThread,
    handler: (params) => readSlackThread(params)
  }),
  defineMethod({
    name: 'slack.send',
    permission: 'workspace',
    params: SlackSend,
    handler: (params) => sendSlackMessage(params)
  }),
  defineMethod({
    name: 'slack.search',
    permission: 'workspace',
    params: SlackSearch,
    handler: (params) => searchSlackMessages(params)
  }),
  defineMethod({
    name: 'slack.listUsers',
    permission: 'workspace',
    params: SlackListUsers,
    handler: (params) => listSlackUsers(params)
  })
]
