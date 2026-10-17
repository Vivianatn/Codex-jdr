/**
 * Administration dashboard API (D-275): the shapes the server sends at
 * /api/admin/* and the dashboard (`src/admin/`) reads. Dates are ISO strings.
 */

export interface AdminStats {
  users: { total: number; new7: number; new30: number; suspended: number; hidden: number }
  campaigns: { total: number; live: number; liveOnline: number; listed: number }
  members: number
  openReports: number
  /** Sign-ups per day over the last 30 days (UTC), oldest first. */
  signups: { day: string; count: number }[]
}

export interface AdminProfile {
  displayName: string
  bio: string
  avatar: string | null
  banner: string | null
}

export interface AdminReport {
  id: string
  reference: string
  category: string
  explanation: string
  status: 'open' | 'actioned' | 'dismissed'
  decision: string | null
  createdAt: string
  decidedAt: string | null
  /** The profile as it was when reported. */
  snapshot: AdminProfile
  target: {
    id: string
    /** Null once the account is deleted. */
    displayName: string | null
    suspended: boolean
    profileHidden: boolean
  }
  /** Null for an anonymous report or a deleted reporter. */
  reporter: { id: string; displayName: string } | null
}

export interface AdminUserRow {
  id: string
  displayName: string
  email: string
  friendCode: string | null
  createdAt: string
  lastLoginAt: string | null
  suspended: boolean
  profileHidden: boolean
}

export interface AdminUserDetail extends AdminUserRow {
  profile: AdminProfile
  termsVersion: string | null
  termsAcceptedAt: string | null
  campaignsOwned: number
  memberships: number
  reportsAgainst: number
  openReportsAgainst: number
  reportsFiled: number
  online: boolean
}

export interface AdminCampaignRow {
  id: string
  name: string
  owner: { id: string; displayName: string }
  members: number
  live: 'online' | 'local' | null
  listed: boolean
  createdAt: string
}

export interface AdminAuditRow {
  id: string
  actor: string
  action: AdminAction
  targetType: 'user' | 'report' | null
  targetId: string | null
  targetLabel: string | null
  detail: Record<string, unknown> | null
  at: string
}

export type AdminAction =
  | 'login'
  | 'loginFailed'
  | 'logout'
  | 'hideProfile'
  | 'restoreProfile'
  | 'suspend'
  | 'unsuspend'
  | 'dismiss'
  | 'deleteAccount'

/** A moderation decision as the dashboard sends it (moderation.ts `Decision`). */
export interface AdminDecision {
  reason: string
  illegal: boolean
  reportId?: string
}

export const ADMIN_REASON_MIN = 10
export const ADMIN_REASON_MAX = 2000
