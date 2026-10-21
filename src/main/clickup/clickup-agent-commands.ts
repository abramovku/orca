import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import {
  CLICKUP_PRIORITY_NAMES,
  type ClickUpComment,
  type ClickUpList,
  type ClickUpPriorityName,
  type ClickUpSpace,
  type ClickUpTask,
  type ClickUpWorkspace
} from '../../shared/clickup-types'
import { requirePersonalToken } from '../personal-token-integrations/personal-token-connection'
import { callClickUpApi, type ClickUpApiRecord } from './clickup-api'

function stringField(record: ClickUpApiRecord, key: string): string | null {
  const value = record[key]
  if (typeof value === 'number') {
    return String(value)
  }
  return typeof value === 'string' && value.length > 0 ? value : null
}

function recordList(value: unknown): ClickUpApiRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

// ClickUp timestamps are millisecond epochs serialized as strings.
function isoFromEpoch(value: unknown): string | null {
  const millis =
    typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(millis) && millis > 0 ? new Date(millis).toISOString() : null
}

function mapTask(raw: ClickUpApiRecord, withDescription: boolean): ClickUpTask | null {
  const id = stringField(raw, 'id')
  if (!id) {
    return null
  }
  const status = isRecord(raw.status) ? stringField(raw.status, 'status') : null
  const priority = isRecord(raw.priority) ? stringField(raw.priority, 'priority') : null
  const list = isRecord(raw.list) ? raw.list : null
  const task: ClickUpTask = {
    id,
    customId: stringField(raw, 'custom_id'),
    name: stringField(raw, 'name') ?? id,
    status,
    priority,
    url: stringField(raw, 'url'),
    assignees: recordList(raw.assignees).flatMap((assignee) => {
      const name = stringField(assignee, 'username') ?? stringField(assignee, 'email')
      return name ? [name] : []
    }),
    dueDate: isoFromEpoch(raw.due_date),
    updatedAt: isoFromEpoch(raw.date_updated),
    listId: list ? stringField(list, 'id') : null,
    listName: list ? stringField(list, 'name') : null
  }
  if (withDescription) {
    task.description =
      stringField(raw, 'markdown_description') ??
      stringField(raw, 'text_content') ??
      stringField(raw, 'description')
  }
  return task
}

function mapTasks(value: unknown): ClickUpTask[] {
  return recordList(value)
    .map((raw) => mapTask(raw, false))
    .filter((task): task is ClickUpTask => task !== null)
}

// ClickUp's API numbers priorities 1 (urgent) through 4 (low).
function priorityNumber(
  priority: ClickUpPriorityName | null | undefined
): number | null | undefined {
  if (priority === undefined) {
    return undefined
  }
  return priority === null ? null : CLICKUP_PRIORITY_NAMES.indexOf(priority) + 1
}

export async function listClickUpWorkspaces(): Promise<ClickUpWorkspace[]> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, '/team')
  return recordList(body.teams).flatMap((team) => {
    const id = stringField(team, 'id')
    return id
      ? [
          {
            id,
            name: stringField(team, 'name') ?? id,
            memberCount: Array.isArray(team.members) ? team.members.length : 0
          }
        ]
      : []
  })
}

