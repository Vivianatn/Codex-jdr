import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const FIELD =
  'w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 transition-colors hover:border-line-strong focus-visible:border-accent aria-invalid:border-hp'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string | null
  id: string
  children: React.ReactNode
}

function FieldShell({ label, hint, error, id, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-muted">({hint})</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-hp-text">
          {error}
        </p>
      )}
    </div>
  )
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextField({ label, hint, error, className, id, ...props }: TextFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <input
        id={fieldId}
        className={cn(FIELD, 'h-10', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
    </FieldShell>
  )
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextAreaField({ label, hint, error, className, id, ...props }: TextAreaFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId}>
      <textarea
        id={fieldId}
        className={cn(FIELD, 'min-h-20 resize-y py-2', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
    </FieldShell>
  )
}
