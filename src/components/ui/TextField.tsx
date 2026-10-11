import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const FIELD =
  'w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70 transition-colors hover:border-line-strong focus-visible:border-accent aria-invalid:border-hp'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string | null
  id: string
  /** Keeps the label for screen readers only (compact rows). */
  hideLabel?: boolean
  className?: string
  children: React.ReactNode
}

export function FieldShell({
  label,
  hint,
  error,
  id,
  hideLabel,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className={cn('block text-sm font-medium text-ink', hideLabel && 'sr-only')}
      >
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
  /** Classes for the input itself (`className` sizes the whole field). */
  inputClassName?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, inputClassName, id, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={className}>
      <input
        ref={ref}
        id={fieldId}
        className={cn(FIELD, 'h-10', inputClassName)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
    </FieldShell>
  )
})

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
