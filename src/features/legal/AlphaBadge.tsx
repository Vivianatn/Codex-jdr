import { useT } from '@/i18n'

/** Alpha status (D-271): small pill in the top bar, opens the CGU section about it. */
export function AlphaBadge() {
  const t = useT()
  return (
    <a
      href="/cgu#alpha"
      target="_blank"
      rel="noopener"
      aria-label={t.legal.alphaLabel}
      title={t.legal.alphaLabel}
      className="shrink-0 rounded-full border border-line-strong bg-warning-soft px-1.5 py-px text-[0.6875rem] font-bold tracking-[0.08em] text-warning-text uppercase no-underline hover:border-gold-line"
      data-testid="alpha-badge"
    >
      {t.legal.alpha}
    </a>
  )
}
