import './site.css'
import {
  analyticsChoice,
  setAnalyticsChoice,
  shouldAskAnalytics,
  startAnalytics,
  type AnalyticsChoice,
} from '@/lib/analytics'

/**
 * Behaviour of the public pages (D-248): the audience-measurement notice
 * (refusing is as easy as accepting, CNIL) and the footer link reopening it.
 * The theme follows the system (inline script in each page's head).
 */

const NOTICE_ID = 'consent-notice'

function closeNotice() {
  document.getElementById(NOTICE_ID)?.remove()
}

function showNotice(focus: boolean) {
  closeNotice()
  const current = analyticsChoice()
  const notice = document.createElement('section')
  notice.id = NOTICE_ID
  notice.className = 'consent'
  notice.setAttribute('aria-labelledby', `${NOTICE_ID}-title`)
  notice.innerHTML = `
    <h2 id="${NOTICE_ID}-title" class="consent-title">Mesure d’audience</h2>
    <p>
      Codex compte ses visites de façon anonyme, <strong>sans cookie</strong> et sur son propre
      serveur : rien n’est partagé avec un tiers.
      <a href="/confidentialite#audience">En savoir plus</a>
    </p>
    ${current ? `<p class="consent-state">Ton choix actuel : ${current === 'accepted' ? 'accepté' : 'refusé'}.</p>` : ''}
    <div class="consent-actions">
      <button type="button" class="button" data-choice="refused">Refuser</button>
      <button type="button" class="button" data-choice="accepted">Accepter</button>
    </div>`
  notice.addEventListener('click', (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLElement>('[data-choice]')?.dataset
      .choice as AnalyticsChoice | undefined
    if (!choice) return
    setAnalyticsChoice(choice)
    closeNotice()
  })
  document.body.appendChild(notice)
  if (focus) notice.querySelector<HTMLButtonElement>('button')?.focus()
}

document.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('[data-consent-open]')) showNotice(true)
})

if (shouldAskAnalytics()) showNotice(false)
startAnalytics()
