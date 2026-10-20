import { z } from 'zod'
import { CLICKUP_PRIORITY_NAMES } from '../clickup-types'
import {
  OptionalBoolean,
  OptionalFiniteNumber,
  OptionalPlainString,
  OptionalString,
  requiredString
} from './rpc-param-primitives'

export const ClickUpWorkspaceScope = z.object({
  workspaceId: requiredString('Missing ClickUp workspace ID')
})

export const ClickUpSpaceScope = z.object({
  spaceId: requiredString('Missing ClickUp space ID')
})

export const ClickUpListTasks = z.object({
  listId: OptionalString,
  workspaceId: OptionalString,
  mine: OptionalBoolean,
  includeClosed: OptionalBoolean,
  statuses: z.array(z.string()).optional(),
  limit: OptionalFiniteNumber
})

export const ClickUpTaskId = z.object({
  taskId: requiredString('Missing ClickUp task ID')
})

export const ClickUpCreateTask = z.object({
  listId: requiredString('Missing ClickUp list ID'),
  name: requiredString('Task title cannot be empty'),
  description: OptionalPlainString,
  status: OptionalString,
  priority: z.enum(CLICKUP_PRIORITY_NAMES).optional()
})

export const ClickUpUpdateTask = z.object({
  taskId: requiredString('Missing ClickUp task ID'),
  name: OptionalString,
  description: OptionalPlainString,
  status: OptionalString,
  // null clears the priority; omitted leaves it unchanged.
  priority: z.enum(CLICKUP_PRIORITY_NAMES).nullable().optional()
})

export const ClickUpAddComment = z.object({
  taskId: requiredString('Missing ClickUp task ID'),
  text: requiredString('Comment text cannot be empty')
})
