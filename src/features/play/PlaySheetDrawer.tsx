import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { IconButton } from '@/components/ui/Button'
import { entityName } from '@/domain/entity'
import { ownerOptions } from '@/domain/familiars'
import { BodyImage } from '@/features/characters/BodyPicker'
import { CharacterSheet, CopyForDiscordButton } from '@/features/characters/CharacterSheet'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { useCampaignStore } from '@/stores/campaignStore'
import { useUiStore } from '@/stores/uiStore'

/**
 * A character sheet sliding over the map (SPEC §8.3): the GM never leaves the
 * play screen. Pinning several sheets side by side comes with phase 5.
 */
export function PlaySheetDrawer() {
  const t = useT()
  const campaign = useCampaign()
  const id = useUiStore((s) => s.playSheetId)
  const close = useUiStore((s) => s.openPlaySheet)
  const entity = useCampaignStore((s) => (id ? s.entities[id] : undefined))
  const all = useCampaignStore((s) => s.entities)
  const updateEntity = useCampaignStore((s) => s.updateEntity)
  const owners = useMemo(() => ownerOptions(Object.values(all)), [all])

  useEffect(() => {
    if (!id) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]'))
        close(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, close])

  if (!entity) return null
  return (
    <motion.aside
      key={entity.id}
      aria-label={t.sheet.open(entityName(entity))}
      className="fixed top-14 right-0 bottom-0 z-40 w-full max-w-4xl overflow-y-auto border-l border-line bg-surface p-5 shadow-overlay"
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <IconButton
        label={t.common.close}
        icon={<X />}
        className="float-right -mt-1"
        onClick={() => close(null)}
      />
      <div className="flex gap-5">
        {/* The character's body "in play" (portrait stays in the sheet header). */}
        <BodyImage
          src={entity.identity.body}
          className="sticky top-0 hidden h-[28rem] w-44 shrink-0 md:flex"
        />
        <div className="min-w-0 flex-1">
          <CharacterSheet
            entity={entity}
            rules={campaign.rules}
            onChange={(recipe, label) => updateEntity(entity.id, recipe, label)}
            context={{ owners }}
            kindLabel={t.kinds[entity.kind]}
            defaultTab="stats"
            actions={<CopyForDiscordButton entity={entity} rules={campaign.rules} />}
          />
        </div>
      </div>
    </motion.aside>
  )
}
