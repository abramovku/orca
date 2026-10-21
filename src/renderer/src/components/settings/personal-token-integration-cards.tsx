import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, Unlink } from 'lucide-react'
import type {
  PersonalTokenConnectionStatus,
  PersonalTokenProvider
} from '../../../../shared/personal-token-integrations'
import { ClickUpIcon } from '@/components/icons/ClickUpIcon'
import { SlackIcon } from '@/components/icons/SlackIcon'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { readIpcErrorMessage } from '@/lib/ipc-error'
import { translate } from '@/i18n/i18n'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { useIntegrationSubordinateRowClass } from './integration-card-presentation'
import { PersonalTokenDialog, type PersonalTokenDialogCopy } from './personal-token-dialog'
import {
  CLICKUP_INTEGRATION_SECTION_ID,
  SLACK_INTEGRATION_SECTION_ID
} from './task-provider-integration-section-ids'
import { UnsealedCredentialNotice } from './UnsealedCredentialNotice'

type CardConfig = {
  provider: PersonalTokenProvider
  icon: React.ReactNode
  description: string
  agentHint: string
  sectionId: string
  dialog: PersonalTokenDialogCopy
}

function PersonalTokenIntegrationCard({ config }: { config: CardConfig }): React.JSX.Element {
  const service = config.dialog.service
  const mountedRef = useMountedRef()
  const subordinateRowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const [status, setStatus] = useState<PersonalTokenConnectionStatus | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  // Reads plaintext metadata only, so mounting the pane cannot trigger a keychain prompt.
  const loadStatus = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    try {
      const next = await window.api.personalTokenIntegration.status(config.provider)
      if (mountedRef.current && generation === loadGenerationRef.current) {
        setStatus(next)
        setLoadFailed(false)
      }
    } catch {
      if (mountedRef.current && generation === loadGenerationRef.current) {
        setLoadFailed(true)
      }
    }
  }, [config.provider, mountedRef])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const connected = status?.configured === true
  const identity = [status?.account, status?.workspace].filter(Boolean).join(' · ')

  const handleDisconnect = async (): Promise<void> => {
    setDisconnecting(true)
    setDisconnectError(null)
    try {
      await window.api.personalTokenIntegration.disconnect(config.provider)
    } catch (error) {
      if (mountedRef.current) {
        setDisconnectError(
          readIpcErrorMessage(error) ??
            translate(
              'auto.components.settings.personal.token.integration.cards.disconnectFailed',
              'Could not remove the saved {{service}} token.',
              { service }
            )
        )
      }
    } finally {
      if (mountedRef.current) {
        setDisconnecting(false)
      }
      void loadStatus()
    }
  }

  return (
    <IntegrationCardShell
      icon={config.icon}
      name={service}
      description={config.description}
      checking={status === null && !loadFailed}
      settingsSectionId={config.sectionId}
      statusTone={connected ? 'connected' : 'neutral'}
      statusLabel={
        loadFailed
          ? translate(
              'auto.components.settings.personal.token.integration.cards.statusUnavailable',
              'Unavailable'
            )
          : connected
            ? translate(
                'auto.components.settings.personal.token.integration.cards.statusConnected',
                'Connected'
              )
            : translate(
                'auto.components.settings.personal.token.integration.cards.statusNotConnected',
                'Not connected'
              )
      }
      actions={
        status !== null || loadFailed ? (
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected
              ? translate(
                  'auto.components.settings.personal.token.integration.cards.replaceToken',
                  'Replace token'
                )
              : translate(
                  'auto.components.settings.personal.token.integration.cards.connect',
                  'Connect'
                )}
          </Button>
        ) : null
      }
    >
      {status !== null || loadFailed ? (
        <IntegrationCardDetails>
          <UnsealedCredentialNotice
            protection={status?.credentialProtection ?? null}
            credentialName={translate(
              'auto.components.settings.personal.token.integration.cards.credentialName',
              'Your {{service}} token',
              { service }
            )}
          />
          {connected ? (
            <div className={subordinateRowClass}>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {identity || service}
              </p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                aria-label={translate(
                  'auto.components.settings.personal.token.integration.cards.disconnect',
                  'Disconnect {{service}}',
                  { service }
                )}
              >
                {disconnecting ? <LoaderCircle className="animate-spin" /> : <Unlink />}
              </Button>
            </div>
          ) : null}
          {status?.credentialError ? (
            <p role="alert" className="text-xs text-destructive">
              {status.credentialError}
            </p>
          ) : null}
          {disconnectError ? <p className="text-xs text-destructive">{disconnectError}</p> : null}
          {loadFailed ? (
            <p role="alert" className="text-xs text-destructive">
              {translate(
                'auto.components.settings.personal.token.integration.cards.statusLoadFailed',
                'Could not check for a saved {{service}} token.',
                { service }
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{config.agentHint}</p>
        </IntegrationCardDetails>
      ) : null}

      <PersonalTokenDialog
        provider={config.provider}
        copy={config.dialog}
        open={dialogOpen}
        replacing={connected}
        onOpenChange={setDialogOpen}
        onConnected={() => void loadStatus()}
      />
    </IntegrationCardShell>
  )
}

export function SlackIntegrationCard(): React.JSX.Element {
  return (
    <PersonalTokenIntegrationCard
      config={{
        provider: 'slack',
        icon: <SlackIcon className="size-5" />,
        sectionId: SLACK_INTEGRATION_SECTION_ID,
        description: translate(
          'auto.components.settings.personal.token.integration.cards.slackDescription',
          'Let agents read channels and threads, search messages, and post updates.'
        ),
        agentHint: translate(
          'auto.components.settings.personal.token.integration.cards.slackAgentHint',
          'Agents use `orca slack` commands. The guide is available with `orca skills get orca-slack`.'
        ),
        dialog: {
          service: 'Slack',
          tokenLabel: translate(
            'auto.components.settings.personal.token.integration.cards.slackTokenLabel',
            'User or bot token'
          ),
          placeholder: translate(
            'auto.components.settings.personal.token.integration.cards.slackPlaceholder',
            'xoxp-... / xoxb-...'
          ),
          instructions: [
            translate(
              'auto.components.settings.personal.token.integration.cards.slackStep1',
              'Create a Slack app for your workspace, add OAuth scopes, install it, then copy the User OAuth Token (xoxp-) or Bot User OAuth Token (xoxb-).'
            ),
            translate(
              'auto.components.settings.personal.token.integration.cards.slackStep2',
              'Scopes: channels:read, channels:history, groups:read, groups:history, users:read, chat:write. Add search:read on a user token to enable search.'
            )
          ],
          docsLabel: translate(
            'auto.components.settings.personal.token.integration.cards.slackDocs',
            'Your Slack apps'
          ),
          docsUrl: 'https://api.slack.com/apps'
        }
      }}
    />
  )
}

export function ClickUpIntegrationCard(): React.JSX.Element {
  return (
    <PersonalTokenIntegrationCard
      config={{
        provider: 'clickup',
        icon: <ClickUpIcon className="size-5" />,
        sectionId: CLICKUP_INTEGRATION_SECTION_ID,
        description: translate(
          'auto.components.settings.personal.token.integration.cards.clickupDescription',
          'Let agents read, create, and update ClickUp tasks and comments.'
        ),
        agentHint: translate(
          'auto.components.settings.personal.token.integration.cards.clickupAgentHint',
          'Agents use `orca clickup` commands. The guide is available with `orca skills get orca-clickup`.'
        ),
        dialog: {
          service: 'ClickUp',
          tokenLabel: translate(
            'auto.components.settings.personal.token.integration.cards.clickupTokenLabel',
            'Personal API token'
          ),
          placeholder: translate(
            'auto.components.settings.personal.token.integration.cards.clickupPlaceholder',
            'pk_...'
          ),
          instructions: [
            translate(
              'auto.components.settings.personal.token.integration.cards.clickupStep1',
              'In ClickUp, open your avatar > Settings > Apps, then generate or copy your personal API token.'
            ),
            translate(
              'auto.components.settings.personal.token.integration.cards.clickupStep2',
              'The token acts as you, with access to every workspace you belong to.'
            )
          ],
          docsLabel: translate(
            'auto.components.settings.personal.token.integration.cards.clickupDocs',
            'ClickUp API settings'
          ),
          docsUrl: 'https://app.clickup.com/settings/apps'
        }
      }}
    />
  )
}
