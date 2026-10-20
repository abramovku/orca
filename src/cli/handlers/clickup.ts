import {
  CLICKUP_PRIORITY_NAMES,
  type ClickUpComment,
  type ClickUpList,
  type ClickUpPriorityName,
  type ClickUpSpace,
  type ClickUpTask,
  type ClickUpWorkspace
} from '../../shared/clickup-types'
import type { PersonalTokenConnectionStatus } from '../../shared/personal-token-integrations'
import { readCommandBody } from '../command-body-input'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  getOptionalPositiveIntegerFlag,
  getOptionalStringFlag,
  getRepeatedStringFlag,
  getRequiredStringFlag
} from '../flags'
import { printResult } from '../format'
import {
  formatClickUpComments,
  formatClickUpLists,
  formatClickUpSpaces,
  formatClickUpTask,
  formatClickUpTasks,
  formatClickUpWorkspaces,
  formatPersonalTokenConnection
} from '../personal-token-integration-format'
import { RuntimeClientError } from '../runtime-client'

const CLICKUP_BODY_MAX_CHARACTERS = 100_000

function isPriorityName(value: string): value is ClickUpPriorityName {
  return CLICKUP_PRIORITY_NAMES.some((name) => name === value)
}

function parsePriority(
  context: HandlerContext,
  allowClear: boolean
): ClickUpPriorityName | null | undefined {
  const raw = getOptionalStringFlag(context.flags, 'priority')?.trim().toLowerCase()
  if (raw === undefined) {
    return undefined
  }
  if (allowClear && raw === 'none') {
    return null
  }
  if (isPriorityName(raw)) {
    return raw
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `--priority must be ${CLICKUP_PRIORITY_NAMES.join(', ')}${allowClear ? ' or none' : ''}.`
  )
}

function readBody(context: HandlerContext, required: boolean): Promise<string | undefined> {
  return readCommandBody(context.flags, context.cwd, {
    required,
    maximumCharacters: CLICKUP_BODY_MAX_CHARACTERS,
    tooLargeCode: 'clickup_body_too_large',
    label: 'ClickUp body'
  })
}

export const CLICKUP_HANDLERS: Record<string, CommandHandler> = {
  'clickup connection': async (context) => {
    const response = await context.client.call<PersonalTokenConnectionStatus>('clickup.status')
    printResult(response, context.json, (status) =>
      formatPersonalTokenConnection('ClickUp', status)
    )
  },
  'clickup workspaces': async (context) => {
    const response = await context.client.call<ClickUpWorkspace[]>('clickup.listWorkspaces')
    printResult(response, context.json, formatClickUpWorkspaces)
  },
  'clickup spaces': async (context) => {
    const response = await context.client.call<ClickUpSpace[]>('clickup.listSpaces', {
      workspaceId: getRequiredStringFlag(context.flags, 'workspace')
    })
    printResult(response, context.json, formatClickUpSpaces)
  },
  'clickup lists': async (context) => {
    const response = await context.client.call<ClickUpList[]>('clickup.listLists', {
      spaceId: getRequiredStringFlag(context.flags, 'space')
    })
    printResult(response, context.json, formatClickUpLists)
  },
  'clickup tasks': async (context) => {
    const listId = getOptionalStringFlag(context.flags, 'list')
    const workspaceId = getOptionalStringFlag(context.flags, 'workspace')
    if (Boolean(listId) === Boolean(workspaceId)) {
      throw new RuntimeClientError('invalid_argument', 'Pass exactly one of --list or --workspace.')
    }
    const response = await context.client.call<ClickUpTask[]>('clickup.listTasks', {
      listId,
      workspaceId,
      mine: context.flags.get('me') === true,
      includeClosed: context.flags.get('all') === true,
      statuses: getRepeatedStringFlag(context.flags, 'status'),
      limit: getOptionalPositiveIntegerFlag(context.flags, 'limit')
    })
    printResult(response, context.json, formatClickUpTasks)
  },
  'clickup task': async (context) => {
    const response = await context.client.call<ClickUpTask>('clickup.getTask', {
      taskId: getRequiredStringFlag(context.flags, 'id')
    })
    printResult(response, context.json, formatClickUpTask)
  },
  'clickup create': async (context) => {
    const name = getRequiredStringFlag(context.flags, 'title').trim()
    if (!name) {
      throw new RuntimeClientError('invalid_argument', 'Task title cannot be blank.')
    }
    const response = await context.client.call<ClickUpTask>('clickup.createTask', {
      listId: getRequiredStringFlag(context.flags, 'list'),
      name,
      description: await readBody(context, false),
      status: getOptionalStringFlag(context.flags, 'status'),
      priority: parsePriority(context, false)
    })
    printResult(response, context.json, formatClickUpTask)
  },
  'clickup update': async (context) => {
    const params = {
      taskId: getRequiredStringFlag(context.flags, 'id'),
      name: getOptionalStringFlag(context.flags, 'title'),
      description: await readBody(context, false),
      status: getOptionalStringFlag(context.flags, 'status'),
      priority: parsePriority(context, true)
    }
    if (
      params.name === undefined &&
      params.description === undefined &&
      params.status === undefined &&
      params.priority === undefined
    ) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Nothing to update. Pass --title, --body, --status or --priority.'
      )
    }
    const response = await context.client.call<ClickUpTask>('clickup.updateTask', params)
    printResult(response, context.json, formatClickUpTask)
  },
  'clickup comment list': async (context) => {
    const response = await context.client.call<ClickUpComment[]>('clickup.listComments', {
      taskId: getRequiredStringFlag(context.flags, 'id')
    })
    printResult(response, context.json, formatClickUpComments)
  },
  'clickup comment add': async (context) => {
    const text = await readCommandBody(context.flags, context.cwd, {
      required: true,
      maximumCharacters: CLICKUP_BODY_MAX_CHARACTERS,
      tooLargeCode: 'clickup_body_too_large',
      label: 'ClickUp comment'
    })
    if (!text.trim()) {
      throw new RuntimeClientError('invalid_argument', 'Comment text cannot be blank.')
    }
    const response = await context.client.call<{ id: string | null }>('clickup.addComment', {
      taskId: getRequiredStringFlag(context.flags, 'id'),
      text
    })
    printResult(response, context.json, (result) =>
      result.id ? `Comment added (${result.id}).` : 'Comment added.'
    )
  }
}
