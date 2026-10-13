/**
 * Puts together what goes on the server (D-262, D-263), in release/:
 *   release/docker-compose.yml, Caddyfile, .env.example   (from deploy/, for Docker)
 *   release/site/                                         (the built site and app, from dist/)
 *   release/server/                                       (the online server compiled to JavaScript)
 * The server alone also serves release/site/ (Plesk Node.js application, Node 22).
 * Run through `npm run deploy:bundle`, which builds first.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'release')
for (const [built, what] of [
  [join(root, 'dist', 'index.html'), 'dist/'],
  [join(root, 'server', 'dist', 'server', 'src', 'index.js'), 'server/dist/'],
] as const)
  if (!existsSync(built)) {
    console.error(`${what} est vide : lance « npm run deploy:bundle » (il construit d’abord).`)
    process.exit(1)
  }

rmSync(out, { recursive: true, force: true })
mkdirSync(out)
for (const file of ['docker-compose.yml', 'Caddyfile', '.env.example'])
  cpSync(join(root, 'deploy', file), join(out, file))
cpSync(join(root, 'dist'), join(out, 'site'), { recursive: true })
mkdirSync(join(out, 'server'))
for (const file of ['package.json', 'package-lock.json', 'Dockerfile'])
  cpSync(join(root, 'server', file), join(out, 'server', file))
cpSync(join(root, 'server', 'dist'), join(out, 'server', 'dist'), { recursive: true })
console.log(`Prêt : ${out}`)
