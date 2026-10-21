import { useId, useState } from 'react'
import { ExternalLink, LoaderCircle, Lock } from 'lucide-react'
import type { PersonalTokenProvider } from '../../../../shared/personal-token-integrations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMountedRef } from '@/hooks/useMountedRef'
import { readIpcErrorMessage } from '@/lib/ipc-error'
import { preventOutsideDismissWhenDirty } from '@/lib/outside-dismiss-guard'
import { translate } from '@/i18n/i18n'

export type PersonalTokenDialogCopy = {
  service: string
  tokenLabel: string
  placeholder: string
  instructions: string[]
  docsLabel: string
  docsUrl: string
}

export function PersonalTokenDialog(props: {
  provider: PersonalTokenProvider
  copy: PersonalTokenDialogCopy
  open: boolean
  replacing: boolean
  onOpenChange: (open: boolean) => void
  onConnected: () => void
}): React.JSX.Element {
  const { copy } = props
  const mountedRef = useMountedRef()
  const inputId = useId()
  const errorId = useId()
  const [draft, setDraft] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setDraft('')
    setError(null)
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (connecting) {
      return
    }
    if (!nextOpen) {
      reset()
    }
    props.onOpenChange(nextOpen)
  }

  // Why: a stray backdrop click must not discard a pasted token.
  const guardOutsideDismiss = preventOutsideDismissWhenDirty(() => draft !== '')

  const handleConnect = async (): Promise<void> => {
    const token = draft.trim()
    if (!token || connecting) {
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const result = await window.api.personalTokenIntegration.connect(props.provider, token)
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        reset()
        props.onOpenChange(false)
        props.onConnected()
        return
      }
      setError(result.error)
    } catch (caught) {
      if (mountedRef.current) {
        setError(
          readIpcErrorMessage(caught) ??
            translate('auto.components.settings.personal.token.dialog.failed', 'Connection failed')
        )
      }
    } finally {
      if (mountedRef.current) {
        setConnecting(false)
      }
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={guardOutsideDismiss}
        onInteractOutside={guardOutsideDismiss}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && draft.trim() && !connecting) {
            event.preventDefault()
            void handleConnect()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {props.replacing
              ? translate(
                  'auto.components.settings.personal.token.dialog.replaceTitle',
                  'Replace {{service}} token',
                  { service: copy.service }
                )
              : translate(
                  'auto.components.settings.personal.token.dialog.connectTitle',
                  'Connect {{service}}',
                  { service: copy.service }
                )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.settings.personal.token.dialog.description',
              'Orca checks the token with {{service}} before saving it. Agents then use it through the orca CLI.',
              { service: copy.service }
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={inputId}>{copy.tokenLabel}</Label>
            <Input
              id={inputId}
              autoFocus
              type="password"
              placeholder={copy.placeholder}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setError(null)
              }}
              disabled={connecting}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {error ? (
            <p id={errorId} className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            {copy.instructions.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              onClick={() => window.api.shell.openUrl(copy.docsUrl)}
            >
              <ExternalLink className="size-3" />
              {copy.docsLabel}
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Lock className="size-3 shrink-0" />
            {translate(
              'auto.components.settings.personal.token.dialog.storage',
              'Stored on this device using Electron encrypted storage when available.'
            )}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={connecting}>
            {translate('auto.components.settings.personal.token.dialog.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleConnect()} disabled={!draft.trim() || connecting}>
            {connecting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {translate(
                  'auto.components.settings.personal.token.dialog.verifying',
                  'Verifying...'
                )}
              </>
            ) : props.replacing ? (
              translate('auto.components.settings.personal.token.dialog.replace', 'Replace token')
            ) : (
              translate('auto.components.settings.personal.token.dialog.connect', 'Connect')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
