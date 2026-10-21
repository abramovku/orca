import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempHome = ''
const fetchMock = vi.fn<typeof fetch>()

async function loadConnection() {
  vi.resetModules()
  const { setSecretStore } = await import('../../shared/secret-store')
  setSecretStore({
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`sealed:${value}`),
    decryptString: (value: Buffer) => value.toString('utf-8').replace(/^sealed:/, ''),
    describeProtectionGap: () => null
  })
  vi.doMock('node:os', async () => {
    const actual = await vi.importActual<typeof Os>('node:os')
    return { ...actual, homedir: () => tempHome }
  })
  return import('./personal-token-connection')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'orca-personal-token-'))
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('personal token connection', () => {
  it('verifies a Slack token, then saves it sealed with plaintext identity metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, user: 'anna', team: 'Acme', user_id: 'U1' })
    )
    const connection = await loadConnection()

    const result = await connection.connectPersonalToken('slack', '  xoxp-good  ')

    expect(result).toEqual({ ok: true, account: 'anna', workspace: 'Acme' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://slack.com/api/auth.test')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer xoxp-good' })
    const secret = readFileSync(join(tempHome, '.orca', 'slack-credential.enc'), 'utf-8')
    expect(secret).toBe('sealed:xoxp-good')
    expect(connection.getPersonalTokenConnectionStatus('slack')).toMatchObject({
      configured: true,
      account: 'anna',
      workspace: 'Acme',
      credentialError: null
    })
    expect(connection.requirePersonalToken('slack')).toBe('xoxp-good')
  })

  it('rejects a token Slack refuses without saving anything', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_auth' }))
    const connection = await loadConnection()

    const result = await connection.connectPersonalToken('slack', 'xoxp-bad')

    expect(result).toEqual({
      ok: false,
      error: 'Slack rejected this token. Check it and try again.'
    })
    expect(existsSync(join(tempHome, '.orca', 'slack-credential.enc'))).toBe(false)
    expect(connection.getPersonalTokenConnectionStatus('slack').configured).toBe(false)
  })

  it('reports a network failure as unreachable, not as a bad token', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    const connection = await loadConnection()

    const result = await connection.connectPersonalToken('clickup', 'pk_1')

    expect(result).toEqual({
      ok: false,
      error: 'Could not reach ClickUp. Check your connection and try again.'
    })
  })

  it('sends the ClickUp token verbatim and labels the connection with its workspaces', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ user: { id: 7, username: 'anna' } }))
      .mockResolvedValueOnce(jsonResponse({ teams: [{ id: '1', name: 'Acme' }] }))
    const connection = await loadConnection()

    const result = await connection.connectPersonalToken('clickup', 'pk_good')

    expect(result).toEqual({ ok: true, account: 'anna', workspace: 'Acme' })
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'pk_good' })
  })

  it('keeps providers isolated and clears only the disconnected one', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, user: 'anna', team: 'Acme' }))
      .mockResolvedValueOnce(jsonResponse({ user: { username: 'anna' } }))
      .mockResolvedValueOnce(jsonResponse({ teams: [] }))
    const connection = await loadConnection()
    await connection.connectPersonalToken('slack', 'xoxp-1')
    await connection.connectPersonalToken('clickup', 'pk_1')

    connection.disconnectPersonalToken('slack')

    expect(connection.getPersonalTokenConnectionStatus('slack').configured).toBe(false)
    expect(connection.getPersonalTokenConnectionStatus('clickup').configured).toBe(true)
    expect(() => connection.requirePersonalToken('slack')).toThrow(/Slack is not connected/)
  })

  it('reads a token saved by a previous launch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, user: 'anna', team: 'Acme' }))
    const first = await loadConnection()
    await first.connectPersonalToken('slack', 'xoxp-persisted')

    const second = await loadConnection()

    expect(second.getPersonalTokenConnectionStatus('slack').account).toBe('anna')
    expect(second.requirePersonalToken('slack')).toBe('xoxp-persisted')
  })
})
