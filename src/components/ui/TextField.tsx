import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Text field (DA §8.2): 3:1 border, focus = 2 px focus colour + soft halo,
 * error = 2 px HP colour. The second pixel is an inset shadow (no layout shift).
 */
export const FIELD =
  'w-full rounded-[10px] border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-150 hover:border-ink-muted focus-visible:border-focus focus-visible:shadow-[inset_0_0_0_1px_var(--codex-focus),0_0_0_3px_var(--codex-accent-soft)] aria-invalid:border-hp aria-invalid:shadow-[inset_0_0_0_1px_var(--codex-hp)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-faint'

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
        className={cn('block text-[0.8125rem] font-semibold text-ink', hideLabel && 'sr-only')}
      >
        {label}
        {hint && <span className="ml-1 font-normal text-ink-muted">({hint})</span>}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-hp-text"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
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
  /** Keeps the label for screen readers only. */
  hideLabel?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, inputClassName, hideLabel, id, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      id={fieldId}
      className={className}
      hideLabel={hideLabel}
    >
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