export async function listClickUpSpaces(args: { workspaceId: string }): Promise<ClickUpSpace[]> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/team/${encodeURIComponent(args.workspaceId)}/space`, {
    query: { archived: false }
  })
  return recordList(body.spaces).flatMap((space) => {
    const id = stringField(space, 'id')
    return id ? [{ id, name: stringField(space, 'name') ?? id }] : []
  })
}

/** Folderless lists plus every folder's lists, flattened so agents get one table. */
export async function listClickUpLists(args: { spaceId: string }): Promise<ClickUpList[]> {
  const token = requirePersonalToken('clickup')
  const spacePath = `/space/${encodeURIComponent(args.spaceId)}`
  const [folderless, folders] = await Promise.all([
    callClickUpApi(token, `${spacePath}/list`, { query: { archived: false } }),
    callClickUpApi(token, `${spacePath}/folder`, { query: { archived: false } })
  ])
  const toList = (raw: ClickUpApiRecord, folder: ClickUpApiRecord | null): ClickUpList[] => {
    const id = stringField(raw, 'id')
    return id
      ? [
          {
            id,
            name: stringField(raw, 'name') ?? id,
            folderId: folder ? stringField(folder, 'id') : null,
            folderName: folder ? stringField(folder, 'name') : null
          }
        ]
      : []
  }
  return [
    ...recordList(folderless.lists).flatMap((raw) => toList(raw, null)),
    ...recordList(folders.folders).flatMap((folder) =>
      recordList(folder.lists).flatMap((raw) => toList(raw, folder))
    )
  ]
}

export async function listClickUpTasks(args: {
  listId?: string
  workspaceId?: string
  mine?: boolean
  includeClosed?: boolean
  statuses?: string[]
  limit?: number
}): Promise<ClickUpTask[]> {
  const token = requirePersonalToken('clickup')
  let assignees: string[] | undefined
  if (args.mine) {
    const me = await callClickUpApi(token, '/user')
    const id = isRecord(me.user) ? stringField(me.user, 'id') : null
    assignees = id ? [id] : undefined
  }
  const query = {
    archived: false,
    include_closed: args.includeClosed ?? false,
    subtasks: true,
    order_by: 'updated',
    assignees,
    statuses: args.statuses && args.statuses.length > 0 ? args.statuses : undefined,
    page: 0
  }
  let body: ClickUpApiRecord
  if (args.listId) {
    body = await callClickUpApi(token, `/list/${encodeURIComponent(args.listId)}/task`, { query })
  } else if (args.workspaceId) {
    body = await callClickUpApi(token, `/team/${encodeURIComponent(args.workspaceId)}/task`, {
      query
    })
  } else {
    throw new Error('Pass --list <id> or --workspace <id>.')
  }
  return mapTasks(body.tasks).slice(0, args.limit ?? 50)
}

export async function getClickUpTask(args: { taskId: string }): Promise<ClickUpTask> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/task/${encodeURIComponent(args.taskId)}`, {
    query: { include_markdown_description: true, include_subtasks: true }
  })
  const task = mapTask(body, true)
  if (!task) {
    throw new Error(`ClickUp task ${args.taskId} not found.`)
  }
  return task
}

export async function createClickUpTask(args: {
  listId: string
  name: string
  description?: string
  status?: string
  priority?: ClickUpPriorityName
}): Promise<ClickUpTask> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/list/${encodeURIComponent(args.listId)}/task`, {
    method: 'POST',
    body: {
      name: args.name,
      markdown_content: args.description,
      status: args.status,
      priority: priorityNumber(args.priority)
    }
  })
  const task = mapTask(body, true)
  if (!task) {
    throw new Error('ClickUp did not return the created task.')
  }
  return task
}

export async function updateClickUpTask(args: {
  taskId: string
  name?: string
  description?: string
  status?: string
  priority?: ClickUpPriorityName | null
}): Promise<ClickUpTask> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/task/${encodeURIComponent(args.taskId)}`, {
    method: 'PUT',
    body: {
      name: args.name,
      markdown_content: args.description,
      status: args.status,
      priority: priorityNumber(args.priority)
    }
  })
  const task = mapTask(body, true)
  if (!task) {
    throw new Error('ClickUp did not return the updated task.')
  }
  return task
}

export async function listClickUpComments(args: { taskId: string }): Promise<ClickUpComment[]> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/task/${encodeURIComponent(args.taskId)}/comment`)
  return recordList(body.comments).flatMap((comment) => {
    const id = stringField(comment, 'id')
    if (!id) {
      return []
    }
    const user = isRecord(comment.user) ? comment.user : null
    return [
      {
        id,
        author: user ? (stringField(user, 'username') ?? stringField(user, 'email')) : null,
        text: stringField(comment, 'comment_text') ?? '',
        createdAt: isoFromEpoch(comment.date)
      }
    ]
  })
}

export async function addClickUpComment(args: {
  taskId: string
  text: string
}): Promise<{ id: string | null }> {
  const token = requirePersonalToken('clickup')
  const body = await callClickUpApi(token, `/task/${encodeURIComponent(args.taskId)}/comment`, {
    method: 'POST',
    body: { comment_text: args.text, notify_all: false }
  })
  return { id: stringField(body, 'id') }
}
