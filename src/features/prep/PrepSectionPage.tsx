import { useParams } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'
import { BestiaryPage } from '@/features/characters/BestiaryPage'
import { CharacterListPage } from '@/features/characters/CharacterListPage'
import { ConditionsPage } from '@/features/library/ConditionsPage'
import { ItemsPage } from '@/features/library/ItemsPage'
import { SkillsPage } from '@/features/library/SkillsPage'
import { MapsPage } from '@/features/maps/MapsPage'
import { SessionsPage } from '@/features/sessions/SessionsPage'
import { RulesPage } from '@/features/rules/RulesPage'
import { PageTransition } from '@/features/shell/PageTransition'
import { useT } from '@/i18n'
import type { PrepSection } from '@/stores/uiStore'
import { DashboardPage } from './DashboardPage'
import { SECTION_ICONS, sectionLabel } from './sections'
import {
  InkwellIllustration,
  LanternIllustration,
  MedallionsIllustration,
} from '@/components/illustrations'

type PlaceholderSection = Exclude<
  PrepSection,
  | 'dashboard'
  | 'players'
  | 'allies'
  | 'bestiary'
  | 'rules'
  | 'items'
  | 'conditions'
  | 'skills'
  | 'maps'
  | 'sessions'
>

/** Routes each prep section to its page. Sections not built yet show an informative empty state. */
export function PrepSectionPage() {
  const t = useT()
  const section = useParams().section as PrepSection

  switch (section) {
    case 'dashboard':
      return <DashboardPage />
    case 'players':
      return (
        <CharacterListPage
          key="players"
          title={t.nav.players}
          emptyTitle={t.sections.players.emptyTitle}
          emptyBody={t.sections.players.emptyBody}
          illustration={<MedallionsIllustration label={t.illustrations.medallions} />}
          groups={[
            { kind: 'player', title: t.nav.players, newLabel: t.characters.newPlayer, empty: '' },
          ]}
        />
      )
    case 'allies':
      return (
        <CharacterListPage
          key="allies"
          title={t.nav.allies}
          emptyTitle={t.sections.allies.emptyTitle}
          emptyBody={t.sections.allies.emptyBody}
          illustration={<LanternIllustration label={t.illustrations.lantern} />}
          groups={[
            {
              kind: 'ally',
              title: t.characters.allies,
              newLabel: t.characters.newAlly,
              empty: t.characters.noAllies,
            },
            {
              kind: 'familiar',
              title: t.characters.familiars,
              newLabel: t.characters.newFamiliar,
              empty: t.characters.noFamiliars,
            },
          ]}
        />
      )
    case 'bestiary':
      return <BestiaryPage />
    case 'rules':
      return <RulesPage />
    case 'items':
      return <ItemsPage />
    case 'skills':
      return <SkillsPage />
    case 'conditions':
      return <ConditionsPage />
    case 'maps':
      return <MapsPage />
    case 'sessions':
      return <SessionsPage />
    default:
      return <Placeholder section={section} />
  }
}

function Placeholder({ section }: { section: PlaceholderSection }) {
  const t = useT()
  const Icon = SECTION_ICONS[section]
  const copy = t.sections[section]
  return (
    <PageTransition key={section} className="px-4 py-8 sm:px-8">
      <h1 className="type-screen-title text-ink">{sectionLabel(t, section)}</h1>
      <div className="h-8" aria-hidden />
      <EmptyState
        icon={<Icon />}
        illustration={<InkwellIllustration label={t.illustrations.inkwell} />}
        eyebrow={sectionLabel(t, section)}
        title={copy.emptyTitle}
        body={copy.emptyBody}
      />
    </PageTransition>
  )
}
