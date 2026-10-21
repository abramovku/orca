import { cancelUnreadResponseBody } from '../lib/unread-response-body'

const DEFAULT_TIMEOUT_MS = 15_000

export type PersonalTokenRequestFailure = 'rejected' | 'unreachable' | 'api_error'

export class PersonalTokenRequestError extends Error {
  constructor(
    readonly failure: PersonalTokenRequestFailure,
    message: string
  ) {
    super(message)
    this.name = 'PersonalTokenRequestError'
  }
}

/**
 * JSON request that separates "the token was refused" from "the network or service failed",
 * so a dropped connection never tells the user to regenerate a working token.
 */
export async function requestPersonalTokenJson(args: {
  service: string
  url: string
  method?: 'GET' | 'POST' | 'PUT'
  headers: Record<string, string>
  body?: unknown
  timeoutMs?: number
}): Promise<{ status: number; json: unknown }> {
  let response: Response
  try {
    response = await fetch(args.url, {
      method: args.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(args.body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
        ...args.headers
      },
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      signal: AbortSignal.timeout(args.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    })
  } catch {
    throw new PersonalTokenRequestError(
      'unreachable',
      `Could not reach ${args.service}. Check your connection and try again.`
    )
  }
  if (response.status === 401) {
    await cancelUnreadResponseBody(response)
    throw new PersonalTokenRequestError(
      'rejected',
      `${args.service} rejected the saved token. Reconnect ${args.service} in Orca Settings > Integrations.`
    )
  }
  if (response.status === 429) {
    await cancelUnreadResponseBody(response)
    throw new PersonalTokenRequestError(
      'api_error',
      `${args.service} rate limit reached. Wait a minute and retry.`
    )
  }
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    if (response.ok) {
      throw new PersonalTokenRequestError(
        'unreachable',
        `${args.service} returned an unreadable response.`
      )
    }
  }
  return { status: response.status, json }
}
