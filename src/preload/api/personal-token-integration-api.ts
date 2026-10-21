import type {
  PersonalTokenConnectResult,
  PersonalTokenConnectionStatus,
  PersonalTokenProvider
} from '../../shared/personal-token-integrations'

export type PersonalTokenIntegrationApi = {
  connect: (provider: PersonalTokenProvider, token: string) => Promise<PersonalTokenConnectResult>
  disconnect: (provider: PersonalTokenProvider) => Promise<void>
  status: (provider: PersonalTokenProvider) => Promise<PersonalTokenConnectionStatus>
}
