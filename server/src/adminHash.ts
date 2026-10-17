import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { hashPassword } from './secrets.ts'

/**
 * Prints the line to paste in the server's environment for the admin
 * dashboard (D-275, docs/DEPLOIEMENT.md):
 *
 *   npm run admin:hash                        (asks for the password, without echo when possible)
 *   echo "mot de passe" | npm run admin:hash  (from standard input)
 *   npm run admin:hash -- "mot de passe"      (from the command line: it stays in the shell history)
 *
 * The hash is the same scrypt format as account passwords (secrets.ts).
 */

export const ADMIN_PASSWORD_MIN = 12

/** `ADMIN_PASSWORD_HASH='scrypt$…'`: quoted so docker compose leaves the `$` alone. */
export async function adminHashLine(password: string): Promise<string> {
  if (password.length < ADMIN_PASSWORD_MIN)
    throw new Error(`Mot de passe trop court : ${ADMIN_PASSWORD_MIN} caractères au moins.`)
  return `ADMIN_PASSWORD_HASH='${await hashPassword(password)}'`
}

async function readPassword(): Promise<string> {
  const fromArgs = process.argv.slice(2).join(' ')
  if (fromArgs) return fromArgs
  if (!stdin.isTTY) {
    let data = ''
    for await (const chunk of stdin) data += String(chunk)
    return data.replace(/\r?\n$/, '')
  }
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  // Typed characters are not echoed.
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput
  let asked = false
  ;(rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
    if (!asked) write.call(rl, s)
  }
  const question = rl.question('Mot de passe administrateur : ')
  asked = true
  const answer = await question
  rl.close()
  stdout.write('\n')
  return answer
}

if (process.argv[1] && /adminHash\.(ts|js)$/.test(process.argv[1]))
  readPassword()
    .then(adminHashLine)
    .then((line) => {
      console.log(line)
      console.error(
        'Copie cette ligne dans deploy/.env (ou la valeur entre apostrophes dans Plesk), avec ADMIN_USERNAME, puis redémarre le serveur.',
      )
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
