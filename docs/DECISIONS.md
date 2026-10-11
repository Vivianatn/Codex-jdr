# Journal des décisions

Choix techniques et UX non couverts par le cahier des charges ([SPEC.md](SPEC.md)), du plus récent au plus ancien. Format : contexte → décision → raison.

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
