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

Sur ton ordinateur, copie `.env.example` en `.env.production.local` et remplis-le. Ces informations apparaissent dans les mentions légales, la page Confidentialité, les CGU et la page Contact ; tant qu'il en manque une, `npm run launch:check` refuse la mise en ligne (D-271) :

| Variable                     | Ce qu'il faut écrire                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CODEX_SITE_URL`             | L'adresse du site, `https://…`                                                                                                                |
| `CODEX_PUBLISHER_NAME`       | Ton nom (ou celui de ta société)                                                                                                              |
| `CODEX_PUBLISHER_STATUS`     | « Particulier », « Entreprise individuelle, SIREN … », « SAS au capital de … €, RCS …, TVA … »                                                |
| `CODEX_PUBLISHER_ADDRESS`    | Adresse postale (domicile ou siège)                                                                                                           |
| `CODEX_PUBLISHER_PHONE`      | Numéro de téléphone                                                                                                                           |
| `CODEX_CONTACT_EMAIL`        | L'adresse de contact : questions, droits RGPD, signalements, point de contact unique du DSA                                                   |
| `CODEX_PUBLICATION_DIRECTOR` | Le directeur ou la directrice de la publication (toi, en général)                                                                             |
| `CODEX_HOST_ADDRESS`         | Adresse de l'hébergeur (PulseHeberg)                                                                                                          |
| `CODEX_HOST_PHONE`           | Téléphone de l'hébergeur                                                                                                                      |
| `CODEX_HOST_LOCATION`        | Pays du centre de données, en phrase : « en France » (dans l'Union européenne)                                                                |
| `CODEX_MAIL_PROVIDER`        | Le service d'envoi derrière `SMTP_URL`, avec son pays : « Brevo (France) ». Choisis-le dans l'UE, sinon la page Confidentialité serait fausse |
| `CODEX_CONSUMER_MEDIATOR`    | Si tu agis en professionnel : le nom et le site de ton médiateur de la consommation ; sinon, une phrase qui explique pourquoi il n'y en a pas |

- **Éditeur particulier** : la loi (LCEN, art. 6-III-2) permet à une personne qui édite à titre non professionnel de ne publier que les coordonnées de l'hébergeur, à condition de lui avoir donné son identité. Si tu fais ce choix, écris-le explicitement dans les champs de l'éditeur (par exemple « Éditeur non professionnel, identité communiquée à l'hébergeur (LCEN, art. 6-III-2) ») ; Codex ne le décide pas à ta place.
- **Accessibilité** : `CODEX_ACCESSIBILITY_STATUS` vaut « non conforme » tant qu'aucun audit RGAA complet n'a été fait (c'est la règle du RGAA) ; ne le passe à « partiellement conforme » (50 % des critères au moins) ou « totalement conforme » qu'après un audit.
- **Changer les CGU ou la page Confidentialité** : mets à jour `legalUpdated` dans `site/config.ts` et, si le changement est important, `TERMS_VERSION` dans `shared/legal.ts` : chaque compte devra accepter la nouvelle version à sa connexion suivante.

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
| `MODERATION_EMAIL`                      | Où arrivent les nouveaux signalements, et l'adresse à laquelle les e-mails de modération demandent de répondre (en général `CODEX_CONTACT_EMAIL`)                 |

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

## 9. Variante Plesk (application Node.js 22)

Sans Docker, le serveur Codex sert aussi le site et l'application lui-même (D-263) : une seule application Node.js suffit.

1. `npm run deploy:bundle` sur ton ordinateur, puis envoie `release/server/` et `release/site/` côte à côte dans le dossier du sous-domaine (par exemple `codex.antoine-vivian.fr/server` et `codex.antoine-vivian.fr/site`).
2. Dans Plesk › Node.js : version **22.x** (22.12 ou plus), racine de l'application `server`, fichier de démarrage `dist/server/src/index.js`, mode production. Clique « NPM install » (installe les dépendances de `package.json`).
3. Variables d'environnement de l'application : `NODE_ENV=production`, `DATABASE_URL` (une base **PostgreSQL**), `CODEX_DATA_KEY`, `CODEX_SITE_URL=https://codex.antoine-vivian.fr`, `SMTP_URL`, `MAIL_FROM`, `MODERATION_EMAIL`. Si le site n'est pas dans `../site`, indique son dossier avec `CODEX_SITE_DIR`.
4. Active HTTPS (Let's Encrypt) sur le sous-domaine et redémarre l'application. `https://codex.antoine-vivian.fr/api/health` doit répondre `{"ok":true}`, et les pages s'afficher avec leur style.

## 10. Essayer en local

```sh
npm run server:install   # une fois : les dépendances du serveur
npm run server:dev       # le serveur, sur une base en mémoire (vidée à chaque redémarrage)
npm run dev              # l'application, qui relaie /api vers le serveur
```

Les e-mails de réinitialisation s'affichent alors dans la console du serveur au lieu de partir.

## 11. Signalements et modération (DSA, D-271)

Toute personne connectée peut signaler un profil (bouton « Signaler ») ; on peut aussi t'écrire à l'adresse de contact (page `/contact`). Chaque signalement est enregistré avec une copie du profil tel qu'il était ; son auteur reçoit un accusé de réception, et `MODERATION_EMAIL` est prévenu. **Tu dois l'examiner toi-même** (aucune décision automatique) et décider sans tarder, surtout pour un contenu manifestement illicite.

Les décisions se prennent en ligne de commande, sur le serveur (mêmes variables d'environnement que lui). Avec Docker :

```sh
docker compose exec server node dist/server/src/moderate.js reports            # signalements ouverts (--all : tous)
docker compose exec server node dist/server/src/moderate.js show <signalement> # le détail et la copie du profil
```

Puis, selon le cas :

```sh
# Retirer la devise et les images d'un profil et en bloquer la modification (--rename "Aventurier" remplace aussi le nom).
docker compose exec server node dist/server/src/moderate.js hide-profile <compte> --report <signalement> --reason "Ta devise contient des insultes envers d'autres joueurs."
# Contenu illicite (et non seulement contraire aux CGU) : ajoute --illegal.
docker compose exec server node dist/server/src/moderate.js suspend <compte> --report <signalement> --reason "…" --illegal
# Aucune mesure : le signalement est classé et son auteur reçoit la raison.
docker compose exec server node dist/server/src/moderate.js dismiss <signalement> --reason "La devise ne contrevient à aucune règle."
# Après une contestation fondée :
docker compose exec server node dist/server/src/moderate.js restore-profile <compte>
docker compose exec server node dist/server/src/moderate.js unsuspend <compte>
```

- La personne visée reçoit par e-mail l'**exposé des motifs** (DSA, art. 17) : la mesure, les faits que tu écris dans `--reason`, le signalement s'il y en a un, le motif (loi ou CGU), et comment contester. Écris `--reason` pour elle : clair, factuel, sans le nom de l'auteur du signalement.
- L'auteur du signalement reçoit la décision (sauf signalement anonyme).
- Une suspension ferme toutes les sessions du compte et refuse sa connexion ; une connexion temps réel déjà ouverte se coupe au plus tard à sa reconnexion.
- Sur Plesk, lance les mêmes commandes depuis le dossier `server` (`node dist/server/src/moderate.js …`) avec les variables de l'application (`DATABASE_URL`, `SMTP_URL`, `MAIL_FROM`, `MODERATION_EMAIL`).
- Contenu pédocriminel ou terroriste : masque-le immédiatement, garde la copie (le signalement la conserve) et signale-le sur [internet-signalement.gouv.fr](https://www.internet-signalement.gouv.fr) ; une autorité peut aussi t'adresser une injonction de retrait (sous une heure pour un contenu terroriste).
- Les signalements traités sont effacés un an après leur décision (balayage quotidien du serveur).
- En secours, la table se lit en SQL : `docker compose exec codex-db psql -U codex -d codex -c "SELECT id, created_at, status, category, target_id FROM reports ORDER BY created_at"`.

## 12. Tableau d'administration (D-275)

`https://codex.antoine-vivian.fr/admin` ouvre le tableau d'administration : vue d'ensemble (comptes, campagnes, parties en cours, signalements, inscriptions des 30 derniers jours), signalements à traiter, recherche de comptes, liste des campagnes (nom, MJ, membres : leur contenu reste chiffré et privé) et journal d'administration. Il fait la même modération que `moderate.js` (section 11), avec les mêmes e-mails d'exposé des motifs, et permet en plus de supprimer un compte.

Il est fermé tant que l'identifiant et le mot de passe ne sont pas configurés sur le serveur.

1. Sur ton ordinateur, choisis un mot de passe long (12 caractères au moins, une phrase de passe de préférence) et calcule son empreinte :

   ```sh
   npm run admin:hash
   ```

   La commande demande le mot de passe sans l'afficher et imprime une ligne `ADMIN_PASSWORD_HASH='scrypt$32768$8$1$…'`. (Sur le serveur, depuis le dossier `server` : `node dist/server/src/adminHash.js`.) Le mot de passe lui-même n'est écrit nulle part.
2. Renseigne deux variables :
   - **Docker** : dans `deploy/.env`, `ADMIN_USERNAME=ton-identifiant` et la ligne `ADMIN_PASSWORD_HASH='…'` telle quelle, **apostrophes comprises** (sans elles, Docker Compose interprète les `$`). Puis `docker compose up -d server`.
   - **Plesk** : Node.js › Variables d'environnement, `ADMIN_USERNAME` et `ADMIN_PASSWORD_HASH` avec la valeur **entre les apostrophes** (sans elles). Puis « Redémarrer l'application ».
3. Ouvre `/admin` et connecte-toi. Sans ces variables, la page dit que l'administration n'est pas configurée.

- Session de 8 heures, dans un cookie réservé à `/api/admin` (HttpOnly, Secure, SameSite=Strict) ; « Se déconnecter » la ferme. Après 5 essais ratés depuis une adresse, il faut attendre 30 s, puis le double à chaque échec (15 min au plus) ; 30 échecs en 15 minutes, toutes adresses confondues, ferment la connexion pour 15 minutes.
- Changer de mot de passe : refais l'étape 1, remplace `ADMIN_PASSWORD_HASH` et redémarre. Changer d'identifiant ferme les sessions ouvertes.
- Chaque connexion (réussie ou non) et chaque décision est inscrite au journal d'administration (onglet « Journal »), gardé un an.
- Supprimer un compte demande un motif (envoyé à la personne) et de retaper son pseudo exact ; ses campagnes disparaissent avec lui. C'est définitif.
- La page n'est jamais indexée (`noindex`, `X-Robots-Tag`, `robots.txt`) et n'apparaît pas dans le plan du site.
