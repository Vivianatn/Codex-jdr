import { Copy, Download, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/fields'
import { useIntlLocale, useT } from '@/i18n'
import { copyText } from '@/lib/clipboard'
import { slugify } from '@/lib/files'

/** Shows a recovery code once; the GM must confirm it is stored before going on. */
export function RecoveryCodePanel({
  code,
  username,
  onDone,
}: {
  code: string
  username: string
  onDone: () => void
}) {
  const t = useT()
  const locale = useIntlLocale()
  const [saved, setSaved] = useState(false)

  const download = () => {
    const text = t.account.codeFileText(username, code, new Date().toLocaleDateString(locale))
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `codex-code-de-secours-${slugify(username)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <div className="space-y-4" data-testid="recovery-code-panel">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-gold-text" aria-hidden />
        <h2 className="type-section text-ink">{t.account.codeTitle}</h2>
      </div>
      <p className="text-sm text-ink-muted">{t.account.codeBody}</p>
      <p
        className="rounded-xl border border-gold-line bg-surface-2 px-4 py-3 text-center font-mono text-lg tracking-wider break-all text-ink tabular-nums select-all"
        data-testid="recovery-code"
      >
        {code}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Copy />}
          onClick={() =>
            copyText(code).then(
              () => toast.success(t.account.codeCopied),
              () => toast.error(t.errors.generic),
            )
          }
        >
          {t.account.codeCopy}
        </Button>
        <Button icon={<Download />} onClick={download}>
          {t.account.codeDownload}
        </Button>
      </div>
      <CheckboxField label={t.account.codeSaved} checked={saved} onChange={setSaved} />
      <Button variant="primary" className="w-full" disabled={!saved} onClick={onDone}>
        {t.account.codeContinue}
      </Button>
    </div>
  )
}
