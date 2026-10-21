import { defineMethod } from '../core'
import {
  ClickUpAddComment,
  ClickUpCreateTask,
  ClickUpListTasks,
  ClickUpSpaceScope,
  ClickUpTaskId,
  ClickUpUpdateTask,
  ClickUpWorkspaceScope
} from '../../../../shared/rpc-contract/clickup-params'
import { getPersonalTokenConnectionStatus } from '../../../personal-token-integrations/personal-token-connection'
import {
  addClickUpComment,
  createClickUpTask,
  getClickUpTask,
  listClickUpComments,
  listClickUpLists,
  listClickUpSpaces,
  listClickUpTasks,
  listClickUpWorkspaces,
  updateClickUpTask
} from '../../../clickup/clickup-agent-commands'

// Why no connect method: the token is pasted in desktop Settings; agents only read and write tasks.
export const CLICKUP_METHODS = [
  defineMethod({
    name: 'clickup.status',
    permission: 'workspace',
    params: null,
    handler: () => getPersonalTokenConnectionStatus('clickup')
  }),
  defineMethod({
    name: 'clickup.listWorkspaces',
    permission: 'workspace',
    params: null,
    handler: () => listClickUpWorkspaces()
  }),
  defineMethod({
    name: 'clickup.listSpaces',
    permission: 'workspace',
    params: ClickUpWorkspaceScope,
    handler: (params) => listClickUpSpaces(params)
  }),
  defineMethod({
    name: 'clickup.listLists',
    permission: 'workspace',
    params: ClickUpSpaceScope,
    handler: (params) => listClickUpLists(params)
  }),
  defineMethod({
    name: 'clickup.listTasks',
    permission: 'workspace',
    params: ClickUpListTasks,
    handler: (params) => listClickUpTasks(params)
  }),
  defineMethod({
    name: 'clickup.getTask',
    permission: 'workspace',
    params: ClickUpTaskId,
    handler: (params) => getClickUpTask(params)
  }),
  defineMethod({
    name: 'clickup.createTask',
    permission: 'workspace',
    params: ClickUpCreateTask,
    handler: (params) => createClickUpTask(params)
  }),
  defineMethod({
    name: 'clickup.updateTask',
    permission: 'workspace',
    params: ClickUpUpdateTask,
    handler: (params) => updateClickUpTask(params)
  }),
  defineMethod({
    name: 'clickup.listComments',
    permission: 'workspace',
    params: ClickUpTaskId,
    handler: (params) => listClickUpComments(params)
  }),
  defineMethod({
    name: 'clickup.addComment',
    permission: 'workspace',
    params: ClickUpAddComment,
    handler: (params) => addClickUpComment(params)
  })
]
