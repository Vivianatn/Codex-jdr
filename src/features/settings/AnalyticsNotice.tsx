import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n'
import { setAnalyticsChoice, shouldAskAnalytics, type AnalyticsChoice } from '@/lib/analytics'

/**
 * One-time notice about the anonymous, cookieless audience measurement (D-248).
 * Non-blocking; refusing is as easy as accepting. Hidden when measurement is off.
 */
export function AnalyticsNotice() {
  const t = useT()
  const [open, setOpen] = useState(shouldAskAnalytics)
  if (!open) return null
  const choose = (choice: AnalyticsChoice) => {
    setAnalyticsChoice(choice)
    setOpen(false)
  }
  return (
    <section
      aria-labelledby="analytics-notice-title"
      className="fixed bottom-4 left-4 z-50 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface-raised p-4 text-sm text-ink shadow-overlay"
    >
      <h2 id="analytics-notice-title" className="type-card-title text-ink">
        {t.analytics.title}
      </h2>
      <p className="mt-1 text-ink-muted">
        {t.analytics.body}{' '}
        <a href="/confidentialite#audience" className="text-accent-text underline">
          {t.analytics.more}
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={() => choose('refused')}>
          {t.analytics.refuse}
        </Button>
        <Button className="flex-1" onClick={() => choose('accepted')}>
          {t.analytics.accept}
        </Button>
      </div>
    </section>
  )
}
