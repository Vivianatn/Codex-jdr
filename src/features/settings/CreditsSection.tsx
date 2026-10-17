import { useT } from '@/i18n'

const LINK = 'text-accent-text underline'

/**
 * Settings › À propos: version (package.json, D-271), alpha status, the legal
 * pages, and the credits of what Codex borrows (CC BY 3.0 asks for it: game-icons.net).
 */
export function CreditsSection() {
  const t = useT()
  const links = [
    ['/cgu', t.legal.links.terms],
    ['/confidentialite', t.legal.links.privacy],
    ['/mentions-legales', t.legal.links.legal],
    ['/accessibilite', t.legal.links.accessibility],
    ['/contact', t.legal.links.contact],
  ] as const
  return (
    <section className="space-y-4" data-testid="credits-section">
      <div className="space-y-2">
        <h3 className="font-sans text-sm font-medium tracking-normal text-ink">
          {t.legal.aboutTitle}
        </h3>
        <p className="text-sm text-ink" data-testid="app-version">
          {t.legal.version(__CODEX_VERSION__)}
        </p>
        <p className="text-xs text-ink-muted">{t.legal.alphaNotice}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map(([href, label]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener" className={LINK}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <h3 className="font-sans text-sm font-medium tracking-normal text-ink">
          {t.credits.title}
        </h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            {t.credits.icons}{' '}
            <a href="https://game-icons.net" target="_blank" rel="noreferrer" className={LINK}>
              game-icons.net
            </a>{' '}
            {t.credits.iconsLicence}
          </li>
          <li>{t.credits.fonts}</li>
          <li>{t.credits.lucide}</li>
        </ul>
      </div>
    </section>
  )
}
