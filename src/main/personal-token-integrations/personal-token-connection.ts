import type {
  PersonalTokenConnectResult,
  PersonalTokenConnectionStatus,
  PersonalTokenProvider
} from '../../shared/personal-token-integrations'
import { verifyClickUpToken } from '../clickup/clickup-api'
import { verifySlackToken } from '../slack/slack-api'
import {
  PERSONAL_TOKEN_SERVICE_NAMES,
  clearPersonalToken,
  getPersonalTokenCredentialError,
  getPersonalTokenMetadata,
  getPersonalTokenProtection,
  hasPersonalToken,
  loadPersonalToken,
  savePersonalToken
} from './credential-store'
import { PersonalTokenRequestError } from './personal-token-request'

const VERIFY_TIMEOUT_MS = 8000

const VERIFIERS: Record<
  PersonalTokenProvider,
  (
    token: string,
    timeoutMs: number
  ) => Promise<{ account: string | null; workspace: string | null }>
> = {
  slack: verifySlackToken,
  clickup: verifyClickUpToken
}

// Proves the token against the service before persisting, so a dead token is rejected inline.
export async function connectPersonalToken(
  provider: PersonalTokenProvider,
  rawToken: string
): Promise<PersonalTokenConnectResult> {
  const service = PERSONAL_TOKEN_SERVICE_NAMES[provider]
  const token = rawToken.trim()
  if (!token) {
    return { ok: false, error: `Enter a ${service} token.` }
  }
  try {
    const identity = await VERIFIERS[provider](token, VERIFY_TIMEOUT_MS)
    savePersonalToken(provider, { token, ...identity })
    return { ok: true, ...identity }
  } catch (error) {
    if (error instanceof PersonalTokenRequestError) {
      return {
        ok: false,
        error:
          error.failure === 'rejected'
            ? `${service} rejected this token. Check it and try again.`
            : error.message
      }
    }
    throw error
  }
}

export function disconnectPersonalToken(provider: PersonalTokenProvider): void {
  clearPersonalToken(provider)
}

// Plaintext metadata only — never decrypts — so Settings can call it on every open.
export function getPersonalTokenConnectionStatus(
  provider: PersonalTokenProvider
): PersonalTokenConnectionStatus {
  const configured = hasPersonalToken(provider)
  const metadata = configured ? getPersonalTokenMetadata(provider) : null
  return {
    provider,
    configured,
    credentialProtection: configured ? getPersonalTokenProtection(provider) : null,
    account: metadata?.account ?? null,
    workspace: metadata?.workspace ?? null,
    credentialError: getPersonalTokenCredentialError(provider)
  }
}

export function requirePersonalToken(provider: PersonalTokenProvider): string {
  const token = loadPersonalToken(provider)
  if (!token) {
    const service = PERSONAL_TOKEN_SERVICE_NAMES[provider]
    throw new Error(
      `${service} is not connected. Connect it in Orca Settings > Integrations, then retry.`
    )
  }
  return token
}
