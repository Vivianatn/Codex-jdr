/**
 * Puts together what goes on the server (D-262), in release/:
 *   release/docker-compose.yml, Caddyfile, .env.example   (from deploy/)
 *   release/site/                                         (the built site and app, from dist/)
 *   release/server/  release/shared/                      (the online server's sources)
 * Then: `scp -r release/. user@server:~/codex` (docs/DEPLOIEMENT.md).
 * Run through `npm run deploy:bundle`, which builds first.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'release')
if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('dist/ est vide : lance « npm run deploy:bundle » (il construit d’abord le site).')
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
cpSync(join(root, 'server', 'src'), join(out, 'server', 'src'), {
  recursive: true,
  // Tests stay home.
  filter: (path) => !/\.test\.ts$|testing\.ts$/.test(path),
})
cpSync(join(root, 'shared'), join(out, 'shared'), {
  recursive: true,
  filter: (path) => !/\.test\.ts$/.test(path),
})
console.log(`Prêt : ${out}\nCopie-le sur le serveur : scp -r release/. utilisateur@serveur:~/codex`)
