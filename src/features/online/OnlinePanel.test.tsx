import * as Tooltip from '@radix-ui/react-tooltip'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnlineStore } from '@/online/onlineStore'
import { server } from '@/online/server/api'
import type { MemberInfo, MemberRole } from '@shared/sync'
import { Members } from './OnlinePanel'

const members: MemberInfo[] = [
  { userId: 'u-owner', displayName: 'Agathe', role: 'owner', characterId: null },
  { userId: 'u-gm', displayName: 'Bastien', role: 'editor', characterId: null },
  { userId: 'u-lyra', displayName: 'Chloé', role: 'player', characterId: null },
]

const renderMembers = (selfId: string, role: MemberRole) => {
  useOnlineStore.setState({ selfId })
  render(
    <Tooltip.Provider>
      <MemoryRouter>
        <Members campaignId="camp-1" role={role} />
      </MemoryRouter>
    </Tooltip.Provider>,
  )
}
const row = async (name: string) =>
  (await screen.findAllByTestId('member')).find((li) => li.textContent?.includes(name))!

let initialSelf: string
beforeEach(() => {
  initialSelf = useOnlineStore.getState().selfId
  vi.spyOn(server, 'members').mockResolvedValue({ members })
})
afterEach(() => {
  vi.restoreAllMocks()
  useOnlineStore.setState({ selfId: initialSelf })
})

describe('campaign members (D-274)', () => {
  it('a GM names players GM and demotes other GMs, never the main GM nor themselves', async () => {
    renderMembers('u-gm', 'editor')
    const update = vi.spyOn(server, 'updateMember').mockResolvedValue({})
    expect(within(await row('Agathe')).queryByRole('button', { name: /MJ|joueur/ })).toBeNull()
    expect(within(await row('Agathe')).getByText('MJ principal')).toBeVisible()
    expect(
      within(await row('Bastien')).queryByRole('button', { name: 'Repasser joueur' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Transmettre la campagne' })).toBeNull()

    await userEvent.click(within(await row('Chloé')).getByRole('button', { name: 'Nommer MJ' }))
    expect(update).toHaveBeenCalledWith('camp-1', 'u-lyra', { role: 'editor' })
  })

  it('the main GM demotes or hands over after confirming', async () => {
    renderMembers('u-owner', 'owner')
    const update = vi.spyOn(server, 'updateMember').mockResolvedValue({})
    const transfer = vi.spyOn(server, 'transferCampaign').mockResolvedValue({})
    const gm = await row('Bastien')
    expect(within(gm).getByText('MJ')).toBeVisible()

    await userEvent.click(within(gm).getByRole('button', { name: 'Repasser joueur' }))
    expect(update).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(update).toHaveBeenCalledWith('camp-1', 'u-gm', { role: 'player' })

    await userEvent.click(within(gm).getByRole('button', { name: 'Transmettre la campagne' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Transmettre la campagne à Bastien ?')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    expect(transfer).toHaveBeenCalledWith('camp-1', 'u-gm')
  })
})
