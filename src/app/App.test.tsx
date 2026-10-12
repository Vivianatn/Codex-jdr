import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUiStore } from '@/stores/uiStore'
import { renderApp } from '@/test/renderApp'

beforeEach(async () => {
  await activeDb().campaigns.clear()
  useUiStore.setState({ lastPrepSection: {} })
  useSettingsStore.setState({ theme: 'light' })
})

describe('campaigns page', () => {
  it('shows a helpful empty state when there is no campaign', async () => {
    renderApp('/')
    expect(await screen.findByText('Aucune campagne pour l’instant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouvelle campagne' })).toBeInTheDocument()
  })

  it('requires a name before creating a campaign', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Nouvelle campagne' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Créer' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Donne un nom à ta campagne.')
  })

  it('creates a campaign and opens its dashboard', async () => {
    const { user, router } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Nouvelle campagne' }))
    await user.type(screen.getByLabelText('Nom'), 'La Crypte des Murmures')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'La Crypte des Murmures' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/c\/[\w-]+\/prep\/dashboard$/)
    expect(await campaignRepository.list()).toHaveLength(1)
  })

  it('lists existing campaigns', async () => {
    await campaignRepository.create({ name: 'Les Terres Brûlées', description: 'Désert' })
    renderApp('/')
    expect(await screen.findByText('Les Terres Brûlées')).toBeInTheDocument()
    expect(screen.getByText('Désert')).toBeInTheDocument()
  })
})

describe('campaign shell', () => {
  it('switches between Préparation and En jeu in one click, back to the last section', async () => {
    const campaign = await campaignRepository.create({ name: 'Mode test' })
    const { user, router } = renderApp(`/c/${campaign.id}/prep/bestiary`)

    expect(await screen.findByRole('heading', { name: 'Bestiaire' })).toBeInTheDocument()
    const modes = screen.getByRole('radiogroup', { name: 'Mode' })

    await user.click(within(modes).getByRole('radio', { name: 'En jeu' }))
    expect(await screen.findByRole('main', { name: 'Plateau de jeu' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/c/${campaign.id}/play`)

    await user.click(within(modes).getByRole('radio', { name: 'Préparation' }))
    expect(await screen.findByRole('heading', { name: 'Bestiaire' })).toBeInTheDocument()
  })

  it('does not mistake the Joueurs section for play mode', async () => {
    const campaign = await campaignRepository.create({ name: 'Joueurs' })
    const { user, router } = renderApp(`/c/${campaign.id}/prep/players`)
    const modes = await screen.findByRole('radiogroup', { name: 'Mode' })
    expect(within(modes).getByRole('radio', { name: 'Préparation' })).toBeChecked()

    await user.click(within(modes).getByRole('radio', { name: 'En jeu' }))
    expect(router.state.location.pathname).toBe(`/c/${campaign.id}/play`)
  })

  it('redirects /c/:id to the dashboard on first visit', async () => {
    const campaign = await campaignRepository.create({ name: 'Redirect' })
    const { router } = renderApp(`/c/${campaign.id}`)
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/c/${campaign.id}/prep/dashboard`),
    )
  })

  it('records when a campaign is opened', async () => {
    const campaign = await campaignRepository.create({ name: 'Ouverte' })
    renderApp(`/c/${campaign.id}/prep/dashboard`)
    await waitFor(async () =>
      expect((await campaignRepository.get(campaign.id))?.lastOpenedAt).not.toBeNull(),
    )
  })

  it('shows a not-found state for an unknown campaign', async () => {
    renderApp('/c/does-not-exist/prep/dashboard')
    expect(await screen.findByText('Campagne introuvable')).toBeInTheDocument()
  })
})

describe('preferences', () => {
  it('toggles the dark theme on <html> and persists it', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Changer de thème' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(useSettingsStore.getState().theme).toBe('dark')
    expect(localStorage.getItem('codex.settings')).toContain('"theme":"dark"')
  })

  it('applies the animation level from the settings dialog', async () => {
    const { user } = renderApp('/')
    await user.click(await screen.findByRole('button', { name: 'Ouvrir les paramètres' }))
    const dialog = await screen.findByRole('dialog', { name: 'Paramètres' })
    await user.click(within(dialog).getByRole('radio', { name: 'Réduites' }))
    expect(document.documentElement.dataset.motion).toBe('reduced')
  })
})
