# Mettre Codex en ligne

Guide pour installer Codex sur ton serveur PulseHeberg. Le site public (accueil, pages légales) et l'application sont servis par **Caddy**, qui obtient seul les certificats HTTPS ; la mesure d'audience **Umami** tourne à côté. Le serveur du mode en ligne (comptes, amis, salons, messagerie) s'ajoutera au même déploiement en phase 7.

## 1. Avant de commencer

- Un nom de domaine (par exemple `codex-jdr.fr`) dont les enregistrements DNS `A` (et `AAAA` si IPv6) pointent vers l'adresse IP du serveur, ainsi que `www` et `stats`.
- Sur le serveur (Debian ou Ubuntu) : Docker et son extension Compose (`curl -fsSL https://get.docker.com | sh`).
- Pare-feu : seuls les ports 22 (SSH), 80 et 443 (TCP et UDP pour 443) sont ouverts.

## 2. Renseigner les informations du site

Sur ton ordinateur, copie `.env.example` en `.env.production.local` et remplis-le : adresse du site, éditeur, contact, hébergeur (nom, adresse, contact, pays du centre de données). Ces informations apparaissent dans les mentions légales et la page Confidentialité ; tant qu'il en manque une, `npm run launch:check` refuse la mise en ligne.

## 3. Installer sur le serveur

```sh
# Sur ton ordinateur : construire le site et l'application
npm run build
# Copier la configuration et le build sur le serveur
scp -r deploy/ utilisateur@serveur:~/codex
scp -r dist/ utilisateur@serveur:~/codex/site
```

```sh
# Sur le serveur
cd ~/codex
cp .env.example .env    # puis remplis-le : domaine, e-mail, deux secrets (openssl rand -hex 32)
docker compose --env-file .env up -d
```

Caddy demande le certificat au premier accès : `https://ton-domaine` répond en HTTPS, `http://` y redirige.

## 4. Activer la mesure d'audience

1. Ouvre `https://stats.ton-domaine`, connecte-toi (identifiants par défaut d'Umami : `admin` / `umami`) et **change tout de suite le mot de passe**.
2. Ajoute un site web avec ton domaine et copie son identifiant.
3. Mets-le dans `.env.production.local` (`VITE_UMAMI_WEBSITE_ID=…`), reconstruis et recopie `dist/` sur le serveur.

## 5. Vérifier avant d'annoncer le site

```sh
npm run launch:check
```

Le contrôle reprend les 20 points de la liste de mise en ligne (pages RGPD et CGU, HTTPS, bandeau, titres, image de partage, favicon, sitemap, textes des images, poids des images et des pages, contraste, responsive, 404, liens, formulaires, anti-spam, analytics, un seul appel à l'action) et s'arrête au premier manque. Une fois en ligne, vérifie aussi :

- l'aperçu de partage avec l'inspecteur de publication de Facebook ou de LinkedIn ;
- la note HTTPS sur <https://www.ssllabs.com/ssltest/> (A+ attendu, grâce au HSTS) ;
- la soumission du sitemap dans Google Search Console.

## 6. Mettre à jour

Reconstruis, recopie `dist/` dans `~/codex/site` : Caddy sert les nouveaux fichiers immédiatement. Les fichiers versionnés (`/assets/…`) sont mis en cache un an ; les pages, jamais.
