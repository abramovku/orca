import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from '../integration-credential-file'
import { readCredentialFileProtection } from '../credential-file-protection'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'
import type { IntegrationCredentialService } from '../../shared/integration-credential-errors'
import type { PersonalTokenProvider } from '../../shared/personal-token-integrations'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'

// Why plaintext metadata beside the sealed token: status reads render the account without
// decrypting, so opening Settings never raises an OS keychain prompt.
export type PersonalTokenMetadata = {
  version: 1
  account: string | null
  workspace: string | null
  updatedAt: string
}

export const PERSONAL_TOKEN_SERVICE_NAMES: Record<
  PersonalTokenProvider,
  IntegrationCredentialService
> = {
  slack: 'Slack',
  clickup: 'ClickUp'
}

type ProviderCache = {
  metadata: PersonalTokenMetadata | null
  metadataLoaded: boolean
  token: string | null
  error: string | null
}

const caches = new Map<PersonalTokenProvider, ProviderCache>()

function cacheFor(provider: PersonalTokenProvider): ProviderCache {
  let cache = caches.get(provider)
  if (!cache) {
    cache = { metadata: null, metadataLoaded: false, token: null, error: null }
    caches.set(provider, cache)
  }
  return cache
}

function getOrcaDir(): string {
  return join(homedir(), '.orca')
}

function metadataPath(provider: PersonalTokenProvider): string {
  return join(getOrcaDir(), `${provider}-credential.json`)
}

export function personalTokenSecretPath(provider: PersonalTokenProvider): string {
  return join(getOrcaDir(), `${provider}-credential.enc`)
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readMetadataFromDisk(provider: PersonalTokenProvider): PersonalTokenMetadata | null {
  const path = metadataPath(provider)
  if (!existsSync(path)) {
    return null
  }
  try {
    const record: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (!isRecord(record)) {
      return null
    }
    return {
      version: 1,
      account: optionalString(record.account),
      workspace: optionalString(record.workspace),
      updatedAt: optionalString(record.updatedAt) ?? ''
    }
  } catch {
    return null
  }
}

export function getPersonalTokenMetadata(
  provider: PersonalTokenProvider
): PersonalTokenMetadata | null {
  const cache = cacheFor(provider)
  if (!cache.metadataLoaded) {
    cache.metadata = readMetadataFromDisk(provider)
    cache.metadataLoaded = true
  }
  return cache.metadata
}

// Never decrypts, so it is safe on every status poll.
export function hasPersonalToken(provider: PersonalTokenProvider): boolean {
  return credentialFileHasContent(personalTokenSecretPath(provider))
}

export function getPersonalTokenCredentialError(provider: PersonalTokenProvider): string | null {
  return cacheFor(provider).error
}

export function getPersonalTokenProtection(
  provider: PersonalTokenProvider
): SecretAtRestProtection | null {
  return readCredentialFileProtection(personalTokenSecretPath(provider))
}

/** Throws CredentialDecryptionError when the stored ciphertext cannot be decrypted. */
export function loadPersonalToken(provider: PersonalTokenProvider): string | null {
  const cache = cacheFor(provider)
  if (cache.token !== null) {
    return cache.token
  }
  const path = personalTokenSecretPath(provider)
  if (!existsSync(path)) {
    return null
  }
  try {
    const token = readStoredCredentialToken(
      PERSONAL_TOKEN_SERVICE_NAMES[provider],
      readFileSync(path)
    )
    cache.token = token
    cache.error = null
    return token
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      cache.error = error.message
    }
    throw error
  }
}

export function savePersonalToken(
  provider: PersonalTokenProvider,
  input: { token: string; account: string | null; workspace: string | null }
): void {
  const dir = getOrcaDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeEncryptedCredential(
    PERSONAL_TOKEN_SERVICE_NAMES[provider],
    personalTokenSecretPath(provider),
    input.token
  )
  const metadata: PersonalTokenMetadata = {
    version: 1,
    account: input.account,
    workspace: input.workspace,
    updatedAt: new Date().toISOString()
  }
  writeCredentialFileAtomic(
    metadataPath(provider),
    Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8')
  )
  caches.set(provider, { metadata, metadataLoaded: true, token: input.token, error: null })
}

export function clearPersonalToken(provider: PersonalTokenProvider): void {
  try {
    for (const path of [personalTokenSecretPath(provider), metadataPath(provider)]) {
      try {
        unlinkSync(path)
      } catch (error) {
        // Why: swallowing a real unlink failure would let the token silently return next launch.
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
          throw error
        }
      }
    }
  } finally {
    caches.set(provider, { metadata: null, metadataLoaded: true, token: null, error: null })
  }
}

/** @internal - tests need a clean in-memory cache between cases. */
export function _resetPersonalTokenCaches(): void {
  caches.clear()
}
