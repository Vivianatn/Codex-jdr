import type {
  ApiErrorCode,
  CampaignSummary,
  InvitePreview,
  JoinRequestInfo,
  MemberInfo,
  MemberRole,
  PublicUser,
  TableChanges,
} from '@shared/sync'

/**
 * Codex's online server (D-262), at /api on the same origin. The session is an
 * HttpOnly cookie the browser sends by itself: this code never sees it.
 */

export type ClientErrorCode = ApiErrorCode | 'offline'

export class ApiError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    readonly status = 0,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(`API error: ${code}`)
    this.name = 'ApiError'
  }
}

/** Identifies this open app, so the server does not send back what it wrote itself. */
export const DEVICE_ID = crypto.randomUUID()

/** Swappable for tests (the real server through `app.inject`). */
let transport: typeof fetch = (...args) => fetch(...args)
export function setApiTransport(next: typeof fetch): void {
  transport = next
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await transport(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        'x-codex-device': DEVICE_ID,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('offline')
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  if (!response.ok) {
    const record = (data ?? {}) as Record<string, unknown>
    const code = typeof record.error === 'string' ? (record.error as ApiErrorCode) : 'server'
    // A proxy answering without the server behind it (deployment, restart).
    throw new ApiError(
      response.status >= 502 && !record.error ? 'offline' : code,
      response.status,
      record,
    )
  }
  return data as T
}

export interface MyRequest {
  id: string
  campaignId: string
  campaignName: string
  ownerName: string
  createdAt: number
}

/** The calls the app makes, typed. */
export const server = {
  me: () => api<{ user: PublicUser }>('GET', '/auth/me'),
  register: (input: { email: string; displayName: string; password: string }) =>
    api<{ user: PublicUser }>('POST', '/auth/register', input),
  login: (email: string, password: string) =>
    api<{ user: PublicUser }>('POST', '/auth/login', { email, password }),
  logout: () => api('POST', '/auth/logout', {}),
  changePassword: (current: string, next: string) =>
    api('POST', '/auth/password', { current, next }),
  requestReset: (email: string) => api('POST', '/auth/reset/request', { email }),
  confirmReset: (token: string, password: string) =>
    api<{ user: PublicUser }>('POST', '/auth/reset/confirm', { token, password }),
  rename: (displayName: string) => api<{ user: PublicUser }>('PATCH', '/account', { displayName }),
  deleteAccount: (password: string) => api('DELETE', '/account', { password }),

  campaigns: () => api<{ campaigns: CampaignSummary[] }>('GET', '/campaigns'),
  putCampaign: (id: string, name: string) => api('PUT', `/campaigns/${id}`, { name }),
  deleteCampaign: (id: string) => api('DELETE', `/campaigns/${id}`),
  leaveCampaign: (id: string) => api('DELETE', `/campaigns/${id}/members/me`),
  members: (id: string) => api<{ members: MemberInfo[] }>('GET', `/campaigns/${id}/members`),
  updateMember: (
    id: string,
    userId: string,
    patch: { role?: Exclude<MemberRole, 'owner'>; characterId?: string | null },
  ) => api('PATCH', `/campaigns/${id}/members/${userId}`, patch),
  removeMember: (id: string, userId: string) => api('DELETE', `/campaigns/${id}/members/${userId}`),
  sharing: (id: string) =>
    api<{ inviteCode: string | null; listed: boolean }>('GET', `/campaigns/${id}/sharing`),
  newInvite: (id: string, disable = false) =>
    api<{ inviteCode: string | null }>('POST', `/campaigns/${id}/invite`, { disable }),
  setListed: (id: string, listed: boolean) =>
    api<{ listed: boolean }>('PATCH', `/campaigns/${id}/sharing`, { listed }),
  invite: (code: string) => api<InvitePreview>('GET', `/invites/${encodeURIComponent(code)}`),
  requestByInvite: (code: string, message: string) =>
    api<{ campaignId: string }>('POST', `/invites/${encodeURIComponent(code)}/request`, {
      message,
    }),
  search: (q: string) =>
    api<{ results: InvitePreview[] }>('GET', `/search?q=${encodeURIComponent(q)}`),
  requestListed: (id: string, message: string) =>
    api<{ campaignId: string }>('POST', `/campaigns/${id}/requests`, { message }),
  requests: (id: string) =>
    api<{ requests: JoinRequestInfo[] }>('GET', `/campaigns/${id}/requests`),
  myRequests: () => api<{ requests: MyRequest[] }>('GET', '/requests'),
  accept: (
    id: string,
    requestId: string,
    role: Exclude<MemberRole, 'owner'>,
    characterId: string | null,
  ) => api('POST', `/campaigns/${id}/requests/${requestId}/accept`, { role, characterId }),
  decline: (id: string, requestId: string) =>
    api('DELETE', `/campaigns/${id}/requests/${requestId}`),

  pull: (id: string, since: number) =>
    api<{ changes: TableChanges[]; rev: number; more: boolean }>(
      'GET',
      `/campaigns/${id}/changes?since=${since}`,
    ),
  push: (id: string, changes: TableChanges[]) =>
    api<{
      rev: number
      corrected: TableChanges[]
      refused: { table: string; id: string; reason: string }[]
      current: TableChanges[]
    }>('POST', `/campaigns/${id}/changes`, { changes }),
}
