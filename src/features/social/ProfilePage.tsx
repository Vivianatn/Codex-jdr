import { ArrowLeft, Pencil, ScrollText, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { LogoMark, Ornament, Wordmark } from '@/components/Brand'
import { Button, IconButton } from '@/components/ui/Button'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/Tabs'
import { AccountSection } from '@/features/account/AccountSection'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { AppHeader } from '@/features/shell/AppHeader'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import { refreshSocial } from '@/online/controller'
import { server } from '@/online/server/api'
import { useServerStore } from '@/online/server/serverStore'
import type { AdventurerProfile } from '@shared/sync'
import { AdventurersPanel } from './AdventurersPanel'
import { ProfileCard } from './ProfileCard'
import { ProfileEditor } from './ProfileEditor'
import { RelationButton } from './RelationButton'
import { usePendingAdventurers, useRelation } from './socialState'

/** `#/profil`: one's own profile, adventurers and account; `#/profil/:userId`: someone else's (D-267). */
export function ProfilePage() {
  const { userId } = useParams()
  const selfId = useServerStore((s) => s.user?.id)
  useEffect(() => {
    void refreshSocial()
  }, [])
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader start={<HomeLink />} />
      <PageTransition>
        <main id="main" className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8 sm:py-12">
          {!userId || userId === selfId ? <OwnProfile /> : <OtherProfile userId={userId} />}
        </main>
      </PageTransition>
    </div>
  )
}

function HomeLink() {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div className="flex min-w-0 items-center gap-2">
      <IconButton
        label={t.nav.backToCampaigns}
        icon={<ArrowLeft />}
        onClick={() => navigate('/')}
      />
      <Link to="/" className="flex items-center gap-2.5" aria-label={t.nav.backToCampaigns}>
        <LogoMark />
        <span className="hidden sm:inline">
          <Wordmark />
        </span>
      </Link>
    </div>
  )
}

function OwnProfile() {
  const t = useT()
  const profile = useServerStore((s) => s.profile)
  const status = useServerStore((s) => s.status)
  const pending = usePendingAdventurers()
  const [editing, setEditing] = useState(false)
  return (
    <div className="space-y-8">
      {profile ? (
        <>
          <ProfileCard
            profile={profile}
            actions={
              <Button icon={<Pencil />} onClick={() => setEditing(true)}>
                {t.adventurers.edit}
              </Button>
            }
          />
          <ProfileEditor profile={profile} open={editing} onOpenChange={setEditing} />
        </>
      ) : (
        status === 'offline' && <p className="text-ink-muted">{t.adventurers.offline}</p>
      )}
      <Tabs defaultValue="adventurers">
        <TabList label={t.adventurers.profileTitle}>
          <Tab value="adventurers">
            <Users aria-hidden />
            {t.adventurers.tabAdventurers}
            {pending > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs text-on-accent tabular-nums">
                {pending}
              </span>
            )}
          </Tab>
          <Tab value="account">
            <UserRound aria-hidden />
            {t.adventurers.tabAccount}
          </Tab>
        </TabList>
        <TabPanel value="adventurers">
          <AdventurersPanel />
        </TabPanel>
        <TabPanel value="account">
          <div className="max-w-xl rounded-lg border border-line bg-surface p-5">
            <AccountSection />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function OtherProfile({ userId }: { userId: string }) {
  const t = useT()
  const [profile, setProfile] = useState<AdventurerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Read again when the bond changes (the friend count follows).
  const relation = useRelation(userId)
  useEffect(() => {
    let alive = true
    server.adventurer(userId).then(
      (r) => alive && setProfile(r.profile),
      (e: unknown) => alive && setError(onlineErrorMessage(t, e)),
    )
    return () => {
      alive = false
    }
  }, [userId, relation, t])
  if (error)
    return (
      <div className="space-y-4">
        <p className="text-ink">{t.adventurers.notFound}</p>
        <BackToMine />
      </div>
    )
  if (!profile) return null
  return (
    <div className="space-y-6">
      <ProfileCard profile={profile} actions={<RelationButton user={profile} />} />
      <BackToMine />
    </div>
  )
}

function BackToMine() {
  const t = useT()
  return (
    <Link
      to="/profil"
      className="inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:underline"
    >
      <ScrollText className="size-4" aria-hidden />
      {t.adventurers.backToMine}
    </Link>
  )
}

/** `#/aventurier/:code`: a shared adventurer link opens that profile. */
export function AdventurerLinkPage() {
  const t = useT()
  const { code = '' } = useParams()
  const [target, setTarget] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    server.adventurerByCode(code).then(
      (r) => setTarget(r.profile.id),
      () => setFailed(true),
    )
  }, [code])
  if (target) return <Navigate to={`/profil/${target}`} replace />
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader start={<HomeLink />} />
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 py-14">
        <h1 className="type-screen-title text-ink">{t.adventurers.linkTitle}</h1>
        <Ornament className="mt-4 mb-6" />
        <p className="text-ink-muted">
          {failed ? t.adventurers.notFound : t.adventurers.linkLoading}
        </p>
      </main>
    </div>
  )
}
