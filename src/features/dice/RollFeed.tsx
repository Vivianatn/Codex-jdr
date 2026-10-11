import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { useFxStore } from '@/stores/fxStore'
import { useRollStore } from '@/stores/rollStore'
import { RollCard } from './RollCard'
import { useRollerName } from './useRollerName'

const VISIBLE_MS = 9000

/**
 * The latest roll, floating over the screen (map included) for a few seconds:
 * animated dice, result readable at once, critical effects. Non-blocking.
 */
export function RollFeed() {
  const t = useT()
  const rollId = useFxStore((s) => s.rollToAnimate)
  const record = useRollStore((s) => (rollId ? s.rolls.find((r) => r.id === rollId) : undefined))
  const nameOf = useRollerName()
  const [hiddenId, setHiddenId] = useState<string | null>(null)

  useEffect(() => {
    if (!rollId) return
    const timer = setTimeout(() => setHiddenId(rollId), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [rollId])

  const visible = record && hiddenId !== record.id
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 w-[min(22rem,calc(100vw-2rem))]">
      <div className="sr-only" aria-live="polite">
        {record ? `${record.label} : ${record.total}` : ''}
      </div>
      <AnimatePresence>
        {visible && (
          <motion.div
            key={record.id}
            className="pointer-events-auto shadow-overlay"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            data-testid="roll-feed"
          >
            <div className="relative">
              <RollCard record={record} who={nameOf(record)} animate />
              <IconButton
                label={t.dice.dismiss}
                icon={<X />}
                size="sm"
                className="absolute -top-2 -right-2 rounded-full border border-line bg-surface shadow-soft"
                onClick={() => setHiddenId(record.id)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
