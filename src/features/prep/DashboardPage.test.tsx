import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import type { ActivityRecord } from '@/domain/activity'
import { createEntity } from '@/domain/entity'
import { newMap } from '@/domain/maps'
import { HOST_ID } from '@/domain/turns'
import { defaultRules } from '@/rules'
import { flushActivity } from '@/stores/activityLog'
import { useCampaignStore } from '@/stores/campaignStore'
import { useRollStore } from '@/stores/rollStore'
import { renderApp } from '@/test/renderApp'

beforeEach(async () => {
  await useCampaignStore.getState().unload()
  useRollStore.setState({ campaignId: null, rolls: [] })
  for (const table of activeDb().tables) await table.clear()
})

function line(campaignId: string, author: ActivityRecord['author'], label: string, at: number) {
  return { id: crypto.randomUUID(), campaignId, at, author, kind: 'do', label, count: 1 } as const
}

describe('dashboard', () => {
  it('shows the campaign figures, the party and what each editor did', async () => {
    const campaign = await campaignRepository.create({ name: 'Ombreval' })
    const rules = defaultRules()
    const lyra = createEntity('player', campaign.id, rules, { identity: { pseudo: 'Lyra' } })
    const goule = createEntity('enemy', campaign.id, rules, { identity: { pseudo: 'Goule' } })
    await activeDb().entities.bulkAdd([lyra, goule])
    await activeDb().maps.add(newMap(campaign.id, { name: 'Crypte' }))
    const now = Date.now()
    await activeDb().activity.bulkAdd([
      line(campaign.id, { id: HOST_ID, name: 'MJ' }, 'Création de Lyra', now - 60_000),
      {
        ...line(campaign.id, { id: 'p1', name: 'Agathe' }, 'Carte « Crypte » modifiée', now),
        count: 3,
      },
    ])

    const { user } = renderApp(`/c/${campaign.id}/prep/dashboard`)
    const figures = await screen.findByRole('region', { name: 'Le registre' })
    await waitFor(() =>
      expect(within(figures).getByRole('link', { name: /Joueurs/ })).toHaveTextContent('1'),
    )
    expect(within(figures).getByRole('link', { name: /Ennemis en jeu/ })).toHaveTextContent('1')
    expect(within(figures).getByRole('link', { name: /Cartes/ })).toHaveTextContent('1')
    expect(
      within(screen.getByRole('region', { name: 'Le groupe' })).getByText('Lyra'),
    ).toBeVisible()

    const log = await screen.findByTestId('activity-log')
    const rows = within(log).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Agathe')
    expect(rows[0]).toHaveTextContent('Carte « Crypte » modifiée× 3')
    expect(rows[1]).toHaveTextContent('MJ (toi)')

    await user.click(screen.getByRole('radio', { name: 'Agathe' }))
    expect(within(screen.getByTestId('activity-log')).getAllByRole('listitem')).toHaveLength(1)
  })

  it('logs the GM’s own changes as they happen', async () => {
    const campaign = await campaignRepository.create({ name: 'Ombreval' })
    const lyra = createEntity('player', campaign.id, defaultRules(), {
      identity: { pseudo: 'Lyra' },
    })
    await activeDb().entities.add(lyra)
    renderApp(`/c/${campaign.id}/prep/dashboard`)
    await screen.findByText('Lyra')
    useCampaignStore.getState().updateEntity(lyra.id, (e) => ({ ...e, level: 3 }), 'Lyra niveau 3')
    await flushActivity()
    expect(
      await within(await screen.findByTestId('activity-log')).findByText('Lyra niveau 3'),
    ).toBeVisible()
  })
})
