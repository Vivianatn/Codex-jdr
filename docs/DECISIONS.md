# Journal des décisions

Choix techniques et UX non couverts par le cahier des charges ([SPEC.md](SPEC.md)), du plus récent au plus ancien. Format : contexte → décision → raison.

---

## Interface façon jeu vidéo (2026-10-12)

Demande du MJ : « gamifier » Codex et faire en sorte qu'il ne ressemble pas à une IA. Précisions du MJ : l'interface doit faire penser aux jeux vidéo, **sans ajouter de système de jeu** (pas de succès ni de progression du MJ) ; direction « RPG classique » (Baldur's Gate 3, Divinity) ; sons actifs par défaut, musique coupée ; retravailler l'apparence et les textes (le code, la documentation et l'historique git restent tels quels).

### D-250 · Direction « RPG classique »

- **Ce qui faisait « IA »** et disparaît : le violet d'accent (la couleur par défaut des interfaces générées), les icônes génériques au trait et les « étincelles » (compétences, états), les coins très arrondis, les surfaces lisses et identiques, l'effet verre.
- **Palette** : rouge sang pour l'action, laiton et or pour les cadres, cuir sombre (En jeu) ou parchemin (Préparation). Contrastes vérifiés (AA partout, AAA pour le texte courant) puis par axe dans les deux thèmes. Jetons nouveaux : `--codex-frame` (filet doré intérieur des panneaux, porté par les ombres), `--codex-bevel-hi/lo` (relief), `--codex-leather` (dégradé de cuir). Le violet reste seulement là où le jeu vidéo l'attend : rareté « épique » et Sagesse.
- **Composants** : boutons en relief qui s'enfoncent au clic (primaire rouge serti de laiton en petites capitales gravées, secondaire en cuir) ; jauges de PV façon HUD (creusées, cerclées, reflet, graduations tous les dixièmes) ; onglets en plaques reliées à la page ; section courante du menu en plaque sertie avec une barre rouge ; champs creusés ; sélecteurs en touches. Rayons 4 à 10 px.
- **Icônes** : glyphes game-icons.net (CC BY 3.0) pour tout ce qui appartient au jeu (sections, objets, états, dés, épées, couronne du MJ…), extraits par `scripts/game-icons.ts` (67 glyphes, seuls ceux utilisés vont dans le paquet) et affichés par `GameIcon` / `gameIcon()`. Les actions d'interface (fermer, annuler, ajouter) gardent des icônes au trait sobres. Crédits dans Paramètres › Crédits.
- Logo et favicon : un écu de cuir serti d'or, codex crème et losange rouge.

### D-251 · Sons et musique synthétisés

- **Aucun fichier audio** : chaque son est fabriqué par Web Audio au moment de le jouer (`src/lib/audio/`). Rien à télécharger, aucune licence, aucun poids dans le paquet. Sans Web Audio (tests, vieux navigateurs), tout reste silencieux sans erreur.
- **Bruitages, actifs par défaut** (choix du MJ) : dés qui roulent sur le bois, puis le verdict (réussite, échec, fanfare de cuivres et cloche pour un critique, ligne descendante et tambour pour un échec critique), coups (plus lourds quand un personnage tombe en Critique ou à 0), soins, montée de niveau, cloche à chaque tour, double tambour à chaque round, cor pour le tour du MJ, victoire, défaite, et un petit claquement de bois sur les boutons principaux et les onglets. Une salve de dégâts de zone ne fait qu'un seul son.
- **Branchés sur ce qui existe déjà** : `useGameSounds` écoute les effets visuels, les jets, les tours et les niveaux ; la logique du jeu ne change pas. La correspondance événement → son est pure (`soundEvents.ts`) et testée. Les niveaux sonores ont été mesurés par un rendu hors ligne et équilibrés, un limiteur évite la saturation quand les sons s'empilent.
- **Musique d'ambiance, coupée par défaut** : un bourdon et des notes pincées tirées d'une gamme modale, jamais deux fois la même ; « taverne » (ré dorien) pendant la préparation, « donjon » (ré phrygien) en jeu.
- Silencieux dans la fenêtre des joueurs (l'écran du MJ joue déjà) et dans un onglet en arrière-plan. Réglages dans Paramètres › Ambiance de jeu : bruitages et musique avec leur volume, bouton « Écouter un critique ».

### D-252 · Bannières des grands moments

- « Round N » traverse le plateau à chaque nouveau round ; « Victoire » quand tous les ennemis présents dans les groupes tombent à 0 PV, « Défaite » quand c'est le cas de tous les joueurs. Elles partent seules (1,8 s, 3,8 s), laissent passer les clics et sont annoncées aux lecteurs d'écran.
- Ce n'est **pas une règle** : rien ne change dans la partie, et une table qui ne considère pas 0 PV comme une défaite peut les couper (Paramètres › Ambiance de jeu ; actives par défaut, comme le reste de l'ambiance demandée par le MJ).

Demande du MJ : un serveur PulseHeberg héberge Codex et ses données ; mode en ligne complet, amitiés entre comptes, bouton pour passer de MJ/éditeur à joueur (rejoindre un salon), messagerie très poussée, et **avant toute chose** la liste des 20 points à vérifier avant de lancer un site web (capture d'une vidéo).

### D-248 · Site public et contrôle des 20 points de mise en ligne

- **Site public séparé de l'application** : accueil, Confidentialité, CGU, Mentions légales et page 404 sont de vraies pages HTML (rapides, indexables) ; l'application passe à `/app/` (`noindex`, exclue de `robots.txt`). Vite construit plusieurs pages (`appType: 'mpa'`, `site/plugin.ts`) : en-tête, pied de page, balises de partage et icônes injectés dans chaque page, `robots.txt` et `sitemap.xml` générés, adresses propres (`/cgu`) et vraie 404 en développement comme en production. `base: '/'` (chemins absolus, sinon la 404 casse en profondeur) ; un shell de bureau construira avec `CODEX_BASE=./`.
- **Les 20 points**, chacun vérifié automatiquement par `npm run launch:check` (`scripts/launch-check.ts` sur le build, `e2e/site.spec.ts` dans le navigateur) :
  - 1–2 : pages Confidentialité (RGPD) et CGU, liées depuis chaque page, plus les mentions légales (LCEN) ;
  - 3 : aucun secret dans ce qui part au navigateur (clés, chaînes de connexion, `.env`) ; seule variable publique : l'identifiant Umami ;
  - 4 : HTTPS forcé par Caddy (redirection et HSTS 2 ans), aucune ressource en `http://` ;
  - 5 : bandeau d'information sur la mesure d'audience, sur le site et dans l'application ; « Refuser » aussi simple qu'« Accepter », choix modifiable depuis le pied de page et les Paramètres. Codex ne dépose aucun cookie non indispensable : un « bandeau cookies » de consentement serait trompeur ;
  - 6 : titre et description uniques par page ; 7 : image de partage 1200 × 630 (55 kB) et balises Open Graph / Twitter ; 8 : favicon SVG et PNG, icône Apple, manifeste ;
  - 9 : sitemap et robots.txt ; 10 : texte alternatif pour chaque image (vérifié aussi dans le code de l'application) ; 11 : images compressées (budget par format, WebP au-delà de 100 kB ; les images importées dans l'app sont déjà redimensionnées en WebP) ;
  - 12 : poids au chargement, 50 kB compressés au plus par page publique (l'accueil fait une dizaine de kB hors image), 420 kB pour l'application ; cache d'un an sur les fichiers versionnés, compression zstd/gzip ;
  - 13–14 : contraste (axe, thèmes clair et sombre) et aucun défilement horizontal de 320 à 1440 px ; 15 : 404 personnalisée servie avec le statut 404 ; 16 : aucun lien interne cassé ;
  - 17 : formulaires : messages d'erreur visibles et lus par les lecteurs d'écran, sous le champ concerné (`aria-invalid`). La création de compte n'affichait jusqu'ici que l'info-bulle du navigateur ;
  - 18 : anti-spam, limites côté serveur, **à faire en phase 7** (le contrôle échoue tant qu'elles manquent) ;
  - 19 : Umami auto-hébergé, sans cookie, relayé sous `/stats` (même origine), coupé par Do Not Track / GPC, données effacées après 13 mois ;
  - 20 : un seul appel à l'action par page (accueil : « Ouvrir Codex »).
- **Rien d'inventé** : éditeur, adresse et contact de l'hébergeur, pays du centre de données et domaine restent « À COMPLÉTER » (`site/config.ts`, `.env.production.local`) ; le contrôle refuse la mise en ligne tant qu'il en reste.
- **CSP** : `connect-src 'self'` au lieu de `'none'` (mesure d'audience, puis API du mode en ligne) ; toujours aucune connexion vers un autre site. Caddy ajoute `frame-ancestors 'none'` en en-tête.
- **Déploiement** : `deploy/` (Caddyfile vérifié avec `caddy adapt` et testé en local ; Docker Compose : Caddy, Umami, sa base, l'effacement à 13 mois) ; guide : [DEPLOIEMENT.md](DEPLOIEMENT.md).
- Les pages publiques décrivent Codex **en ligne** (comptes sur le serveur, chiffrement de bout en bout, amis, messagerie) : elles ne seront publiées qu'une fois les phases 7 à 10 terminées. Leurs engagements deviennent des exigences de ces phases : cookie de session `HttpOnly; Secure; SameSite=Strict`, limitation des tentatives de connexion, journaux techniques gardés 1 an, comptes inactifs supprimés après 3 ans, sauvegardes effacées sous 30 jours, suppression du compte et export depuis l'application, signalement d'un message.

### D-249 · Mode en ligne sur serveur : choix et découpage

Choix du MJ : données **sur le serveur, chiffrées de bout en bout** (le serveur ne peut lire ni les campagnes ni les messages) ; serveur **Node.js, Fastify, PostgreSQL et WebSocket** derrière Caddy, en Docker Compose ; analytics **Umami auto-hébergé sans cookie** ; messagerie complète (privés et salons ; réponses, réactions, modification, épingles, recherche ; écriture en cours, accusés de lecture, présence, notifications, non-lus ; pièces jointes, partage de jets, fiches et objets, messages chuchotés du MJ).

Ce choix remplace D-241 (comptes locaux seulement) et D-245 (pair-à-pair WebRTC sans serveur). Découpage :

- **Phase 6** : site public et 20 points de mise en ligne (D-248).
- **Phase 7** : serveur et comptes. `server/` (Fastify, PostgreSQL, WebSocket, validation partagée), comptes en ligne dont le mot de passe ne quitte jamais l'appareil (seule une preuve dérivée est envoyée ; clés enveloppées comme aujourd'hui), clés publiques d'identité, session par cookie, limites anti-spam, reprise des comptes et campagnes locaux.
- **Phase 8** : amis et salons. Demandes, acceptation, blocage, présence ; bascule MJ/éditeur ↔ joueur ; salons pour rejoindre une campagne ou une partie (remplacent l'échange de codes WebRTC).
- **Phase 9** : campagnes sur le serveur, chiffrées de bout en bout. Une clé par campagne remise à chaque membre avec sa clé publique ; le serveur contrôle les droits sur les métadonnées (table, campagne, rôle) ; les joueurs reçoivent une vue réduite chiffrée avec une clé à part (toujours ni bestiaire ni notes du MJ) ; copie locale chiffrée pour le hors-ligne.
- **Phase 10** : messagerie chiffrée de bout en bout.

---

## Tableau de bord et journal des éditeurs (2026-10-12)

### D-247 · Le tableau de bord montre toute la campagne et ce qu'a fait chaque éditeur

Demande du MJ : « affiche toutes les données relatives à la campagne ainsi que les dernières choses qu'ont faites les éditeurs ». Rien n'enregistrait jusqu'ici **qui** avait fait une modification.

- **Tableau de bord** (DA §10.2) : en-tête (création, dernière modification), « La campagne en chiffres » (joueurs, alliés et familiers, ennemis en jeu, modèles du bestiaire, compétences, objets, états, cartes, séances préparées, parties jouées, jets ; chaque tuile mène à sa section), « Le groupe » (médaillon, niveau, barre de PV), « Partie » (en cours ou non, opérateur, carte en jeu, groupes, tour, dernière partie), « Derniers jets » (5) et « Ce qu'ont fait les éditeurs ». « Pour bien commencer » ne reste que tant que la campagne est vide.
- **Journal d'activité** : table `activity` (schéma v10), une ligne = auteur (identifiant + nom de compte), action, moment. L'action est le libellé que l'historique d'annulation donne déjà à chaque modification (« Gorak −7 PV », « Gobelin 2 déplacé ») : rien à maintenir en double. Les annulations et rétablissements sont consignés (« Annulé : … »). Les écritures qui ne passent pas par l'historique (bestiaire, bibliothèque d'objets, états, règles, jets favoris, séances, nom de la campagne) ajoutent leur ligne explicitement (`recordActivity`).
- **Lignes fusionnées** : la même action du même auteur dans les 2 minutes (déplacer un jeton pas à pas, taper dans un champ) met à jour la ligne avec un compteur « × 3 » au lieu d'en empiler. 300 lignes au plus par campagne ; seul l'hôte élague.
- **En ligne** : la table est synchronisée vers les éditeurs, **jamais vers les joueurs** (ce que prépare le MJ n'a pas à leur être révélé). Un co-éditeur écrit ses propres lignes ; l'hôte n'accepte que celles signées de l'identifiant et du nom de cet éditeur, et refuse toute suppression : personne ne peut se faire passer pour un autre ni effacer la trace d'un autre. Les intentions des joueurs (déplacer leur jeton, lancer leurs dés) sont signées de leur nom par l'hôte. Version du protocole passée à 2 (nouvelle table).
- **Pas dans l'export** : le journal décrit qui a travaillé sur la campagne, pas la campagne elle-même ; il est supprimé avec elle.

## Mise en page sans défilement horizontal (2026-10-12)

### D-246 · Jamais de barre de défilement horizontale

Demande du MJ (capture du panneau des groupes) : « il ne faut pas de barre de défilement horizontale, tout doit être disponible dès que l'on voit ».

- **Audit automatique** (`e2e/layout.spec.ts`, `npm run test:layout`, inclus dans `test:e2e`) : avec la campagne exemple, il parcourt l'écran de connexion, les campagnes, « Rejoindre une partie », chaque section de préparation, l'assistant de création, l'import Discord, chaque onglet d'une fiche, une session, l'éditeur de carte, le démarrage, la table, la manipulation rapide, la fenêtre joueurs, les paramètres et le panneau en ligne, à six tailles (1440, 1280, 1024, 768, 620 et 390 px de large). Il signale tout élément qui défile de côté, la page elle-même, et tout élément fixé à l'écran (notifications, fenêtres) qui en dépasse. Il a été vérifié en réintroduisant un défaut.
- **Corrigé** : les lignes du panneau des groupes prenaient la largeur de leur contenu (un `<button>` ne s'étire pas : `w-full`) ; la navigation de préparation et les onglets de fiche défilaient sur petit écran (ils passent à la ligne) ; le bandeau des tours cachait des groupes derrière une barre masquée (ils passent à la ligne) ; sur téléphone, l'en-tête poussait la page à 596 px (le sélecteur Préparation / En jeu prend sa propre ligne, « En ligne » devient une icône, le changement de thème reste dans les Paramètres) ; en jeu, les notifications étaient décalées pour une colonne de groupes absente sous 1024 px et sortaient de l'écran.
- Règle consignée dans CLAUDE.md : passer à la ligne, empiler ou réorganiser plutôt que `overflow-x-auto`.

---

## Sessions, partie démarrée à la main, mode en ligne (2026-10-12)

### D-244 · Les quêtes deviennent des sessions ; la partie se démarre à la main

Demande du MJ : « les quêtes deviennent des sessions qu'on peut utiliser et réutiliser », « le mode jeu démarré manuellement par un éditeur », « en jeu il n'y en a qu'un qui opère ».

- **Session préparée** (table `sessions`, schéma v9) : titre, résumé, objectifs, récompenses (XP, monnaie, objets), notes du MJ, carte à mettre sur le plateau, rencontres (modèles du bestiaire × nombre). Elle n'est jamais modifiée par le jeu : on la rejoue autant qu'on veut.
- **Partie jouée** (table `sessionRuns`) : une par démarrage — date, durée, mode, opérateurs successifs, participants, objectifs atteints, notes de la partie. L'onglet « Jouées » de la section Sessions en est l'historique. Les objectifs cochés appartiennent à la partie, pas à la session.
- La section « Quêtes » disparaît (absorbée) ; « Sessions » remplace l'écran vide prévu par la spec (journal de session : à compléter plus tard avec les jets).
- **Démarrage manuel** : l'écran En jeu affiche « Aucune partie en cours » tant que personne n'a démarré ; on choisit une session (ou une partie libre) et le mode (MJ seul / en ligne). Démarrer met la carte de la session sur le plateau, crée les ennemis des rencontres (numérotés) dans un groupe, et fait de celui qui démarre **l'opérateur**.
- **Un seul opérateur** (`play.live.operator`) : les autres éditeurs voient la table en lecture seule (`inert`, bandeau « X mène la partie »). L'opérateur peut passer la main à un éditeur connecté et termine la partie.
- Démarrer, passer la main et terminer **vident l'historique d'annulation** : on ne peut pas annuler à travers ces points de passage (l'historique est local à chaque appareil).
- Format d'export v8 (sessions et parties incluses) ; une partie en cours n'est jamais importée comme « en cours ».

### D-245 · Deux modes : MJ seul (local) et en ligne, pair-à-pair sans serveur

Demande du MJ : un mode « seulement MJ » local et un mode en ligne où des joueurs rejoignent une session et choisissent leur personnage ; plusieurs éditeurs peuvent préparer ensemble ; un compte a deux rôles (MJ et joueur). Choix du MJ : **pair-à-pair sans serveur**, **co-édition en direct chez le propriétaire**, **les joueurs déplacent leur jeton et lancent leurs dés**.

- **Transport** : WebRTC (canal de données chiffré DTLS). Pas de serveur de signalisation : l'hôte et chaque invité échangent **deux codes** (invitation puis réponse) par le canal qu'ils partagent déjà (Discord…). Le code contient la description de session et l'empreinte DTLS : la connexion n'accepte que l'appareil dont on a collé le code. Les candidats réseau sont collectés avant de produire le code (un seul échange). Serveur STUN public par défaut (`stun.l.google.com`), modifiable ou vide (même réseau seulement) dans les Paramètres ; pas de relais TURN, donc certains réseaux stricts (entreprise, certaines 4G) échoueront : limite assumée du « sans serveur ».
- **Topologie en étoile, l'hôte fait foi** : la campagne reste dans la base chiffrée du MJ propriétaire. Chaque invité reçoit une **copie temporaire** (base `codex-remote-*`, chiffrée avec une clé jetable, supprimée en partant ; les copies orphelines sont effacées au déverrouillage suivant). Toute l'interface existante fonctionne sur cette copie grâce à `activeDb()`.
- **Synchronisation** : un « fil des modifications » (middleware Dexie, après validation de la transaction) signale les écritures. L'hôte recalcule, pour chaque invité, ce qu'il a le droit de voir et n'envoie que les différences (empreinte par enregistrement). Un éditeur envoie ses propres écritures ; l'hôte les valide, les applique et accuse réception ; la copie de l'éditeur ignore les mises à jour de ses écritures pas encore confirmées. Conflits : la dernière écriture reçue par l'hôte gagne.
- **Ce que voit un joueur** : la carte en jeu sans éléments cachés, notes du MJ ni contenu des coffres fermés ; les jetons visibles ; le groupe ; les ennemis visibles réduits à nom, image, PV et états (ni statistiques, ni butin, ni description) ; les jets publics. Jamais le bestiaire, la bibliothèque d'objets, les sessions préparées ni les notes du MJ.
- **Ce que peut faire un joueur** : choisir un personnage joueur libre, déplacer **son** jeton et lancer **ses** dés (tests et jets libres), sous forme d'**intentions** que l'hôte vérifie (partie en ligne en cours, personnage à lui, case valide, pas de mur) puis joue lui-même : les dés sont tirés par l'hôte. En mode MJ seul, les intentions sont refusées.
- **Éditeurs** : tout le reste. Pendant une partie, seul l'opérateur (D-244) modifie personnages, cartes, jets et compétences ; l'hôte refuse les autres et renvoie la vérité. Un éditeur peut démarrer la partie (il devient opérateur) ; s'il se déconnecte, la main revient à l'hôte.
- **Validation par l'hôte** de chaque message : format, taille (5 000 enregistrements au plus), table autorisée, enregistrement appartenant bien à la campagne (y compris si le même identifiant existe dans une autre campagne), images matricielles uniquement.
- **Un compte, deux rôles** : chaque compte est MJ de ses campagnes et peut « Rejoindre une partie » comme joueur ou co-MJ selon l'invitation reçue. Pendant qu'il est invité, ses propres campagnes restent fermées et chiffrées ; « Quitter la partie » les rend.
- **Durée de vie** : la session en ligne vit tant que l'hôte reste dans la campagne avec Codex déverrouillé ; recharger la page, quitter la campagne ou verrouiller la ferme pour tous.
- La CSP (`connect-src 'none'`) ne s'applique pas à WebRTC ; vérifié sur le build de production (test e2e).

---

## Comptes, chiffrement et sécurité (2026-10-12)

Demande du MJ : « un système de compte et chiffre toutes les données », garder la base existante en la renforçant, « très forte protection ». Détail technique et modèle de menace : [SECURITE.md](SECURITE.md).

### D-241 · Comptes locaux et chiffrement de toutes les données

- **Comptes locaux, sans serveur** : un compte = un nom, un mot de passe et sa propre base chiffrée sur l'appareil. Un serveur aurait contredit le principe local-first et ajouté un traitement de données (RGPD) sans bénéfice pour une table de jeu.
- **Clé de données par compte** (256 bits), enveloppée par une clé dérivée du mot de passe (PBKDF2-SHA-256, 600 000 itérations, OWASP 2023) et, séparément, par un **code de secours** de 160 bits montré une seule fois. Sans l'un ni l'autre, les données sont perdues : c'est le prix d'un vrai chiffrement, dit clairement à la création.
- **Chiffrement par enregistrement** (XChaCha20-Poly1305, `@noble/ciphers`) dans un intergiciel Dexie : tout le code existant (dépôts, requêtes en direct, `modify`) fonctionne sans changement. Chiffrement synchrone obligatoire : une opération WebCrypto asynchrone ferme la transaction IndexedDB. Argon2id écarté : en JavaScript pur il serait plus lent que PBKDF2 natif à sécurité égale dans le navigateur.
- **Mots de passe** : 15 caractères minimum (NIST SP 800-63B rév. 4 pour un facteur unique), pas de règles de composition, refus des suites de touches, mots courants et du nom du compte ; conseil de phrase de passe. Ralentissement après 5 échecs (30 s doublés, 15 min au plus). Mot de passe actuel redemandé pour le changer, renouveler le code ou supprimer le compte.
- **Session en mémoire seulement** ; recharger la page redemande le mot de passe (garder la clé dans `sessionStorage` l'aurait écrite sur disque via la restauration de session du navigateur). Verrouillage automatique par défaut à 15 min, réglable (5, 15, 30, 60 min, jamais) ; bouton « Verrouiller » dans l'en-tête.
- **Fenêtre joueurs** : elle reçoit la session de la fenêtre du MJ par `BroadcastChannel` (même origine, jamais hors du navigateur) et se verrouille avec elle ; aucun mot de passe tapé devant les joueurs.
- **Reprise des campagnes existantes** : la base `codex` non chiffrée est copiée dans le premier compte créé, puis supprimée.
- Accès à la base : `activeDb()` (`src/db/db.ts`) au lieu d'un singleton ; les dépôts prennent un accesseur `() => CodexDB`.
- Les réglages d'affichage restent en clair dans `localStorage` (lus avant la connexion pour éviter le flash de thème ; rien de personnel).

### D-242 · Base de données renforcée (schéma v8)

- **Index réduits** à ceux que le code interroge : les champs d'index restent lisibles dans une base chiffrée, donc plus aucun nom (campagne, objet) n'est indexé.
- **Intergiciel d'intégrité** : refuse les enregistrements sans identifiant ou sans campagne quand la table l'exige (D-224).
- **Authentification liée au contexte** : la table et les valeurs d'index font partie des données associées ; déplacer une fiche dans une autre campagne en modifiant le fichier est détecté. Un enregistrement non authentique est signalé (toast) et lu comme absent.
- **Sauvegardes** : table `backups`, chiffrée comme le reste ; une automatique par jour à l'ouverture (si au moins une campagne), manuelles, trois conservées ; restauration précédée d'une sauvegarde de l'état actuel. Elles protègent des erreurs, pas de la perte de l'appareil (rôle des exports).
- **Sauvegarde automatique fiabilisée** : une écriture échouée (disque plein…) n'était pas réessayée et les modifications passaient pour enregistrées ; désormais l'état « dernier enregistré » est rétabli, un toast prévient et un nouvel essai a lieu toutes les 5 s.
- `navigator.storage.persist()` à la connexion.

### D-243 · Durcissement

- **CSP** injectée au build (`vite.config.ts`) : `default-src 'none'`, scripts du paquet et script de thème par empreinte, `connect-src 'none'` (aucune exfiltration possible), pas d'`eval`, `object-src`/`base-uri`/`form-action` fermés, `referrer` coupé. `style-src 'unsafe-inline'` reste nécessaire (Sonner, Radix injectent des `<style>`). Absente du serveur de dev (rechargement à chaud). Pas de source maps en production.
- **Imports** : `JSON.parse` sans clés `__proto__`/`constructor`/`prototype`, images limitées aux data URL PNG/JPEG/WebP/GIF/AVIF (SVG refusé), 256 Mo au plus. Les images ajoutées dans l'app étaient déjà ré-encodées par un canvas.
- **Tests e2e de sécurité** sur le build de production servi à part (port 4174).
- **Écarté** : Trusted Types (gain faible sans `innerHTML` dans le code, risque de casser des bibliothèques), chiffrement des exports (ils servent à la portabilité RGPD, à reconsidérer si le MJ le demande).

---

## Polices plus humaines et RGPD (2026-10-12)

### D-239 · Polices humanistes à la place de Cinzel, Fraunces et Inter

Demande du MJ : des polices « plus humaines ». Cinzel (capitales romaines gravées) et Inter (grotesque d'interface) donnaient un ton froid. Remplacement rôle pour rôle, toujours 100 % hors ligne (Fontsource) et sous licence SIL OFL 1.1 :

| Rôle                                                                      | Avant              | Après                                                        |
| ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ |
| Titres d'écran, surtitres, chiffres de caractéristiques, résultats de dés | Cinzel 500/600/700 | Alegreya SC 500/700 (petites capitales calligraphiques)      |
| Titres de section et de carte, noms                                       | Fraunces variable  | Alegreya variable                                            |
| Interface et texte courant                                                | Inter variable     | Source Sans 3 variable (sans humaniste, chiffres tabulaires) |

Alegreya et Alegreya SC sont de la même famille : les titres gardent une seule voix. Alegreya a des chiffres elzéviriens par défaut ; `body` active `lnum` pour que les nombres de jeu restent alignés. Alegreya SC n'a pas de graisse 600 : titres d'écran et de dialogue en 500 (plus légers, plus manuscrits), surtitres en 700. Le plateau (Konva) lit ses polices dans `BOARD_FONTS` (`boardTheme.ts`) au lieu de littéraux dispersés dans `MapCanvas`.

### D-240 · Conformité RGPD d'une application locale

Codex n'a ni serveur, ni compte, ni cookie, ni mesure d'audience, ni appel réseau (vérifié : aucun `fetch`, aucune ressource externe, polices embarquées). L'éditeur ne traite donc aucune donnée ; le MJ est seul responsable de ce qu'il y saisit, y compris sur ses joueurs (prénoms, pseudos Discord, portraits). Ce qui manquait pour qu'il puisse exercer et faire respecter les droits :

- **Information** : section « Données et confidentialité » dans les Paramètres (résumé + notice dépliable) et [CONFIDENTIALITE.md](CONFIDENTIALITE.md).
- **Accès et portabilité (art. 15 et 20)** : « Tout exporter » produit une archive JSON lisible (`codex-archive` v1 : toutes les campagnes au format `codex-campaign`). L'écran Campagnes réimporte indifféremment une campagne ou une archive.
- **Effacement (art. 17)** : « Tout effacer » vide toutes les tables IndexedDB et toutes les clés `codex.*` du localStorage, après une confirmation (seule modale autorisée : suppression), puis recharge l'application sur l'écran Campagnes. La suppression d'une campagne effaçait déjà tout ce qui lui appartient (D-224).
- **Minimisation** : rien n'est collecté en dehors de ce que le MJ saisit ; les réglages d'affichage ne contiennent aucune donnée personnelle.

Chiffrement de la base : fait ensuite, à la demande du MJ (D-241).

---

## Direction artistique « Codex à la chandelle » (2026-10-11)

La référence est [CODEX-DA.md](CODEX-DA.md), produit par Claude Design à partir du cahier des charges. Les entrées ci-dessous notent seulement les écarts et les choix d'application.

### D-235 · Thème sombre du mode En jeu appliqué à toute la page

Le document pose `data-theme="dark"` sur le conteneur de l'écran En jeu. Mais les menus, toasts et boîtes de dialogue s'ouvrent hors de ce conteneur (portails Radix) et seraient restés clairs. Le réglage « En jeu, toujours en sombre » (activé par défaut) bascule donc toute la page tant que l'écran En jeu est affiché ; la Vue joueurs est toujours sombre. L'interrupteur de thème de l'en-tête, en jeu, lève aussi ce réglage. Le grain de papier n'apparaît qu'en Préparation.

### D-238 · Application de la DA : ce qui est fait, ce qui reste

Le plan d'application du document (§12) a été suivi dans l'ordre, un commit par étape : tokens, polices, plateau, écran En jeu et éditeur, composants de base, composants de jeu, mouvement, Vue joueurs, ornements, états vides, réglages, vérification. Un test axe dédié (`e2e/da-a11y.spec.ts`) couvre les écrans refaits dans les deux thèmes. `npm run screens` produit les captures de contrôle.

Choix d'application :

- **Réglages** : ils restent une boîte de dialogue, enrichie de « En jeu, toujours en sombre », « Taille du texte » et « Grain de papier ». La page à navigation du document (§10.9) viendra avec la phase 6. Il n'y a pas de sons à régler.
- **Performance** : le compteur de zoom lit la caméra lui-même (sinon toute la page se redessinait à chaque image). Avec 200 jetons, le plateau tient la même cadence qu'avec aucun : les jetons ne coûtent plus rien de mesurable. La valeur absolue dépend de la charge de la machine (25 à 42 images/s mesurées le même soir, sans jeton, en rendu logiciel).

Éléments du document non réalisés, car ils dépendent de fonctions qui n'existent pas encore :

- menu radial au clic droit sur un jeton (§8.10) et palette de commandes Ctrl K (§10.1, §10.2) ;
- tableau de bord avec prochaine séance, quêtes et « À ne pas oublier » (§10.2) : il attend les phases sessions et quêtes ;
- fiche en deux colonnes avec carte d'identité à coins enluminés (§10.3), panneau de détail du bestiaire (§10.4), tiroirs épinglés côte à côte (§8.9) ;
- lanceur de dés en grande boîte de dialogue à trois colonnes et « lancer express » R (§10.7). Le panneau de dés existant a les nouveaux résultats.
- icônes game-icons.net (§11.2) : il faut d'abord récupérer les fichiers et leurs auteurs. Lucide reste utilisé en attendant.
- disposition tablette (colonne des groupes de 72 px, panneau rapide en volet bas) (§10.6).

### D-237 · Composants de jeu : écarts assumés

- **« Épique » reste le nom de la quatrième rareté.** Le cahier des charges (§4.11) dit « épique » ; l'écart 8 du document de DA affirme le contraire à tort. Elle prend les couleurs « très rare » du document.
- **La mini-fiche reste modifiable** (D-234, demande du MJ). Le document la prévoit en lecture seule. Elle en reprend le style : verre, sigles colorés, chiffres en Cinzel, fonds doux par caractéristique. La version compacte garde les sept caractéristiques, que le MJ a demandées.
- Les couleurs d'état choisies par le MJ (rouge, orange, jaune, vert, bleu, violet, rose, gris) sont rattachées aux familles du document (§8.16) : dégâts, alerte, bénéfique en or, soin, info, Sagesse, Charisme, neutre.
- Les personnages qui ont déjà joué sont désaturés dans le bandeau plutôt qu'à 50 % d'opacité : l'opacité faisait échouer le contraste des initiales (vu par axe).

### D-236 · Plateau : thème en littéraux, tailles qui suivent la case

- Les couleurs du plateau sont dans `src/features/maps/boardTheme.ts` (et non `src/board/`), à côté du canevas. Trois palettes : MJ clair, MJ sombre, joueurs.
- Les tailles en pixels du document sont données pour une case de 70 px. Elles sont converties à la taille de case de la carte, donc elles suivent le zoom, sauf la grille, la mesure, les zones et les signalements, qui restent en pixels d'écran.
- Les icônes du plateau sont les tracés Lucide (ISC), générés dans `boardIcons.ts` et dessinés en `Path2D`.
- La grille des nouvelles cartes est en couleur « automatique » (celle du thème). Le MJ peut toujours choisir une couleur, et les cartes existantes gardent la leur.
- La Vue joueurs ne montre jamais le nom d'un ennemi : la fonction « révéler le nom » du document n'existe pas encore.
- Le portrait d'un personnage à terre est assombri plutôt que désaturé : un filtre Konva aurait obligé à mettre chaque jeton en cache.

## Phase 4 — Plateau (2026-10-11)

### D-228 · Cartes de la campagne

- Une carte (`src/domain/maps.ts`, table `maps`) regroupe sa grille (carrée ou hexagonale, taille de case, décalage, couleur, opacité), son image de fond, son décor, ses objets interactifs (coffre, piège, levier, passage vers une autre carte, PNJ, note du MJ), ses murs et portes, ses jetons, ses dessins et son brouillard. Elle appartient à sa campagne (D-224).
- Les cartes vivent dans le store de campagne, à côté des personnages et de l'état de jeu : déplacer un jeton, ouvrir une porte ou déclencher un piège avec ses dégâts forment **une seule** entrée d'annulation.
- Toutes les actions de jeu sur une carte passent par `src/features/game/mapActions.ts` (placement, déplacement, portes, crochetage, perception de groupe, pièges, zones d'effet).
- La carte en jeu est `play.mapId`. Un passage permet d'en changer en un clic.

### D-229 · Images dans une table `assets`

Les fonds de carte et les images d'ambiance sont stockés à part (table `assets`, WebP, 4096 px au plus, 15 Mo au plus à l'import). Une carte ne garde que l'identifiant de son image, si bien que la sauvegarde automatique (fréquente) reste légère. L'export v7 contient `maps` et `assets`. Une copie à l'import renumérote tout : jetons, passages, PNJ, fond, carte en jeu et image d'ambiance.

### D-230 · Mesures et déplacements : rien d'imposé

- Distance diagonale configurable (`grid.diagonal`) : euclidienne par défaut (la plus neutre pour « 1 case = 1 m »), Chebyshev ou alternée (1-2-1).
- Portée de déplacement (`movement.baseCells`, `movement.perDexterity`) : **0 par défaut**, donc aucun cercle de portée n'est affiché tant que le MJ ne l'a pas réglée (D-217).
- Les murs et les portes fermées bloquent le glisser d'un jeton. Maj permet de forcer.

### D-231 · Brouillard de guerre

- Désactivé par défaut. Le MJ révèle ou masque au pinceau ou au rectangle. Il voit le brouillard en transparence, les joueurs ne voient rien dessous.
- Révélation automatique autour des jetons de joueurs (rayon en cases, ligne de vue arrêtée par les murs et les portes fermées) : désactivée par défaut, à activer par carte.
- Les ennemis posés sur une carte avec brouillard arrivent cachés aux joueurs.

### D-232 · Vue joueurs (second écran)

- `#/c/:id/view` s'ouvre dans une autre fenêtre. Elle ne charge **pas** le store de campagne, pour éviter que deux fenêtres sauvegardent en même temps : elle lit IndexedDB en direct (Dexie `liveQuery`, qui fonctionne entre onglets).
- La caméra du MJ et les signalements (ping, Alt + clic) passent par un `BroadcastChannel` (`codex-view-<campagne>`). La vue joueurs suit la caméra du MJ, ajustée à la taille de sa fenêtre, ou passe en caméra libre.
- Le MJ choisit ce qu'affichent les joueurs : la carte, une image d'ambiance ou une pause. Les joueurs ne voient ni le calque MJ, ni les éléments cachés, ni les pièges non repérés, ni les PV des ennemis.

### D-234 · Mini-fiches au-dessus des jetons

- En jeu, cliquer un jeton ouvre sa mini-fiche juste au-dessus de lui (ou en dessous près du bord haut) : PV avec le champ rapide (« -2 », « +5 », « t+4 »), les sept caractéristiques avec −/+, et un clic sur une valeur pour taper « -2 », « +1 » ou « 14 ». Les états s'ajoutent et se retirent au même endroit. Chaque modification est une étape annulable.
- La case « Mini-fiches des joueurs » affiche en permanence une version compacte en lecture seule (PV, caractéristiques, états) au-dessus de chaque joueur. Un clic l'ouvre en version complète.
- Les mini-fiches sont en HTML par-dessus le canevas, pas en Konva : texte net, champs de saisie natifs, accessibilité. Elles suivent la caméra. Échap ferme la mini-fiche ouverte.
- Le panneau rapide complet (objets, armes) reste accessible depuis la mini-fiche et depuis les groupes.
- Les mini-fiches ne s'affichent jamais dans la vue joueurs.

### D-233 · Rendu et performances

- Le plateau utilise Konva (react-konva 18, compatible React 18), réparti en calques : statique (fond, grille, décor, objets, murs), jetons, brouillard et dessins, puis superpositions.
- Les écrans de carte sont chargés à la demande (`React.lazy`), si bien que Konva reste hors du bundle principal.
- Les jetons sont mémoïsés : bouger la caméra ne recalcule pas les 200 jetons.
- Mesure (`npm run test:perf`, Chromium sans écran, rendu logiciel) : **≈ 35 images/s avec 200 jetons** pendant le zoom et le déplacement, contre ≈ 42 images/s sans aucun jeton dans le même harnais. Le test n'échoue que sous 20 images/s. Il tourne seul, car en parallèle les autres tests faussent la mesure.
- Dans l'éditeur, les panneaux sont posés à côté de la carte pour ne pas en masquer une partie. En jeu, ils flottent par-dessus, le temps d'une action.

## Phase 3 — Tours par groupes (2026-10-11)

### D-226 · Le suivi de combat est remplacé par des tours par groupes

À la demande du MJ, la phase 3 du cahier des charges (§6 : initiative, combat, XP de fin de combat, butin) est **abandonnée**. Elle est remplacée par un système de tours plus simple, en mode **En jeu** :

- Le MJ crée des **groupes** dans la barre latérale (nom libre) et y place n'importe quels personnages : joueurs, ennemis, alliés, familiers. Un personnage appartient à un seul groupe à la fois. Groupes et membres se réordonnent avec ▲▼, se renomment et se suppriment.
- Les tours suivent l'ordre : les **groupes l'un après l'autre**, et dans le groupe actif **ses personnages l'un après l'autre** (« Tour suivant »). Quand tous les groupes ont joué vient le **tour du MJ** : rien ne bouge tant qu'il ne clique pas sur « Reprendre », ce qui lance le round suivant depuis le premier groupe.
- Un **bandeau** en haut de l'écran indique le round, le groupe qui joue, ses personnages (celui dont c'est le tour est mis en avant, ceux qui ont déjà joué sont estompés) et les groupes suivants jusqu'au tour du MJ.
- Quand c'est au tour d'un personnage, ses **effets de début de tour** sont appliqués (D-208 : effets des états, durées, recharges). Ils n'existent que si le MJ les a définis (D-217).
- Chaque étape (tour suivant, reprendre, changement de groupe) est **une** action annulable par Ctrl+Z, avec ses effets. Les groupes et le tour en cours sont enregistrés avec la campagne, survivent au rechargement et partent avec l'export.
- Supprimer le personnage qui joue fait passer le tour au suivant ; supprimer son groupe passe au groupe suivant.
- L'initiative, le partage d'XP et le butin de fin de combat ne sont pas faits. Les §11.3 scénarios 3 et 4 du cahier des charges s'appuient désormais sur ce système.

### D-227 · Manipulation rapide pendant la partie

Un clic sur un personnage (bandeau ou groupes) ouvre un **panneau de manipulation rapide** par-dessus la carte, identique pour joueurs, ennemis, alliés et familiers :

- les **PV** (champ « -7, +5, t+4 ») ;
- les **sept caractéristiques** avec des boutons −1 / +1 sur la valeur de base, dans les bornes des règles (1 à 20 par défaut) ;
- les **objets et armes** : ajout en une ligne (nom, case « Arme » avec ses dégâts, équipement immédiat dans une main libre), équiper / déséquiper, retirer ;
- les **états** : ajout depuis la liste de la campagne, retrait d'un clic.

Chaque clic est une action annulable. Le bouton « Fiche complète » ouvre la fiche entière dans le tiroir.

---

## Demandes du MJ (2026-10-11, suite de la phase 2)

### D-218 · Compétences indépendantes

Les compétences sont des **entités de la campagne** (bibliothèque **Préparation › Compétences**), attachables à n'importe quel type de personnage.

- Un personnage porte une **copie liée** (`sourceId`) : toutes les règles continuent de lire `entity.skills`. Seuls les champs de définition (nom, type, caractéristique, description, modificateurs, utilisations max, recharge, effet) sont synchronisés. L'état propre au personnage (activée, utilisations restantes, recharge restante) est conservé.
- La bibliothèque vit **dans le même état annulable que les personnages** (`useCampaignStore`). Modifier ou supprimer une compétence met à jour tous ceux qui l'ont, en **une seule** action annulable par Ctrl+Z. Une bibliothèque hors de l'historique laisserait une annulation remettre les fiches à une version de compétence que la bibliothèque n'a plus.
- La bibliothèque est **propre à la campagne** et partie avec son export. Les compétences d'un modèle de bestiaire (partagé entre campagnes) sont reprises dans la bibliothèque de la campagne où on ajoute ses exemplaires.
- Sur la fiche : ajouter depuis la bibliothèque, créer (ce qui ajoute à la bibliothèque), modifier (avec un avertissement si la compétence est partagée), et « Retirer du personnage », qui ne supprime pas de la bibliothèque. Supprimer depuis la bibliothèque retire la compétence de tous ceux qui l'ont, après confirmation.
- Les compétences existantes et importées (Discord, anciennes sauvegardes) sont **adoptées automatiquement** : les copies identiques (même type, nom et description, sans tenir compte des accents ni de la casse) partagent une seule définition, les autres en créent une.
- Données : table `skills` (schéma v5) et export v5. Les anciens fichiers s'importent toujours.

### D-219 · Inventaire vide à la création

L'assistant n'a plus d'étape Inventaire : un personnage commence toujours avec un inventaire vide, et les objets s'ajoutent ensuite depuis sa fiche. L'**import Discord** garde l'inventaire écrit dans la fiche collée, car il s'agit de reprendre un personnage qui existe déjà.

### D-220 · Portrait et corps

En plus du portrait rond (recadré), chaque personnage a une **image du corps** (`identity.body`). Elle s'importe par clic ou glisser-déposer, sans recadrage, avec ses proportions et sa transparence (WebP de 768 × 1152 au plus). On la voit dans l'onglet Identité, dans le tiroir de fiche en mode **En jeu** et au centre de l'écran d'inventaire. Les jetons du plateau l'utiliseront en phase 4.

### D-221 · PV tirés ou donnés

Comme pour les caractéristiques, les PV max se saisissent de deux façons : le **d20 tiré** (10 + d20 + Nv) ou les **PV max donnés**, pour un personnage créé avant Codex. Dans le second cas, on stocke la valeur et le niveau auquel elle a été donnée (`hp.fixedMax`, `hp.fixedLevel`) ; les niveaux suivants appliquent la règle « PV par niveau ». Le choix se fait dans l'assistant et dans l'onglet Statistiques. Un import Discord dont les PV ne correspondent à aucun d20 garde ces PV comme PV donnés au lieu d'inventer un jet.

### D-222 · Inventaire façon jeu vidéo

- L'écran présente :
  - une **silhouette** : l'image du corps, avec les emplacements d'équipement autour (main principale, armure et accessoire 1 à gauche ; main secondaire et accessoire 2 à droite, plus la défense si la règle est active) ;
  - un **sac** en grille de cases encadrées selon la rareté, avec une lueur pour épique et légendaire, un badge de quantité et un « ? » pour un objet non identifié ;
  - un **panneau de description** de l'objet sélectionné, avec toutes ses caractéristiques et ses actions.
- Les objets équipés quittent le sac pour la silhouette. On les équipe en glissant une case sur un emplacement compatible, et on les déséquipe en les glissant sur le sac. Chaque action existe aussi en bouton, pour le clavier et le tactile.
- Un objet a une **icône** (36 dessins au choix, sinon celle de son type) ou une **image importée** (256 px au plus).

### D-223 · Familiers rattachables

Un familier se rattache à un **joueur, un allié ou un ennemi**. Sur la fiche du maître, un panneau « Familiers » liste ses familiers et permet d'en détacher, de rattacher un familier sans maître ou d'en créer un directement pour lui ; l'assistant arrive alors avec le maître déjà choisi. Les cartes de familier affichent « Familier de … ». Supprimer un maître libère ses familiers, et Ctrl+Z rétablit le lien.

### D-224 · Tout est propre à sa campagne

Précision du MJ (2026-10-11) : **tout appartient à une campagne**. Le bestiaire et la bibliothèque d'objets, qui étaient communs à toutes les campagnes de l'appareil, deviennent propres à chaque campagne, comme les compétences (D-218) et les états (D-217).

- Schéma v6 : `bestiary` et `itemLibrary` sont indexés par `campaignId`. La migration copie les anciens modèles et objets dans **chaque** campagne existante, pour ne rien perdre, et rebranche les ennemis déjà créés sur le modèle de leur propre campagne.
- L'export (version 6) contient le bestiaire et les objets de la campagne. Une campagne importée en copie reçoit ses propres modèles et objets, avec les liens ennemi → modèle conservés. Supprimer une campagne supprime aussi son bestiaire et sa bibliothèque d'objets.
- Cela remplace la partie « bibliothèques partagées » de D-106 et D-210.

### D-225 · Inventaires entièrement manipulables par le MJ

Le MJ fait ce qu'il veut de l'inventaire de **tous** les personnages, modèles du bestiaire compris : ajouter un objet, le modifier, le supprimer, l'équiper ou le déséquiper, régler sa quantité (boutons −1 / +1 dans le panneau de l'objet), le donner. L'import Discord garde l'inventaire de la fiche collée, que le MJ peut ensuite modifier librement. Seules les actions de jeu (Utiliser, Identifier, Donner) sont réservées aux personnages présents dans la campagne, pas aux modèles.

---

## Principe — Codex n'impose aucune règle (2026-10-11)

### D-217 · Toutes les mécaniques optionnelles sont désactivées par défaut

Le MJ a refusé toutes les valeurs par défaut proposées en D-201 : « chaque MJ décide, le logiciel doit être très libre ». En conséquence :

- **Remplace D-201.** Aucune mécanique de la phase 2 n'est active dans une nouvelle campagne. Chacune s'active et se règle dans **Préparation › Règles** : vide, 0 ou décoché = désactivé, et l'élément d'interface correspondant n'apparaît pas.
  - Attaques : pas de bonus de Force. Pas de dés à mains nues : le champ « Dégâts » de l'attaque est prérempli avec l'arme équipée, sinon vide ; vide = pas de jet de dégâts, le MJ applique ce qu'il veut.
  - Défense : calculée seulement si le MJ coche « à partir de la Dextérité » et/ou « bonus de l'équipement ».
  - Charge : 0 kg par point de Force = pas de capacité ni d'état « Surchargé ».
  - Fatigue : 0 niveau maximum = pas de compteur d'épuisement ; malus aux tests au choix du MJ.
  - Repos : le repos court n'existe que si le MJ donne des dés de soin ; le repos long ne fait que ce que le MJ coche (PV max, PV temporaires, épuisement, chance, compétences).
  - Points de chance : 0 = aucun (et pas de relance).
  - XP : par défaut un simple compteur, le niveau change à la main. Au choix : progression régulière (N × valeur) ou **table personnalisée** (XP totale pour les niveaux 2, 3, 4…).
  - Disposition : 0 = les tests sociaux ne déplacent pas la jauge, le MJ la règle à la main.
  - Monnaie : aucune pièce ; la bourse est un simple nombre jusqu'à ce que le MJ définisse ses pièces (nom, abréviation, valeur).
- **États.** Il n'y a plus d'états prédéfinis figés dans le code. Chaque campagne reçoit une **liste de départ** (Empoisonné, En feu…) : nom, icône et couleur seulement, **sans durée ni effet chiffré**. Le MJ peut tout modifier, dupliquer ou supprimer.
- **Restent actives** les règles confirmées par le MJ (D-101 : 2d20/2, PV, critiques, rappel de compétence, case de 1 m) et les seuils de PV du cahier des charges (§4.2). Elles restent modifiables.
- **Données existantes** : le schéma passe en v4. Pour chaque campagne, un groupe de règles encore égal aux anciennes valeurs inventées est remis à « désactivé », tandis qu'une valeur changée par le MJ est conservée. La liste d'états de départ est ajoutée si la campagne n'en avait pas. Le même nettoyage s'applique à l'import d'un fichier de version 3 ou antérieure. L'export passe en version 4.
- Tests : le principe est vérifié par `src/domain/freedom.test.ts`. Les tests des mécaniques utilisent un jeu de règles « MJ qui a tout activé » (`src/test/fixtures.ts`), jamais les valeurs par défaut.
- Au passage : les dialogues défilent quand ils dépassent la hauteur de l'écran (le bouton « Enregistrer » de l'éditeur d'état était inaccessible sur petit écran).

---

## Phase 2 — Dés et statistiques (2026-10-11)

### D-201 · Règles par défaut à valider par le MJ — **remplacée par D-217**

Ces règles n'étaient pas fixées par le cahier des charges ni par tes réponses. Elles ont toutes une valeur par défaut raisonnable et se modifient dans **Préparation › Règles** :

| Règle                                      | Valeur par défaut                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Bonus de Force aux dégâts au corps à corps | oui, `(Force − 10) / 2` arrondi à l'inférieur                            |
| Dégâts à mains nues                        | `1d4`                                                                    |
| Capacité de charge                         | 5 kg par point de Force effective                                        |
| Malus « Surchargé »                        | −2 en Dextérité                                                          |
| Épuisement                                 | 6 niveaux maximum, −1 à tous les tests par niveau                        |
| Repos court                                | +`1d6` PV                                                                |
| Repos long                                 | PV au maximum, −1 épuisement, points de chance et utilisations restaurés |
| Points de chance                           | 1 point par tranche de 5 de Chance effective                             |
| XP                                         | passer du niveau N à N+1 coûte 100 × N XP                                |
| Seuils de PV                               | « Blessé » sous 50 %, « Critique » sous 25 %                             |
| Disposition                                | ±1 cran par test social, ±2 sur un critique majeur                       |
| Monnaie                                    | 1 po = 10 pa = 100 pc                                                    |

### D-202 · Moteur de dés

- Grammaire complète dans `src/dice/parser.ts` : `NdM`, `d%`, `kh`/`kl`/`k`/`dh`/`dl`, + − × / et parenthèses, avec au plus 100 dés, 2 à 1000 faces et 120 caractères. Chaque erreur a un code et une position, traduits en français (« « ? » inattendu (caractère 8) »).
- La division s'arrondit selon la **règle d'arrondi de la campagne** (`2d20/2` au supérieur par défaut). Les valeurs restent exactes jusqu'au résultat final.
- Le hasard vient de `crypto.getRandomValues`. Les tests utilisent un générateur à graine (mulberry32), et la distribution de `2d20/2` est vérifiée sur 100 000 tirages, avec une tolérance de 0,4 point par valeur (≈ 5 écarts-types).
- Pour un test, le d20 « naturel » est le dé gardé (avantage = `2d20kh1`, désavantage = `2d20kl1`).

### D-203 · Historique des jets

Les jets sont des faits, pas des actions : ils ne s'annulent pas avec Ctrl+Z, mais les effets qu'ils déclenchent (dégâts, états, utilisations…) s'annulent. Ils sont stockés dans une table `rolls` par campagne, avec au plus 500 jets (les plus anciens sont supprimés), et inclus dans l'export JSON. Le journal d'un personnage fusionne ses événements et ses jets ; on évite ainsi de dupliquer les jets dans la fiche.

### D-204 · Tests et actions par caractéristique (§4)

- **Clic** sur la valeur d'une caractéristique : test normal. **Clic droit / appui long** ou bouton **⋯** (accessible au clavier) : avantage, désavantage, test secret, bonus/malus, puis les actions propres à la caractéristique.
- Malus d'épuisement appliqué à tous les tests. Les faces critiques l'emportent toujours (D-101).
- Faits en phase 2 : attaque au corps à corps (Force) et à distance (Dextérité) avec dégâts de l'arme équipée appliqués à la cible ; test opposé avec duel animé ; jets de résistance ; concentration ; discrétion, crochetage, esquive ; connaissances, énigme, identification d'objet ; persuasion, intimidation, tromperie (jauge de disposition d'un allié) ; intuition en jet secret ; résistance mentale ; relance avec un point de chance.
- Reportés : initiative et partage d'XP (phase 3, combat) ; déplacement, perception révélant des éléments du plateau, dégâts de zone sur des jetons (phase 4, plateau) ; tables de butin et d'événements, marchands et marchandage (phase 3 et extras de la phase 6) ; notes de lore à difficulté (avec les notes de campagne) ; indices d'énigme progressifs.

### D-205 · Test opposé

Une réussite bat un échec ; à égalité, une réussite critique (majeure > mineure) l'emporte et un échec critique pénalise ; à égalité encore, la plus grande marge gagne. Si tout est identique, c'est une égalité, et on relance.

### D-206 · Tests sociaux

La jauge de disposition (§4.7) n'existe que sur les **alliés** : les tests de persuasion, d'intimidation et de tromperie ciblent donc un allié. Une réussite fait monter la jauge d'un cran, un échec la fait baisser d'un cran ; un critique majeur la déplace de deux crans.

### D-207 · États automatiques, jamais stockés

« Blessé », « Critique », « À terre » (selon les PV), « Surchargé » (poids > capacité) et « Épuisement N » sont **calculés** à l'affichage. Ils ne peuvent donc jamais être désynchronisés, et un soin les fait disparaître. Le malus de Dextérité de « Surchargé » s'applique automatiquement aux valeurs effectives. L'état « à terre » de la liste du §4.10 (renversé) s'appelle **« Au sol »**, pour ne pas le confondre avec « À terre » à 0 PV.

### D-208 · « Passer un tour »

C'est le début du tour d'un personnage (§4.10, §6), dans cet ordre : effets par tour des états (dégâts ou soins tirés aux dés, PV temporaires consommés d'abord), rappel des jets pour se libérer (notification avec un bouton « Tenter »), décompte des durées avec notification à l'expiration, puis décompte des temps de recharge des compétences. Le tout forme **une seule** action annulable. Le suivi de combat de la phase 3 appellera la même fonction (`startOfTurn`).

### D-209 · Bibliothèque d'états

Les 13 états prédéfinis sont dans le code et ne se modifient pas. Le MJ crée ses propres états, ou **duplique** un état prédéfini pour l'adapter, dans **Préparation › États**. Les états personnalisés appartiennent à la campagne et partent avec son export. Un état appliqué à un personnage est une **copie** du modèle : modifier le modèle ensuite ne change pas les états déjà en cours.

### D-210 · Objets, équipement, monnaie

- Un objet a : type, rareté (liseré coloré), poids, valeur, emplacement d'équipement, modificateurs actifs une fois équipé, défense, dégâts, effet « Utiliser » et propriété cachée.
- Les emplacements sont main principale, main secondaire, armure et deux accessoires. Équiper un emplacement occupé déséquipe l'objet qui s'y trouvait.
- Défense = Dextérité effective + bonus de défense des objets équipés.
- La bourse est stockée en **plus petite pièce**. Les montants se saisissent librement (`+3 po`, `2 po 5 pa`, `-50 pc`), et la conversion s'affiche automatiquement.
- Le transfert d'objets entre personnages se fait par glisser-déposer sur le nom du destinataire, ou par le menu « Donner à… » (accessible au clavier). Les objets identiques s'empilent.
- La **bibliothèque d'objets** (Préparation › Objets) est commune à toutes les campagnes, comme le bestiaire.

### D-211 · Compétences actives

Une compétence active a un nombre d'utilisations par repos long (ou illimité), un temps de recharge en tours et un effet : dégâts, soin (même jet pour toutes les cibles) ou application d'un état. Au lancement, un test de la caractéristique liée peut être demandé. **Lancer consomme l'utilisation et lance la recharge, même si le test échoue.** Les cibles se choisissent parmi les personnages de la campagne ; le ciblage sur le plateau viendra en phase 4.

### D-212 · Saisie rapide des PV

Le champ unique accepte `-7`, `+5`, `t+4` (ou `t4`), et aussi des dés (`-2d6`). **Un nombre seul compte comme des dégâts**, le cas le plus fréquent en partie. Le champ se vide après chaque application pour qu'on puisse taper le coup suivant directement. Il se trouve dans l'en-tête de la fiche, dans l'onglet Statistiques et dans la barre d'accès rapide du mode En jeu.

### D-213 · Animations des dés

Le résultat s'affiche **immédiatement** ; les dés roulent pendant environ 0,65 s puis se posent. Sur un critique, une gerbe de particules dorées ; sur un échec critique, un tremblement et une teinte rouge. Une option « Animation des dés » permet de couper l'animation sans toucher aux autres animations. Les animations désactivées et le réglage système « réduire les animations » sont toujours respectés.

### D-214 · Fiche en jeu

En mode En jeu, cliquer sur un nom dans la barre d'accès rapide ouvre sa fiche dans un tiroir par-dessus la carte. Il n'y a qu'une fiche à la fois pour l'instant ; l'épinglage de plusieurs fiches côte à côte arrive en phase 5. Les modèles du bestiaire ne se « jouent » pas : pas de PV rapides ni de « Passer un tour » sur eux.

### D-215 · Reporté : webhook Discord

L'envoi des jets vers un salon Discord (§7, optionnel) est reporté aux finitions de la phase 6. Il envoie des données vers un service externe et demande une configuration et une confirmation explicites.

### D-216 · Données v3

Le schéma Dexie passe en v3 avec deux nouvelles tables, `rolls` et `itemLibrary`. Une campagne gagne une `library` (états personnalisés et jets favoris). Les personnages gagnent `purse`, `exhaustion` et `luckSpent`, et leurs objets, compétences et états ont des champs plus riches. La migration complète les campagnes (règles, bibliothèque) et les personnages existants, avec un test v2 → v3. L'export passe en `version: 3` (avec les jets) ; les fichiers v1 et v2 s'importent toujours.

---

## Phase 1 — Fiches (2026-10-11)

### D-101 · Règles confirmées par le MJ

Réponses aux questions de la section 13, appliquées comme valeurs par défaut dans `src/rules/config.ts` (`DEFAULT_RULES`) et modifiables par campagne dans **Préparation › Règles** :

| #   | Question                         | Règle retenue                                                                                                                      |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Arrondi de `2d20/2`              | Au supérieur (défaut conservé)                                                                                                     |
| 2   | PV à la montée de niveau         | **+1 PV max par niveau gagné**. Donc PV max = 10 + 1d20 + Nv à tout niveau.                                                        |
| 3   | Méthode des tests                | Jet sous la caractéristique, `1d20 ≤ valeur` (défaut conservé)                                                                     |
| 4   | Progression des caractéristiques | Non (défaut conservé)                                                                                                              |
| 5   | Gain de compétences              | Le MJ ajoute les compétences qu'il veut, quand il veut. **Tous les 10 niveaux, un rappel** l'invite à en ajouter une (voir D-104). |
| 6   | Critiques                        | **1 = réussite critique majeure, 2 = mineure ; 20 = échec critique majeur, 19 = mineur**                                           |
| 7   | Unité de grille                  | **1 case = 1 m**                                                                                                                   |

« On garde par défaut » a été interprété comme couvrant les questions sans réponse explicite (1, 3 et 4). Les faces critiques l'emportent toujours sur la comparaison : un 2 naturel réussit même sous une caractéristique de 1, un 19 naturel échoue même sous 20. Le critique élargi par la Chance (§4.9) existe, mais il est désactivé par défaut.

### D-102 · Statistiques et PV tirés à l'avance

Le MJ tire les caractéristiques et les PV avant la séance, pour tous les types de personnages. L'assistant ne lance donc aucun dé : on **saisit** soit la valeur finale, soit les deux d20 (l'app applique alors la division par 2 et l'arrondi de la campagne). Les PV se saisissent sous forme du d20 tiré, et le total `10 + jet + Nv` est affiché. Le lanceur de dés général (§7) reste prévu en phase 2, pour les jets que le MJ fera en partie. L'animation « la valeur se grave dans la carte » est conservée à la saisie.

### D-103 · PV max dérivé, jamais stocké

On stocke le **jet de PV** (`hp.roll`), pas le maximum. `PV max = base + jet + 1 + (Nv − 1) × PV par niveau` est recalculé partout (`rules/hp.ts`). Changer une règle met donc à jour toutes les fiches, et un import Discord retrouve le jet à partir du maximum. À une montée de niveau, les PV actuels augmentent du même nombre que le maximum.

### D-104 · Compétences de départ exigées pour les joueurs seulement (configurable)

La fiche Discord est celle des joueurs. Imposer « exactement 2 actives, 1 passive, 1 passif de classe » pour chaque gobelin serait un formulaire bloquant inutile (§9.5). L'assistant bloque donc pour les **joueurs** par défaut ; les types concernés se choisissent dans les règles de campagne. Après la création, **aucune limite** : le MJ ajoute le nombre de compétences qu'il veut, à n'importe quel niveau (précision du MJ, 2026-10-11). Quand un personnage franchit un multiple de 10 niveaux, une notification rappelle d'ajouter une compétence et une ligne est écrite dans son journal. Le rappel ne bloque rien ; son intervalle se règle (ou se coupe avec 0) dans les règles de campagne.

### D-105 · Format Discord

- Export : les libellés du modèle sont repris à l'identique (`## Etat :`, `- type d'arme`, `- Dexterité`, `----`). La description et le mindset vont dans un bloc de citation `>`. Les PV s'écrivent `actuels/max (10 + jet + 1)`. Les compétences sont préfixées `[Active]`, `[Passive]` ou `[Passif de classe]`, avec la caractéristique liée entre parenthèses. Les quantités s'écrivent `x2`. Les textes sur plusieurs lignes deviennent des lignes indentées.
- Les lignes d'aide du modèle (« (DETERMINE PAR LANCES… ) ») ne sont pas réécrites dans une fiche remplie.
- Import tolérant : accents, majuscules et deux-points facultatifs, `11,5`, `10 + 1d20+Nv = 27`, `(x20)`, `(active)`, et une ligne « Mindset : » libre. Ce qui manque prend une valeur par défaut et est signalé avant l'import.
- Ne passent pas par Discord : portrait, PV temporaires, modificateurs chiffrés des compétences, journal. L'aller-retour sans perte est vérifié sur tout le reste par un test par propriétés (300 fiches aléatoires).

### D-106 · Bestiaire partagé, exemplaires dans la campagne

Les **modèles d'ennemis** vivent dans une table `bestiary` commune à toutes les campagnes (§2.3 « réutilisables d'une campagne à l'autre »). « Ajouter à la campagne » crée N **copies indépendantes** numérotées (« Gobelin 4 », « Gobelin 5 »…, à la suite des numéros existants), au niveau choisi. Supprimer un modèle ne supprime pas ses exemplaires. L'export de campagne contient les exemplaires, pas les modèles ; l'export de la bibliothèque est prévu avec les extras de la phase 6.

### D-107 · État en mémoire, sauvegarde automatique, annulation

Comme prévu en D-008 : à l'ouverture d'une campagne, ses personnages sont chargés dans `useCampaignStore`, qui fait foi tant qu'elle est ouverte. Chaque modification est sauvegardée dans IndexedDB par différence de références, regroupée toutes les 250 ms, et forcée avant un export, un changement de campagne ou la fermeture de la page. Toutes les modifications de fiche sont annulables : **Ctrl+Z / Ctrl+Maj+Z**, boutons dans l'en-tête, et bouton « Annuler » dans les toasts de suppression et d'ajout d'ennemis. Les champs texte valident à la sortie du champ ou avec Entrée, pas à chaque frappe : une modification = une entrée d'historique. Les modèles du bestiaire sont édités directement en base, sans historique.

### D-108 · Portrait

Image importée par clic ou glisser-déposer, puis recadrée dans un dialogue (déplacement à la souris ou aux flèches du clavier, zoom au curseur), et enregistrée en carré WebP de 384 px dans la fiche (data URL). Les exports JSON restent ainsi autonomes, sans fichier image séparé.

### D-109 · Journal de fiche

Sont consignés : création ou import, changement de niveau, PV actuels et temporaires, valeurs de base des caractéristiques, compétences apprises ou retirées, états, objets obtenus ou retirés. Les simples corrections de texte (identité) ne le sont pas, pour garder un journal lisible. Il est limité à 500 entrées par fiche.

### D-110 · Export de campagne v2

Le format passe en `version: 2` et contient `entities`. Les fichiers v1 (phase 0) s'importent toujours : règles par défaut et aucun personnage. Lorsqu'une campagne est importée comme copie, ses personnages reçoivent de nouveaux identifiants, et les liens familier → propriétaire sont recâblés.

### D-111 · Tests

- Les tests de composants rendent l'application entière (routeur, Dexie sur fake-indexeddb, animations coupées). Le délai d'attente de Testing Library passe à 4 s et celui d'un test à 20 s : l'assistant tape des dizaines de champs.
- Les tests e2e démarrent l'app avec son réglage « Animations : désactivées » (et les audits axe attendent en plus la fin de toute animation CSS) : un contraste mesuré pendant un fondu, avec du texte encore semi-transparent, donnait de faux positifs intermittents.
- Playwright utilise la moitié des cœurs (`workers: '50%'`) avec un délai de 60 s par test : chaque test pilote toute l'application.

---

## Phase 0 — Fondations (2026-10-11)

### D-001 · Versions de l'outillage

- **React 18.3** comme demandé. Conséquence : **React Router 7** (la v8 exige React 19).
- **ESLint 9** : `eslint-plugin-jsx-a11y` ne supporte pas encore ESLint 10.
- **Tailwind CSS 4** (configuration en CSS, sans `tailwind.config.js`), **Vite 8**, **Vitest 5**, **TypeScript 6** en mode strict, plus `noUncheckedIndexedAccess`.
- Node.js 24 LTS installé en version portable dans `%LOCALAPPDATA%\Programs\nodejs` : pas d'installeur système ni de droits administrateur.

### D-002 · Routage par hash

`createHashRouter` (`#/c/<id>/prep/players`). Les liens profonds fonctionnent sans serveur, depuis `file://` et dans la future enveloppe Tauri (phase 6). Le build utilise `base: './'` pour la même raison.

### D-003 · Structure des URL et modes

- `/` : liste des campagnes.
- `/c/:id/prep/:section` : mode **Préparation**, avec 9 sections (tableau de bord, joueurs, bestiaire, alliés et familiers, objets, cartes, sessions, quêtes, notes).
- `/c/:id/play` : mode **En jeu**.
- La bascule Préparation ⇄ En jeu est un contrôle segmenté toujours visible dans l'en-tête : **1 clic**. Le retour en Préparation rouvre la dernière section visitée de cette campagne (mémorisée par appareil).
- Le mode actif est déduit d'une correspondance de route exacte (`useMatch`), pas d'une recherche de sous-chaîne : `/prep/players` contient `/play` (bug trouvé par l'e2e).

### D-004 · Réglages de l'appareil dans localStorage, campagnes dans IndexedDB

Thème, niveau d'animation et langue sont **par appareil**, pas par campagne. Ils sont dans `localStorage` (store Zustand `persist`) pour pouvoir être lus de façon synchrone par un petit script dans `index.html` : le bon thème s'applique avant le premier rendu, sans flash clair/sombre. Toutes les données de jeu vont dans IndexedDB (Dexie).

### D-005 · Thème

- Clair par défaut (cahier des charges), sombre, ou « Système » (suit `prefers-color-scheme` en direct).
- Bouton soleil/lune dans l'en-tête pour basculer en un clic ; le choix « Système » est dans les Paramètres.
- Les couleurs vivent dans `src/styles/tokens.css` (`--codex-*`) et sont exposées à Tailwind via `@theme inline`, ce qui permet de changer de thème à l'exécution.
- **Contraste AA** : l'améthyste `#6D5BD0` et l'or `#D9A441` du cahier des charges ne sont pas assez contrastés comme couleur de _texte_ (l'or sur ivoire fait ≈ 2:1, l'améthyste sur fond sombre ≈ 3:1). On ajoute des variantes réservées au texte (`--codex-accent-text`, `--codex-gold-text`, `--codex-hp-text`, `--codex-heal-text`) ; les couleurs d'origine restent pour les aplats, bordures et décors. Le texte secondaire sombre (`#A9A4BD`), absent du cahier des charges, a été choisi pour passer l'AA.
- Les couleurs de caractéristiques sont légèrement éclaircies en thème sombre, pour rester lisibles sur `#1E1C29`.

### D-006 · Animations

- Réglage « Complètes / Réduites / Désactivées », appliqué via `MotionConfig` (`reducedMotion`, `skipAnimations`) et un attribut `data-motion` sur `<html>` pour les transitions CSS.
- Le réglage système `prefers-reduced-motion` est **toujours respecté**, même en mode « Complètes ».

### D-007 · i18n typée sans bibliothèque

Un objet de messages par langue (`src/i18n/locales/fr.ts`) ; les chaînes paramétrées sont des fonctions (`t.campaigns.deleted(name)`). Le type `Messages` oblige toute future langue à fournir exactement les mêmes clés, et une clé manquante est une erreur de compilation. Pas d'i18next : inutile tant qu'il n'y a qu'une langue, et sans risque de clé inconnue au runtime. L'interface tutoie le MJ, comme les exemples du cahier des charges.

### D-008 · Annuler/rétablir par instantanés

`src/stores/history.ts` : un middleware Zustand qui garde des instantanés d'une _tranche_ d'état choisie (`select`). Les mises à jour sont immuables, donc un instantané ne contient que des références : en garder 200 ne coûte presque rien. Chaque entrée a un libellé (pour l'historique visible demandé en §8.9). `transaction(label, fn)` regroupe plusieurs modifications en une seule entrée (ex. dégâts de zone), et `untracked(fn)` sert au chargement. **Conséquence d'architecture pour la suite** : pendant une partie, l'état de la campagne ouverte vit en mémoire dans des stores Zustand (source de vérité, annulables) et est sauvegardé automatiquement vers Dexie (en différé). On ne lit pas Dexie directement depuis les composants de jeu.

### D-009 · Export/import de campagne

- Format JSON versionné : `{ format: "codex-campaign", version: 1, exportedAt, campaign, … }`. Les phases suivantes ajouteront leurs tables à ce document, en incrémentant `version` si la forme change.
- Un fichier issu d'une version **plus récente** de Codex est refusé avec un message clair.
- Si une campagne avec le même identifiant existe déjà, l'import crée une **copie** (nouvel identifiant, nom suffixé « (copie) ») au lieu d'écraser : on ne détruit jamais de données sans confirmation.
- Nom du fichier : `codex-<nom-slugifié>-<AAAA-MM-JJ>.json`.

### D-010 · Polices embarquées

Inter (variable) et Cinzel sont livrées via `@fontsource`, sans Google Fonts : l'app reste 100 % hors ligne (local-first, Tauri).

### D-011 · Taille du bundle

Un seul bundle de ≈ 215 kB gzip en phase 0. Pour une app locale, c'est bien en dessous de l'objectif d'ouverture en moins de 2 s. Le seuil d'avertissement de Vite est relevé à 800 kB (1 000 kB en phase 2, ≈ 280 kB gzip) ; le découpage par route (`React.lazy`) est prévu avec l'optimisation de la phase 6, ou plus tôt si le plateau (Konva/Pixi) alourdit beaucoup le bundle.

### D-012 · Modales

Les `Dialog` (Radix) servent uniquement en Préparation (création, renommage) et pour les confirmations de suppression. En mode En jeu, les phases suivantes utiliseront des tiroirs et des toasts (`sonner`, en bas à droite, non bloquants).
