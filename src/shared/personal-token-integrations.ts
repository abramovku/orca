import type { SecretAtRestProtection } from './secret-at-rest-protection'

/** Integrations that connect with one pasted personal token and serve agents through the CLI. */
export type PersonalTokenProvider = 'slack' | 'clickup'

export const PERSONAL_TOKEN_PROVIDERS: readonly PersonalTokenProvider[] = ['slack', 'clickup']

export function isPersonalTokenProvider(value: unknown): value is PersonalTokenProvider {
  return value === 'slack' || value === 'clickup'
}

// Deliberately excludes the token: it never crosses IPC/RPC back to a client.
export type PersonalTokenConnectionStatus = {
  provider: PersonalTokenProvider
  configured: boolean
  /** Optional so an older host that omits it reads as unknown rather than as sealed. */
  credentialProtection?: SecretAtRestProtection | null
  account: string | null
  workspace: string | null
  credentialError: string | null
}

export type PersonalTokenConnectResult =
  | { ok: true; account: string | null; workspace: string | null }
  | { ok: false; error: string }
