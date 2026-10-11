import { Swords } from 'lucide-react'
import { Link } from 'react-router'
import { Ornament } from '@/components/Brand'
import { buttonClasses } from '@/components/ui/buttonStyles'
import { PageTransition } from '@/features/shell/PageTransition'
import { useCampaign } from '@/features/shell/campaignContext'
import { useT } from '@/i18n'
import { cn } from '@/lib/cn'

export function DashboardPage() {
  const t = useT()
  const campaign = useCampaign()

  return (
    <PageTransition className="px-4 py-8 sm:px-8">
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {campaign.name}
        </h1>
        <p className="mt-2 text-ink-muted">{campaign.description || t.dashboard.subtitle}</p>
        <Ornament variant="stats" className="my-8" />

        <section
          aria-labelledby="next-steps"
          className="rounded-lg border border-line bg-surface p-6 shadow-soft"
        >
          <h2 id="next-steps" className="font-display text-lg font-semibold text-ink">
            {t.dashboard.nextStepsTitle}
          </h2>
          <ol className="mt-4 space-y-3">
            {t.dashboard.nextSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-ink">
                <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Link to={`/c/${campaign.id}/play`} className={cn(buttonClasses('primary'), 'mt-6')}>
            <Swords className="size-4" aria-hidden />
            {t.dashboard.playCta}
          </Link>
        </section>
      </div>
    </PageTransition>
  )
}
