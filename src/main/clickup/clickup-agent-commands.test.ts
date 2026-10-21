import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../personal-token-integrations/personal-token-connection', () => ({
  requirePersonalToken: () => 'pk_test'
}))

import {
  getClickUpTask,
  listClickUpLists,
  listClickUpTasks,
  updateClickUpTask
} from './clickup-agent-commands'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function requestUrl(index: number): URL {
  return new URL(String(fetchMock.mock.calls[index][0]))
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clickup agent commands', () => {
  it('maps a task with its markdown description and ISO dates', async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        id: '86abc',
        custom_id: 'ENG-1',
        name: 'Fix login',
        status: { status: 'in progress' },
        priority: { priority: 'high' },
        url: 'https://app.clickup.com/t/86abc',
        assignees: [{ username: 'anna' }],
        due_date: '1700000000000',
        date_updated: '1700000000000',
        list: { id: 'L1', name: 'Sprint' },
        markdown_description: '# Steps'
      })
    )

    const task = await getClickUpTask({ taskId: '86abc' })

    expect(task).toMatchObject({
      id: '86abc',
      customId: 'ENG-1',
      status: 'in progress',
      priority: 'high',
      assignees: ['anna'],
      dueDate: '2023-11-14T22:13:20.000Z',
      listName: 'Sprint',
      description: '# Steps'
    })
    expect(requestUrl(0).searchParams.get('include_markdown_description')).toBe('true')
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'pk_test' })
  })

  it('filters workspace tasks to the token owner with repeated array params', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ user: { id: 42 } }))
      .mockResolvedValueOnce(json({ tasks: [{ id: 't1', name: 'One' }] }))

    const tasks = await listClickUpTasks({
      workspaceId: '900',
      mine: true,
      statuses: ['open', 'review']
    })

    expect(tasks.map((t) => t.id)).toEqual(['t1'])
    const url = requestUrl(1)
    expect(url.pathname).toBe('/api/v2/team/900/task')
    expect(url.searchParams.getAll('assignees[]')).toEqual(['42'])
    expect(url.searchParams.getAll('statuses[]')).toEqual(['open', 'review'])
  })

  it('flattens folderless and foldered lists into one table', async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname
      return path.endsWith('/list')
        ? json({ lists: [{ id: 'L0', name: 'Inbox' }] })
        : json({ folders: [{ id: 'F1', name: 'Q3', lists: [{ id: 'L1', name: 'Sprint' }] }] })
    })

    const lists = await listClickUpLists({ spaceId: 'S1' })

    expect(lists).toEqual([
      { id: 'L0', name: 'Inbox', folderId: null, folderName: null },
      { id: 'L1', name: 'Sprint', folderId: 'F1', folderName: 'Q3' }
    ])
  })

  it('sends priority as ClickUp numbers and null to clear it', async () => {
    fetchMock.mockImplementation(async () => json({ id: 't1', name: 'One' }))

    await updateClickUpTask({ taskId: 't1', priority: 'urgent' })
    await updateClickUpTask({ taskId: 't1', priority: null })

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ priority: 1 })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ priority: null })
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT')
  })

  it('surfaces ClickUp error text', async () => {
    fetchMock.mockResolvedValueOnce(json({ err: 'Status does not exist', ECODE: 'ITEM_114' }, 400))
    await expect(updateClickUpTask({ taskId: 't1', status: 'nope' })).rejects.toThrow(
      'ClickUp request failed: Status does not exist'
    )
  })
})
