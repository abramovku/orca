import type { HandlerGroup } from './handler-group-manifest'

export const SLACK_HANDLER_GROUP: HandlerGroup = {
  name: 'slack',
  keys: [
    'slack connection',
    'slack channels',
    'slack history',
    'slack thread',
    'slack send',
    'slack search',
    'slack users'
  ],
  load: async () => (await import('./handlers/slack.js')).SLACK_HANDLERS
}

export const CLICKUP_HANDLER_GROUP: HandlerGroup = {
  name: 'clickup',
  keys: [
    'clickup connection',
    'clickup workspaces',
    'clickup spaces',
    'clickup lists',
    'clickup tasks',
    'clickup task',
    'clickup create',
    'clickup update',
    'clickup comment list',
    'clickup comment add'
  ],
  load: async () => (await import('./handlers/clickup.js')).CLICKUP_HANDLERS
}
