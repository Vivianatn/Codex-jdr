import { lazy, Suspense, useState, type ComponentType } from 'react'

/**
 * Every screen behind the lock screen loads on demand (D-255): the lock screen
 * only needs the account code, so it shows without downloading the game.
 * `preloadScreens()` fetches the first screens while the GM types the password.
 * Each screen has its own Suspense boundary, so the layout around it stays up.
 * Once its code is there, a screen renders directly: `lazy` would suspend it
 * once more, and React holds a revealed fallback for up to 500 ms per level.
 */
function screen<P extends object>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null
  const once = () => (pending ??= load().then((component) => (loaded = component)))
  // A lazy component renders with the props of the component it wraps.
  const Lazy = lazy(() =>
    once().then((component) => ({ default: component })),
  ) as unknown as ComponentType<P>
  function Screen(props: P) {
    // Chosen at mount, so an instance never swaps (and remounts) its content.
    const [Ready] = useState(() => loaded)
    return Ready ? (
      <Ready {...props} />
    ) : (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    )
  }
  return Object.assign(Screen, { preload: once })
}

export const CampaignsPage = screen(() =>
  import('@/features/campaigns/CampaignsPage').then((m) => m.CampaignsPage),
)
export const InvitePage = screen(() =>
  import('@/features/online/InvitePage').then((m) => m.InvitePage),
)
export const ProfilePage = screen(() =>
  import('@/features/social/ProfilePage').then((m) => m.ProfilePage),
)
export const AdventurerLinkPage = screen(() =>
  import('@/features/social/ProfilePage').then((m) => m.AdventurerLinkPage),
)
export const ResetPasswordPage = screen(() =>
  import('@/features/account/ResetPasswordPage').then((m) => m.ResetPasswordPage),
)
export const PlayerScreen = screen(() =>
  import('@/features/online/PlayerScreen').then((m) => m.PlayerScreen),
)
export const CampaignLayout = screen(() =>
  import('@/features/shell/CampaignLayout').then((m) => m.CampaignLayout),
)
export const PrepLayout = screen(() =>
  import('@/features/prep/PrepLayout').then((m) => m.PrepLayout),
)
export const PrepSectionPage = screen(() =>
  import('@/features/prep/PrepSectionPage').then((m) => m.PrepSectionPage),
)
export const PlayLayout = screen(() =>
  import('@/features/play/PlayLayout').then((m) => m.PlayLayout),
)
export const SessionEditor = screen(() =>
  import('@/features/sessions/SessionEditor').then((m) => m.SessionEditor),
)
export const EntitySheetPage = screen(() =>
  import('@/features/characters/SheetPages').then((m) => m.EntitySheetPage),
)
export const TemplateSheetPage = screen(() =>
  import('@/features/characters/SheetPages').then((m) => m.TemplateSheetPage),
)
export const CreationWizard = screen(() =>
  import('@/features/characters/wizard/CreationWizard').then((m) => m.CreationWizard),
)
// The map screens carry Konva.
export const MapEditorPage = screen(() =>
  import('@/features/maps/MapEditorPage').then((m) => m.MapEditorPage),
)
export const PlayerView = screen(() =>
  import('@/features/maps/PlayerView').then((m) => m.PlayerView),
)

/** What the GM sees right after unlocking: campaigns list, a campaign's prep, the sheets. */
export function preloadScreens(): void {
  const first = [CampaignsPage, CampaignLayout, PrepLayout, PrepSectionPage, EntitySheetPage]
  for (const s of first) void s.preload()
}
