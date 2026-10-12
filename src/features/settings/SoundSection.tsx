import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/fields'
import { useT } from '@/i18n'
import { playSound } from '@/lib/audio/sfx'
import { useSettingsStore } from '@/stores/settingsStore'

function Volume({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 pl-7">
      <label htmlFor={id} className="w-16 shrink-0 text-xs text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--codex-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="tabular w-10 text-right text-xs text-ink-muted">
        {Math.round(value * 100)} %
      </span>
    </div>
  )
}

/** Sound effects and background music (D-251). */
export function SoundSection() {
  const t = useT()
  const s = useSettingsStore()
  return (
    <section className="space-y-2" data-testid="sound-section">
      <h3 className="font-sans text-sm font-medium tracking-normal text-ink">{t.sound.title}</h3>
      <CheckboxField
        label={t.sound.effects}
        hint={t.sound.effectsHint}
        checked={s.soundEffects}
        onChange={s.setSoundEffects}
      />
      <Volume
        label={t.sound.volume}
        value={s.soundVolume}
        disabled={!s.soundEffects}
        onChange={s.setSoundVolume}
      />
      <CheckboxField
        label={t.sound.music}
        hint={t.sound.musicHint}
        checked={s.music}
        onChange={s.setMusic}
      />
      <Volume
        label={t.sound.volume}
        value={s.musicVolume}
        disabled={!s.music}
        onChange={s.setMusicVolume}
      />
      <CheckboxField
        label={t.sound.banners}
        hint={t.sound.bannersHint}
        checked={s.gameBanners}
        onChange={s.setGameBanners}
      />
      <Button size="sm" disabled={!s.soundEffects} onClick={() => playSound('critSuccess')}>
        {t.sound.test}
      </Button>
    </section>
  )
}
