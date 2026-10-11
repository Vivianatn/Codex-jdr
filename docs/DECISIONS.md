# Journal des décisions

Choix techniques et UX non couverts par le cahier des charges ([SPEC.md](SPEC.md)), du plus récent au plus ancien. Format : contexte → décision → raison.

---

## Phase 1 — Fiches (2026-10-11)

### D-101 · Règles confirmées par le MJ

Réponses aux questions de la section 13, appliquées comme valeurs par défaut dans `src/rules/config.ts` (`DEFAULT_RULES`) et modifiables par campagne dans **Préparation › Règles** :

| #   | Question                         | Règle retenue                                                                                |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Arrondi de `2d20/2`              | Au supérieur (défaut conservé)                                                               |
| 2   | PV à la montée de niveau         | **+1 PV max par niveau gagné**. Donc PV max = 10 + 1d20 + Nv à tout niveau.                  |
| 3   | Méthode des tests                | Jet sous la caractéristique, `1d20 ≤ valeur` (défaut conservé)                               |
| 4   | Progression des caractéristiques | Non (défaut conservé)                                                                        |
| 5   | Gain de compétences              | **+1 compétence (active ou passive) tous les 10 niveaux**, sans niveau requis par compétence |
| 6   | Critiques                        | **1 = réussite critique majeure, 2 = mineure ; 20 = échec critique majeur, 19 = mineur**     |
| 7   | Unité de grille                  | **1 case = 1 m**                                                                             |

« On garde par défaut » a été interprété comme couvrant les questions sans réponse explicite (1, 3 et 4). Les faces critiques l'emportent toujours sur la comparaison : un 2 naturel réussit même sous une caractéristique de 1, un 19 naturel échoue même sous 20. Le critique élargi par la Chance (§4.9) existe, mais il est désactivé par défaut.

### D-102 · Statistiques et PV tirés à l'avance

Le MJ tire les caractéristiques et les PV avant la séance, pour tous les types de personnages. L'assistant ne lance donc aucun dé : on **saisit** soit la valeur finale, soit les deux d20 (l'app applique alors la division par 2 et l'arrondi de la campagne). Les PV se saisissent sous forme du d20 tiré, et le total `10 + jet + Nv` est affiché. Le lanceur de dés général (§7) reste prévu en phase 2, pour les jets que le MJ fera en partie. L'animation « la valeur se grave dans la carte » est conservée à la saisie.

### D-103 · PV max dérivé, jamais stocké

On stocke le **jet de PV** (`hp.roll`), pas le maximum. `PV max = base + jet + 1 + (Nv − 1) × PV par niveau` est recalculé partout (`rules/hp.ts`). Changer une règle met donc à jour toutes les fiches, et un import Discord retrouve le jet à partir du maximum. À une montée de niveau, les PV actuels augmentent du même nombre que le maximum.

### D-104 · Compétences de départ exigées pour les joueurs seulement (configurable)

La fiche Discord est celle des joueurs. Imposer « exactement 2 actives, 1 passive, 1 passif de classe » pour chaque gobelin serait un formulaire bloquant inutile (§9.5). L'assistant bloque donc pour les **joueurs** par défaut ; les types concernés se choisissent dans les règles de campagne. Sur une fiche existante, dépasser le nombre de compétences autorisé par le niveau n'affiche qu'un avertissement.

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
- Les audits axe des tests e2e attendent la fin des animations : un contraste mesuré pendant un fondu (texte encore semi-transparent) donnait de faux positifs.
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

Un seul bundle de ≈ 215 kB gzip en phase 0. Pour une app locale, c'est bien en dessous de l'objectif d'ouverture en moins de 2 s. Le seuil d'avertissement de Vite est relevé à 800 kB ; le découpage par route (`React.lazy`) est prévu avec l'optimisation de la phase 6, ou plus tôt si le plateau (Konva/Pixi) alourdit beaucoup le bundle.

### D-012 · Modales

Les `Dialog` (Radix) servent uniquement en Préparation (création, renommage) et pour les confirmations de suppression. En mode En jeu, les phases suivantes utiliseront des tiroirs et des toasts (`sonner`, en bas à droite, non bloquants).
