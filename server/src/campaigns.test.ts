import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CampaignSummary, InvitePreview, MemberInfo } from '../../shared/sync.ts'
import { campaignWith, signUp, testServer, type Agent } from './testing.ts'

let server: Awaited<ReturnType<typeof testServer>>
let gm: Agent
let lyra: Agent
beforeEach(async () => {
  server = await testServer()
  gm = await signUp(server.app, 'Gm')
  lyra = await signUp(server.app, 'Lyra')
})
afterEach(() => server.close())

const campaigns = async (a: Agent) =>
  (await a.request<{ campaigns: CampaignSummary[] }>('GET', '/api/campaigns')).body.campaigns

describe('campaigns online', () => {
  it('puts a campaign online once; nobody else can claim its id', async () => {
    expect((await gm.request('PUT', '/api/campaigns/camp-1', { name: 'Ombreval' })).status).toBe(
      200,
    )
    expect((await gm.request('PUT', '/api/campaigns/camp-1', { name: 'Ombreval' })).status).toBe(
      200,
    )
    expect((await lyra.request('PUT', '/api/campaigns/camp-1', { name: 'Volé' })).body).toEqual({
      error: 'conflict',
    })
    expect(await campaigns(gm)).toEqual([
      {
        id: 'camp-1',
        name: 'Ombreval',
        role: 'owner',
        ownerName: 'Gm',
        characterId: null,
        live: null,
        pendingRequests: 0,
      },
    ])
    expect(await campaigns(lyra)).toEqual([])
  })

  it('joins through an invitation link: request, the GM accepts with a role and a character', async () => {
    await gm.request('PUT', '/api/campaigns/camp-1', { name: 'Ombreval' })
    const { body } = await gm.request<{ inviteCode: string }>(
      'POST',
      '/api/campaigns/camp-1/invite',
    )

    const preview = await lyra.request<InvitePreview>('GET', `/api/invites/${body.inviteCode}`)
    expect(preview.body).toEqual({
      campaignId: 'camp-1',
      campaignName: 'Ombreval',
      ownerName: 'Gm',
      status: 'none',
    })
    await lyra.request('POST', `/api/invites/${body.inviteCode}/request`, {
      message: 'Je joue Lyra !',
    })
    expect(
      (await lyra.request<InvitePreview>('GET', `/api/invites/${body.inviteCode}`)).body.status,
    ).toBe('requested')
    expect(
      (await lyra.request<{ requests: unknown[] }>('GET', '/api/requests')).body.requests,
    ).toHaveLength(1)

    expect((await campaigns(gm))[0]!.pendingRequests).toBe(1)
    const { body: list } = await gm.request<{
      requests: { id: string; displayName: string; message: string }[]
    }>('GET', '/api/campaigns/camp-1/requests')
    expect(list.requests[0]).toMatchObject({ displayName: 'Lyra', message: 'Je joue Lyra !' })
    // A player cannot see or accept requests.
    expect((await lyra.request('GET', '/api/campaigns/camp-1/requests')).status).toBe(404)

    await gm.request('POST', `/api/campaigns/camp-1/requests/${list.requests[0]!.id}/accept`, {
      role: 'player',
      characterId: 'char-lyra',
    })
    expect(await campaigns(lyra)).toEqual([
      expect.objectContaining({
        id: 'camp-1',
        role: 'player',
        characterId: 'char-lyra',
        pendingRequests: 0,
      }),
    ])
    const members = await gm.request<{ members: MemberInfo[] }>(
      'GET',
      '/api/campaigns/camp-1/members',
    )
    expect(members.body.members.map((m) => [m.displayName, m.role, m.characterId])).toEqual([
      ['Gm', 'owner', null],
      ['Lyra', 'player', 'char-lyra'],
    ])
    expect(
      (await lyra.request<InvitePreview>('GET', `/api/invites/${body.inviteCode}`)).body.status,
    ).toBe('member')
  })

  it('a new invitation code disables the previous link', async () => {
    const { inviteCode } = await campaignWith(server.app, gm)
    await gm.request('POST', '/api/campaigns/camp-1/invite')
    expect((await lyra.request('GET', `/api/invites/${inviteCode}`)).status).toBe(404)
    await gm.request('POST', '/api/campaigns/camp-1/invite', { disable: true })
    expect(
      (await gm.request<{ inviteCode: null }>('GET', '/api/campaigns/camp-1/sharing')).body
        .inviteCode,
    ).toBeNull()
  })

  it('finds only the campaigns their GM listed', async () => {
    await campaignWith(server.app, gm)
    const search = async () =>
      (await lyra.request<{ results: InvitePreview[] }>('GET', '/api/search?q=ombre')).body.results
    expect(await search()).toEqual([])
    expect((await lyra.request('POST', '/api/campaigns/camp-1/requests', {})).status).toBe(404)
    await gm.request('PATCH', '/api/campaigns/camp-1/sharing', { listed: true })
    expect(await search()).toEqual([
      { campaignId: 'camp-1', campaignName: 'Ombreval', ownerName: 'Gm', status: 'none' },
    ])
    await lyra.request('POST', '/api/campaigns/camp-1/requests', {})
    expect((await search())[0]!.status).toBe('requested')
    // Wildcards are taken literally.
    expect(
      (await lyra.request<{ results: unknown[] }>('GET', '/api/search?q=%25%25')).body.results,
    ).toEqual([])
  })

  it('every GM has the same rights, except deleting the campaign or touching the owner (D-274)', async () => {
    const cogm = await signUp(server.app, 'Cogm')
    const bob = await signUp(server.app, 'Bob')
    const { inviteCode } = await campaignWith(server.app, gm, [[cogm, 'editor']])
    await bob.request('POST', `/api/invites/${inviteCode}/request`, {})
    const { body } = await cogm.request<{ requests: { id: string }[] }>(
      'GET',
      '/api/campaigns/camp-1/requests',
    )
    const accept = await cogm.request(
      'POST',
      `/api/campaigns/camp-1/requests/${body.requests[0]!.id}/accept`,
      { role: 'editor' },
    )
    expect(accept.status).toBe(200)
    const patch = (a: Agent, who: Agent, data: object) =>
      a.request('PATCH', `/api/campaigns/camp-1/members/${who.userId}`, data)
    expect((await patch(cogm, bob, { role: 'player' })).status).toBe(200)
    expect((await patch(cogm, bob, { role: 'editor' })).status).toBe(200)
    // A GM demotes another GM, and a GM is listed or not by any GM.
    expect((await patch(bob, cogm, { role: 'player' })).status).toBe(200)
    expect((await patch(bob, cogm, { role: 'editor' })).status).toBe(200)
    expect(
      (await cogm.request('PATCH', '/api/campaigns/camp-1/sharing', { listed: true })).status,
    ).toBe(200)
    // Nobody demotes or removes the owner; only the owner deletes the campaign.
    expect((await patch(cogm, gm, { role: 'player' })).status).toBe(403)
    expect((await patch(gm, gm, { role: 'player' })).status).toBe(403)
    expect(
      (await cogm.request('DELETE', `/api/campaigns/camp-1/members/${gm.userId}`)).status,
    ).toBe(403)
    expect((await cogm.request('DELETE', '/api/campaigns/camp-1')).status).toBe(403)
    // A GM removes another GM.
    expect(
      (await cogm.request('DELETE', `/api/campaigns/camp-1/members/${bob.userId}`)).status,
    ).toBe(200)
    // A player manages nobody.
    await campaignWith(server.app, gm, [[lyra, 'player']])
    expect((await patch(lyra, cogm, { role: 'player' })).status).toBe(403)
    expect(
      (await lyra.request('PATCH', '/api/campaigns/camp-1/sharing', { listed: false })).status,
    ).toBe(403)
  })

  it('the owner hands the campaign over to another GM', async () => {
    const cogm = await signUp(server.app, 'Cogm')
    const bob = await signUp(server.app, 'Bob')
    const outsider = await signUp(server.app, 'Out')
    await campaignWith(server.app, gm, [
      [cogm, 'editor'],
      [lyra, 'player'],
    ])
    const transfer = (a: Agent, to: Agent) =>
      a.request('POST', '/api/campaigns/camp-1/transfer', { userId: to.userId })
    expect((await transfer(cogm, gm)).status).toBe(403)
    expect((await transfer(gm, lyra)).status).toBe(400)
    expect((await transfer(gm, outsider)).status).toBe(400)
    expect((await transfer(gm, gm)).status).toBe(400)
    expect((await transfer(bob, cogm)).status).toBe(404)
    expect((await transfer(gm, cogm)).status).toBe(200)

    expect((await campaigns(lyra))[0]).toMatchObject({ ownerName: 'Cogm' })
    const members = await gm.request<{ members: MemberInfo[] }>(
      'GET',
      '/api/campaigns/camp-1/members',
    )
    expect(members.body.members.map((m) => [m.displayName, m.role])).toEqual([
      ['Gm', 'editor'],
      ['Cogm', 'owner'],
      ['Lyra', 'player'],
    ])
    expect((await transfer(gm, cogm)).status).toBe(403)
    expect((await gm.request('DELETE', '/api/campaigns/camp-1')).status).toBe(403)
    expect(
      (
        await cogm.request('PATCH', `/api/campaigns/camp-1/members/${gm.userId}`, {
          role: 'player',
        })
      ).status,
    ).toBe(200)
  })

  it('a member leaves, the owner removes, nobody removes the owner', async () => {
    await campaignWith(server.app, gm, [[lyra, 'player']])
    expect(
      (await lyra.request('DELETE', `/api/campaigns/camp-1/members/${gm.userId}`)).status,
    ).toBe(403)
    expect((await gm.request('DELETE', `/api/campaigns/camp-1/members/${gm.userId}`)).status).toBe(
      403,
    )
    expect((await lyra.request('DELETE', '/api/campaigns/camp-1/members/me')).status).toBe(200)
    expect(await campaigns(lyra)).toEqual([])
  })

  it('declines or withdraws a request', async () => {
    const { inviteCode } = await campaignWith(server.app, gm)
    await lyra.request('POST', `/api/invites/${inviteCode}/request`, {})
    const { body } = await lyra.request<{ requests: { id: string }[] }>('GET', '/api/requests')
    expect(
      (await lyra.request('DELETE', `/api/campaigns/camp-1/requests/${body.requests[0]!.id}`))
        .status,
    ).toBe(200)
    expect(
      (await gm.request<{ requests: unknown[] }>('GET', '/api/campaigns/camp-1/requests')).body
        .requests,
    ).toEqual([])
  })

  it('only the owner deletes the campaign, for everyone', async () => {
    await campaignWith(server.app, gm, [[lyra, 'player']])
    expect((await lyra.request('DELETE', '/api/campaigns/camp-1')).status).toBe(403)
    expect((await gm.request('DELETE', '/api/campaigns/camp-1')).status).toBe(200)
    expect(await campaigns(lyra)).toEqual([])
  })

  it('needs a session', async () => {
    const anonymous = (await import('./testing.ts')).agent(server.app)
    expect((await anonymous.request('GET', '/api/campaigns')).body).toEqual({
      error: 'unauthenticated',
    })
  })
})
