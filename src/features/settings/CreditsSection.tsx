import { useT } from '@/i18n'

/** Credits of what Codex borrows (CC BY 3.0 asks for it: game-icons.net). */
export function CreditsSection() {
  const t = useT()
  return (
    <section className="space-y-2" data-testid="credits-section">
      <h3 className="font-sans text-sm font-medium tracking-normal text-ink">{t.credits.title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li>
          {t.credits.icons}{' '}
          <a
            href="https://game-icons.net"
            target="_blank"
            rel="noreferrer"
            className="text-accent-text underline"
          >
            game-icons.net
          </a>{' '}
          {t.credits.iconsLicence}
        </li>
        <li>{t.credits.fonts}</li>
        <li>{t.credits.lucide}</li>
      </ul>
    </section>
  )
}
