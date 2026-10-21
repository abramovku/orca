/**
 * Settings → Integrations shows Slack and ClickUp cards, and their token dialogs keep a pasted
 * token across a backdrop click while Cancel discards it.
 */

import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { dismissTransientAnnouncement } from './helpers/ssh-config-host-picker'
import { waitForSessionReady } from './helpers/store'

async function openIntegrationsSettings(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    // Why: the spec asserts on English strings; the host may run a non-English locale.
    await store.getState().updateSettings({ uiLanguage: 'en' })
    store.getState().openSettingsTarget({ pane: 'integrations', repoId: null })
    store.getState().openSettingsPage()
  })
  await expect(page.getByPlaceholder('Search settings')).toBeVisible({ timeout: 10_000 })
  await dismissTransientAnnouncement(page)
}

test.describe('Settings Slack and ClickUp integrations', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await openIntegrationsSettings(orcaPage)
  })

  for (const service of [
    { name: 'Slack', section: 'integrations-slack' },
    { name: 'ClickUp', section: 'integrations-clickup' }
  ]) {
    test(`${service.name} card starts disconnected and its token draft survives a backdrop click`, async ({
      orcaPage
    }) => {
      const card = orcaPage.locator(`[data-settings-section="${service.section}"]`)
      await card.scrollIntoViewIfNeeded()
      await expect(card.getByText('Not connected')).toBeVisible({ timeout: 15_000 })
      await card.getByRole('button', { name: 'Connect' }).click()

      const dialog = orcaPage.getByRole('dialog', { name: `Connect ${service.name}` })
      await expect(dialog).toBeVisible()
      const tokenInput = dialog.locator('input[type="password"]')
      await tokenInput.fill('e2e-secret')

      await orcaPage.locator('[data-slot="dialog-overlay"]').click({ position: { x: 8, y: 8 } })
      await expect(dialog).toHaveAttribute('data-state', 'open')
      await expect(tokenInput).toHaveValue('e2e-secret')

      if (process.env.ORCA_E2E_SCREENSHOT_DIR) {
        await orcaPage.screenshot({
          path: `${process.env.ORCA_E2E_SCREENSHOT_DIR}/${service.section}-dialog.png`
        })
      }

      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await expect(dialog).toBeHidden()
      await card.getByRole('button', { name: 'Connect' }).click()
      await expect(dialog.locator('input[type="password"]')).toHaveValue('')
      await dialog.getByRole('button', { name: 'Cancel' }).click()

      if (process.env.ORCA_E2E_SCREENSHOT_DIR) {
        await card.screenshot({
          path: `${process.env.ORCA_E2E_SCREENSHOT_DIR}/${service.section}-card.png`
        })
      }
    })
  }
})
