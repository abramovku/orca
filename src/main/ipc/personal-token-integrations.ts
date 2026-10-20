import { ipcMain } from 'electron'
import {
  isPersonalTokenProvider,
  type PersonalTokenConnectResult,
  type PersonalTokenConnectionStatus
} from '../../shared/personal-token-integrations'
import {
  connectPersonalToken,
  disconnectPersonalToken,
  getPersonalTokenConnectionStatus
} from '../personal-token-integrations/personal-token-connection'

function requireProvider(value: unknown) {
  if (!isPersonalTokenProvider(value)) {
    throw new Error('Unknown integration')
  }
  return value
}

export function registerPersonalTokenIntegrationHandlers(): void {
  ipcMain.handle(
    'personalTokenIntegration:connect',
    async (_event, provider: unknown, token: unknown): Promise<PersonalTokenConnectResult> => {
      if (typeof token !== 'string') {
        return { ok: false, error: 'Enter a token.' }
      }
      return connectPersonalToken(requireProvider(provider), token)
    }
  )

  ipcMain.handle(
    'personalTokenIntegration:disconnect',
    async (_event, provider: unknown): Promise<void> => {
      disconnectPersonalToken(requireProvider(provider))
    }
  )

  ipcMain.handle(
    'personalTokenIntegration:status',
    async (_event, provider: unknown): Promise<PersonalTokenConnectionStatus> =>
      getPersonalTokenConnectionStatus(requireProvider(provider))
  )
}
