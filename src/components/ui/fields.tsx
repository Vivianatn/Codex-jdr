import {
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'
import { parseNumber } from '@/lib/numbers'
import { FIELD, FieldShell } from './TextField'

/**
 * Fields that commit on blur / Enter instead of on every keystroke, so one
 * edit = one undo entry. They resync when the value changes from outside (undo).
 */
function useDraft<T>(value: T) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  if (!Object.is(value, synced)) {
    setSynced(value)
    setDraft(value)
  }
  return [draft, setDraft] as const
}

interface CommonProps {
  label: string
  hint?: string
  hideLabel?: boolean
  className?: string
  error?: string | null
}

export interface CommitInputProps
  extends
    CommonProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'> {
  value: string
  onCommit: (value: string) => void
  /** Classes for the input itself (`className` sizes the whole field). */
  inputClassName?: string
}

export function CommitInput({
  label,
  hint,
  hideLabel,
  className,
  inputClassName,
  error,
  value,
  onCommit,
  ...props
}: CommitInputProps) {
  const id = useId()
  const [draft, setDraft] = useDraft(value)
  const commit = () => {
    const next = draft.trim()
    if (next !== value) onCommit(next)
    else setDraft(value)
  }
  return (
    <FieldShell
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      error={error}
      id={id}
      className={className}
    >
      <input
        id={id}
        className={cn(FIELD, 'h-10', inputClassName)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(value)
        }}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  )
}

export interface CommitTextAreaProps
  extends
    CommonProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className'> {
  value: string
  onCommit: (value: string) => void
}

export function CommitTextArea({
  label,
  hint,
  hideLabel,
  className,
  error,
  value,
  onCommit,
  ...props
}: CommitTextAreaProps) {
  const id = useId()
  const [draft, setDraft] = useDraft(value)
  const commit = () => {
    const next = draft.trim()
    if (next !== value) onCommit(next)
  }
  return (
    <FieldShell
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      error={error}
      id={id}
      className={className}
    >
      <textarea
        id={id}
        className={cn(FIELD, 'min-h-24 resize-y py-2 leading-relaxed')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit()
        }}
        {...props}
      />
    </FieldShell>
  )
}

export interface NumberInputProps
  extends
    CommonProps,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      'value' | 'onChange' | 'className' | 'min' | 'max'
    > {
  value: number | null
  onCommit: (value: number) => void
  min?: number
  max?: number
  integer?: boolean
  inputClassName?: string
}

/** Tolerant number field: accepts "11,5", clamps to [min, max], reverts invalid input. */
export function NumberInput({
  label,
  hint,
  hideLabel,
  className,
  error,
  value,
  onCommit,
  min,
  max,
  integer = true,
  inputClassName,
  ...props
}: NumberInputProps) {
  const id = useId()
  const shown = value === null ? '' : String(value)
  const [draft, setDraft] = useDraft(shown)
  const commit = () => {
    const parsed = parseNumber(draft)
    if (parsed === null) return setDraft(shown)
    let next = integer ? Math.round(parsed) : parsed
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }
  return (
    <FieldShell
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      error={error}
      id={id}
      className={className}
    >
      <input
        id={id}
        inputMode={integer ? 'numeric' : 'decimal'}
        className={cn(FIELD, 'tabular h-10', inputClassName)}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(shown)
        }}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  )
}

export interface SelectFieldProps<V extends string> extends CommonProps {
  value: V
  onChange: (value: V) => void
  options: { value: V; label: string }[]
  disabled?: boolean
  /** Classes for the <select> itself (`className` sizes the whole field). */
  selectClassName?: string
}

export function SelectField<V extends string>({
  label,
  hint,
  hideLabel,
  className,
  error,
  value,
  onChange,
  options,
  disabled,
  selectClassName,
}: SelectFieldProps<V>) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      hint={hint}
      hideLabel={hideLabel}
      error={error}
      id={id}
      className={className}
    >
      <select
        id={id}
        className={cn(FIELD, 'h-10 pr-8', selectClassName)}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: ReactNode
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded-[5px] accent-[var(--codex-accent)]"
      />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </label>
    </div>
  )
}
