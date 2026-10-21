import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const personalTokenIntegrationApi = {
  connect: (provider, token) =>
    ipcRenderer.invoke('personalTokenIntegration:connect', provider, token),
  disconnect: (provider) => ipcRenderer.invoke('personalTokenIntegration:disconnect', provider),
  status: (provider) => ipcRenderer.invoke('personalTokenIntegration:status', provider)
} satisfies PreloadApi['personalTokenIntegration']
