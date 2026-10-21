import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import {
  PersonalTokenRequestError,
  requestPersonalTokenJson
} from '../personal-token-integrations/personal-token-request'

const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2'

export type ClickUpApiRecord = Record<string, unknown>

type QueryValue = string | number | boolean | readonly string[] | undefined

function buildQuery(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue
    }
    if (Array.isArray(value)) {
      // ClickUp expects repeated `key[]=` entries for array filters.
      for (const item of value) {
        params.append(`${key}[]`, item)
      }
    } else {
      params.append(key, String(value))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export async function callClickUpApi(
  token: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT'
    query?: Record<string, QueryValue>
    body?: unknown
    timeoutMs?: number
  } = {}
): Promise<ClickUpApiRecord> {
  const { status, json } = await requestPersonalTokenJson({
    service: 'ClickUp',
    url: `${CLICKUP_API_BASE_URL}${path}${buildQuery(options.query ?? {})}`,
    method: options.method,
    // Why no "Bearer": ClickUp personal tokens go in the header verbatim.
    headers: { Authorization: token },
    body: options.body,
    timeoutMs: options.timeoutMs
  })
  if (status >= 400) {
    const message = isRecord(json) && typeof json.err === 'string' ? json.err : `HTTP ${status}`
    throw new PersonalTokenRequestError(
      status === 403 ? 'rejected' : 'api_error',
      `ClickUp request failed: ${message}`
    )
  }
  if (!isRecord(json)) {
    throw new PersonalTokenRequestError('unreachable', 'ClickUp returned an unreadable response.')
  }
  return json
}

export async function verifyClickUpToken(
  token: string,
  timeoutMs: number
): Promise<{ account: string | null; workspace: string | null }> {
  const body = await callClickUpApi(token, '/user', { timeoutMs })
  const user = isRecord(body.user) ? body.user : null
  const account =
    user && typeof user.username === 'string' && user.username
      ? user.username
      : user && typeof user.email === 'string'
        ? user.email
        : null
  let workspace: string | null = null
  try {
    const teams = await callClickUpApi(token, '/team', { timeoutMs })
    const names = Array.isArray(teams.teams)
      ? teams.teams
          .filter(isRecord)
          .flatMap((team) => (typeof team.name === 'string' ? [team.name] : []))
      : []
    workspace = names.length > 0 ? names.join(', ') : null
  } catch {
    // The token is already proven by /user; the workspace label is decoration.
  }
  return { account, workspace }
}
