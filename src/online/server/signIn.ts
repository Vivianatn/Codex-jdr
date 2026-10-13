import { toast } from 'sonner'
import { getMessages } from '@/i18n'
import { AccountError, accounts, type OnlineLink, type Unlocked } from '@/security/accounts'
import type { PublicUser } from '@shared/sync'
import { server } from './api'

/**
 * Signing in from the lock screen with an online account (D-262). Kept apart
 * from the rest of the online code, which loads only once Codex is unlocked.
 */

export const linkOf = (user: PublicUser): OnlineLink => ({
  userId: user.id,
  email: user.email,
  displayName: user.displayName,
})

/**
 * Lock screen, « Se connecter avec un compte en ligne » (D-262): the server
 * checks the password, then the local account linked to it opens with the same
 * password, or one is made on this device and the campaigns come down.
 */
export async function signInOnline(email: string, password: string): Promise<Unlocked> {
  const { user } = await server.login(email, password)
  return openLocalFor(user, password)
}

/** Lock screen, « Créer un compte en ligne ». */
export async function registerOnline(input: {
  email: string
  displayName: string
  password: string
}): Promise<Unlocked> {
  const { user } = await server.register(input)
  return openLocalFor(user, input.password)
}

async function openLocalFor(user: PublicUser, password: string): Promise<Unlocked> {
  const existing = await accounts.findOnline(user.id)
  if (existing) {
    try {
      const unlocked = await accounts.unlock(existing.id, password)
      const account = await accounts.setOnline(existing.id, linkOf(user))
      return { ...unlocked, account }
    } catch (error) {
      if (!(error instanceof AccountError && error.code === 'wrongPassword')) throw error
      // The password changed online (reset by e-mail): this device's copy cannot be opened
      // with it. It is kept under another name; a fresh copy comes down from the server.
      await accounts.setOnline(existing.id, null)
      await accounts.rename(
        existing.id,
        await accounts.freeUsername(`${existing.username} (ancienne copie)`),
      )
      toast(getMessages().account.online.oldCopyKept)
    }
  }
  const username = await accounts.freeUsername(user.displayName)
  const created = await accounts.create({ username, password })
  const account = await accounts.setOnline(created.account.id, linkOf(user))
  return { account, key: created.key }
}
