// Shared by the app and the server (D-262): no imports, no TypeScript-only syntax.
/**
 * Password rules (D-241), after NIST SP 800-63B rev. 4: a long passphrase rather
 * than composition rules. 15 characters minimum because the password is the
 * only factor and protects data an attacker could copy and attack offline.
 */

export const MIN_PASSWORD_LENGTH = 15
export const MAX_PASSWORD_LENGTH = 256
const MAX_USERNAME_LENGTH = 40

export type PasswordProblem =
  'passwordTooShort' | 'passwordTooLong' | 'passwordTooSimple' | 'passwordContainsUsername'

// Keyboard rows and runs people pad short passwords with.
const SEQUENCES = [
  '0123456789',
  'abcdefghijklmnopqrstuvwxyz',
  'azertyuiopqsdfghjklmwxcvbn',
  'qwertyuiopasdfghjklzxcvbnm',
]
const COMMON_WORDS = ['motdepasse', 'password', 'codex', 'donjon', 'dragon', 'soleil', 'bonjour']

function length(text: string): number {
  return [...text].length
}

/** Lowercase, accents removed: for comparisons only. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function usernameKey(username: string): string {
  return fold(username.trim().replace(/\s+/g, ' '))
}

export function checkUsername(username: string): 'usernameInvalid' | null {
  const n = length(username.trim())
  return n >= 1 && n <= MAX_USERNAME_LENGTH && !/\p{Cc}/u.test(username) ? null : 'usernameInvalid'
}

/** First problem found, or null when the password is acceptable. */
export function checkPassword(password: string, username = ''): PasswordProblem | null {
  const n = length(password)
  if (n < MIN_PASSWORD_LENGTH) return 'passwordTooShort'
  if (n > MAX_PASSWORD_LENGTH) return 'passwordTooLong'
  const folded = fold(password).replace(/[\s\-_.]/g, '')
  const name = usernameKey(username).replace(/[\s\-_.]/g, '')
  if (name.length >= 3 && folded.includes(name)) return 'passwordContainsUsername'
  if (new Set(folded).size < 5) return 'passwordTooSimple'
  // What is left once common words and keyboard runs are removed must still be long.
  let rest = folded
  for (const word of COMMON_WORDS) rest = rest.split(word).join('')
  for (const run of SEQUENCES)
    for (let size = run.length; size >= 4; size--)
      for (let i = 0; i + size <= run.length; i++)
        rest = rest.split(run.slice(i, i + size)).join('')
  if (length(rest) < 8) return 'passwordTooSimple'
  return null
}
