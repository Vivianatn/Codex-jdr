import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { Portrait } from '@/features/characters/Portrait'
import { onlineErrorMessage } from '@/features/online/onlineMessages'
import { useT } from '@/i18n'
import { fitImage, imageFromFile } from '@/lib/images'
import { saveProfile } from '@/online/controller'
import { AVATAR_MAX, BANNER_MAX, BIO_MAX, type AdventurerProfile } from '@shared/sync'
import { ProfileBanner } from './ProfileCard'

/** Pictures are shrunk on the device before they leave it. */
const AVATAR_SIZE = 320
const BANNER_SIZE = { width: 1500, height: 500 }

/** Name, motto, picture and banner (D-267). A picture left alone is not sent again. */
export function ProfileEditor({
  profile,
  open,
  onOpenChange,
}: {
  profile: AdventurerProfile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const [name, setName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  // undefined = unchanged, null = removed, string = new picture.
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined)
  const [banner, setBanner] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName(profile.displayName)
    setBio(profile.bio)
    setAvatar(undefined)
    setBanner(undefined)
    setError(null)
  }

  const shownAvatar = avatar === undefined ? profile.avatar : avatar
  const shownBanner = banner === undefined ? profile.banner : banner

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
      title={t.adventurers.editTitle}
      description={t.adventurers.editBody}
    >
      <form
        className="space-y-5"
        data-testid="profile-editor"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await saveProfile({
              ...(name.trim() !== profile.displayName ? { displayName: name } : {}),
              ...(bio !== profile.bio ? { bio } : {}),
              ...(avatar !== undefined ? { avatar } : {}),
              ...(banner !== undefined ? { banner } : {}),
            })
            toast.success(t.adventurers.saved)
            setAvatar(undefined)
            setBanner(undefined)
            onOpenChange(false)
          } catch (err) {
            setError(onlineErrorMessage(t, err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <PicturePicker
          label={t.adventurers.banner}
          hasPicture={Boolean(shownBanner)}
          onPicked={setBanner}
          onError={setError}
          shrink={(img) => fitImage(img, BANNER_SIZE.width, BANNER_SIZE.height)}
          max={BANNER_MAX}
        >
          <ProfileBanner src={shownBanner} className="h-24 rounded-lg" />
        </PicturePicker>
        <PicturePicker
          label={t.adventurers.avatar}
          hasPicture={Boolean(shownAvatar)}
          onPicked={setAvatar}
          onError={setError}
          shrink={(img) => fitImage(img, AVATAR_SIZE, AVATAR_SIZE)}
          max={AVATAR_MAX}
        >
          <Portrait src={shownAvatar} name={name || profile.displayName} size="md" />
        </PicturePicker>
        <TextField
          label={t.adventurers.displayName}
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextAreaField
          label={t.adventurers.bio}
          hint={t.adventurers.bioHint(BIO_MAX)}
          placeholder={t.adventurers.bioPlaceholder}
          maxLength={BIO_MAX}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm font-medium text-hp-text">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? t.adventurers.saving : t.adventurers.save}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function PicturePicker({
  label,
  hasPicture,
  onPicked,
  onError,
  shrink,
  max,
  children,
}: {
  label: string
  hasPicture: boolean
  onPicked: (picture: string | null) => void
  onError: (message: string | null) => void
  shrink: (img: HTMLImageElement) => string
  max: number
  children: ReactNode
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<ImagePlus />} onClick={() => input.current?.click()}>
          {t.adventurers.choosePicture}
        </Button>
        {hasPicture && (
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => onPicked(null)}>
            {t.adventurers.removePicture}
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label} : ${t.adventurers.choosePicture}`}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            const picture = shrink(await imageFromFile(file))
            if (picture.length > max) return onError(t.adventurers.pictureTooBig)
            onError(null)
            onPicked(picture)
          } catch {
            onError(t.adventurers.notAnImage)
          }
        }}
      />
    </fieldset>
  )
}
