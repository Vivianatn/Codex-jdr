import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { IconButton } from '@/components/ui/Button'
import { TextField, type TextFieldProps } from '@/components/ui/TextField'
import { useT } from '@/i18n'

/** Password input with a show/hide toggle; never spell-checked or autocorrected. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type'>>(
  function PasswordField(props, ref) {
    const t = useT()
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <TextField
          ref={ref}
          {...props}
          type={visible ? 'text' : 'password'}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          inputClassName="pr-11"
        />
        <IconButton
          size="sm"
          className="absolute top-[1.85rem] right-1"
          label={visible ? t.account.hidePassword : t.account.showPassword}
          icon={visible ? <EyeOff /> : <Eye />}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
        />
      </div>
    )
  },
)
