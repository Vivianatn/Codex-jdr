import { Ban, Check } from 'lucide-react'
import { useId } from 'react'
import { entityName } from '@/domain/entity'
import { PLAYER_COLORS, playerColorOf, type PlayerColorKey } from '@/domain/playerColors'
import type { Entity } from '@/domain/types'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'

/**
 * Swatches to choose a player's colour (D-268). Native radios: arrow keys move
 * between colours. A colour worn by another player stays available (big
 * tables share), and says who wears it.
 */
export function PlayerColorPicker({
  value,
  onChange,
  others = [],
  label,
  hint,
  compact = false,
}: {
  value: PlayerColorKey | null
  onChange: (color: PlayerColorKey | null) => void
  /** The campaign's other player characters, to say who already wears a colour. */
  others?: readonly Entity[]
  label?: string
  hint?: string | null
  compact?: boolean
}) {
  const t = useT()
  const name = useId()
  const wornBy = (color: PlayerColorKey) =>
    others.filter((e) => playerColorOf(e) === color).map((e) => entityName(e))
  const swatch = compact ? 'size-6' : 'size-8'

  return (
    <fieldset className="min-w-0 space-y-1.5" data-testid="player-color-picker">
      <legend className={cn('text-sm font-medium text-ink', compact && 'sr-only')}>
        {label ?? t.playerColors.title}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {PLAYER_COLORS.map((color) => {
          const worn = wornBy(color)
          const text = worn.length
            ? `${t.playerColors.names[color]} (${t.playerColors.takenBy(worn.join(', '))})`
            : t.playerColors.names[color]
          return (
            <label key={color} className="relative cursor-pointer" title={text}>
              <input
                type="radio"
                name={name}
                value={color}
                checked={value === color}
                onChange={() => onChange(color)}
                className="peer sr-only"
                aria-label={text}
              />
              <span
                data-player-color={color}
                className={cn(
                  'flex items-center justify-center rounded-full border-2 border-surface bg-player shadow-soft transition-transform',
                  'peer-checked:scale-110 peer-checked:shadow-[0_0_0_2px_var(--codex-surface),0_0_0_4px_var(--codex-player)]',
                  'peer-focus-visible:shadow-[var(--codex-focus-ring)]',
                  swatch,
                )}
                aria-hidden
              >
                {value === color ? (
                  <Check className="size-4 text-surface" strokeWidth={3} />
                ) : worn.length ? (
                  <span className="size-1.5 rounded-full bg-surface" />
                ) : null}
              </span>
            </label>
          )
        })}
        <label className="relative cursor-pointer" title={t.playerColors.none}>
          <input
            type="radio"
            name={name}
            value=""
            checked={value === null}
            onChange={() => onChange(null)}
            className="peer sr-only"
            aria-label={t.playerColors.none}
          />
          <span
            className={cn(
              'flex items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-surface text-ink-muted',
              'peer-checked:border-solid peer-checked:text-ink peer-focus-visible:shadow-[var(--codex-focus-ring)]',
              swatch,
            )}
            aria-hidden
          >
            <Ban className="size-3.5" />
          </span>
        </label>
      </div>
      {hint !== null && !compact && (
        <p className="text-xs text-ink-muted">{hint ?? t.playerColors.hint}</p>
      )}
    </fieldset>
  )
}

/** A small dot in a player's colour, next to their name. */
export function PlayerColorDot({
  color,
  className,
}: {
  color: PlayerColorKey | null
  className?: string
}) {
  if (!color) return null
  return (
    <span
      data-player-color={color}
      className={cn('inline-block size-2.5 shrink-0 rounded-full bg-player', className)}
      aria-hidden
    />
  )
}
