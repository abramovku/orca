import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../personal-token-integrations/personal-token-connection', () => ({
  requirePersonalToken: () => 'xoxp-test'
}))

import {
  readSlackHistory,
  resolveSlackChannelId,
  searchSlackMessages,
  sendSlackMessage
} from './slack-agent-commands'

const fetchMock = vi.fn<typeof fetch>()

function slack(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), { status: 200 })
}

function calledMethod(index: number): string {
  const url = new URL(String(fetchMock.mock.calls[index][0]))
  return url.pathname.replace('/api/', '')
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('slack agent commands', () => {
  it('uses a channel ID as-is and resolves a #name across pages', async () => {
    await expect(resolveSlackChannelId('t', 'C0123456789')).resolves.toBe('C0123456789')
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock
      .mockResolvedValueOnce(
        slack({
          channels: [{ id: 'C1', name: 'random' }],
          response_metadata: { next_cursor: 'p2' }
        })
      )
      .mockResolvedValueOnce(slack({ channels: [{ id: 'C2', name: 'Eng' }] }))

    await expect(resolveSlackChannelId('t', '#eng')).resolves.toBe('C2')
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('cursor')).toBe('p2')
  })

  it('reports an unknown channel name instead of guessing', async () => {
    fetchMock.mockResolvedValueOnce(slack({ channels: [] }))
    await expect(resolveSlackChannelId('t', '#missing')).rejects.toThrow(
      'Slack channel "#missing" not found'
    )
  })

  it('returns history oldest first with author names filled in', async () => {
    fetchMock
      .mockResolvedValueOnce(
        slack({
          messages: [
            { ts: '2.0', user: 'U1', text: 'second' },
            { ts: '1.0', user: 'U1', text: 'first', reply_count: 2 }
          ]
        })
      )
      .mockResolvedValueOnce(slack({ user: { name: 'anna', profile: { display_name: 'Anna' } } }))

    const messages = await readSlackHistory({ channel: 'C0123456789' })

    expect(messages.map((m) => [m.ts, m.userName, m.replyCount])).toEqual([
      ['1.0', 'Anna', 2],
      ['2.0', 'Anna', 0]
    ])
    // One users.info lookup per distinct author.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('posts as JSON and still succeeds when the permalink lookup fails', async () => {
    fetchMock
      .mockResolvedValueOnce(slack({ channel: 'C0123456789', ts: '9.9' }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: 'internal_error' }), { status: 200 })
      )

    const result = await sendSlackMessage({
      channel: 'C0123456789',
      text: 'Deploy finished',
      threadTs: '1.0'
    })

    expect(result).toEqual({ channelId: 'C0123456789', ts: '9.9', permalink: null })
    const [, init] = fetchMock.mock.calls[0]
    expect(calledMethod(0)).toBe('chat.postMessage')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      channel: 'C0123456789',
      text: 'Deploy finished',
      thread_ts: '1.0'
    })
  })

  it('names the missing scope when Slack refuses a method', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: 'missing_scope', needed: 'search:read' }), {
        status: 200
      })
    )
    await expect(searchSlackMessages({ query: 'deploy' })).rejects.toThrow(
      /missing the search:read scope/
    )
  })
})
