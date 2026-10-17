# Journal des décisions

Choix techniques et UX non couverts par le cahier des charges ([SPEC.md](SPEC.md)), du plus récent au plus ancien. Format : contexte → décision → raison.

---

## Téléportation par le MJ (2026-10-17)

### D-276 · Le MJ téléporte qui il veut, où il veut, sans condition

Demande du MJ : « Un MJ peut téléporter les personnages qu'il souhaite, de force, sur une autre carte, sans condition ; il choisit la destination de chacun ; simple et rapide à utiliser. »

- **Domaine pur** : `teleport(maps, moves)` (`src/domain/maps.ts`). Chaque jeton quitte toutes les cartes où il se trouve et atterrit sur la cible, à `at` s'il est donné, sinon à côté du point d'arrivée de la carte (`arrivalCell` : à côté du passage qui ramène d'où il vient, sinon au centre), sur une case libre et jamais sur un passage. Plusieurs personnages vers la même carte partagent ce point d'ancrage : ils atterrissent sur des cases distinctes et voisines, le groupe reste groupé. Taille et état caché conservés ; un personnage sans jeton en reçoit un (un ennemi naît caché sous le brouillard, comme `withToken`). Murs, portes, brouillard et passages ne comptent pas. Cible = sa propre carte → il va au point par défaut. Les cartes non touchées gardent leur identité (pas d'écriture inutile ni de synchro).
- **Familiers** : `withFollowingFamiliars` (`src/domain/familiars.ts`) ajoute, juste après leur maître, les familiers reliés qui sont sur un plateau ; un familier non posé reste hors plateau, un familier qui a sa propre destination la garde. Case « Les familiers suivent », cochée par défaut.
- **Action** : `teleportCharacters(moves, { familiarsFollow })` (`mapActions.ts`) = UNE entrée d'annulation pour toutes les cartes touchées, brouillard révélé automatiquement comme `placeToken`. Toast « Lyra et Gorak téléportés vers « Crypte » » (ou « N personnages téléportés » si plusieurs destinations) avec l'action « Aller sur « Crypte » » : le plateau du MJ ne bascule jamais tout seul.
- **Chemin rapide** : sous-menu « Téléporter vers… » dans le menu du personnage (`BoardMenu` : rangées des groupes, familiers, mini-fiche du jeton), cartes triées par nom, coche sur la carte où il se trouve, « en jeu » sur celle du plateau. Un clic = téléporté.
- **Chemin multiple** : bouton « Téléporter » (baguette) dans les options du plateau, à côté du choix de carte ; popover non bloquant (`TeleportPanel`). Liste : tous les personnages joueurs + quiconque a un jeton (joueurs, alliés, familiers, ennemis), chacun avec sa case à cocher, la carte où il est et son propre choix de destination (changer la destination coche la ligne). Raccourcis « Joueurs », « Ennemis », « Sélection » (jetons sélectionnés sur le plateau, déjà cochés à l'ouverture), « Tous », « Aucun » ; « Tout envoyer vers » règle d'un coup les lignes cochées ; un seul bouton « Téléporter (n) ». Les lignes se replient à 390 px, le popover défile verticalement s'il le faut.
- **Réservé à l'opérateur** : le plateau du MJ n'existe que sur l'écran de jeu, déjà `inert` pour les non-opérateurs (D-244) ; les joueurs (écran invité) ne le voient jamais.
- **En ligne** : rien de spécial — la modification des cartes se synchronise comme les autres, et chaque joueur voit la carte où se trouve son personnage (`projectForPlayer`, D-256) : un joueur téléporté suit donc sa destination (test de projection).

---

## Tableau d'administration (2026-10-17)

### D-275 · Un tableau `/admin` pour voir la plateforme et modérer à la souris

Demande du MJ : un tableau de bord à `https://codex.antoine-vivian.fr/admin`, protégé par identifiant et mot de passe, pour voir les données de la plateforme et modérer très simplement (jusqu'ici : ligne de commande `moderate.js`, D-271).

- **Identifiants uniquement dans l'environnement du serveur** : `ADMIN_USERNAME` et `ADMIN_PASSWORD_HASH` (empreinte scrypt au format des mots de passe des comptes, `secrets.ts`). Absents : toute connexion est refusée (503, « administration non configurée »). Rien n'est écrit en dur. `npm run admin:hash` (`server/src/adminHash.ts`) lit le mot de passe (saisie masquée, entrée standard ou argument ; 12 caractères au moins) et imprime `ADMIN_PASSWORD_HASH='…'`, entre apostrophes pour que Docker Compose ne lise pas les `$` ; `config.ts` retire ces apostrophes si on les colle.
- **Session séparée, stockée côté serveur** : nouvelle migration 4, table `admin_sessions` (empreinte SHA-256 du jeton, comme les sessions des comptes) plutôt qu'un jeton signé en mémoire — elle se révoque (déconnexion), survit à un redémarrage et ne demande pas de clé de plus. Cookie `codex_admin` HttpOnly, SameSite=Strict, Secure en production, chemin `/api/admin`, 8 heures fixes. Changer `ADMIN_USERNAME` invalide les sessions ouvertes.
- **Connexion** : identifiant comparé en temps constant (SHA-256 + `timingSafeEqual`), vérification scrypt faite même si l'identifiant est faux (empreinte factice). Limite par adresse : 5 essais libres puis attente de 30 s doublée jusqu'à 15 min ; 30 échecs en 15 min toutes adresses confondues ferment la connexion 15 min ; plus `@fastify/rate-limit` (10 par 15 min). Compteurs en mémoire : un redémarrage les remet à zéro, acceptable pour un seul administrateur.
- **CSRF** : SameSite=Strict, contrôle d'origine global (app.ts) et, sous `/api/admin`, toute requête qui modifie doit être en `application/json` (415 sinon). Toutes les réponses : `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`.
- **Journal** : table `admin_audit` (qui, action, cible, libellé de la cible, motif, adresse IP, date) pour chaque connexion, échec, déconnexion et décision ; un identifiant raté n'y est pas recopié (ce pourrait être un mot de passe tapé dans le mauvais champ). Gardé un an (balayage quotidien `sweepAdmin`, avec les sessions expirées).
- **Modération** : les routes appellent `moderation.ts` (`hideProfile`, `suspendAccount`, `dismissReport`…) pour garder les exposés des motifs (DSA art. 17) et la réponse à l'auteur du signalement ; une suspension coupe aussi les connexions temps réel. **Supprimer un compte** réutilise la suppression de `auth.ts` (extraite en `deleteAccount`), exige un motif et le pseudo exact retapé, et envoie un exposé des motifs (`deleteAccountFor`, nouvelle restriction « deletion »).
- **Données montrées** : comptes, campagnes, parties en cours (`live` non nul, dont en ligne), membres, signalements ouverts, inscriptions par jour sur 30 jours (barres CSS + tableau pour lecteurs d'écran). Les campagnes ne montrent que leurs métadonnées (nom, MJ, membres, partie, catalogue, date) : leurs enregistrements restent scellés et ne sont jamais lus.
- **Page** : entrée Vite `admin/index.html` (comme `app/`) avec son propre petit arbre React (`src/admin/`, ~6 kB gzip hors React et styles partagés) qui réutilise `Button`, `TextField`, les jetons et styles typographiques ; pas de store, pas de base locale, thème selon le système. Les textes sont dans `fr.ts` (`admin`), importés directement (pas `useT`, qui chargerait le store des réglages). Pas de modale : les confirmations s'ouvrent dans la carte. Même CSP que les autres pages (hash du script de thème). Servie par Caddy (`try_files {path}/index.html`) comme par le serveur Node (`site.ts`), et par `npm run dev` (`site/plugin.ts`) ; `noindex` (meta + `X-Robots-Tag`), `Disallow: /admin`, hors sitemap — le point 9 de `launch:check` le vérifie désormais.

## Plusieurs MJ à égalité (2026-10-17)

### D-274 · Un MJ donne les mêmes droits à un autre MJ

Demande du MJ : « qu'un MJ donne les mêmes droits à un autre utilisateur en MJ sur une campagne, pour avoir plusieurs MJ ». Jusqu'ici, seul le propriétaire nommait ou retirait les co-MJ, listait la campagne dans la recherche ; un co-MJ ne gérait que les joueurs.

- Tous les MJ (`owner` et `editor`) ont les mêmes droits : accepter une demande en tant que MJ ou joueur, nommer un joueur MJ, repasser un MJ joueur, retirer n'importe quel membre, gérer le lien d'invitation et l'inscription à la recherche, mener la partie, modifier toute la campagne.
- Le propriétaire devient le « MJ principal » (libellés : MJ principal / MJ / Joueur ; « Co-MJ » disparaît). Lui seul supprime la campagne et la transmet ; personne ne peut le repasser joueur ni le retirer.
- Transmission : `POST /api/campaigns/:id/transfer { userId }`, réservée au MJ principal, vers un autre membre déjà MJ ; en une transaction (`FOR UPDATE` sur la campagne), l'ancien propriétaire devient MJ, la cible propriétaire, `campaigns.owner_id` suit.
- Panneau En ligne › Membres : « Nommer MJ » (sans confirmation, réversible), « Repasser joueur » et « Transmettre la campagne » après confirmation ; chaque action laisse un toast et une ligne au journal d'activité.
- Un MJ repassé joueur ou retiré pendant qu'il mène la partie en ligne cesse de la servir (`mayServe` vérifie aussi le rôle) : ses joueurs sont sortis de la partie.

Raison : le MJ veut des MJ égaux ; garder un MJ principal évite qu'une campagne se retrouve sans personne pour la supprimer et qu'un MJ en écarte un autre de sa propre campagne.

À suivre :
- Supprimer le compte du MJ principal supprime ses campagnes en cascade, même s'il reste d'autres MJ : lui conseiller de transmettre d'abord (ou transmettre automatiquement au plus ancien MJ).
- Si le MJ qui menait la partie est repassé joueur ou retiré, la partie reste à son nom : les autres MJ ne peuvent ni la terminer ni la reprendre (règle « seul l'opérateur termine ou transmet », D-244). Il faudra permettre à un MJ de reprendre une partie dont l'opérateur n'est plus MJ.

## Version alpha (2026-10-17)

### D-273 · Codex passe en 0.1.0-alpha

Demande du MJ : après les couleurs des joueurs, la grande animation des dés, les familiers au tour de leur maître, la réactivité en ligne, le nouvel écran de jeu et la mise en conformité (D-268 à D-272), la plateforme passe en version alpha.

- `package.json` et `server/package.json` passent de `0.0.0` à `0.1.0-alpha` ; la version affichée (Paramètres › À propos, pied de page du site) vient de là, sans valeur recopiée ailleurs.
- Alpha = service sans garantie (section `#alpha` des CGU), signalé par le badge « Alpha ».
- Les faits légaux encore `TO_FILL` (D-271) restent à fournir par le MJ avant l'ouverture publique : `npm run launch:check` les liste.

## Écran de jeu : le plateau d’abord, les joueurs toujours en vue (2026-10-17)

### D-272 · Bande des joueurs, panneaux côte à côte et repliables, moins de défilement

Demande du MJ : « améliore la visibilité de l’écran principal d’une session pour bien laisser voir les joueurs ; le moins de scroll possible dans chaque fenêtre de fonctionnalité ». Constat sur captures (1440×900, 1366×768, 1024×768, 390×844) : panneaux flottants qui se recouvraient (groupes sous la bannière de round, contrôles de carte sous la manipulation rapide), manipulation rapide qui défilait sur deux écrans, groupes absents sous 1024 px, bouton « Tour suivant » coupé sur téléphone, les mêmes valeurs affichées deux fois (Tests et Caractéristiques).

- **Bande des joueurs** (`PartyStrip`, en haut du plateau, chez le MJ et chez le joueur en ligne) : chaque personnage joueur à sa couleur (D-268, anneau du portrait, nom), ses PV (barre + chiffres), ses états (icônes), un point « en ligne / hors ligne » quand la partie est en ligne, le halo doré de celui qui joue et ses familiers accolés (D-269). Un clic ouvre la manipulation rapide (MJ) ; chez le joueur elle est en lecture seule et sa propre carte est teintée. Repliable en portraits seuls (retenu sur l’appareil) et automatiquement en portraits quand la place manque (requête de conteneur sur la zone du plateau, pas sur la fenêtre).
- **Panneaux côte à côte** : l’écran de jeu pose au-dessus du plateau une mise en page en colonnes — rail des tours à gauche, bande des joueurs et contrôles de carte en haut, outils en bas, manipulation rapide à droite. La carte (chargée à part, Konva) envoie ses contrôles dans ces emplacements (`boardSlots`, portail React) : plus aucun panneau n’en recouvre un autre et le centre du plateau reste libre. Sur téléphone la manipulation rapide devient une feuille en bas d’écran.
- **Rail des tours repliable** : en-tête « Groupes » avec bouton pour le masquer (retenu sur l’appareil, `uiStore.play`) ; sous 1024 px il s’ouvre à la demande par-dessus le plateau (avant : invisible). Lignes denses : une ligne par personnage (portrait à sa couleur, nom, PV), le champ PV et les états dessous ; monter, descendre et retirer du groupe passent dans le menu « ⋮ » de la ligne (avec les gestes du plateau), monter/descendre/supprimer un groupe dans le menu du groupe. « Sans groupe » et « Ajouter un familier » se replient (le second, rare, est replié par défaut ; il reste aussi dans le panneau du maître). Le contenu défile dans le rail, jamais hors de sa carte.
- **Manipulation rapide sans défilement** aux tailles courantes : en-tête compact fixe (portrait, nom, PV, champ PV, fiche complète, fermer), puis **une seule grille « Tests et caractéristiques »** (le nom lance le test, − et + changent la valeur : la valeur n’apparaît plus deux fois), les gestes du jeton, puis Objets **ou** États (segments, choix retenu). Ajout d’objet sur une ligne ; les champs d’arme n’apparaissent que pour une arme. Liseré du haut à la couleur du personnage (or pour le MJ).
- **Bandeau des tours** sur une ligne fine à partir de 1024 px ; sur téléphone le round et les boutons d’abord, l’ordre des groupes dessous, rien n’est coupé. « Arrêter les tours » en icône sous 1280 px (nom accessible gardé), portraits des groupes à la couleur des joueurs, « Qui joue » masqué sur téléphone (les portraits du bandeau font la même chose).
- **Contrôles de carte compacts** : « Suivre le tour » et « Mini-fiches des joueurs » en icône + case, le texte quand le plateau est large ; la barre d’outils passe à la ligne au lieu de déborder ; le zoom et le libellé « Vue joueurs » se cachent quand la zone est étroite (molette et pincement restent).
- **Écran du joueur en ligne** : plateau d’abord, bande des joueurs dessus, fiche plus dense (barre de PV, tests en grille de quatre), et sur téléphone la fiche est un panneau du bas repliable (au plus 45 % de la hauteur) : la page ne défile plus en hauteur (D-261).
- **Accessibilité** : cibles de 40 px sur écran tactile (`pointer-coarse`), menus et replis au clavier avec `aria-expanded`, cartes des joueurs avec un nom complet (« Lyra : 18 / 22 PV, en ligne, à son tour, états : … »), animation réduite respectée (la manipulation rapide apparaît en fondu).
- **Raison** : le MJ regarde la table, pas les panneaux ; voir d’un coup d’œil l’état de chaque joueur et garder le plateau dégagé compte plus que tout afficher à la fois. Les gestes rares sont à un clic dans un menu plutôt qu’à l’écran en permanence.

## Conformité légale pour l'alpha publique (2026-10-17)

### D-271 · Plateforme en règle : textes légaux, droits dans le produit, signalement (DSA), consentement

Demande du MJ : « professionnalise toute la plateforme en respectant toutes les règles européennes et françaises pour le web ». Audit des écarts puis mise en œuvre.

- **Écarts trouvés** : mentions légales sans téléphone (éditeur, hébergeur), crédits incomplets (modification des icônes CC BY non dite) ; page Confidentialité sans base légale ni durée par traitement, sans sous-traitants (envoi d'e-mails), sans signalements ni sauvegardes, cookies non détaillés ; aucun export des données du compte en ligne ; aucun signalement dans le produit (DSA art. 16), ni exposé des motifs (art. 17), ni point de contact (art. 11-12) ; acceptation des CGU et âge non recueillis ni prouvés ; aucune déclaration d'accessibilité ; pas de mention « alpha » ; tableau de la page Confidentialité qui défilait en largeur (D-246) ; en-têtes de sécurité absents quand le serveur sert lui-même le site (Plesk) ; pas d'avis de changement de mot de passe (CNIL 2022-100).
- **Pages** : mentions légales (LCEN art. 1-1 et 6-III : téléphones, lieu d'hébergement, crédits complets), Confidentialité réécrite traitement par traitement (données, finalité, base légale, durée, qui voit quoi) avec une section **« Cookies et traceurs »** (`#cookies` : cookie de session, stockage local, IndexedDB, Umami exempté ; donc pas de bandeau de consentement, seulement l'information avec refus possible), CGU réécrites (alpha `#alpha`, âge, profil public, conduite, signalement `#signaler`, modération et exposé des motifs, points de contact, responsabilité d'hébergeur, durée, modifications, droit et médiation), nouvelles pages **`/accessibilite`** (déclaration RGAA honnête : « non conforme » faute d'audit complet, comme l'exige le RGAA ; ce qui est vérifié, non-conformités connues, recours au Défenseur des droits) et **`/contact`** (point de contact unique, signalement par e-mail avec les mentions de l'art. 16, Pharos). Pied de page de chaque page : Mentions légales, Confidentialité, Cookies, CGU, « Accessibilité : non conforme », Contact et signalement, Mesure d'audience. Badge « Alpha » dans l'en-tête du site et la barre du haut de l'application, vers `/cgu#alpha`.
- **Rien d'inventé** : les faits manquants restent « À COMPLÉTER » (`site/config.ts`, `.env.production.local`) : téléphone de l'éditeur et de l'hébergeur, service d'envoi d'e-mails, médiateur de la consommation (ou la raison pour laquelle il n'y en a pas) s'ajoutent aux faits déjà demandés. Le statut d'accessibilité est réglable mais vaut « non conforme » jusqu'à un audit.
- **Consentement** (`shared/legal.ts`, migration 3) : à l'inscription, l'âge (15 ans ou plus, ou accord d'un parent, loi I&L art. 45) et une case non cochée « J'accepte les conditions d'utilisation et j'ai lu la politique de confidentialité » (on accepte des CGU ; une politique de confidentialité se lit). Le serveur garde la version acceptée, la date et l'âge déclaré (`POST /api/account/terms`). Les comptes existants, ou tous quand `TERMS_VERSION` change, voient une fois l'écran « Conditions d'utilisation » après déverrouillage (`TermsGate`) ; il ne bloque jamais quand le serveur est injoignable.
- **Droits dans le produit** : « Télécharger mes données » (Paramètres › Données et confidentialité, et sur l'écran des CGU) : `GET /api/account/export`, un JSON avec compte, conditions acceptées, profil et images, aventuriers, adhésions, demandes, signalements faits, sessions (dates seulement) et le contenu déchiffré des campagnes dont on est le MJ ; jamais l'empreinte du mot de passe ni un jeton. Suppression du compte vérifiée par un test : profil, liens, adhésions, demandes, sessions, campagnes possédées et leurs enregistrements partent ; un signalement fait reste sans son auteur.
- **Signalement (DSA)** : « Signaler » sur le profil d'un autre compte (motif parmi 10 catégories, explication de 10 à 2 000 caractères, déclaration de bonne foi ; anonymat possible seulement pour un abus sexuel sur mineur, art. 16(2)(c)). `POST /api/reports` garde une copie du profil, limite à 10 par heure et par adresse et 20 par jour et par compte, envoie un accusé de réception et prévient `MODERATION_EMAIL`. La modération se fait en ligne de commande (`server/src/moderate.ts`, guide : DEPLOIEMENT.md §11) : masquer un profil (devise et images retirées, modification bloquée, nom remplaçable), suspendre (sessions fermées, connexion refusée), classer, lever ; chaque mesure envoie l'exposé des motifs (art. 17 : mesure, faits, signalement, motif légal ou contractuel, décision humaine, recours) et la décision à l'auteur du signalement. Signalements traités effacés un an après la décision.
- **Sécurité** : les règles de mot de passe (15 caractères, phrases, refus des suites et mots courants, limitation des tentatives, scrypt) sont déjà au-dessus de la délibération CNIL 2022-100 ; ajout d'un e-mail quand le mot de passe change ou est réinitialisé. Le serveur, quand il sert le site, envoie les mêmes en-têtes que Caddy (HSTS, CSP `frame-ancestors`, Permissions-Policy, COOP) ; toute réponse `/api` est `no-store`.
- **Version** : lue dans `package.json` au build (`__CODEX_VERSION__`, `APP_VERSION`), montrée dans Paramètres › À propos (avec les liens légaux) et le pied de page du site.
- **Contrôle de mise en ligne** : points 1 et 2 renforcés (cookies, droits, sous-traitants, alpha, signalement, exposé des motifs), nouveaux points 21 (mentions légales complètes), 22 (déclaration d'accessibilité et mention sur chaque page), 23 (signalement et point de contact), 24 (alpha signalée) ; `e2e/site.spec.ts` couvre les nouvelles pages, le pied de page, les ancres et le consentement ; `e2e/legal.spec.ts` télécharge les données d'un compte créé dans le navigateur. `CODEX_BUILD_PORT` permet de lancer la version construite sur un autre port que 4174.

## Familiers, dés et plateau du MJ en jeu (2026-10-17)

### D-269 · Les familiers jouent au tour de leur maître ; qui lance les dés ; le MJ gère le plateau

Demande du MJ : « Quand on passe aux tours des ennemis c'est le MJ qui lance les dés pour les ennemis et c'est pareil pour les alliés ; en revanche pour les familiers c'est le joueur auquel il est relié qui tire les dés ; les familiers partagent le tour de leur joueur. Le MJ peut supprimer les ennemis et aussi les joueurs du plateau ; je dois pouvoir ajouter les familiers reliés aux personnages et uniquement ceux-là, ou ceux des ennemis. »

- **Tour partagé** : un familier relié à un maître qui existe (joueur, ennemi ou allié) n'a plus de place à lui dans l'ordre des tours ; il joue pendant le tour de son maître (`turnActors`, `turnFamiliars`). La case « Agit au tour de son maître » de sa fiche (déjà là, cochée par défaut) reste le réglage : décochée, le familier redevient un membre ordinaire qu'on place dans un groupe. Un familier sans maître se comporte comme avant.
- **Ajout à un groupe refusé** plutôt que redirigé : le familier n'est pas proposé dans « Ajouter au groupe » ; il est listé sous son maître (bordure dorée, non déplaçable). Les parties enregistrées sont nettoyées au chargement et avant chaque étape des tours (`withoutAttachedFamiliars`) ; si le familier retiré était en train de jouer, le tour passe au suivant. Rediriger vers le groupe du maître aurait créé un doublon de tour.
- **Début de tour** : quand le maître commence son tour, les effets de début de tour de ses familiers s'appliquent aussi, dans la même annulation ; l'annonce dit « Au tour de Lyra, avec Hibou ». Le bandeau montre les familiers en petits portraits accolés au maître ; sur la carte (MJ, fenêtre joueurs, joueur en ligne) leurs jetons sont mis en avant avec celui du maître (`activeEntityIds`) ; « Suivre le tour » centre toujours sur le maître.
- **Qui lance les dés** : le joueur en ligne lance pour son personnage et pour les familiers reliés à lui, rien d'autre ; il peut aussi déplacer leurs jetons. L'appareil du MJ le vérifie (`controlledBy`, appelé par `HostSession.play()`) et refuse le reste (« pas à toi »). Son panneau montre la fiche de chacun de ses familiers avec ses tests, et « C'est ton tour ! » ressort en doré. Le MJ lance pour les ennemis, les alliés et leurs familiers : pendant un tour, le bandeau affiche « Qui joue » avec un bouton par acteur (le personnage et ses familiers) qui ouvre la manipulation rapide, où une rangée « Tests » lance chaque caractéristique d'un clic. Pendant le tour d'un joueur, le MJ garde tous ses pouvoirs.
- **Jets hors tour autorisés** : rien n'empêche un joueur de lancer quand ce n'est pas son tour (sauvegardes, réactions) ; seul le « à qui » est vérifié.
- **Plateau du MJ** : « Retirer du plateau » (manipulation rapide, mini-fiche du jeton, ligne du personnage dans les groupes) enlève le jeton de toutes les cartes ; « Retirer du plateau et des tours » le sort aussi des groupes, en **une** annulation. Un personnage joueur n'est jamais supprimé ainsi ; un joueur en ligne reste dans la partie sans jeton (il voit la carte en jeu). « Supprimer l'ennemi » supprime l'ennemi de la campagne, des cartes et des groupes, après la confirmation de suppression (seule fenêtre bloquante permise en jeu) ; Ctrl+Z le rétablit.
- **Les familiers suivent** : retirer un maître du plateau retire aussi les jetons de ses familiers, sans demander (ils jouent à son tour ; les laisser seuls serait une erreur dans presque tous les cas). Supprimer un ennemi retire les jetons de ses familiers, qui restent dans la campagne, libres.
- **Ajouter un familier** (section des groupes, et « Placer Hibou » dans le panneau du maître) : seulement les familiers reliés à un personnage joueur ou à un ennemi, rangés par maître, avec « déjà sur le plateau » ; ni les familiers libres ni ceux des alliés, comme le MJ l'a demandé. Le jeton se pose sur la première case libre autour du maître, dans la carte, ni derrière un mur ni sur un passage (`familiarSpot`), caché si le maître l'est ; à l'endroit habituel si le maître n'a pas de jeton. Relier un familier à un ennemi se faisait déjà en préparation (onglet Identité de la fiche du familier, ou « Familiers » sur la fiche de l'ennemi) : rien à ajouter.

## Réactivité du mode en ligne (2026-10-17)

### D-270 · Les gestes du MJ partent tout de suite, le pion du joueur bouge sans attendre

Demande du MJ : « optimise la réactivité du mode en ligne pour tous les joueurs ». Mesure d'abord (`src/online/latency.test.ts` : table réaliste de 6 joueurs, 8 cartes, 40 personnages, 300 lancers ; relais en mémoire, donc sans le réseau) :

| Du geste à l'écran des 6 joueurs (médiane)                            | Avant                                               | Après                            |
| --------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------- |
| Le MJ déplace un pion                                                 | 330 ms                                              | 4 ms                             |
| Le MJ lance les dés                                                   | 70 ms, et **jamais** au-delà de 100 lancers publics | 6 ms                             |
| Un joueur déplace son pion (aller-retour)                             | 341 ms (+ 2 trajets réseau)                         | 20 ms, affiché **immédiatement** |
| Relecture de la base à chaque changement (cartes + lancers, chiffrés) | 15–28 ms                                            | 0 (plus de relecture)            |
| Comparaison des vues des 6 joueurs après un déplacement               | 1,8 ms                                              | 0,4 ms                           |

- **Contexte.** L'appareil du MJ attendait l'auto-enregistrement (250 ms), puis 50 ms, relisait et redéchiffrait des tables entières, et resérialisait chaque enregistrement de chaque joueur à chaque fois. Un bogue en plus : les lancers montrés aux joueurs étaient « les 100 derniers » dans l'ordre des identifiants, pas du temps ; passé 100 lancers publics, un nouveau lancer n'arrivait presque jamais chez les joueurs (et la grande animation de D-268 ne se lançait pas).
- **Décision — côté MJ** (`hostFeed.ts`, `projection.ts`). La base n'est lue qu'une fois ; ensuite les écritures validées arrivent par le flux de changements (en clair, sans relecture), et tant que la campagne est ouverte, ses stores en mémoire (personnages, cartes, tours, compétences, lancers) passent devant : la partie n'attend plus l'auto-enregistrement. Un geste isolé part aussitôt ; une rafale (brouillard peint) est regroupée, au plus une synchronisation toutes les 33 ms. Les projections sont mémorisées par enregistrement (même objet → même vue, partagée par les joueurs qui voient la même chose) et la comparaison saute sans le regarder un enregistrement inchangé. Les lancers sont triés par date avant de garder les 100 derniers.
- **Côté joueur** (`guestSession.ts`). Ce qui arrive va d'abord à l'écran, la copie chiffrée est écrite derrière (dans l'ordre). Le pion du joueur bouge dès qu'il le lâche ; si le MJ refuse, il revient à la dernière position reçue ; un autre changement de la carte reçu entre-temps ne l'efface pas.
- **Connexion** (`socket.ts`, `hub.ts`, `controller.ts`). Une connexion silencieuse 15 s est testée (ping) ; sans réponse en 5 s elle est abandonnée sans attendre le navigateur. Reconnexion rapide puis espacée (≈ 0,25 s, 0,5 s, 1 s… jusqu'à 30 s, avec du hasard pour que toute la table ne revienne pas au même instant), et immédiate au retour du réseau ou de l'onglet. Un joueur dont la connexion tombe garde sa table 45 s et rentre seul dans la partie ; si c'est l'appareil du MJ, le serveur garde ses joueurs 30 s et les lui présente à nouveau quand il revient. Après un retour, l'opérateur renvoie la table entière, qui remplace la copie (ce qui a disparu entre-temps est effacé, rien n'est rejoué deux fois). Le budget de messages de l'appareil du MJ grandit avec le nombre de joueurs servis (un message par joueur à chaque changement). Côté co-MJ, les avis de changement reçus en rafale ne déclenchent qu'une lecture, et aucune pour une révision déjà lue.
- **Inchangé, et vérifié par des tests** : l'opérateur valide toujours chaque intention, et le filtrage est le même (pions cachés, calque MJ, notes, coffres fermés, lancers secrets, caractéristiques des ennemis). Déjà en place : `ws` désactive Nagle et le serveur n'active pas la compression par message. Protocole inchangé (toujours v3).
- **Raison.** Le délai venait de l'attente et des relectures, pas du réseau : les supprimer rend chaque geste visible dans le temps d'un trajet réseau. **Reste** : un co-MJ voit toujours les gestes du MJ après l'auto-enregistrement (250 ms) puis un envoi et une lecture HTTP ; une intention de joueur relit encore la fiche de campagne dans la base (validation, hors de ce chantier).

## Couleurs des joueurs et grande animation des dés (2026-10-17)

### D-268 · Chaque lancer de la partie s'affiche en grand, à la couleur de celui qui lance

Demande du MJ : pendant une partie, chaque lancer (d'un joueur pendant son tour comme du MJ) s'affiche avec une très grosse animation au milieu de l'écran, chez tous les joueurs et chez le MJ, à la couleur donnée au joueur quand il rejoint la partie.

- **Couleurs des joueurs** (`src/domain/playerColors.ts`) : dix couleurs nommées, dans l'ordre d'attribution — cramoisi, azur, émeraude, cuivre, prune, sarcelle, rose, mousse, indigo, glacier. Ni or ni ambre : l'or est la couleur du MJ (`gm`, l'or de la DA), et l'ambre s'y confondrait. Pas de violet franc (D-250) ni de vert acide (« néon » interdit) : la prune et l'indigo restent sourds, la mousse remplace le citron vert. Chaque couleur a trois tokens clair/sombre (`--codex-player-<clé>`, `-soft`, `-text` au contraste AA sur les surfaces) ; un élément porte `data-player-color="<clé>"` et ses enfants utilisent `bg-player`, `bg-player-soft`, `text-player-text`, `border-player`, `--codex-player-glow` (index.css). Le plateau Konva a les mêmes valeurs en littéraux (`boardTheme.ts`).
- **Où elle est rangée** : sur la fiche du personnage joueur (`details.color`, `null` par défaut et pour les anciennes sauvegardes, normalisé au chargement), pour qu'elle se synchronise partout comme le reste de la fiche. Ce n'est pas une règle de jeu : rien à activer dans Règles.
- **Attribution** : quand un joueur entre dans la partie avec un personnage (`HostSession.admit`, `choose`), quand le MJ accepte une demande en lui donnant un personnage, ou change le personnage d'un membre, le personnage reçoit la première couleur qu'aucun autre personnage joueur de la campagne ne porte (au-delà de dix, la moins portée : les couleurs tournent). C'est un changement annulable de l'appareil de l'opérateur (`ensurePlayerColor`). Le MJ la change sur la fiche (onglet Identité) et à côté de chaque joueur entré dans la partie (panneau En ligne) ; une couleur déjà portée reste choisissable et dit par qui.
- **Couleur d'un lancer** (`colorOfEntity`) : personnage joueur → sa couleur ; familier dont le maître est un joueur → celle du maître ; tout le reste (ennemis, alliés, leurs familiers, jets libres du MJ, joueur sans couleur) → l'or du MJ. Sur le plateau, les pions des joueurs et de leurs familiers ont un anneau de leur couleur (et le fond du pion d'un joueur la prend).
- **La scène des dés** (`src/features/dice/DiceStage.tsx`, file pure `diceStageQueue.ts`) : sur l'écran de jeu (opérateur et co-MJ spectateurs, hors de la table `inert` pour que l'annonce soit lue), sur l'écran d'un joueur en ligne et dans la fenêtre des joueurs. Les dés (6 au plus en grand, les autres comptés) tombent en tournant en 3D (perspective, rotateX/rotateY), à la couleur du lanceur (fond doux, contour plein, halo), puis le total énorme arrive avec un rebond ; médaillon et nom du lanceur, libellé du jet, verdict ; or et étincelles pour une réussite critique, secousse rouge pour un échec critique. Lisible sur le plateau dans les deux thèmes : pastilles opaques sur un halo coloré. Au-dessus du plateau et des bannières (z 35), sous les fenêtres et les toasts.
- **Seulement les nouveaux lancers** : ceux déjà là à l'ouverture de l'écran ne sont jamais rejoués, ni ceux de plus de 8 s qui arrivent tard (synchronisation initiale, rattrapage après une reconnexion). Les jets secrets ne s'affichent que sur les appareils du MJ (`isHostDevice()`), jamais dans la fenêtre des joueurs ni chez un joueur.
- **File** : les lancers rapprochés passent l'un après l'autre ; plus la file est longue, plus chacun est court (2,6 s seul, 1,9 s puis 1,3 s quand d'autres attendent) et au-delà de quatre en attente les plus anciens sont abandonnés, pour que la table ne prenne jamais de retard.
- **Ne bloque jamais** : aucun événement pointeur, s'en va seule, Échap la passe. Mouvement réduit, niveau d'animation réduit ou dés non animés : pas de culbute, un fondu court avec le résultat. L'appareil a un réglage « Grande animation des dés » (Paramètres, activé par défaut : c'est de l'interface, pas une règle). Le résultat est annoncé dans une région `aria-live`. Le bruit des dés est joué pour les lancers que cet appareil n'a pas déjà sonorisés (ceux des autres), jamais dans la fenêtre des joueurs.
- **Raison** : la couleur sur la fiche suit le personnage partout (plateau, fenêtre des joueurs, appareils des joueurs) sans nouveau message réseau ; la scène lit les lancers déjà synchronisés (magasin des jets ou base locale en direct), donc elle marche pour les jets locaux comme pour ceux des autres.
- **Reste** : une pastille de couleur dans le bandeau des tours (`TurnBanner`) et la liste des groupes n'est pas encore ajoutée.

## Profil et aventuriers (2026-10-14)

### D-267 · Un profil pour chaque compte, des « aventuriers » pour amis

Demande du MJ : un espace pour voir et modifier son compte, une vraie partie sociale avec des amis appelés « aventuriers », photo de profil et bannière, plusieurs façons de demander l'amitié, et l'accès au profil dans la barre du haut (photo + pseudo).

- **Barre du haut** : `ProfileButton` (photo, ou initiales, et pseudo ; la photo seule sur téléphone), avec une pastille pour les demandes reçues. Il mène à `#/profil`.
- **Page profil** (`src/features/social/`) : bannière, photo, pseudo, devise (300 caractères au plus), date d'arrivée, nombre d'aventuriers, campagnes partagées. « Modifier le profil » ouvre une fenêtre (hors partie, donc permise) : pseudo, devise, photo, bannière. Les images sont réduites sur l'appareil (photo 320 px, bannière 1500 × 500, WebP) puis envoyées. Deux onglets : **Aventuriers** et **Compte** (la section Compte des Paramètres, réutilisée). Le profil d'un autre compte est sur `#/profil/:id`.
- **Serveur** (`server/src/social.ts`, migration 2) : colonnes `bio`, `avatar`, `banner`, `profile_rev`, `friend_code` sur `users`, table `friendships` (demandeur, destinataire, acceptée ou non). Les images sont gardées en data URL raster vérifiée (comme les images de campagne, D-243) et servies comme fichiers par `/api/users/:id/avatar|banner?v=rev` (cache d'un an, l'adresse change avec l'image), pour que les listes restent légères. Le serveur envoie `{ t: 'friends' }` aux deux comptes à chaque changement ; l'application relit et affiche un toast pour une nouvelle demande.
- **Qui voit quoi** : tout compte connecté peut voir le pseudo, la devise et les images d'un autre (c'est un profil public entre joueurs) ; l'adresse e-mail reste privée ; le code d'aventurier n'est montré qu'à son titulaire, qui le partage s'il veut. Supprimer le compte supprime le profil et les liens. La page Confidentialité le dit.
- **Les façons de demander** : (1) chercher un pseudo ou un code dans « Trouver un aventurier » ; (2) partager son **code d'aventurier** (8 caractères sans 0/O ni 1/I, affiché `XXXX-XXXX`) ou son **lien** `#/aventurier/CODE`, qui ouvre le profil ; (3) les **compagnons de table** : les membres de ses campagnes qui ne sont pas encore aventuriers ; (4) la **liste des membres** du panneau « En ligne » d'une campagne (bouton par membre, le nom ouvre son profil) ; (5) le **profil** de quelqu'un. Demander à quelqu'un qui nous avait déjà demandé vaut acceptation. Refuser, retirer sa demande et « Ne plus faire route ensemble » (avec confirmation) suppriment le lien.
- **Ailleurs dans Codex** : le nom d'un candidat dans les demandes pour rejoindre une campagne, celui d'un joueur entré dans la partie et celui du MJ d'une session du catalogue ouvrent leur profil ou portent le bouton d'ajout. Les Paramètres renvoient vers « Mon profil ».
- **Présence** : un aventurier connecté a une pastille verte et passe en tête de liste (« 2 en ligne »). Le serveur prévient les aventuriers d'un compte quand son premier appareil se connecte ou que le dernier se déconnecte. Seuls les aventuriers voient cette présence.
- **Catalogue des sessions** (D-265) : les sessions ouvertes par un de ses aventuriers viennent en premier, marquées « Table d'un de tes aventuriers ». Une session reste visible seulement si son MJ l'affiche : être aventuriers ne donne pas accès aux parties non affichées.
- **Connexion** : l'effet qui connecte le compte au serveur ne coupe plus une connexion plus récente (remontage, Strict Mode) : sa déconnexion arrivait après la nouvelle connexion, d'où des échecs aléatoires des tests en ligne.

## Codex passe entièrement en ligne (2026-10-14)

### D-266 · Plus de compte ni de partie « local »

Demande du MJ : « le logiciel sera entièrement en ligne ». Remplace la partie « local-first » de D-241/D-257 pour les comptes et le mode « MJ seul » de D-244.

- **Comptes** : tout compte est un compte en ligne. L'écran d'accueil propose « Créer un compte » (inscription en ligne) ou « J'ai déjà un compte » (connexion). La création de compte local, le code de secours et la récupération par code disparaissent de l'écran de verrouillage ; « Mot de passe oublié » passe par l'e-mail. On ne peut plus délier son compte (Paramètres).
- **Copie sur l'appareil** : gardée, chiffrée avec le mot de passe, comme cache du moteur de synchronisation (D-262) ; le déverrouillage rapide (« Déverrouiller ») l'ouvre et se connecte. Ce n'est plus un mode de travail : rien n'est présenté comme « hors ligne ».
- **Anciens comptes locaux** : après déverrouillage, un compte non relié n'ouvre rien d'autre que « Relie ton compte pour continuer » (créer ou rejoindre un compte en ligne) ; ses campagnes partent alors sur le serveur.
- **Campagnes** : déjà envoyées toutes seules au serveur (D-257) ; plus d'état « pas encore en ligne » sauf une campagne détachée.
- **Parties** : toujours en ligne. Le choix « MJ seul / En ligne » disparaît ; le bouton « Démarrer » attend que la campagne soit sur le serveur. Les anciennes parties `local` restent lisibles.
- **Textes** : écran de verrouillage, notice de confidentialité, page d'accueil, CGU et Confidentialité du site disent que les campagnes sont gardées sur le serveur, chiffrées.
- **Tests** : les tests unitaires tournent sur un compte relié, sans serveur (`connectOnline`/`serveCampaign` neutralisés dans `src/test/setup.ts`) ; chaque scénario e2e crée un compte en ligne (`createAccount`). Le serveur des e2e assouplit ses limites de comptes (`CODEX_RELAX_LIMITS`, ignoré en production).

## Accueil d'un nouvel appareil (2026-10-14)

### D-265 · Catalogue des sessions ouvertes

Demande du MJ : des sessions que les joueurs rejoignent en un clic après accord du MJ ; une fois entré, le joueur choisit parmi les personnages disponibles avant de voir la carte.

- **Côté MJ** : au démarrage d'une partie **en ligne**, case « Afficher dans le catalogue des sessions », **décochée par défaut** (une partie n'est pas montrée à tout le serveur sans que le MJ le décide). Elle se change aussi pendant la partie, dans le panneau « En ligne ». `play.live` porte le titre de la session (`title`) et ce choix (`listed`) ; le serveur les lit comme le reste de `live` (`liveOf`).
- **Catalogue** (`GET /api/sessions`) : les parties en ligne affichées dont l'appareil de l'opérateur sert les joueurs **en ce moment** (une partie qu'on ne peut pas rejoindre n'y figure pas). Il montre le titre, la campagne, le MJ et l'heure de début, jamais le contenu de la session. Un MJ ou co-MJ ne voit pas sa propre table. Le serveur envoie `{ t: 'sessions' }` à tous quand une partie démarre, s'arrête, change d'affichage ou n'est plus servie.
- **Rejoindre** : « Demander à rejoindre » envoie, sans message, la même demande d'adhésion à la campagne que le lien d'invitation (D-257) ; le serveur la refuse si la session n'est plus ouverte. Le MJ reçoit un toast même en pleine partie et accepte depuis le panneau « En ligne » : par défaut sans imposer de personnage. Le bouton devient alors « Entrer dans la partie ».
- **Choix du personnage** : sans personnage imposé, l'écran du joueur montre d'abord « Choisis ton personnage » (personnages joueurs, ceux déjà pris grisés) ; la carte n'apparaît qu'après le choix, vérifié par l'opérateur (déjà en place, D-245).

### D-264 · L'écran d'accueil demande d'abord : créer un compte ou en retrouver un

Demande du MJ : en arrivant sur Codex sans compte sur l'appareil, on tombait directement sur le formulaire de création, alors qu'on a peut-être déjà un compte. L'écran « Bienvenue dans Codex » propose maintenant deux choix : **Créer un compte** (formulaire local, avec « Créer un compte en ligne » à côté) et **J'ai déjà un compte** (connexion au compte en ligne : un compte local ne peut pas exister ailleurs que sur son appareil). Chaque écran a un bouton Retour vers ce choix. Quand des comptes existent déjà sur l'appareil, l'écran de verrouillage ne change pas.

## Le mode en ligne passe par le serveur (2026-10-13)

### D-263 · Le serveur tourne sur Node 22 et peut servir le site

Demande du MJ : faire tourner Codex sur Node.js 22.x (son serveur Plesk) et que le style s'affiche.

- **Node 22** : Node 22 n'exécute pas le TypeScript sans option. Le serveur est donc compilé en JavaScript (`npm run server:build`, `tsc` vers `server/dist/`, `shared/` compris) ; il démarre avec `node dist/server/src/index.js`. Vérifié sous Node 22.12. En développement, `server:dev` garde le TypeScript direct. Vite 8 demande Node 22.12 au moins : `engines` le dit.
- **Le style** : dans une application Node.js de Plesk, toutes les requêtes arrivent à Node ; le serveur ne servait que `/api`, donc `/assets/*.css` répondait 404. Il sert maintenant le site construit lui-même, avec les règles du Caddyfile (adresses sans .html, vraie page 404, `/assets` en cache un an, pages jamais, en-têtes de sécurité, aucun fichier hors du dossier). Avec Docker, Caddy garde ce rôle (`CODEX_SERVE_SITE=false`).

### D-262 · Serveur Codex : comptes, campagnes synchronisées, parties relayées

Demande du MJ : « prépare la partie online du logiciel pour la migration sur mon serveur web », en partant du principe que le serveur fonctionne. Met en œuvre D-257 (et ce qui reste valable de D-249) ; remplace le pair-à-pair de D-245 (échange de codes, WebRTC, STUN) et le réglage STUN.

- **Serveur** (`server/`, paquet à part) : Node 24 exécute directement le TypeScript (pas d'étape de compilation), Fastify 5, `@fastify/websocket`, PostgreSQL (`pg`) ; en développement et en test, PGlite (PostgreSQL en WebAssembly, en mémoire : sur disque, il échoue sous Windows). Migrations versionnées (`migrations.ts`, jamais modifiées après coup). Code partagé avec l'application sans alias dans `shared/` (`sync.ts` : tables, validation des lots, cadres WebSocket, types d'API ; `passwords.ts` : mêmes règles de mot de passe des deux côtés).
- **Comptes en ligne** : adresse e-mail, nom affiché, mot de passe (règles D-241). Empreinte scrypt (N = 2¹⁵) ; session dans un cookie `HttpOnly`, `Secure`, `SameSite=Strict`, limité à `/api`, 30 jours, dont seul le SHA-256 est gardé ; les requêtes d'écriture venant d'une autre origine sont refusées. 5 échecs puis attente doublée (comme sur l'appareil), limites par adresse IP, champ piège à l'inscription. Mot de passe oublié : lien à usage unique valable une heure, envoyé par SMTP (`SMTP_URL`) ; en développement, affiché dans la console. Changer de mot de passe ferme les autres sessions. Suppression du compte = ses campagnes aussi ; compte inutilisé trois ans supprimé (balayage quotidien), comme le dit la page Confidentialité.
- **Compte local ↔ compte en ligne** : le compte local reste le coffre chiffré de l'appareil ; il se **relie** à un compte en ligne (Paramètres › Compte en ligne : créer, ou « J'ai déjà un compte en ligne »). Le compte en ligne créé ainsi prend le mot de passe local. Sur l'écran de verrouillage, « Se connecter avec un compte en ligne » ouvre le compte local relié avec le même mot de passe, ou en crée un sur ce nouvel appareil (sans code de secours : le serveur et l'e-mail en tiennent lieu) et les campagnes redescendent. Si le mot de passe a été réinitialisé en ligne, l'ancienne copie de l'appareil est gardée sous un autre nom (« … (ancienne copie) ») et une nouvelle descend du serveur.
- **Campagnes chiffrées au repos** (D-257 : lisibles par le serveur) : chaque enregistrement est scellé en AES-256-GCM avec `CODEX_DATA_KEY`, lié à sa table, son identifiant et sa campagne. Les sauvegardes (`pg_dump` nocturne, 14 jours) restent donc chiffrées.
- **Synchronisation** : chaque appareil du MJ et des co-MJ garde sa copie locale chiffrée et travaille dessus, connecté ou non. Le fil des modifications (D-245) remplit une **file d'envoi** (table `outbox`, schéma v11) : une entrée par enregistrement, la plus récente remplace l'ancienne. Le serveur donne à chaque écriture une révision (séquence, écritures d'une même campagne sérialisées) ; l'appareil envoie sa file, puis récupère ce qui a changé depuis sa dernière révision (`syncState`), page par page (1 000 enregistrements ou 16 Mo). Un enregistrement encore dans la file n'est jamais écrasé par ce qui arrive. Le serveur ne renvoie pas à un appareil ce qu'il vient d'écrire (en-tête `x-codex-device`). Conflits : la dernière écriture reçue gagne, comme avant.
- **Contrôles du serveur, enregistrement par enregistrement** (un enregistrement refusé ne fait pas échouer le lot ; il revient tel que le serveur l'a, et l'appareil le remet) : appartenance à la campagne, images matricielles seulement, tables de la partie (personnages, cartes, jets, compétences) réservées à l'opérateur pendant une partie, lignes du journal signées du compte qui écrit (ou d'un joueur, par l'opérateur ; le nom affiché est toujours celui du compte), journal jamais effacé par un appareil (le serveur garde les 300 dernières lignes), campagne jamais supprimée par un lot. Démarrer une partie fait de soi l'opérateur ; seul l'opérateur la termine ou passe la main. La fiche de campagne envoyée par un co-MJ pendant une partie garde l'état de jeu de l'opérateur (sa copie peut être en retard) et lui est renvoyée corrigée.
- **Reprise des campagnes locales** (D-257) : en reliant le compte, toutes ses campagnes partent sur le serveur ; ensuite toute campagne créée, importée ou copiée aussi. Avant l'envoi, le MJ « hôte » de l'appareil (`host`) devient le compte en ligne dans la partie en cours et dans ses lignes du journal ; les lignes signées par d'anciens invités pair-à-pair restent sur l'appareil. Supprimer sur l'appareil une campagne en ligne la supprime du serveur (MJ) ou quitte la campagne (co-MJ), dès que le serveur est joignable.
- **Perte d'accès** : la copie d'un co-MJ retiré de la campagne (ou dont la campagne est supprimée) est effacée de son appareil. Celle du MJ, jamais : si sa campagne disparaît du serveur (supprimée d'un autre appareil, serveur restauré), elle reste sur l'appareil, hors ligne, et « Mettre la campagne en ligne » la renvoie.
- **Rejoindre** (D-257) : le MJ ou un co-MJ crée un **lien d'invitation** (`/app/#/rejoindre/CODE`, remplaçable, désactivable) ; le MJ peut aussi rendre la campagne **visible dans la recherche** par son nom. Le joueur demande à rejoindre (avec un mot facultatif) ; le MJ ou un co-MJ accepte en choisissant le rôle (co-MJ : MJ seulement) et le personnage, ou refuse. Panneau « En ligne » de la campagne : lien, demandes, membres (présence, rôle, personnage, retirer), joueurs dans la partie.
- **Bascule MJ / Joueur** sur l'écran des campagnes : en MJ, ses campagnes (pastille « En ligne », « Co-MJ · campagne de X », demandes en attente) ; en Joueur, « Mes parties » (partie en cours ou non, « Entrer dans la partie », quitter la campagne), ses demandes en attente et « Rejoindre une campagne » (lien ou recherche).
- **Parties en direct** : un joueur ne lit ni n'écrit jamais les enregistrements. Quand une partie « En ligne » tourne, l'appareil de son opérateur, tant que la campagne y est ouverte, s'annonce au serveur ; le serveur relaie, par la WebSocket, les messages entre lui et chaque joueur entré. L'opérateur fait tourner le protocole de D-245 (version 3, joueurs seulement) : projection de ce que le joueur peut voir, intentions vérifiées et jouées chez lui. L'identifiant d'un joueur est celui de son compte ; le personnage choisi par le MJ à l'acceptation est imposé (sinon le joueur choisit parmi les personnages libres). Passer la main, terminer la partie, retirer le joueur ou verrouiller l'appareil de l'opérateur fait sortir les joueurs (« La partie en ligne est terminée »).
- **Temps réel** (`/api/ws`) : « des enregistrements ont changé » aux MJ et co-MJ, « tes campagnes ont changé » à chacun, présence par campagne (sert aussi à proposer la main aux co-MJ connectés), relais de la partie. Reconnexion seule (1 s, 2 s, 4 s… 30 s) ; un appareil hors ligne garde sa file et l'envoie au retour.
- **Déploiement** : `npm run deploy:bundle` prépare `release/` (compose, Caddyfile, site construit, sources du serveur) ; Docker Compose ajoute `server`, `codex-db` (PostgreSQL 16) et `codex-backup`. En développement et en e2e, Vite relaie `/api` vers le serveur (`CODEX_API`) ; Playwright démarre le serveur sur une base en mémoire.
- **Pages publiques corrigées** : l'accueil, les CGU et la page Confidentialité promettaient encore le chiffrement de bout en bout, les amis et la messagerie de D-249. Elles décrivent maintenant ce qui existe (adresse e-mail demandée, campagnes chiffrées mais lisibles par le serveur, invitations). Amis et messagerie restent à faire (phases suivantes de D-249).
- Tests : serveur (`server/src/*.test.ts`, PGlite) ; moteur de synchronisation de l'application contre le vrai serveur (`appSync.test.ts`) ; relais joueurs (`online.test.ts`) ; e2e entre trois navigateurs et le serveur, et retour d'un compte sur un nouvel appareil (`e2e/online.spec.ts`).

---

## Passages par joueur et cap sur la mise en ligne (2026-10-13)

### D-256 · Un passage n'emmène que celui qui le prend

Demande du MJ : quand un joueur touche un passage, lui seul est transporté dans la pièce où il mène ; le MJ garde accès à toutes les cartes de la séance par une arborescence rapide.

- **Contact** : un jeton qui se pose sur un élément « Passage vers une carte » (une de ses cases sous l'élément, rotation comprise) part seul vers la carte cible. Une seule étape d'annulation pour les deux cartes (« Ayla passe vers « Cave » »). Le plateau du MJ (`play.mapId`) ne bouge pas.
- **Arrivée** : à côté du passage qui ramène à la carte d'origine (une porte a deux côtés), sinon au milieu ; jamais sur un passage (le pas suivant le renverrait), jamais sur un autre jeton.
- **Ne déclenchent pas** : un passage caché (le MJ le révèle d'abord), sans carte cible, ou qui mène à la même carte.
- Demandé explicitement par le MJ, donc actif d'emblée (D-217 : règle confirmée par le MJ). Vaut pour tous les jetons que l'on déplace, ennemis compris : un passage est un passage.
- **En ligne** : chaque joueur reçoit la carte où se trouve **son** personnage (jeton visible ; à défaut, la carte en jeu) et peut s'y déplacer. Un jeton caché ne trahit pas sa position. La fenêtre joueurs (second écran partagé) montre toujours la carte choisie par le MJ.
- **Arborescence du MJ** (`MapTreeMenu`, en jeu, remplace la liste « Carte en jeu ») : la carte de la séance, puis celles où mènent ses passages, en arbre (chaque carte une fois, au plus court chemin), puis les cartes où se trouve le groupe, puis « Autres cartes ». Chaque carte indique qui s'y trouve (noms du groupe, nombre d'ennemis). La choisir la met sur le plateau du MJ ; personne n'est déplacé.

### D-261 · Les écrans de plateau ne font jamais défiler la page

Retour du MJ (capture de l'éditeur de carte, texte agrandi) : deux barres de défilement verticales côte à côte, celle du panneau et une autre, inutile, pour toute la page.

- **Cause 1** : les champs de fichier invisibles (`sr-only`, positionnés en absolu) du panneau de réglages échappaient à sa zone de défilement, faute d'ancêtre positionné, et allongeaient la page. Les zones de défilement du panneau et de la palette sont maintenant `relative`.
- **Cause 2** : avec un texte agrandi sur un écran peu haut, le menu de gauche de Préparation dépassait la fenêtre ; il défile désormais seul (à partir de 768 px de large).
- Les tuiles de la palette grandissent avec le texte au lieu de couper leur nom.
- **Audit** (`e2e/layout.spec.ts`) : l'éditeur de carte et le plateau de jeu ne doivent jamais faire défiler la page en hauteur, à 100 %, 125 % et 150 % de taille de texte (à partir de 768 px ; sur téléphone le menu s'empile au-dessus et la page défile normalement). Vérifié en réintroduisant le défaut.

### D-260 · Supprimer sur le plateau de jeu aussi

Retour du MJ : « la suppression d'éléments ne fonctionne pas ». Dans l'éditeur, tout se supprimait (vérifié : éléments de chaque type, murs, jetons, après rechargement) ; mais sur le plateau « En jeu », le panneau d'un élément n'avait pas de bouton « Supprimer », celui d'un mur ou d'une porte non plus, et la touche Suppr n'y faisait rien.

- Le bouton « Supprimer l'élément » et « Supprimer » (mur, porte) sont proposés en jeu comme dans l'éditeur ; Ctrl+Z annule.
- Les raccourcis (Suppr ou Retour arrière : supprimer la sélection ; R : tourner l'élément) sont partagés par l'éditeur et le plateau (`useMapKeys`). En jeu, la touche ne retire pas les personnages : cliquer un jeton ouvre sa fiche, un Retour arrière égaré ne doit pas l'enlever de la carte (« Retirer de la carte » reste dans la manipulation rapide).

### D-259 · Éditeur de carte : personnages, zones d'images, portes à double sens

Demandes du MJ : pouvoir supprimer des éléments en éditant une carte, y poser un allié ou un personnage (pas seulement un ennemi), faire apparaître une image ou une suite d'images quand on clique sur une zone, montrer les portes sur une seconde carte de la démo, et poser automatiquement le point de retour sur la carte cible.

- **Supprimer** : le bouton « Supprimer l'élément » et la touche Suppr existaient, mais la couche du MJ (notes, et désormais zones d'images) n'écoutait les clics qu'avec la gomme : on ne pouvait ni ouvrir ni supprimer une note. Elle a maintenant sa propre couche cliquable, en édition comme en jeu.
- **Personnages dans l'éditeur** : section « Personnages » de la palette (et du menu sous 1280 px) avec tous les types, joueurs, alliés, familiers, ennemis ; on glisse sur la carte ou on clique pour poser au centre. Un jeton sélectionné s'ouvre dans un panneau (taille, caché, « Retirer de la carte ») ; Suppr retire les jetons sélectionnés. La pose est partagée avec le jeu (`withToken`).
- **Zone d'images** (« Image à montrer », couche MJ, jamais vue des joueurs) : une liste ordonnée d'images ajoutées dans l'éditeur. En jeu, le MJ clique la zone : « Montrer aux joueurs », puis image précédente / suivante (« 2 / 3 »), « Revenir à la carte ». `PlayerDisplay.gallery` porte la suite ; la fenêtre joueurs montre l'image entière et sa position, le joueur en ligne la voit par-dessus le plateau. Un joueur en ligne ne reçoit que l'image à l'écran, jamais les suivantes.
- **Porte à double sens** : choisir la cible d'un passage (éditeur ou jeu) pose aussitôt le passage de retour sur la carte cible, au même endroit (ramené dans la carte), sur la case libre la plus proche qui n'est pas déjà un passage ; jamais un second retour. Une seule annulation retire les deux. Dans l'éditeur de session, le retour est posé tout seul ; le MJ peut cliquer pour le déplacer ou garder l'emplacement.
- **Démo** (`exemples/campagne-test-ombreval.json`) : seconde carte « Ossuaire d'Ombreval » reliée à la crypte par un escalier dans chaque sens, une zone « Fresque de l'autel » avec deux images, et la session devient le parcours crypte → ossuaire. Réimporter le fichier pour la voir.

### D-258 · Une session est un parcours de cartes

Demande du MJ : une session est une succession de cartes dont on fixe l'ordre d'apparition, construite de la façon la plus visuelle possible, et les portes se posent depuis l'édition de la session.

- **Modèle** : `SessionPlan.mapId` (une carte) devient `mapIds` (liste ordonnée). Les sessions enregistrées avant sont converties à la lecture (`normalizeSessionPlan`, aussi appliqué par le dépôt) et à l'import ; une copie de campagne garde l'ordre.
- **« Parcours de la session »**, en tête de l'éditeur : une carte par étape (vignette de l'image de fond, sinon sa grille ; numéro d'étape ; portes vers et depuis les autres cartes, avec leur numéro). L'ordre se change en glissant les cartes, ou avec les flèches (clavier). On ajoute une carte existante ou on en crée une nouvelle sur place ; retirer une carte du parcours ne la supprime pas.
- **Poser une porte** (fenêtre de préparation, autorisée hors jeu) : on choisit où elle mène (par défaut l'étape suivante), on clique sur la case du plateau ; puis on clique là où l'on arrive sur l'autre carte (la porte du retour), ou « Pas de porte de retour ». Si l'autre carte a déjà une porte qui revient, l'étape est sautée. Une porte posée sur une case qui en a déjà une est redirigée (`withPassage`). Chaque pose est annulable (Ctrl+Z). Ces portes sont des passages D-256 : un jeton qui les touche part seul.
- **En jeu** : la première carte du parcours est mise sur le plateau au démarrage ; l'arborescence (D-256) liste les cartes du parcours numérotées dans l'ordre, et propose « Carte suivante ».
- Le plateau de la fenêtre a un mode « choisir une case » (`MapCanvas.onCellPick`) ; elle est chargée à la demande (Konva).

### D-257 · Mise en ligne : choix du MJ qui révisent D-249

Le MJ abandonne l'échange de codes pair-à-pair (D-245) et vise directement la mise en ligne. Choix faits le 2026-10-13 :

- **Ordre** : cartes d'abord (D-256), puis le serveur.
- **Données chiffrées sur le serveur, lisibles par lui** (et non chiffrées de bout en bout comme le prévoyait D-249) : chiffrées au repos et en transit (HTTPS). Plus simple, mot de passe oublié réinitialisable par e-mail, recherche et partage côté serveur. La messagerie (phase 10) suit le même choix.
- **Compte en ligne + copie hors ligne** : on prépare sans connexion sur une copie locale chiffrée, synchronisée au retour du réseau. Les comptes et campagnes locaux existants sont repris par le compte en ligne.
- **Rejoindre** : un joueur demande à rejoindre une **campagne** (lien d'invitation ou recherche) ; le MJ accepte, choisit le rôle (joueur ou co-MJ) et le personnage ; ensuite le joueur voit les séances en cours et y entre en un clic. Un bouton bascule entre mode MJ (créer, gérer ses campagnes) et mode joueur (rejoindre, ses parties).
- Reste valable de D-249 : Node.js, Fastify, PostgreSQL, WebSocket derrière Caddy en Docker Compose ; Umami sans cookie.

## Hygiène du code (2026-10-13)

### D-254 · Réutiliser avant d'écrire

Demande du MJ : ne pas réécrire ce qui existe déjà dans une librairie. Règle (CLAUDE.md) : avant d'écrire un utilitaire, chercher dans la plateforme (`Intl`, `structuredClone`…), puis dans les dépendances installées, puis dans `src/lib/`. Première passe :

- `shallowEqual` de l'historique remplacé par `shallow` de `zustand/shallow`.
- `isRecord` (5 copies) → `src/lib/guards.ts` ; test « on tape dans un champ » (5 variantes) → `isTypingTarget` dans `src/lib/dom.ts`.
- Base64url des codes de connexion : réutilise `toBase64`/`fromBase64`/`utf8` de `security/crypto.ts` au lieu d'un encodeur octet par octet.
- Tris alphabétiques : un `Intl.Collator('fr')` partagé (`compareText`, `src/lib/text.ts`) au lieu de `localeCompare(…, 'fr')`, qui recrée un collateur à chaque comparaison.
- Bornes `Math.min(Math.max(…))` → `clamp()` (`src/lib/numbers.ts`).
- Pas de nouvelle dépendance (lodash, etc.) : la plateforme et les paquets déjà là suffisent.

### D-255 · Écran de connexion rapide

Demande du MJ : la connexion et l'inscription chargeaient trop lentement.

- **Écrans à la demande** : tout ce qui est derrière le verrou (`src/app/screens.tsx`) se charge à la demande. Le JS téléchargé avant l'écran de connexion passe de ≈ 1 245 Ko à ≈ 620 Ko (React, routeur, Dexie, chiffrement). Pendant qu'on tape le mot de passe, `preloadScreens()` récupère en tâche de fond la liste des campagnes et la préparation : l'arrivée après déverrouillage n'attend rien.
- Un écran dont le code est déjà là s'affiche directement, sans `lazy` : sinon React suspend une fois de plus et retient la page jusqu'à 500 ms par niveau de mise en page imbriqué. Le choix se fait au montage, pour ne jamais remonter un écran ouvert.
- **Inscription et récupération** : les deux dérivations PBKDF2 (mot de passe, code de secours) tournent en parallèle, soit ≈ 220 ms au lieu de ≈ 330 ms sur ordinateur, et proportionnellement plus gagné sur téléphone. Les 600 000 itérations restent (D-241) : c'est le prix de la sécurité, pas un défaut.
- **Sauvegarde du jour** : la date de la dernière sauvegarde se lit dans l'index (`lastKey()`), au lieu de déchiffrer toute la dernière archive à chaque connexion. Quand une sauvegarde est due, elle attend que le navigateur soit inactif (`whenIdle`) au lieu de concurrencer l'affichage du premier écran.
- Tests : `renderApp` précharge tous les écrans (await au chargement du module).

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

### D-253 · Des textes avec une voix

- **Ce qui sonnait « généré »** : la même tournure partout (« Aucun X pour l'instant »), les formules passe-partout (« Vue d'ensemble », « Pour bien commencer », « Tout ce qu'il faut à ta table »), les tirets cadratins dans les libellés, et sur l'accueil la grille de huit cartes identiques.
- **Ce qui les remplace** : des états vides qui parlent la langue de la table (« Ton bestiaire attend ses créatures », « Le coffre est vide », « Ni poison ni malédiction », « Les dés n'ont pas encore roulé », « La table attend ses joueurs »), des sous-titres concrets, des exemples de JDR dans les champs (« Un royaume en ruine, une dette de sang… »). Le tutoiement, la clarté et la longueur restent les mêmes : rien de plus long, rien de cryptique. Les libellés avec « — » passent à « : » ou « de » ; les titres de pages utilisent « · ».
- **Accueil** : « Le grimoire de ta table », puis deux chapitres qui alternent texte et capture (les fiches, la table en jeu) et une courte liste « Et aussi » en texte, au lieu d'une grille de cartes. Devise : « le grimoire du maître du jeu ».
- Corrigé au passage : l'état vide des cartes annonçait encore l'éditeur de plateau « dans une prochaine phase ».

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

### D-245 · Deux modes : MJ seul (local) et en ligne, pair-à-pair sans serveur (transport remplacé par D-262)

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
