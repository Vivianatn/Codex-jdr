# Mettre Codex en ligne

Guide pour installer Codex sur ton serveur PulseHeberg. Tout tourne dans Docker :

| Service                                | Rôle                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `caddy`                                | Sert le site et l'application, obtient seul les certificats HTTPS, relaie `/api` et `/stats` |
| `server`                               | Le serveur du mode en ligne (D-262) : comptes, campagnes, synchronisation, parties en direct |
| `codex-db`                             | Sa base PostgreSQL (les campagnes y sont chiffrées avec `CODEX_DATA_KEY`)                    |
| `codex-backup`                         | Une copie de la base chaque nuit dans `~/codex/backups`, 14 jours gardés                     |
| `umami`, `umami-db`, `umami-retention` | Mesure d'audience sans cookie (D-248)                                                        |

Seul Caddy est joignable depuis Internet (ports 80 et 443) ; le reste ne parle que sur le réseau interne de Docker.

## 1. Avant de commencer

- Un nom de domaine (par exemple `codex-jdr.fr`) dont les enregistrements DNS `A` (et `AAAA` si IPv6) pointent vers l'adresse IP du serveur, ainsi que `www` et `stats`.
- Sur le serveur (Debian ou Ubuntu) : Docker et son extension Compose (`curl -fsSL https://get.docker.com | sh`).
- Pare-feu : seuls les ports 22 (SSH), 80 et 443 (TCP, et UDP pour 443) sont ouverts.
- Pour la réinitialisation des mots de passe par e-mail : un compte d'envoi SMTP (celui de ton hébergeur de messagerie, ou un service comme Brevo, Mailjet…). Sans lui, tout marche sauf « Mot de passe oublié ».

## 2. Renseigner les informations du site

Sur ton ordinateur, copie `.env.example` en `.env.production.local` et remplis-le : adresse du site, éditeur, contact, hébergeur (nom, adresse, contact, pays du centre de données). Ces informations apparaissent dans les mentions légales et la page Confidentialité ; tant qu'il en manque une, `npm run launch:check` refuse la mise en ligne.

## 3. Préparer le paquet à envoyer

```sh
npm run deploy:bundle
```

Cette commande construit le site et l'application, puis rassemble dans `release/` tout ce qui va sur le serveur : `docker-compose.yml`, `Caddyfile`, `.env.example`, le site construit (`site/`) et les sources du serveur (`server/`, `shared/`).

```sh
scp -r release/. utilisateur@serveur:~/codex
```

## 4. Premier démarrage sur le serveur

```sh
cd ~/codex
cp .env.example .env
nano .env
```

Remplis :

| Variable                                | Valeur                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODEX_DOMAIN`                          | Ton domaine, sans `https://`                                                                                                                                      |
| `ACME_EMAIL`                            | Ton adresse (avis d'expiration des certificats)                                                                                                                   |
| `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET` | `openssl rand -hex 32` pour chacun                                                                                                                                |
| `CODEX_DB_PASSWORD`                     | `openssl rand -hex 32`                                                                                                                                            |
| `CODEX_DATA_KEY`                        | `openssl rand -hex 32` — **garde-en une copie hors du serveur** (gestionnaire de mots de passe, papier) : sans elle, ni la base ni les sauvegardes ne se relisent |
| `SMTP_URL`                              | `smtps://utilisateur:motdepasse@serveur-smtp:465` (un `@` dans l'identifiant s'écrit `%40`)                                                                       |
| `MAIL_FROM`                             | L'expéditeur des e-mails, par exemple `Codex <ne-pas-repondre@codex-jdr.fr>`                                                                                      |

Puis :

```sh
docker compose up -d --build
docker compose ps          # tout doit être « running » (healthy pour les bases et le serveur)
docker compose logs server # « Server listening at http://0.0.0.0:3000 »
```

Caddy demande le certificat au premier accès : `https://ton-domaine` répond en HTTPS, `http://` y redirige. Vérifie que le serveur répond :

```sh
curl https://ton-domaine/api/health   # {"ok":true}
```

La base du serveur se crée et se met à jour toute seule au démarrage (migrations dans `server/src/migrations.ts`).

## 5. Activer la mesure d'audience

1. Ouvre `https://stats.ton-domaine`, connecte-toi (identifiants par défaut d'Umami : `admin` / `umami`) et **change tout de suite le mot de passe**.
2. Ajoute un site web avec ton domaine et copie son identifiant.
3. Mets-le dans `.env.production.local` (`VITE_UMAMI_WEBSITE_ID=…`), refais `npm run deploy:bundle` et recopie `release/site/` (section 7).

## 6. Vérifier avant d'annoncer le site

```sh
npm run launch:check
```

Le contrôle reprend les 20 points de la liste de mise en ligne et s'arrête au premier manque. Une fois en ligne, vérifie aussi :

- l'aperçu de partage avec l'inspecteur de publication de Facebook ou de LinkedIn ;
- la note HTTPS sur <https://www.ssllabs.com/ssltest/> (A+ attendu, grâce au HSTS) ;
- la soumission du sitemap dans Google Search Console ;
- le parcours en ligne, avec deux navigateurs : créer un compte en ligne, mettre une campagne en ligne, envoyer le lien d'invitation, accepter la demande, démarrer une partie « En ligne », entrer comme joueur ;
- « Mot de passe oublié ? » : l'e-mail arrive, le lien ouvre l'écran du nouveau mot de passe.

## 7. Mettre à jour

```sh
npm run deploy:bundle
scp -r release/. utilisateur@serveur:~/codex
ssh utilisateur@serveur 'cd ~/codex && docker compose up -d --build'
```

Le site change immédiatement ; le serveur redémarre en quelques secondes (les parties en cours reprennent : les appareils se reconnectent seuls, et ce qui a été modifié entre-temps part au retour de la connexion). Les fichiers versionnés (`/assets/…`) sont mis en cache un an ; les pages, jamais.

## 8. Sauvegardes et restauration

- Chaque nuit, `codex-backup` écrit `~/codex/backups/codex-AAAA-MM-JJ.dump` et efface ceux de plus de 14 jours. Copie-les de temps en temps hors du serveur (`scp utilisateur@serveur:~/codex/backups/*.dump .`).
- Les campagnes y restent chiffrées avec `CODEX_DATA_KEY` : range la clé **ailleurs** que les sauvegardes.
- Restaurer une sauvegarde :

```sh
docker compose stop server
docker compose exec -T codex-db pg_restore -U codex -d codex --clean --if-exists < backups/codex-AAAA-MM-JJ.dump
docker compose start server
```

Chaque appareil garde aussi sa propre copie chiffrée des campagnes : même un serveur perdu ne fait pas perdre une campagne. Une campagne disparue du serveur reste sur l'appareil de son MJ, qui peut la remettre en ligne (bouton « En ligne » › « Mettre la campagne en ligne »).

## 9. Essayer en local

```sh
npm run server:install   # une fois : les dépendances du serveur
npm run server:dev       # le serveur, sur une base en mémoire (vidée à chaque redémarrage)
npm run dev              # l'application, qui relaie /api vers le serveur
```

Les e-mails de réinitialisation s'affichent alors dans la console du serveur au lieu de partir.
