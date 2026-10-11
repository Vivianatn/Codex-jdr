import { Monitor, Moon, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useT } from '@/i18n'
import { useResolvedTheme } from '@/app/usePreferences'
import { useSettingsStore, type AnimationLevel, type ThemePreference } from '@/stores/settingsStore'

export function SettingsButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={t.settings.open} icon={<Settings />} onClick={() => setOpen(true)} />
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

/** One-click light/dark switch for the header (the dialog also offers "Système"). */
export function ThemeToggle() {
  const t = useT()
  const resolved = useResolvedTheme()
  const setTheme = useSettingsStore((s) => s.setTheme)
  return (
    <IconButton
      label={t.settings.toggleTheme}
      icon={resolved === 'dark' ? <Sun /> : <Moon />}
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
      data-testid="theme-toggle"
    />
  )
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const { theme, animations, setTheme, setAnimations } = useSettingsStore()

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.settings.title}
      description={t.settings.description}
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-sans text-sm font-medium tracking-normal text-ink">
            {t.settings.theme}
          </h3>
          <SegmentedControl<ThemePreference>
            label={t.settings.theme}
            value={theme}
            onValueChange={setTheme}
            options={[
              { value: 'light', label: t.settings.themeLight, icon: <Sun /> },
              { value: 'dark', label: t.settings.themeDark, icon: <Moon /> },
              { value: 'system', label: t.settings.themeSystem, icon: <Monitor /> },
            ]}
          />
        </section>

        <section className="space-y-2">
          <h3 className="font-sans text-sm font-medium tracking-normal text-ink">
            {t.settings.animations}
          </h3>
          <SegmentedControl<AnimationLevel>
            label={t.settings.animations}
            value={animations}
            onValueChange={setAnimations}
            options={[
              { value: 'full', label: t.settings.animationsFull },
              { value: 'reduced', label: t.settings.animationsReduced },
              { value: 'off', label: t.settings.animationsOff },
            ]}
          />
          <p className="text-xs text-ink-muted">{t.settings.animationsHint}</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-sans text-sm font-medium tracking-normal text-ink">
            {t.settings.language}
          </h3>
          <p className="text-sm text-ink-muted">{t.settings.languageFrench}</p>
        </section>
      </div>
    </Dialog>
  )
}
