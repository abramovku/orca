import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import {
  PersonalTokenRequestError,
  requestPersonalTokenJson
} from '../personal-token-integrations/personal-token-request'

const SLACK_API_BASE_URL = 'https://slack.com/api'

// Slack answers HTTP 200 with `ok: false`; these codes mean the token itself is unusable.
const REJECTED_TOKEN_ERRORS = new Set([
  'invalid_auth',
  'not_authed',
  'token_revoked',
  'token_expired',
  'account_inactive',
  'not_allowed_token_type'
])

type SlackParams = Record<string, string | number | boolean | undefined>

export type SlackApiRecord = Record<string, unknown>

function slackErrorMessage(method: string, body: SlackApiRecord): string {
  const code = typeof body.error === 'string' ? body.error : 'unknown_error'
  if (code === 'missing_scope') {
    const needed = typeof body.needed === 'string' ? body.needed : 'an additional scope'
    return `Slack token is missing the ${needed} scope required by ${method}. Add the scope to your Slack app and reinstall it, then reconnect.`
  }
  if (code === 'not_in_channel') {
    return 'The Slack token is not a member of that channel. Join or invite the app to the channel first.'
  }
  if (code === 'channel_not_found') {
    return 'Slack channel not found, or the token cannot see it.'
  }
  return `Slack ${method} failed: ${code}`
}

export async function callSlackApi(
  token: string,
  method: string,
  params: SlackParams = {},
  options: { post?: boolean; timeoutMs?: number } = {}
): Promise<SlackApiRecord> {
  const defined = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] => entry[1] !== undefined
  )
  const query = new URLSearchParams(defined.map(([key, value]) => [key, String(value)]))
  const url =
    options.post || defined.length === 0
      ? `${SLACK_API_BASE_URL}/${method}`
      : `${SLACK_API_BASE_URL}/${method}?${query.toString()}`
  const { json } = await requestPersonalTokenJson({
    service: 'Slack',
    url,
    method: options.post ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}` },
    body: options.post ? Object.fromEntries(defined) : undefined,
    timeoutMs: options.timeoutMs
  })
  if (!isRecord(json)) {
    throw new PersonalTokenRequestError('unreachable', 'Slack returned an unreadable response.')
  }
  if (json.ok !== true) {
    const code = typeof json.error === 'string' ? json.error : ''
    throw new PersonalTokenRequestError(
      REJECTED_TOKEN_ERRORS.has(code) ? 'rejected' : 'api_error',
      REJECTED_TOKEN_ERRORS.has(code)
        ? 'Slack rejected the token. Check it, or reconnect Slack in Orca Settings > Integrations.'
        : slackErrorMessage(method, json)
    )
  }
  return json
}

export async function verifySlackToken(
  token: string,
  timeoutMs: number
): Promise<{ account: string | null; workspace: string | null }> {
  const body = await callSlackApi(token, 'auth.test', {}, { timeoutMs })
  return {
    account: typeof body.user === 'string' ? body.user : null,
    workspace: typeof body.team === 'string' ? body.team : null
  }
}
