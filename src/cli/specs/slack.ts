import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SLACK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['slack', 'connection'],
    summary: 'Show the Slack connection saved in Orca',
    usage: 'orca slack connection [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Connect or replace the token in Orca Settings > Integrations > Slack.']
  },
  {
    path: ['slack', 'channels'],
    summary: 'List Slack channels the token can see',
    usage: 'orca slack channels [--query <text>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'query', 'limit'],
    examples: ['orca slack channels --query eng --json']
  },
  {
    path: ['slack', 'history'],
    summary: 'Read recent messages in a Slack channel',
    usage: 'orca slack history <channel> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'channel', 'limit'],
    positionalArgs: ['channel'],
    examples: [
      'orca slack history "#eng-alerts" --limit 20 --json',
      'orca slack history C0123456789'
    ]
  },
  {
    path: ['slack', 'thread'],
    summary: 'Read every reply in a Slack thread',
    usage: 'orca slack thread <channel> --ts <threadTs> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'channel', 'ts', 'limit'],
    positionalArgs: ['channel'],
    examples: ['orca slack thread C0123456789 --ts 1712345678.123456 --json']
  },
  {
    path: ['slack', 'send'],
    summary: 'Post a message to a Slack channel or thread',
    usage:
      'orca slack send <channel> (--body <text> | --body-file <path|->) [--thread-ts <ts>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'channel', 'body', 'body-file', 'thread-ts'],
    positionalArgs: ['channel'],
    examples: [
      'orca slack send "#eng" --body "Deploy finished" --json',
      'orca slack send C0123456789 --thread-ts 1712345678.123456 --body "Fixed in PR #42"'
    ],
    notes: ['Posts as the owner of the saved token. Only send when the user asked for it.']
  },
  {
    path: ['slack', 'search'],
    summary: 'Search Slack messages (user tokens only)',
    usage: 'orca slack search <query> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'query', 'limit'],
    positionalArgs: ['query'],
    examples: ['orca slack search "in:#eng deploy failed" --limit 10 --json'],
    notes: ['Needs a user token (xoxp-) with the search:read scope; bot tokens cannot search.']
  },
  {
    path: ['slack', 'users'],
    summary: 'List Slack workspace members',
    usage: 'orca slack users [--query <text>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'query', 'limit'],
    examples: ['orca slack users --query anna --json']
  }
]
