import { beforeEach, describe, expect, it } from 'vitest'
import { bestiaryRepository } from '@/db/bestiary'
import { campaignRepository } from '@/db/campaigns'
import { activeDb } from '@/db/db'
import { sessionRepository } from '@/db/sessions'
import { createEntity } from '@/domain/entity'
import { newMap } from '@/domain/maps'
import { newSessionPlan } from '@/domain/sessions'
import { HOST_ID } from '@/domain/turns'
import { getMessages } from '@/i18n'
import { useOnlineStore } from '@/online/onlineStore'
import { defaultRules } from '@/rules'
import { campaignHistory, useCampaignStore } from '@/stores/campaignStore'
import { createLiveActions } from './liveActions'

const t = getMessages()
const store = () => useCampaignStore.getState()

beforeEach(async () => {
  await store().unload()
  useOnlineStore.setState({ selfId: HOST_ID })
  for (const table of activeDb().tables) await table.clear()
})

async function setup() {
  const campaign = await campaignRepository.create({ name: 'Ombreval' })
  const goule = createEntity('enemy', campaign.id, defaultRules(), {
    identity: { pseudo: 'Goule' },
    level: 2,
    hpMax: 22,
  })
  await bestiaryRepository.save(goule)
  const map = newMap(campaign.id, { name: 'Crypte' })
  await activeDb().maps.add(map)
  const plan = {
    ...newSessionPlan(campaign.id, 'La crypte'),
    mapIds: [map.id],
    objectives: [{ id: 'o1', text: 'Trouver Brann' }],
    encounters: [{ id: 'e1', templateId: goule.id, count: 2 }],
  }
  await sessionRepository.savePlan(plan)
  await store().load(campaign.id)
  return { campaign, plan, map, actions: createLiveActions(t, campaign) }
}

describe('starting and ending a game (D-244)', () => {
  it('starts from a plan: run, map, numbered enemies in a group, the starter operates', async () => {
    const { plan, map, actions } = await setup()
    const run = await actions.start({ planId: plan.id, mode: 'local' })

    expect(run).toMatchObject({ planId: plan.id, title: 'La crypte', mode: 'local', endedAt: null })
    const { play, entities } = store()
    expect(play.live).toMatchObject({ runId: run!.id, operator: { id: HOST_ID } })
    expect(play.mapId).toBe(map.id)
    const names = Object.values(entities).map((e) => e.identity.pseudo)
    expect(names.sort()).toEqual(['Goule 1', 'Goule 2'])
    expect(play.groups).toHaveLength(1)
    expect(play.groups[0]!.memberIds).toHaveLength(2)
    expect((await sessionRepository.getPlan(plan.id))?.timesPlayed).toBe(1)
    // A checkpoint: nothing to undo across the start.
    expect(campaignHistory.getState().past).toHaveLength(0)
    // One game at a time.
    expect(await actions.start({ planId: null, mode: 'local' })).toBeNull()
  })

  it('tracks objectives per run, hands over, and ends into the history', async () => {
    const { plan, actions } = await setup()
    const run = (await actions.start({ planId: plan.id, mode: 'online' }))!
    await actions.toggleObjective('o1')
    await actions.saveRunNotes('Brann est sauvé.')
    await actions.handOver({ id: 'peer-1', name: 'Agathe' })
    expect(store().play.live?.operator).toEqual({ id: 'peer-1', name: 'Agathe' })

    await actions.end()
    expect(store().play.live).toBeNull()
    const saved = await sessionRepository.getRun(run.id)
    expect(saved).toMatchObject({
      objectivesDone: ['o1'],
      notes: 'Brann est sauvé.',
      operators: ['MJ', 'Agathe'],
    })
    expect(saved?.endedAt).toBeGreaterThan(0)
    // The plan itself is untouched, ready to be played again.
    expect((await sessionRepository.getPlan(plan.id))?.objectives).toEqual(plan.objectives)
  })

  it('a free game needs no plan', async () => {
    const { actions } = await setup()
    const run = await actions.start({ planId: null, mode: 'local' })
    expect(run?.title).toBe('Partie libre')
    expect(store().play.groups).toEqual([])
  })
})
