import { CircleAlert } from 'lucide-react'
import { useId } from 'react'
import { useT } from '@/i18n'
import type { ConsentValue } from './legalApi'

const LINK = 'font-medium text-accent-text underline underline-offset-2'

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-hp-text"
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  )
}

/**
 * Sign-up consent (D-271): the terms accepted explicitly (unticked box, links
 * to the texts) and the age declared (15 or over, or a parent's agreement,
 * loi Informatique et Libertés art. 45). Errors show once the form is sent.
 */
export function TermsConsent({
  value,
  onChange,
  showErrors,
}: {
  value: ConsentValue
  onChange: (value: ConsentValue) => void
  showErrors: boolean
}) {
  const t = useT()
  const id = useId()
  const termsError = showErrors && !value.accepted
  const ageError = showErrors && !value.age
  return (
    <div className="space-y-3">
      <fieldset
        className="space-y-1.5"
        aria-invalid={ageError || undefined}
        aria-describedby={ageError ? `${id}-age-error` : undefined}
      >
        <legend className="text-[0.8125rem] font-semibold text-ink">{t.legal.ageLegend}</legend>
        {(
          [
            ['15+', t.legal.ageAdult],
            ['parental', t.legal.ageParental],
          ] as const
        ).map(([age, label]) => (
          <label key={age} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name={`${id}-age`}
              value={age}
              checked={value.age === age}
              onChange={() => onChange({ ...value, age })}
              className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[var(--codex-accent)]"
            />
            {label}
          </label>
        ))}
        {ageError && <FieldError id={`${id}-age-error`}>{t.legal.ageRequired}</FieldError>}
      </fieldset>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <input
            id={`${id}-terms`}
            type="checkbox"
            checked={value.accepted}
            onChange={(e) => onChange({ ...value, accepted: e.target.checked })}
            aria-invalid={termsError || undefined}
            aria-describedby={termsError ? `${id}-terms-error` : undefined}
            className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-sm accent-[var(--codex-accent)]"
          />
          <label htmlFor={`${id}-terms`} className="text-sm text-ink">
            {t.legal.acceptBefore}
            <a href="/cgu" target="_blank" rel="noopener" className={LINK}>
              {t.legal.terms}
              <span className="sr-only"> {t.legal.newTab}</span>
            </a>
            {t.legal.acceptMiddle}
            <a href="/confidentialite" target="_blank" rel="noopener" className={LINK}>
              {t.legal.privacy}
              <span className="sr-only"> {t.legal.newTab}</span>
            </a>
            {t.legal.acceptAfter}
          </label>
        </div>
        {termsError && <FieldError id={`${id}-terms-error`}>{t.legal.acceptRequired}</FieldError>}
      </div>
    </div>
  )
}
