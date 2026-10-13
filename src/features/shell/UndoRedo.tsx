import { Redo2, Undo2 } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useStore } from 'zustand'
import { IconButton } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { isTypingTarget } from '@/lib/dom'
import { campaignHistory } from '@/stores/campaignStore'

/** Header undo/redo buttons + Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (outside text fields). */
export function UndoRedo() {
  const t = useT()
  const past = useStore(campaignHistory, (s) => s.past)
  const future = useStore(campaignHistory, (s) => s.future)

  useEffect(() => {
    const undo = () => {
      const entry = campaignHistory.getState().past.at(-1)
      if (!entry) return
      campaignHistory.getState().undo()
      toast(t.history.undone(entry.label))
    }
    const redo = () => {
      const entry = campaignHistory.getState().future.at(-1)
      if (!entry) return
      campaignHistory.getState().redo()
      toast(t.history.redone(entry.label))
    }
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [t])

  const lastPast = past.at(-1)
  const lastFuture = future.at(-1)
  return (
    <div className="mr-1 flex items-center">
      <IconButton
        label={lastPast ? `${t.history.undo} — ${lastPast.label}` : t.history.undo}
        icon={<Undo2 />}
        disabled={!lastPast}
        onClick={() => {
          campaignHistory.getState().undo()
          if (lastPast) toast(t.history.undone(lastPast.label))
        }}
      />
      <IconButton
        label={lastFuture ? `${t.history.redo} — ${lastFuture.label}` : t.history.redo}
        icon={<Redo2 />}
        disabled={!lastFuture}
        onClick={() => {
          campaignHistory.getState().redo()
          if (lastFuture) toast(t.history.redone(lastFuture.label))
        }}
      />
    </div>
  )
}
