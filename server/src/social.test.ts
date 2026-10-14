import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AdventurerProfile, FriendsList } from '../../shared/sync.ts'
import { campaignWith, signUp, socket, testServer, type Agent } from './testing.ts'

// 1×1 transparent PNG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

let server: Awaited<ReturnType<typeof testServer>>
let ysolde: Agent
let bran: Agent
beforeEach(async () => {
  server = await testServer()
  ysolde = await signUp(server.app, 'Ysolde')
  bran = await signUp(server.app, 'Bran')
})
afterEach(() => server.close())

const profileOf = async (viewer: Agent, id: string) =>
  (await viewer.request<{ profile: AdventurerProfile }>('GET', `/api/adventurers/${id}`)).body
    .profile
const friends = async (a: Agent) => (await a.request<FriendsList>('GET', '/api/friends')).body

describe('profiles (D-267)', () => {
  it('edits name, motto, picture and banner, and serves the pictures as files', async () => {
    const { status, body } = await ysolde.request<{ profile: AdventurerProfile }>(
      'PATCH',
      '/api/profile',
      { displayName: 'Ysolde la Grise', bio: 'Toujours un pas devant.', avatar: PNG, banner: PNG },
    )
    expect(status).toBe(200)
    expect(body.profile).toMatchObject({
      displayName: 'Ysolde la Grise',
      bio: 'Toujours un pas devant.',
      relation: 'self',
    })
    expect(body.profile.code).toMatch(/^[A-Z2-9]{8}$/)
    expect(body.profile.avatar).toMatch(/^\/api\/users\/[\w-]+\/avatar\?v=1$/)

    const image = await server.app.inject({
      method: 'GET',
      url: body.profile.avatar!,
      headers: { cookie: bran.cookie },
    })
    expect(image.statusCode).toBe(200)
    expect(image.headers['content-type']).toBe('image/png')
    expect(image.rawPayload.subarray(1, 4).toString()).toBe('PNG')

    // Someone else sees the profile, never the code.
    const seen = await profileOf(bran, ysolde.userId)
    expect(seen).toMatchObject({ displayName: 'Ysolde la Grise', relation: 'none', code: null })

    // A picture is removed with null; scripts in disguise are refused.
    await ysolde.request('PATCH', '/api/profile', { avatar: null })
    expect((await profileOf(bran, ysolde.userId)).avatar).toBeNull()
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    expect((await ysolde.request('PATCH', '/api/profile', { banner: svg })).status).toBe(400)
    expect((await ysolde.request('PATCH', '/api/profile', { displayName: ' ' })).status).toBe(400)
  })
})

describe('adventurers (D-267)', () => {
  it('a request, its acceptance, presence, then parting ways', async () => {
    const b = await socket(server.app, bran)
    expect((await ysolde.request('POST', `/api/friends/${bran.userId}`)).body).toEqual({
      relation: 'sent',
    })
    await b.next('friends')
    expect((await friends(bran)).incoming.map((f) => f.displayName)).toEqual(['Ysolde'])
    expect((await friends(ysolde)).outgoing.map((f) => f.displayName)).toEqual(['Bran'])
    expect((await profileOf(bran, ysolde.userId)).relation).toBe('received')

    // Asking back accepts.
    expect((await bran.request('POST', `/api/friends/${ysolde.userId}`)).body).toEqual({
      relation: 'friend',
    })
    expect((await friends(ysolde)).friends.map((f) => f.displayName)).toEqual(['Bran'])
    expect((await profileOf(ysolde, bran.userId)).friendCount).toBe(1)

    // Bran is connected (his socket): Ysolde sees him online, then offline when he leaves.
    expect((await friends(ysolde)).friends[0]?.online).toBe(true)
    const y = await socket(server.app, ysolde)
    b.close()
    await y.next('friends')
    expect((await friends(ysolde)).friends[0]?.online).toBe(false)
    y.close()

    await ysolde.request('DELETE', `/api/friends/${bran.userId}`)
    expect(await friends(bran)).toMatchObject({ friends: [], incoming: [], outgoing: [] })
    expect((await ysolde.request('POST', `/api/friends/${ysolde.userId}`)).status).toBe(400)
  })

  it('finds people by name, by code or by link, and suggests table companions', async () => {
    const code = (await ysolde.request<{ profile: AdventurerProfile }>('GET', '/api/profile')).body
      .profile.code!
    const search = async (q: string) =>
      (
        await bran.request<{ results: { displayName: string; relation: string }[] }>(
          'GET',
          `/api/adventurers?q=${encodeURIComponent(q)}`,
        )
      ).body.results
    expect(await search('ysol')).toEqual([expect.objectContaining({ displayName: 'Ysolde' })])
    expect(await search(`${code.slice(0, 4)}-${code.slice(4)}`)).toHaveLength(1)
    // Nobody finds themselves.
    expect(await search('bran')).toEqual([])

    const byLink = await bran.request<{ profile: AdventurerProfile }>(
      'GET',
      `/api/adventurers/code/${encodeURIComponent(`https://codex.fr/app/#/aventurier/${code}`)}`,
    )
    expect(byLink.body.profile.displayName).toBe('Ysolde')
    expect(
      (await bran.request('POST', `/api/friends/code/${code.toLowerCase()}`)).body,
    ).toMatchObject({ userId: ysolde.userId, relation: 'sent' })

    const lyra = await signUp(server.app, 'Lyra')
    await campaignWith(server.app, ysolde, [[lyra, 'player']])
    expect((await friends(lyra)).suggestions).toEqual([
      expect.objectContaining({ displayName: 'Ysolde', campaign: 'Ombreval' }),
    ])
    expect((await profileOf(lyra, ysolde.userId)).together).toEqual(['Ombreval'])
  })

  it('needs a session', async () => {
    const response = await server.app.inject({ method: 'GET', url: '/api/friends' })
    expect(response.statusCode).toBe(401)
  })
})
