import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const CLICKUP_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['clickup', 'connection'],
    summary: 'Show the ClickUp connection saved in Orca',
    usage: 'orca clickup connection [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Connect or replace the token in Orca Settings > Integrations > ClickUp.']
  },
  {
    path: ['clickup', 'workspaces'],
    summary: 'List ClickUp workspaces the token can access',
    usage: 'orca clickup workspaces [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['clickup', 'spaces'],
    summary: 'List spaces in a ClickUp workspace',
    usage: 'orca clickup spaces --workspace <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'workspace'],
    examples: ['orca clickup spaces --workspace 9012345678 --json']
  },
  {
    path: ['clickup', 'lists'],
    summary: 'List the lists in a ClickUp space, including lists inside folders',
    usage: 'orca clickup lists --space <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'space'],
    examples: ['orca clickup lists --space 90120000001 --json']
  },
  {
    path: ['clickup', 'tasks'],
    summary: 'List ClickUp tasks in a list or across a workspace',
    usage:
      'orca clickup tasks (--list <id> | --workspace <id>) [--me] [--all] [--status <name>...] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'list', 'workspace', 'me', 'all', 'status', 'limit'],
    repeatableFlags: ['status'],
    examples: [
      'orca clickup tasks --list 901200000123 --json',
      'orca clickup tasks --workspace 9012345678 --me --limit 20 --json'
    ],
    notes: ['--me keeps tasks assigned to the token owner; --all includes closed tasks.']
  },
  {
    path: ['clickup', 'task'],
    summary: 'Read one ClickUp task with its description',
    usage: 'orca clickup task <taskId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['orca clickup task 86abc123 --json']
  },
  {
    path: ['clickup', 'create'],
    summary: 'Create a ClickUp task',
    usage:
      'orca clickup create --list <id> --title <text> [--body <text> | --body-file <path|->] [--status <name>] [--priority urgent|high|normal|low] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'list', 'title', 'body', 'body-file', 'status', 'priority'],
    examples: ['orca clickup create --list 901200000123 --title "Fix login redirect" --json']
  },
  {
    path: ['clickup', 'update'],
    summary: 'Update a ClickUp task',
    usage:
      'orca clickup update <taskId> [--title <text>] [--body <text> | --body-file <path|->] [--status <name>] [--priority urgent|high|normal|low|none] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'title', 'body', 'body-file', 'status', 'priority'],
    positionalArgs: ['id'],
    examples: ['orca clickup update 86abc123 --status "in review" --json']
  },
  {
    path: ['clickup', 'comment', 'list'],
    summary: 'List comments on a ClickUp task',
    usage: 'orca clickup comment list <taskId> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id']
  },
  {
    path: ['clickup', 'comment', 'add'],
    summary: 'Comment on a ClickUp task',
    usage: 'orca clickup comment add <taskId> (--body <text> | --body-file <path|->) [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id', 'body', 'body-file'],
    positionalArgs: ['id'],
    examples: ['orca clickup comment add 86abc123 --body "Fixed in PR #42" --json']
  }
]
