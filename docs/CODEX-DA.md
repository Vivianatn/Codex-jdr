# CODEX-DA — Direction artistique « Codex à la chandelle »

> Document de référence pour appliquer la direction artistique de Codex dans le code (React 18, Tailwind CSS v4, Radix UI, Konva).
> Il se lit de haut en bas. Chaque valeur est exacte et doit être reprise telle quelle. Aucun choix n'est laissé ouvert.
> Les maquettes correspondantes sont sur le canvas « Codex — DA Grimoire moderne ».

---

## 1. Intention

**Codex à la chandelle** : l'élégance d'un vieux manuel de jeu de rôle, traduite en outil contemporain, clair et aéré.

- **Mots-clés** : ivoire, encre, améthyste, or, chandelle, filet gravé, retenue, lisibilité, calme sous pression.
- **Base** : une interface d'outil pro (hiérarchie nette, beaucoup d'air, contrôles sobres). Le fantastique se loge dans les détails : petites capitales calligraphiques (Alegreya SC), titres de cartes à empattements humanistes (Alegreya), texte en sans humaniste (Source Sans 3), filets et fleurons dorés fins, coins enluminés, or réservé à l'exceptionnel.
- **Préparation** (clair par défaut) : ivoire chaud, encre violet-noir, or dosé.
- **En jeu** (sombre par défaut) : « table à la lueur des bougies ». Brun-noir chaud, jamais noir pur, jamais violacé. Le plateau est le héros ; l'interface flotte autour en verre dépoli et s'efface.
- **Vue joueurs** : toujours sombre, sans aucun chrome, lisible à 3 mètres.
- **On ne fait pas** : parchemin chargé, cuir, clous, skeuomorphisme ; polices « médiévales » ; néon et esthétique gamer ; dégradés violets ; SaaS générique. Une couleur n'est jamais le seul porteur d'une information (toujours doublée d'un libellé, d'une icône ou d'une forme).

---

## 2. Tokens de couleur

Tous les noms existants sont conservés. Les nouveaux sont préfixés `--codex-` et marqués _(nouveau)_. Le thème sombre s'active avec `data-theme="dark"` sur `<html>` ; le réglage « Automatique » pose cet attribut selon `prefers-color-scheme`.

Règles d'usage transverses :

- Un token sans suffixe (`--codex-hp`, `--codex-stat-wisdom`…) sert aux **éléments d'interface** (barres, liserés, remplissages, icônes). Pour du **texte**, on utilise toujours la variante `*-text`.
- Les fonds de pastilles utilisent la variante `*-soft`.
- `--codex-line` est décoratif ; toute bordure de contrôle utilise `--codex-line-strong`.

| Token                                        | Clair                                                              | Sombre                                                        | Usage                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `--codex-bg`                                 | `#F6F2E9`                                                          | `#15110D`                                                     | Fond de l'application derrière toutes les surfaces.                                                   |
| `--codex-surface`                            | `#FFFDF8`                                                          | `#1F1913`                                                     | Cartes, panneaux fixes, champs de saisie.                                                             |
| `--codex-surface-2`                          | `#EFE9DC`                                                          | `#29211A`                                                     | Zones secondaires : pistes de barres, contrôles segmentés, lignes survolées.                          |
| `--codex-surface-glass`                      | `rgb(255 253 248 / 0.84)`                                          | `rgb(31 25 19 / 0.82)`                                        | Surfaces qui flottent sur le plateau (avec flou 16 px).                                               |
| `--codex-ink`                                | `#211C26`                                                          | `#F2EADD`                                                     | Texte principal, icônes actives.                                                                      |
| `--codex-ink-muted`                          | `#655D6E`                                                          | `#B3A691`                                                     | Texte secondaire, légendes, icônes au repos.                                                          |
| `--codex-line`                               | `#E2DACA`                                                          | `#362C23`                                                     | Séparateurs et contours décoratifs, jamais seuls porteurs de sens.                                    |
| `--codex-line-strong`                        | `#8C8069`                                                          | `#85745F`                                                     | Bordures de contrôles (champs, boutons secondaires, cases) : 3:1 minimum.                             |
| `--codex-accent`                             | `#6D5BD0`                                                          | `#7562D8`                                                     | Action principale : boutons primaires, onglet actif, sélection.                                       |
| `--codex-accent-hover`                       | `#5C4AC0`                                                          | `#6655CC`                                                     | Survol de l’action principale.                                                                        |
| `--codex-accent-soft`                        | `#ECE8FA`                                                          | `#2C2540`                                                     | Fond d’un élément sélectionné (navigation, puce, carte).                                              |
| `--codex-accent-text`                        | `#5844BA`                                                          | `#B4A6F4`                                                     | Texte et liens couleur améthyste, boutons fantômes.                                                   |
| `--codex-gold`                               | `#D9A441`                                                          | `#E0AE4E`                                                     | Remplissages exceptionnels : barre d’XP, étincelles, dé critique. Jamais seul comme bordure en clair. |
| `--codex-gold-soft`                          | `#F7ECD3`                                                          | `#3A2C17`                                                     | Fond des moments exceptionnels : niveau, légendaire, tour actif.                                      |
| `--codex-gold-text`                          | `#82601B`                                                          | `#EBC274`                                                     | Texte doré, surtitres en capitales.                                                                   |
| `--codex-hp`                                 | `#E05252`                                                          | `#E35D5D`                                                     | PV, dégâts : barres et pastilles (élément d’interface).                                               |
| `--codex-hp-text`                            | `#AE2E2B`                                                          | `#F28B82`                                                     | Texte de dégâts, messages d’erreur.                                                                   |
| `--codex-heal`                               | `#2E9A5E`                                                          | `#4CB97A`                                                     | Soin, PV sains : barres et pastilles.                                                                 |
| `--codex-heal-text`                          | `#20714A`                                                          | `#7BD6A1`                                                     | Texte de soin, statut « Prêt ».                                                                       |
| `--codex-warning`                            | `#B97A12`                                                          | `#E8A33D`                                                     | Alerte, PV « blessé » : barres et pastilles.                                                          |
| `--codex-info`                               | `#3A80CC`                                                          | `#4A90D9`                                                     | Information, contour des PV temporaires.                                                              |
| `--codex-stat-strength`                      | `#B5483A`                                                          | `#D0675A`                                                     | Force : liseré, pastille pleine, graphique.                                                           |
| `--codex-stat-constitution`                  | `#5E8B4A`                                                          | `#7FAE6A`                                                     | Constitution : idem.                                                                                  |
| `--codex-stat-dexterity`                     | `#17908A`                                                          | `#34C0B5`                                                     | Dextérité : idem.                                                                                     |
| `--codex-stat-intelligence`                  | `#3E6FD8`                                                          | `#6B93EC`                                                     | Intelligence : idem.                                                                                  |
| `--codex-stat-charisma`                      | `#C94A85`                                                          | `#E57AAB`                                                     | Charisme : idem.                                                                                      |
| `--codex-stat-wisdom`                        | `#8B5CC7`                                                          | `#A782DC`                                                     | Sagesse : idem.                                                                                       |
| `--codex-stat-luck`                          | `#A87719`                                                          | `#E2B65E`                                                     | Chance : idem.                                                                                        |
| `--codex-surface-raised` _(nouveau)_         | `#FFFFFF`                                                          | `#241E17`                                                     | Boîtes de dialogue, menus, info-bulles : un cran au-dessus de surface.                                |
| `--codex-surface-sunken` _(nouveau)_         | `#EAE3D4`                                                          | `#191410`                                                     | Creux : grille d’inventaire, scène du lanceur de dés, puits de dépôt.                                 |
| `--codex-ink-faint` _(nouveau)_              | `#9A9183`                                                          | `#75695A`                                                     | Texte désactivé uniquement (exempté de contraste par le WCAG).                                        |
| `--codex-on-accent` _(nouveau)_              | `#FFFFFF`                                                          | `#FFFFFF`                                                     | Texte et icônes posés sur accent, danger et jetons.                                                   |
| `--codex-accent-active` _(nouveau)_          | `#4E3DAE`                                                          | `#5848BE`                                                     | Appui (état actif) de l’action principale.                                                            |
| `--codex-focus` _(nouveau)_                  | `#6D5BD0`                                                          | `#B4A6F4`                                                     | Anneau de focus clavier (2 px + 2 px d’écart).                                                        |
| `--codex-on-gold` _(nouveau)_                | `#2A1E08`                                                          | `#2A1E08`                                                     | Texte posé sur un remplissage gold.                                                                   |
| `--codex-gold-line` _(nouveau)_              | `#A97B22`                                                          | `#C9963A`                                                     | Filets, ornements, cadres légendaires, halo du jeton actif en clair.                                  |
| `--codex-gold-glow` _(nouveau)_              | `rgb(217 164 65 / 0.40)`                                           | `rgb(224 174 78 / 0.45)`                                      | Lueur diffuse des moments dorés (box-shadow uniquement).                                              |
| `--codex-hp-soft` _(nouveau)_                | `#FCECE7`                                                          | `#3E241F`                                                     | Fond des pastilles de dégâts, d’erreur, des ennemis.                                                  |
| `--codex-danger` _(nouveau)_                 | `#C43C3A`                                                          | `#C43C3A`                                                     | Fond du bouton danger et de « Infliger » (texte on-accent 5,18:1).                                    |
| `--codex-danger-hover` _(nouveau)_           | `#A93230`                                                          | `#A93230`                                                     | Survol du bouton danger.                                                                              |
| `--codex-heal-soft` _(nouveau)_              | `#EAF3E9`                                                          | `#263323`                                                     | Fond des pastilles de soin et d’états bénéfiques.                                                     |
| `--codex-warning-text` _(nouveau)_           | `#8A5A0E`                                                          | `#F0BF6E`                                                     | Texte d’alerte, libellé « Blessé ».                                                                   |
| `--codex-warning-soft` _(nouveau)_           | `#F8F0E1`                                                          | `#3F2F1A`                                                     | Fond d’alerte, traînée fantôme de la barre de PV.                                                     |
| `--codex-info-text` _(nouveau)_              | `#2B66A8`                                                          | `#8DBDF0`                                                     | Texte d’information.                                                                                  |
| `--codex-info-soft` _(nouveau)_              | `#EBF1F4`                                                          | `#262C33`                                                     | Fond d’information.                                                                                   |
| `--codex-hp-temp` _(nouveau)_                | `#D7E6F5`                                                          | `#22364D`                                                     | Segment des PV temporaires dans la barre (contour info).                                              |
| `--codex-stat-strength-text` _(nouveau)_     | `#A43D30`                                                          | `#E58A7E`                                                     | Texte de la Force (sigle, valeur colorée).                                                            |
| `--codex-stat-constitution-text` _(nouveau)_ | `#476E36`                                                          | `#97C383`                                                     | Texte de la Constitution.                                                                             |
| `--codex-stat-dexterity-text` _(nouveau)_    | `#13716A`                                                          | `#5BD3C9`                                                     | Texte de la Dextérité.                                                                                |
| `--codex-stat-intelligence-text` _(nouveau)_ | `#3460C4`                                                          | `#93B1F2`                                                     | Texte de l’Intelligence.                                                                              |
| `--codex-stat-charisma-text` _(nouveau)_     | `#B23D73`                                                          | `#EE9BC0`                                                     | Texte du Charisme.                                                                                    |
| `--codex-stat-wisdom-text` _(nouveau)_       | `#7A4BB6`                                                          | `#BEA2E8`                                                     | Texte de la Sagesse.                                                                                  |
| `--codex-stat-luck-text` _(nouveau)_         | `#82601B`                                                          | `#EBC274`                                                     | Texte de la Chance.                                                                                   |
| `--codex-stat-strength-soft` _(nouveau)_     | `#F6E7E1`                                                          | `#422921`                                                     | Fond de pastille Force.                                                                               |
| `--codex-stat-constitution-soft` _(nouveau)_ | `#ECEFE3`                                                          | `#323724`                                                     | Fond de pastille Constitution.                                                                        |
| `--codex-stat-dexterity-soft` _(nouveau)_    | `#E3F0EB`                                                          | `#233A33`                                                     | Fond de pastille Dextérité.                                                                           |
| `--codex-stat-intelligence-soft` _(nouveau)_ | `#E8ECF4`                                                          | `#2E313E`                                                     | Fond de pastille Intelligence.                                                                        |
| `--codex-stat-charisma-soft` _(nouveau)_     | `#F9E8EA`                                                          | `#472C31`                                                     | Fond de pastille Charisme.                                                                            |
| `--codex-stat-wisdom-soft` _(nouveau)_       | `#F1EAF2`                                                          | `#3A2E3B`                                                     | Fond de pastille Sagesse.                                                                             |
| `--codex-stat-luck-soft` _(nouveau)_         | `#F5EDDD`                                                          | `#463822`                                                     | Fond de pastille Chance.                                                                              |
| `--codex-rarity-common` _(nouveau)_          | `#8C8069`                                                          | `#8E7F6B`                                                     | Cadre d’objet commun.                                                                                 |
| `--codex-rarity-common-text` _(nouveau)_     | `#655D6E`                                                          | `#B3A691`                                                     | Libellé « COMMUN ».                                                                                   |
| `--codex-rarity-common-soft` _(nouveau)_     | `#FFFDF8`                                                          | `#29211A`                                                     | Fond de case commune.                                                                                 |
| `--codex-rarity-uncommon` _(nouveau)_        | `#3D8F55`                                                          | `#5FC27D`                                                     | Cadre d’objet peu commun.                                                                             |
| `--codex-rarity-uncommon-text` _(nouveau)_   | `#2C7442`                                                          | `#7BD6A1`                                                     | Libellé « PEU COMMUN ».                                                                               |
| `--codex-rarity-uncommon-soft` _(nouveau)_   | `#EAF3E9`                                                          | `#263323`                                                     | Fond de case peu commune.                                                                             |
| `--codex-rarity-rare` _(nouveau)_            | `#3E6FD8`                                                          | `#6B93EC`                                                     | Cadre d’objet rare.                                                                                   |
| `--codex-rarity-rare-text` _(nouveau)_       | `#3460C4`                                                          | `#93B1F2`                                                     | Libellé « RARE ».                                                                                     |
| `--codex-rarity-rare-soft` _(nouveau)_       | `#E8ECF4`                                                          | `#2E313E`                                                     | Fond de case rare.                                                                                    |
| `--codex-rarity-very-rare` _(nouveau)_       | `#8B5CC7`                                                          | `#A782DC`                                                     | Cadre d’objet très rare.                                                                              |
| `--codex-rarity-very-rare-text` _(nouveau)_  | `#7A4BB6`                                                          | `#BEA2E8`                                                     | Libellé « TRÈS RARE ».                                                                                |
| `--codex-rarity-very-rare-soft` _(nouveau)_  | `#F1EAF2`                                                          | `#3A2E3B`                                                     | Fond de case très rare.                                                                               |
| `--codex-rarity-legendary` _(nouveau)_       | `#A97B22`                                                          | `#C9963A`                                                     | Cadre d’objet légendaire (+ lueur gold-glow).                                                         |
| `--codex-rarity-legendary-text` _(nouveau)_  | `#82601B`                                                          | `#EBC274`                                                     | Libellé « LÉGENDAIRE ».                                                                               |
| `--codex-rarity-legendary-soft` _(nouveau)_  | `#F7ECD3`                                                          | `#3A2C17`                                                     | Fond de case légendaire.                                                                              |
| `--codex-token-player` _(nouveau)_           | `#6D5BD0`                                                          | `#7562D8`                                                     | Couleur du type Joueur hors canvas (listes, filtres).                                                 |
| `--codex-token-ally` _(nouveau)_             | `#2B7D4C`                                                          | `#2B7D4C`                                                     | Couleur du type Allié hors canvas.                                                                    |
| `--codex-token-familiar` _(nouveau)_         | `#137570`                                                          | `#137570`                                                     | Couleur du type Familier hors canvas.                                                                 |
| `--codex-token-foe` _(nouveau)_              | `#C43C3A`                                                          | `#C43C3A`                                                     | Couleur du type Ennemi hors canvas.                                                                   |
| `--codex-token-npc` _(nouveau)_              | `#B23D73`                                                          | `#B23D73`                                                     | Couleur des PNJ hors canvas.                                                                          |
| `--codex-scrim` _(nouveau)_                  | `rgb(33 28 38 / 0.40)`                                             | `rgb(8 6 4 / 0.62)`                                           | Voile derrière une boîte de dialogue.                                                                 |
| `--codex-glass-line` _(nouveau)_             | `rgb(140 128 105 / 0.35)`                                          | `rgb(242 234 221 / 0.10)`                                     | Bordure 1 px des surfaces en verre dépoli.                                                            |
| `--codex-bar` _(nouveau)_                    | `rgb(255 253 248 / 0.94)`                                          | `rgb(21 17 13 / 0.94)`                                        | Fond du bandeau des tours en mode En jeu.                                                             |
| `--codex-shadow-soft`                        | `0 1px 2px rgb(33 28 38 / 0.06), 0 4px 16px rgb(33 28 38 / 0.06)`  | `0 1px 2px rgb(0 0 0 / 0.30), 0 4px 16px rgb(0 0 0 / 0.30)`   | Cartes au repos.                                                                                      |
| `--codex-shadow-lifted`                      | `0 2px 4px rgb(33 28 38 / 0.06), 0 12px 32px rgb(33 28 38 / 0.10)` | `0 2px 6px rgb(0 0 0 / 0.35), 0 16px 40px rgb(0 0 0 / 0.45)`  | Survol de carte, surfaces flottantes, toasts.                                                         |
| `--codex-shadow-overlay`                     | `0 4px 8px rgb(33 28 38 / 0.10), 0 24px 64px rgb(33 28 38 / 0.22)` | `0 4px 12px rgb(0 0 0 / 0.45), 0 32px 80px rgb(0 0 0 / 0.60)` | Boîtes de dialogue, palette de commandes.                                                             |
| `--codex-radius-sm`                          | `8px`                                                              | `8px`                                                         | Puces carrées, cases d’inventaire 52 px, info-bulles.                                                 |
| `--codex-radius`                             | `12px`                                                             | `12px`                                                        | Champs, boutons, cases d’inventaire 84 px, toasts, cartes compactes.                                  |
| `--codex-radius-lg`                          | `16px`                                                             | `16px`                                                        | Cartes, panneaux, surfaces flottantes.                                                                |
| `--codex-radius-xl` _(nouveau)_              | `20px`                                                             | `20px`                                                        | Boîtes de dialogue.                                                                                   |
| `--codex-radius-pill` _(nouveau)_            | `999px`                                                            | `999px`                                                       | Pastilles, puces, barres.                                                                             |
| `--codex-blur-glass` _(nouveau)_             | `16px`                                                             | `16px`                                                        | Flou du verre dépoli (backdrop-filter).                                                               |
| `--codex-grain-opacity` _(nouveau)_          | `0.025`                                                            | `0.03`                                                        | Opacité du grain de papier.                                                                           |
| `--codex-dur-fast` _(nouveau)_               | `150ms`                                                            | `150ms`                                                       | Survol, couleur, focus.                                                                               |
| `--codex-dur-base` _(nouveau)_               | `220ms`                                                            | `220ms`                                                       | Ouverture de menu, onglets, toasts.                                                                   |
| `--codex-dur-slow` _(nouveau)_               | `300ms`                                                            | `300ms`                                                       | Tiroirs, boîtes de dialogue, pages.                                                                   |
| `--codex-dur-moment` _(nouveau)_             | `600ms`                                                            | `600ms`                                                       | Barre de PV, révélation, dégâts flottants.                                                            |
| `--codex-dur-epic` _(nouveau)_               | `1200ms`                                                           | `1200ms`                                                      | Dés, critique, montée de niveau.                                                                      |
| `--codex-ease-out` _(nouveau)_               | `cubic-bezier(0.22, 1, 0.36, 1)`                                   | `cubic-bezier(0.22, 1, 0.36, 1)`                              | Entrées, apparitions (courbe par défaut).                                                             |
| `--codex-ease-in` _(nouveau)_                | `cubic-bezier(0.55, 0, 1, 0.45)`                                   | `cubic-bezier(0.55, 0, 1, 0.45)`                              | Sorties, disparitions.                                                                                |
| `--codex-ease-in-out` _(nouveau)_            | `cubic-bezier(0.65, 0, 0.35, 1)`                                   | `cubic-bezier(0.65, 0, 0.35, 1)`                              | Déplacements de caméra, barres.                                                                       |
| `--codex-ease-bounce` _(nouveau)_            | `cubic-bezier(0.34, 1.56, 0.64, 1)`                                | `cubic-bezier(0.34, 1.56, 0.64, 1)`                           | Rebond des dés et des chiffres.                                                                       |

### Bloc CSS complet (à coller tel quel dans `src/styles/tokens.css`)

```css
:root {
  color-scheme: light;
  --codex-bg: #f6f2e9;
  --codex-surface: #fffdf8;
  --codex-surface-2: #efe9dc;
  --codex-surface-glass: rgb(255 253 248 / 0.84);
  --codex-ink: #211c26;
  --codex-ink-muted: #655d6e;
  --codex-line: #e2daca;
  --codex-line-strong: #8c8069;
  --codex-accent: #6d5bd0;
  --codex-accent-hover: #5c4ac0;
  --codex-accent-soft: #ece8fa;
  --codex-accent-text: #5844ba;
  --codex-gold: #d9a441;
  --codex-gold-soft: #f7ecd3;
  --codex-gold-text: #82601b;
  --codex-hp: #e05252;
  --codex-hp-text: #ae2e2b;
  --codex-heal: #2e9a5e;
  --codex-heal-text: #20714a;
  --codex-warning: #b97a12;
  --codex-info: #3a80cc;
  --codex-stat-strength: #b5483a;
  --codex-stat-constitution: #5e8b4a;
  --codex-stat-dexterity: #17908a;
  --codex-stat-intelligence: #3e6fd8;
  --codex-stat-charisma: #c94a85;
  --codex-stat-wisdom: #8b5cc7;
  --codex-stat-luck: #a87719;
  --codex-surface-raised: #ffffff;
  --codex-surface-sunken: #eae3d4;
  --codex-ink-faint: #9a9183;
  --codex-on-accent: #ffffff;
  --codex-accent-active: #4e3dae;
  --codex-focus: #6d5bd0;
  --codex-on-gold: #2a1e08;
  --codex-gold-line: #a97b22;
  --codex-gold-glow: rgb(217 164 65 / 0.4);
  --codex-hp-soft: #fcece7;
  --codex-danger: #c43c3a;
  --codex-danger-hover: #a93230;
  --codex-heal-soft: #eaf3e9;
  --codex-warning-text: #8a5a0e;
  --codex-warning-soft: #f8f0e1;
  --codex-info-text: #2b66a8;
  --codex-info-soft: #ebf1f4;
  --codex-hp-temp: #d7e6f5;
  --codex-stat-strength-text: #a43d30;
  --codex-stat-constitution-text: #476e36;
  --codex-stat-dexterity-text: #13716a;
  --codex-stat-intelligence-text: #3460c4;
  --codex-stat-charisma-text: #b23d73;
  --codex-stat-wisdom-text: #7a4bb6;
  --codex-stat-luck-text: #82601b;
  --codex-stat-strength-soft: #f6e7e1;
  --codex-stat-constitution-soft: #ecefe3;
  --codex-stat-dexterity-soft: #e3f0eb;
  --codex-stat-intelligence-soft: #e8ecf4;
  --codex-stat-charisma-soft: #f9e8ea;
  --codex-stat-wisdom-soft: #f1eaf2;
  --codex-stat-luck-soft: #f5eddd;
  --codex-rarity-common: #8c8069;
  --codex-rarity-common-text: #655d6e;
  --codex-rarity-common-soft: #fffdf8;
  --codex-rarity-uncommon: #3d8f55;
  --codex-rarity-uncommon-text: #2c7442;
  --codex-rarity-uncommon-soft: #eaf3e9;
  --codex-rarity-rare: #3e6fd8;
  --codex-rarity-rare-text: #3460c4;
  --codex-rarity-rare-soft: #e8ecf4;
  --codex-rarity-very-rare: #8b5cc7;
  --codex-rarity-very-rare-text: #7a4bb6;
  --codex-rarity-very-rare-soft: #f1eaf2;
  --codex-rarity-legendary: #a97b22;
  --codex-rarity-legendary-text: #82601b;
  --codex-rarity-legendary-soft: #f7ecd3;
  --codex-token-player: #6d5bd0;
  --codex-token-ally: #2b7d4c;
  --codex-token-familiar: #137570;
  --codex-token-foe: #c43c3a;
  --codex-token-npc: #b23d73;
  --codex-scrim: rgb(33 28 38 / 0.4);
  --codex-glass-line: rgb(140 128 105 / 0.35);
  --codex-bar: rgb(255 253 248 / 0.94);
  --codex-shadow-soft: 0 1px 2px rgb(33 28 38 / 0.06), 0 4px 16px rgb(33 28 38 / 0.06);
  --codex-shadow-lifted: 0 2px 4px rgb(33 28 38 / 0.06), 0 12px 32px rgb(33 28 38 / 0.1);
  --codex-shadow-overlay: 0 4px 8px rgb(33 28 38 / 0.1), 0 24px 64px rgb(33 28 38 / 0.22);
  --codex-radius-sm: 8px;
  --codex-radius: 12px;
  --codex-radius-lg: 16px;
  --codex-radius-xl: 20px;
  --codex-radius-pill: 999px;
  --codex-blur-glass: 16px;
  --codex-grain-opacity: 0.025;
  --codex-dur-fast: 150ms;
  --codex-dur-base: 220ms;
  --codex-dur-slow: 300ms;
  --codex-dur-moment: 600ms;
  --codex-dur-epic: 1200ms;
  --codex-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --codex-ease-in: cubic-bezier(0.55, 0, 1, 0.45);
  --codex-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --codex-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --codex-font-display: 'Alegreya SC', 'Alegreya Variable', Georgia, serif;
  --codex-font-title: 'Alegreya Variable', 'Alegreya', Georgia, serif;
  --codex-font-body: 'Source Sans 3 Variable', 'Source Sans 3', system-ui, sans-serif;
}

:root[data-theme='dark'],
[data-theme='dark'] {
  color-scheme: dark;
  --codex-bg: #15110d;
  --codex-surface: #1f1913;
  --codex-surface-2: #29211a;
  --codex-surface-glass: rgb(31 25 19 / 0.82);
  --codex-ink: #f2eadd;
  --codex-ink-muted: #b3a691;
  --codex-line: #362c23;
  --codex-line-strong: #85745f;
  --codex-accent: #7562d8;
  --codex-accent-hover: #6655cc;
  --codex-accent-soft: #2c2540;
  --codex-accent-text: #b4a6f4;
  --codex-gold: #e0ae4e;
  --codex-gold-soft: #3a2c17;
  --codex-gold-text: #ebc274;
  --codex-hp: #e35d5d;
  --codex-hp-text: #f28b82;
  --codex-heal: #4cb97a;
  --codex-heal-text: #7bd6a1;
  --codex-warning: #e8a33d;
  --codex-info: #4a90d9;
  --codex-stat-strength: #d0675a;
  --codex-stat-constitution: #7fae6a;
  --codex-stat-dexterity: #34c0b5;
  --codex-stat-intelligence: #6b93ec;
  --codex-stat-charisma: #e57aab;
  --codex-stat-wisdom: #a782dc;
  --codex-stat-luck: #e2b65e;
  --codex-surface-raised: #241e17;
  --codex-surface-sunken: #191410;
  --codex-ink-faint: #75695a;
  --codex-on-accent: #ffffff;
  --codex-accent-active: #5848be;
  --codex-focus: #b4a6f4;
  --codex-on-gold: #2a1e08;
  --codex-gold-line: #c9963a;
  --codex-gold-glow: rgb(224 174 78 / 0.45);
  --codex-hp-soft: #3e241f;
  --codex-danger: #c43c3a;
  --codex-danger-hover: #a93230;
  --codex-heal-soft: #263323;
  --codex-warning-text: #f0bf6e;
  --codex-warning-soft: #3f2f1a;
  --codex-info-text: #8dbdf0;
  --codex-info-soft: #262c33;
  --codex-hp-temp: #22364d;
  --codex-stat-strength-text: #e58a7e;
  --codex-stat-constitution-text: #97c383;
  --codex-stat-dexterity-text: #5bd3c9;
  --codex-stat-intelligence-text: #93b1f2;
  --codex-stat-charisma-text: #ee9bc0;
  --codex-stat-wisdom-text: #bea2e8;
  --codex-stat-luck-text: #ebc274;
  --codex-stat-strength-soft: #422921;
  --codex-stat-constitution-soft: #323724;
  --codex-stat-dexterity-soft: #233a33;
  --codex-stat-intelligence-soft: #2e313e;
  --codex-stat-charisma-soft: #472c31;
  --codex-stat-wisdom-soft: #3a2e3b;
  --codex-stat-luck-soft: #463822;
  --codex-rarity-common: #8e7f6b;
  --codex-rarity-common-text: #b3a691;
  --codex-rarity-common-soft: #29211a;
  --codex-rarity-uncommon: #5fc27d;
  --codex-rarity-uncommon-text: #7bd6a1;
  --codex-rarity-uncommon-soft: #263323;
  --codex-rarity-rare: #6b93ec;
  --codex-rarity-rare-text: #93b1f2;
  --codex-rarity-rare-soft: #2e313e;
  --codex-rarity-very-rare: #a782dc;
  --codex-rarity-very-rare-text: #bea2e8;
  --codex-rarity-very-rare-soft: #3a2e3b;
  --codex-rarity-legendary: #c9963a;
  --codex-rarity-legendary-text: #ebc274;
  --codex-rarity-legendary-soft: #3a2c17;
  --codex-token-player: #7562d8;
  --codex-token-ally: #2b7d4c;
  --codex-token-familiar: #137570;
  --codex-token-foe: #c43c3a;
  --codex-token-npc: #b23d73;
  --codex-scrim: rgb(8 6 4 / 0.62);
  --codex-glass-line: rgb(242 234 221 / 0.1);
  --codex-bar: rgb(21 17 13 / 0.94);
  --codex-shadow-soft: 0 1px 2px rgb(0 0 0 / 0.3), 0 4px 16px rgb(0 0 0 / 0.3);
  --codex-shadow-lifted: 0 2px 6px rgb(0 0 0 / 0.35), 0 16px 40px rgb(0 0 0 / 0.45);
  --codex-shadow-overlay: 0 4px 12px rgb(0 0 0 / 0.45), 0 32px 80px rgb(0 0 0 / 0.6);
  --codex-radius-sm: 8px;
  --codex-radius: 12px;
  --codex-radius-lg: 16px;
  --codex-radius-xl: 20px;
  --codex-radius-pill: 999px;
  --codex-blur-glass: 16px;
  --codex-grain-opacity: 0.03;
  --codex-dur-fast: 150ms;
  --codex-dur-base: 220ms;
  --codex-dur-slow: 300ms;
  --codex-dur-moment: 600ms;
  --codex-dur-epic: 1200ms;
  --codex-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --codex-ease-in: cubic-bezier(0.55, 0, 1, 0.45);
  --codex-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --codex-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --codex-font-display: 'Alegreya SC', 'Alegreya Variable', Georgia, serif;
  --codex-font-title: 'Alegreya Variable', 'Alegreya', Georgia, serif;
  --codex-font-body: 'Source Sans 3 Variable', 'Source Sans 3', system-ui, sans-serif;
}
```

### Branchement Tailwind CSS v4 (dans `src/styles/app.css`)

```css
@import 'tailwindcss';
@import './tokens.css';

@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));

@theme inline {
  --color-bg: var(--codex-bg);
  --color-surface: var(--codex-surface);
  --color-surface-2: var(--codex-surface-2);
  --color-surface-raised: var(--codex-surface-raised);
  --color-surface-sunken: var(--codex-surface-sunken);
  --color-surface-glass: var(--codex-surface-glass);
  --color-ink: var(--codex-ink);
  --color-ink-muted: var(--codex-ink-muted);
  --color-ink-faint: var(--codex-ink-faint);
  --color-line: var(--codex-line);
  --color-line-strong: var(--codex-line-strong);
  --color-accent: var(--codex-accent);
  --color-accent-hover: var(--codex-accent-hover);
  --color-accent-active: var(--codex-accent-active);
  --color-accent-soft: var(--codex-accent-soft);
  --color-accent-text: var(--codex-accent-text);
  --color-on-accent: var(--codex-on-accent);
  --color-focus: var(--codex-focus);
  --color-gold: var(--codex-gold);
  --color-gold-soft: var(--codex-gold-soft);
  --color-gold-text: var(--codex-gold-text);
  --color-gold-line: var(--codex-gold-line);
  --color-on-gold: var(--codex-on-gold);
  --color-hp: var(--codex-hp);
  --color-hp-text: var(--codex-hp-text);
  --color-hp-soft: var(--codex-hp-soft);
  --color-hp-temp: var(--codex-hp-temp);
  --color-danger: var(--codex-danger);
  --color-danger-hover: var(--codex-danger-hover);
  --color-heal: var(--codex-heal);
  --color-heal-text: var(--codex-heal-text);
  --color-heal-soft: var(--codex-heal-soft);
  --color-warning: var(--codex-warning);
  --color-warning-text: var(--codex-warning-text);
  --color-warning-soft: var(--codex-warning-soft);
  --color-info: var(--codex-info);
  --color-info-text: var(--codex-info-text);
  --color-info-soft: var(--codex-info-soft);
  /* Répéter le motif pour les 7 caractéristiques (strength, constitution, dexterity,
     intelligence, charisma, wisdom, luck) : --color-stat-X, --color-stat-X-text, --color-stat-X-soft.
     Idem pour les 5 raretés : --color-rarity-X, --color-rarity-X-text, --color-rarity-X-soft. */
  --radius-sm: var(--codex-radius-sm);
  --radius-md: var(--codex-radius);
  --radius-lg: var(--codex-radius-lg);
  --radius-xl: var(--codex-radius-xl);
  --shadow-soft: var(--codex-shadow-soft);
  --shadow-lifted: var(--codex-shadow-lifted);
  --shadow-overlay: var(--codex-shadow-overlay);
  --font-display: var(--codex-font-display);
  --font-title: var(--codex-font-title);
  --font-sans: var(--codex-font-body);
  --ease-out: var(--codex-ease-out);
  --ease-in: var(--codex-ease-in);
  --ease-in-out: var(--codex-ease-in-out);
}
```

Le mode **En jeu** pose `data-theme="dark"` sur le conteneur racine de l'écran En jeu (et non sur `<html>`) quand le réglage « En jeu, toujours en sombre » est actif (activé par défaut). La **Vue joueurs** pose toujours `data-theme="dark"`.

---

## 3. Contrastes

Ratios WCAG 2.1 calculés sur les valeurs exactes de la section 2. Seuils : 4,5:1 pour le texte courant, 3:1 pour les éléments d'interface (bordures de contrôles, anneau de focus, barres, liserés). Les surfaces en verre sont calculées composées sur `--codex-bg`. **Toutes les paires passent dans les deux thèmes.**

| Paire                                                                                                    | Type      | Seuil | Clair   | Sombre  |
| -------------------------------------------------------------------------------------------------------- | --------- | ----- | ------- | ------- |
| Texte principal sur fond (`--codex-ink` / `--codex-bg`)                                                  | Texte     | 4,5:1 | 14,93:1 | 15,73:1 |
| Texte principal sur surface (`--codex-ink` / `--codex-surface`)                                          | Texte     | 4,5:1 | 16,41:1 | 14,58:1 |
| Texte principal sur surface-2 (`--codex-ink` / `--codex-surface-2`)                                      | Texte     | 4,5:1 | 13,79:1 | 13,26:1 |
| Texte principal sur verre (sur plateau) (`--codex-ink` / verre composé sur `--codex-bg`)                 | Texte     | 4,5:1 | 16,16:1 | 14,76:1 |
| Texte secondaire sur fond (`--codex-ink-muted` / `--codex-bg`)                                           | Texte     | 4,5:1 | 5,62:1  | 7,85:1  |
| Texte secondaire sur surface (`--codex-ink-muted` / `--codex-surface`)                                   | Texte     | 4,5:1 | 6,18:1  | 7,28:1  |
| Texte secondaire sur surface-2 (`--codex-ink-muted` / `--codex-surface-2`)                               | Texte     | 4,5:1 | 5,19:1  | 6,62:1  |
| Texte secondaire sur surface-sunken (`--codex-ink-muted` / `--codex-surface-sunken`)                     | Texte     | 4,5:1 | 4,91:1  | 7,64:1  |
| Texte secondaire sur surface-raised (`--codex-ink-muted` / `--codex-surface-raised`)                     | Texte     | 4,5:1 | 6,28:1  | 6,90:1  |
| Texte secondaire sur verre (`--codex-ink-muted` / verre composé sur `--codex-bg`)                        | Texte     | 4,5:1 | 6,08:1  | 7,37:1  |
| Texte sur bouton primaire (`--codex-on-accent` / `--codex-accent`)                                       | Texte     | 4,5:1 | 5,18:1  | 4,67:1  |
| Texte sur bouton primaire survolé (`--codex-on-accent` / `--codex-accent-hover`)                         | Texte     | 4,5:1 | 6,57:1  | 5,62:1  |
| Texte sur bouton primaire appuyé (`--codex-on-accent` / `--codex-accent-active`)                         | Texte     | 4,5:1 | 8,07:1  | 6,81:1  |
| Texte sur bouton danger (`--codex-on-accent` / `--codex-danger`)                                         | Texte     | 4,5:1 | 5,18:1  | 5,18:1  |
| Lien / bouton fantôme sur surface (`--codex-accent-text` / `--codex-surface`)                            | Texte     | 4,5:1 | 7,00:1  | 8,04:1  |
| Texte sélectionné sur accent-soft (`--codex-accent-text` / `--codex-accent-soft`)                        | Texte     | 4,5:1 | 5,93:1  | 6,71:1  |
| Texte doré sur surface (`--codex-gold-text` / `--codex-surface`)                                         | Texte     | 4,5:1 | 5,68:1  | 10,36:1 |
| Texte doré sur gold-soft (`--codex-gold-text` / `--codex-gold-soft`)                                     | Texte     | 4,5:1 | 4,92:1  | 8,05:1  |
| Texte sur remplissage or (`--codex-on-gold` / `--codex-gold`)                                            | Texte     | 4,5:1 | 7,25:1  | 8,03:1  |
| Dégâts sur surface (`--codex-hp-text` / `--codex-surface`)                                               | Texte     | 4,5:1 | 6,40:1  | 7,28:1  |
| Dégâts sur hp-soft (`--codex-hp-text` / `--codex-hp-soft`)                                               | Texte     | 4,5:1 | 5,67:1  | 5,95:1  |
| Soin sur surface (`--codex-heal-text` / `--codex-surface`)                                               | Texte     | 4,5:1 | 5,86:1  | 9,92:1  |
| Soin sur heal-soft (`--codex-heal-text` / `--codex-heal-soft`)                                           | Texte     | 4,5:1 | 5,25:1  | 7,58:1  |
| Alerte sur surface (`--codex-warning-text` / `--codex-surface`)                                          | Texte     | 4,5:1 | 5,82:1  | 10,26:1 |
| Alerte sur warning-soft (`--codex-warning-text` / `--codex-warning-soft`)                                | Texte     | 4,5:1 | 5,22:1  | 7,58:1  |
| Info sur info-soft (`--codex-info-text` / `--codex-info-soft`)                                           | Texte     | 4,5:1 | 5,16:1  | 7,16:1  |
| Sigle Force sur sa pastille (`--codex-stat-strength-text` / `--codex-stat-strength-soft`)                | Texte     | 4,5:1 | 5,30:1  | 5,26:1  |
| Sigle Force sur surface-2 (`--codex-stat-strength-text` / `--codex-surface-2`)                           | Texte     | 4,5:1 | 5,28:1  | 6,23:1  |
| Sigle Constitution sur sa pastille (`--codex-stat-constitution-text` / `--codex-stat-constitution-soft`) | Texte     | 4,5:1 | 5,07:1  | 6,12:1  |
| Sigle Constitution sur surface-2 (`--codex-stat-constitution-text` / `--codex-surface-2`)                | Texte     | 4,5:1 | 4,89:1  | 7,88:1  |
| Sigle Dextérité sur sa pastille (`--codex-stat-dexterity-text` / `--codex-stat-dexterity-soft`)          | Texte     | 4,5:1 | 4,98:1  | 6,73:1  |
| Sigle Dextérité sur surface-2 (`--codex-stat-dexterity-text` / `--codex-surface-2`)                      | Texte     | 4,5:1 | 4,82:1  | 8,75:1  |
| Sigle Intelligence sur sa pastille (`--codex-stat-intelligence-text` / `--codex-stat-intelligence-soft`) | Texte     | 4,5:1 | 4,90:1  | 6,04:1  |
| Sigle Intelligence sur surface-2 (`--codex-stat-intelligence-text` / `--codex-surface-2`)                | Texte     | 4,5:1 | 4,80:1  | 7,40:1  |
| Sigle Charisme sur sa pastille (`--codex-stat-charisma-text` / `--codex-stat-charisma-soft`)             | Texte     | 4,5:1 | 4,66:1  | 6,03:1  |
| Sigle Charisme sur surface-2 (`--codex-stat-charisma-text` / `--codex-surface-2`)                        | Texte     | 4,5:1 | 4,56:1  | 7,60:1  |
| Sigle Sagesse sur sa pastille (`--codex-stat-wisdom-text` / `--codex-stat-wisdom-soft`)                  | Texte     | 4,5:1 | 5,07:1  | 5,83:1  |
| Sigle Sagesse sur surface-2 (`--codex-stat-wisdom-text` / `--codex-surface-2`)                           | Texte     | 4,5:1 | 4,95:1  | 7,18:1  |
| Sigle Chance sur sa pastille (`--codex-stat-luck-text` / `--codex-stat-luck-soft`)                       | Texte     | 4,5:1 | 4,96:1  | 6,76:1  |
| Sigle Chance sur surface-2 (`--codex-stat-luck-text` / `--codex-surface-2`)                              | Texte     | 4,5:1 | 4,77:1  | 9,42:1  |
| Libellé rareté commun sur surface (`--codex-rarity-common-text` / `--codex-surface`)                     | Texte     | 4,5:1 | 6,18:1  | 7,28:1  |
| Libellé rareté peu commun sur surface (`--codex-rarity-uncommon-text` / `--codex-surface`)               | Texte     | 4,5:1 | 5,61:1  | 9,92:1  |
| Libellé rareté rare sur surface (`--codex-rarity-rare-text` / `--codex-surface`)                         | Texte     | 4,5:1 | 5,71:1  | 8,13:1  |
| Libellé rareté très rare sur surface (`--codex-rarity-very-rare-text` / `--codex-surface`)               | Texte     | 4,5:1 | 5,89:1  | 7,89:1  |
| Libellé rareté légendaire sur surface (`--codex-rarity-legendary-text` / `--codex-surface`)              | Texte     | 4,5:1 | 5,68:1  | 10,36:1 |
| Bordure de champ sur surface (`--codex-line-strong` / `--codex-surface`)                                 | Interface | 3,0:1 | 3,82:1  | 3,86:1  |
| Bordure de champ sur fond (`--codex-line-strong` / `--codex-bg`)                                         | Interface | 3,0:1 | 3,48:1  | 4,17:1  |
| Bordure de champ sur surface-2 (`--codex-line-strong` / `--codex-surface-2`)                             | Interface | 3,0:1 | 3,21:1  | 3,51:1  |
| Anneau de focus sur fond (`--codex-focus` / `--codex-bg`)                                                | Interface | 3,0:1 | 4,63:1  | 8,68:1  |
| Anneau de focus sur surface (`--codex-focus` / `--codex-surface`)                                        | Interface | 3,0:1 | 5,09:1  | 8,04:1  |
| Bouton primaire sur surface (`--codex-accent` / `--codex-surface`)                                       | Interface | 3,0:1 | 5,09:1  | 3,73:1  |
| Bouton primaire sur surface-2 (`--codex-accent` / `--codex-surface-2`)                                   | Interface | 3,0:1 | 4,28:1  | 3,39:1  |
| Barre PV (hp) sur surface (`--codex-hp` / `--codex-surface`)                                             | Interface | 3,0:1 | 3,76:1  | 4,96:1  |
| Barre PV (heal) sur surface (`--codex-heal` / `--codex-surface`)                                         | Interface | 3,0:1 | 3,50:1  | 7,07:1  |
| Barre PV (warning) sur surface (`--codex-warning` / `--codex-surface`)                                   | Interface | 3,0:1 | 3,53:1  | 8,07:1  |
| Cadre légendaire sur surface (`--codex-rarity-legendary` / `--codex-surface`)                            | Interface | 3,0:1 | 3,73:1  | 6,55:1  |
| Cadre commun sur surface (`--codex-rarity-common` / `--codex-surface`)                                   | Interface | 3,0:1 | 3,82:1  | 4,47:1  |
| Cadre peu commun sur surface (`--codex-rarity-uncommon` / `--codex-surface`)                             | Interface | 3,0:1 | 3,93:1  | 7,87:1  |
| Filet or (gold-line) sur surface (`--codex-gold-line` / `--codex-surface`)                               | Interface | 3,0:1 | 3,73:1  | 6,55:1  |
| Liseré Force sur surface (`--codex-stat-strength` / `--codex-surface`)                                   | Interface | 3,0:1 | 5,23:1  | 4,78:1  |
| Liseré Force sur fond (`--codex-stat-strength` / `--codex-bg`)                                           | Interface | 3,0:1 | 4,76:1  | 5,16:1  |
| Liseré Constitution sur surface (`--codex-stat-constitution` / `--codex-surface`)                        | Interface | 3,0:1 | 3,92:1  | 6,77:1  |
| Liseré Constitution sur fond (`--codex-stat-constitution` / `--codex-bg`)                                | Interface | 3,0:1 | 3,57:1  | 7,30:1  |
| Liseré Dextérité sur surface (`--codex-stat-dexterity` / `--codex-surface`)                              | Interface | 3,0:1 | 3,83:1  | 7,75:1  |
| Liseré Dextérité sur fond (`--codex-stat-dexterity` / `--codex-bg`)                                      | Interface | 3,0:1 | 3,49:1  | 8,37:1  |
| Liseré Intelligence sur surface (`--codex-stat-intelligence` / `--codex-surface`)                        | Interface | 3,0:1 | 4,62:1  | 5,81:1  |
| Liseré Intelligence sur fond (`--codex-stat-intelligence` / `--codex-bg`)                                | Interface | 3,0:1 | 4,20:1  | 6,27:1  |
| Liseré Charisme sur surface (`--codex-stat-charisma` / `--codex-surface`)                                | Interface | 3,0:1 | 4,30:1  | 6,38:1  |
| Liseré Charisme sur fond (`--codex-stat-charisma` / `--codex-bg`)                                        | Interface | 3,0:1 | 3,91:1  | 6,89:1  |
| Liseré Sagesse sur surface (`--codex-stat-wisdom` / `--codex-surface`)                                   | Interface | 3,0:1 | 4,64:1  | 5,69:1  |
| Liseré Sagesse sur fond (`--codex-stat-wisdom` / `--codex-bg`)                                           | Interface | 3,0:1 | 4,22:1  | 6,15:1  |
| Liseré Chance sur surface (`--codex-stat-luck` / `--codex-surface`)                                      | Interface | 3,0:1 | 3,88:1  | 9,19:1  |
| Liseré Chance sur fond (`--codex-stat-luck` / `--codex-bg`)                                              | Interface | 3,0:1 | 3,53:1  | 9,92:1  |

Paires spécifiques au plateau et aux jetons (valeurs de la section 9) :

| Paire                                                               | Seuil | Ratio   |
| ------------------------------------------------------------------- | ----- | ------- |
| Initiales blanches sur jeton joueur clair `#6D5BD0`                 | 4,5:1 | 5,18:1  |
| Initiales blanches sur jeton joueur sombre et Vue joueurs `#7562D8` | 4,5:1 | 4,67:1  |
| Initiales blanches sur jeton allié `#2B7D4C`                        | 4,5:1 | 5,07:1  |
| Initiales blanches sur jeton familier `#137570`                     | 4,5:1 | 5,52:1  |
| Initiales blanches sur jeton ennemi `#C43C3A`                       | 4,5:1 | 5,18:1  |
| Initiales blanches sur jeton PNJ `#B23D73`                          | 4,5:1 | 5,51:1  |
| Étiquette de nom sombre `#F2EADD` sur `#15110D`                     | 4,5:1 | 15,73:1 |
| Étiquette de nom claire `#FFFDF8` sur `#211C26`                     | 4,5:1 | 16,41:1 |
| Bulle de mesure `#2A1E08` sur `#E0AE4E`                             | 4,5:1 | 8,03:1  |
| Bulle de mesure claire `#2A1E08` sur `#D9A441`                      | 4,5:1 | 7,25:1  |
| Mur sombre `#E9DFCF` sur sol `#3A3128`                              | 3:1   | 9,65:1  |
| Mur clair `#211C26` sur sol `#E8DFCC`                               | 3:1   | 12,60:1 |
| Halo actif `#E0AE4E` sur sol sombre `#3A3128`                       | 3:1   | 6,26:1  |
| Sélection `#B4A6F4` sur sol sombre                                  | 3:1   | 5,88:1  |
| Sélection `#6D5BD0` sur sol clair `#E8DFCC`                         | 3:1   | 3,91:1  |
| Piège `#C23B3B` sur sol clair                                       | 3:1   | 3,98:1  |
| Piège `#E35D5D` sur sol sombre                                      | 3:1   | 3,63:1  |
| Bandeau Vue joueurs `#EBC274` sur `#15110D`                         | 4,5:1 | 11,18:1 |

Les anneaux de PV ne sont jamais posés directement sur le sol : ils sont toujours bordés à l'extérieur par le liseré du jeton (`#FFFDF8` en clair, `#15110D` en sombre). Ratios anneau / liseré : sain clair 3,50:1, blessé clair 3,53:1, critique clair 5,19:1 ; en sombre, tous supérieurs à 5:1. Les objets du plateau sont toujours posés sur une plaque (section 9), jamais directement sur le sol.

---

## 4. Typographie

### 4.1 Polices (100 % hors ligne, licence SIL OFL 1.1)

| Rôle                                                                                                          | Famille                  | Paquet Fontsource                    | Graisses à embarquer                       | Import                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Petites capitales calligraphiques : titres d'écran, surtitres, chiffres de caractéristiques, résultats de dés | Alegreya SC              | `@fontsource/alegreya-sc`            | 500, 700                                   | `import "@fontsource/alegreya-sc/500.css"; import "@fontsource/alegreya-sc/700.css";` |
| Titres de section et de carte, noms de personnages                                                            | Alegreya (variable)      | `@fontsource-variable/alegreya`      | axe `wght` (on utilise 500 et 600)         | `import "@fontsource-variable/alegreya";`                                             |
| Interface, texte courant, chiffres tabulaires                                                                 | Source Sans 3 (variable) | `@fontsource-variable/source-sans-3` | axe `wght` (on utilise 400, 500, 600, 700) | `import "@fontsource-variable/source-sans-3";`                                        |

Réglages globaux :

- `body { font-family: var(--codex-font-body); font-size: 15px; line-height: 1.6; font-feature-settings: "lnum" 1; -webkit-font-smoothing: antialiased; }`
- Tous les nombres de jeu (PV, XP, poids, monnaie, compteurs) : `font-variant-numeric: tabular-nums;`.
- Alegreya SC ne s'utilise jamais en dessous de 11 px ni pour plus d'une ligne de texte courant. Elle n'a que les graisses 500 et 700.
- Alegreya : jamais en dessous de 15 px ; ses chiffres elzéviriens sont neutralisés par `lnum` (nombres de jeu alignés).

### 4.2 Échelle

| Rôle                                  | Police                                                | Taille                                      | Interlignage | Graisse   | Approche   | Casse                                   | Couleur                                                                        |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------- | ------------ | --------- | ---------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Titre d'écran                         | Alegreya SC                                           | 32 px (40 px sur l'écran Campagnes)         | 1,15         | 500       | 0,02em     | naturelle (rendue en petites capitales) | `--codex-ink`                                                                  |
| Surtitre                              | Alegreya SC                                           | 12 px                                       | 16 px        | 600       | 0,18em     | capitales                               | `--codex-gold-text`                                                            |
| Titre de section                      | Alegreya                                              | 20 px                                       | 28 px        | 600       | 0          | phrase                                  | `--codex-ink`                                                                  |
| Titre de carte                        | Alegreya                                              | 16 px (22 px en tête de carte de campagne)  | 1,35         | 600       | 0          | phrase                                  | `--codex-ink`                                                                  |
| Nom de personnage (fiche)             | Alegreya                                              | 28 px                                       | 34 px        | 600       | 0          | phrase                                  | `--codex-ink`                                                                  |
| Corps                                 | Source Sans 3                                         | 15 px                                       | 24 px        | 400       | 0          | phrase                                  | `--codex-ink`                                                                  |
| Libellé, bouton                       | Source Sans 3                                         | 14 px (15 px pour boutons de 40 px et plus) | 20 px        | 600       | 0          | phrase                                  | selon composant                                                                |
| Petit                                 | Source Sans 3                                         | 13 px                                       | 20 px        | 400       | 0          | phrase                                  | `--codex-ink-muted`                                                            |
| Légende                               | Source Sans 3                                         | 12 px                                       | 16 px        | 500       | 0,01em     | phrase                                  | `--codex-ink-muted`                                                            |
| Sigle de caractéristique              | Source Sans 3                                         | 11 px (9 px dans la mini-fiche)             | 1            | 700       | 0,08em     | capitales                               | `--codex-stat-X-text`                                                          |
| Chiffre de caractéristique (fiche)    | Alegreya SC                                           | 44 px                                       | 1            | 700       | 0          | —                                       | `--codex-ink`                                                                  |
| Chiffre de caractéristique (pastille) | Alegreya SC                                           | 26 px                                       | 1            | 700       | 0          | —                                       | `--codex-ink`                                                                  |
| PV (fiche)                            | Source Sans 3                                         | 20 px, « / max » en 14 px 500               | 1,2          | 700       | 0          | —                                       | `--codex-ink`                                                                  |
| Résultat de dé                        | Alegreya SC                                           | 64 px                                       | 1            | 700       | 0          | —                                       | `--codex-gold-text` si critique, sinon `--codex-ink`                           |
| Dégâts flottants (canvas)             | Alegreya SC                                           | 28 px (40 px si critique)                   | 1            | 700       | 0          | —                                       | dégâts `#F28B82` / soin `#7BD6A1` / critique `#EBC274`, contour 3 px `#15110D` |
| Vue joueurs : nom de jeton            | Source Sans 3                                         | 24 px à 1920 × 1080                         | 1,2          | 600       | 0          | phrase                                  | `#F2EADD`                                                                      |
| Vue joueurs : bandeau de tour         | Source Sans 3 34 px + Alegreya SC 26 px (« ROUND 3 ») | à 1920 × 1080                               | 1,2          | 600 / 700 | 0 / 0,14em | phrase / capitales                      | `#F2EADD` / `#EBC274`                                                          |
| Vue joueurs : titre de pause          | Alegreya SC                                           | 86 px à 1920 × 1080                         | 1,1          | 600       | 0,04em     | —                                       | `#F2EADD`                                                                      |
| Vue joueurs : sous-titre de pause     | Alegreya                                              | 43 px à 1920 × 1080                         | 1,3          | 500       | 0          | phrase                                  | `#D9CFBE`                                                                      |

Les tailles de la Vue joueurs sont données pour 1920 × 1080 et s'échelonnent avec `font-size: calc(<taille> / 1080 * 100vh)`. Le réglage « Taille du texte » (100 %, 112 %, 125 %) multiplie `html { font-size }` (16 px de base) ; toutes les tailles d'interface ci-dessus sont donc écrites en `rem` dans le code (15 px = 0,9375rem). Il n'agit pas sur le plateau.

---

## 5. Espacement, rayons, bordures, ombres, verre dépoli

### 5.1 Espacement (grille de 4 px)

| Pas | Valeur | Usage                                                              |
| --- | ------ | ------------------------------------------------------------------ |
| 1   | 4 px   | écart icône / texte serré, padding de pastille vertical            |
| 2   | 8 px   | écart entre puces, entre boutons d'un groupe                       |
| 3   | 12 px  | padding interne des petites cartes, écart dans une liste           |
| 4   | 16 px  | padding des surfaces flottantes, marge des surfaces sur le plateau |
| 5   | 20 px  | écart entre cartes du tableau de bord                              |
| 6   | 24 px  | padding des cartes et des panneaux, écart entre colonnes           |
| 8   | 32 px  | padding horizontal de page                                         |
| 10  | 40 px  | padding de page Préparation                                        |
| 14  | 56 px  | marge haute de l'écran Campagnes                                   |

### 5.2 Rayons

| Token                 | Valeur | Usage                                                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `--codex-radius-sm`   | 8 px   | puces carrées, segments internes d'un contrôle segmenté, info-bulles, cases d'équipement de 52 px                    |
| `--codex-radius`      | 12 px  | boutons, champs, toasts, cases d'inventaire de 84 px, contrôles segmentés (conteneur : 10 px pour les boutons 40 px) |
| `--codex-radius-lg`   | 16 px  | cartes, panneaux, surfaces flottantes                                                                                |
| `--codex-radius-xl`   | 20 px  | boîtes de dialogue                                                                                                   |
| `--codex-radius-pill` | 999 px | pastilles d'état, puces de filtre, barres de progression, interrupteurs                                              |

Les boutons de 40 px de haut ont un rayon de 10 px ; ceux de 32–36 px, 8 px ; ceux de 44–48 px, 12 px.

### 5.3 Bordures

- Cartes et panneaux : 1 px `--codex-line`.
- Contrôles (champ, bouton secondaire, case à cocher, sélecteur) : 1 px `--codex-line-strong`.
- Focus : `box-shadow: 0 0 0 2px var(--codex-bg), 0 0 0 4px var(--codex-focus)` (anneau de 2 px avec 2 px d'écart). Champ en focus : bordure 2 px `--codex-focus` + `0 0 0 3px var(--codex-accent-soft)`.
- Erreur : bordure 2 px `--codex-hp`.
- Sélection de carte : bordure 2 px `--codex-accent` + `0 0 0 3px var(--codex-accent-soft)`.
- Élément doré (niveau, légendaire, « À ne pas oublier ») : 1 px `--codex-gold-line`.
- Liseré de caractéristique : `border-top: 3px solid var(--codex-stat-X)` sur les cartes de caractéristique.

### 5.4 Ombres

| Token                    | Clair                                                              | Sombre                                                        | Quand                                                                                |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--codex-shadow-soft`    | `0 1px 2px rgb(33 28 38 / 0.06), 0 4px 16px rgb(33 28 38 / 0.06)`  | `0 1px 2px rgb(0 0 0 / 0.30), 0 4px 16px rgb(0 0 0 / 0.30)`   | cartes au repos, segment actif d'un contrôle segmenté                                |
| `--codex-shadow-lifted`  | `0 2px 4px rgb(33 28 38 / 0.06), 0 12px 32px rgb(33 28 38 / 0.10)` | `0 2px 6px rgb(0 0 0 / 0.35), 0 16px 40px rgb(0 0 0 / 0.45)`  | carte survolée, surfaces flottantes sur le plateau, toasts, menus, panneau de détail |
| `--codex-shadow-overlay` | `0 4px 8px rgb(33 28 38 / 0.10), 0 24px 64px rgb(33 28 38 / 0.22)` | `0 4px 12px rgb(0 0 0 / 0.45), 0 32px 80px rgb(0 0 0 / 0.60)` | boîtes de dialogue, palette de commandes                                             |

Bouton primaire : `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 6px rgb(70 50 170 / 0.30)` (clair) et `inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 8px rgb(0 0 0 / 0.40)` (sombre).
Surfaces sombres : ajouter `inset 0 1px 0 rgb(242 234 221 / 0.04)` sur les cartes pour un léger reflet de chandelle sur l'arête haute.

### 5.5 Verre dépoli (uniquement sur le plateau et dans la Vue joueurs)

```css
.codex-glass {
  background: var(--codex-surface-glass);
  border: 1px solid var(--codex-glass-line);
  border-radius: var(--codex-radius-lg);
  box-shadow: var(--codex-shadow-lifted);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  backdrop-filter: blur(16px) saturate(1.1);
}
@supports not (backdrop-filter: blur(1px)) {
  .codex-glass {
    background: var(--codex-surface);
  }
}
```

Utilisé pour : colonne des groupes, panneau d'action rapide, mini-fiche, barre d'outils de carte, toasts En jeu, contrôle de zoom. Jamais ailleurs (en Préparation, les surfaces sont pleines). Le bandeau des tours utilise `--codex-bar` (opaque à 94 %) sans flou, pour rester net.

---

## 6. Ornements et textures

Quatre ornements, tous en trait fin, couleur `--codex-gold-line`, jamais remplis à plus de 20 %. Ils se dessinent en SVG inline avec `aria-hidden="true"` et `stroke="currentColor"` pour hériter de la couleur.

### 6.1 Filet à losange (séparateur)

```html
<svg
  class="codex-rule"
  width="160"
  height="16"
  viewBox="0 0 160 16"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
>
  <line x1="0" y1="8" x2="70" y2="8" stroke-width="1" />
  <path d="M80 2 L86 8 L80 14 L74 8 Z" stroke-width="1.25" />
  <circle cx="80" cy="8" r="1.6" fill="currentColor" stroke="none" />
  <line x1="90" y1="8" x2="160" y2="8" stroke-width="1" />
</svg>
```

- Où : sous le titre de l'écran Campagnes (160 × 16), sous le titre de pause de la Vue joueurs (360 × 24, traits 1,5), en pied de la fiche imprimée.
- Combien : un seul par écran.
- Jamais : entre deux cartes, dans une liste, dans le mode En jeu.

### 6.2 Coin enluminé

```html
<svg
  class="codex-corner"
  width="28"
  height="28"
  viewBox="0 0 28 28"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1"
>
  <path d="M2 26V8a6 6 0 0 1 6-6h18" />
  <path d="M6 26V12a6 6 0 0 1 6-6h14" opacity="0.5" />
  <circle cx="2" cy="2" r="1.5" fill="currentColor" stroke="none" />
</svg>
```

- Où : coins supérieurs gauche et droit (miroir `transform: scaleX(-1)`) de la carte d'identité de la fiche, à 10 px des bords ; coins de la carte de montée de niveau ; coins des cases légendaires de plus de 84 px.
- Combien : deux par élément, jamais quatre.
- Jamais : sur les boutons, les champs, les surfaces flottantes du plateau.

### 6.3 Fleuron « chandelle » (emblème)

```html
<svg
  class="codex-candle"
  width="24"
  height="36"
  viewBox="0 0 24 36"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path
    d="M12 2c2 3.5 4 5.5 4 9a4 4 0 0 1-8 0c0-3.5 2-5.5 4-9z"
    fill="currentColor"
    fill-opacity="0.18"
  />
  <path
    d="M12 9c.8 1.5 1.5 2.5 1.5 3.8a1.5 1.5 0 0 1-3 0c0-1.3.7-2.3 1.5-3.8z"
    fill="currentColor"
  />
  <path d="M9 17h6v15H9zM6 34h12" />
</svg>
```

- Où : écran de pause (64 × 96), encadré « À ne pas oublier » du tableau de bord (22 × 22, version simplifiée sans base), écran d'accueil sans campagne.
- Jamais : comme icône d'action.

### 6.4 Monogramme Codex

```html
<svg
  class="codex-mark"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  aria-hidden="true"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
>
  <path d="M5 3h11l3 3v15H5z" />
  <path d="M12 8l2 3-2 3-2-3z" />
  <path d="M8 18h8" />
</svg>
```

Suivi du mot « CODEX » en Alegreya SC 700, 18–20 px, approche 0,12em. Couleur du monogramme : `--codex-gold-line` ; mot : `--codex-ink`.

### 6.5 Grain de papier

- Uniquement sur `body` en Préparation (jamais sur le plateau, le verre, les boîtes de dialogue ni la Vue joueurs).
- Implémentation : pseudo-élément fixe, `pointer-events: none`, `opacity: var(--codex-grain-opacity)`, `mix-blend-mode: multiply` (clair) / `screen` (sombre), image : SVG inline encodé en data URI dans le CSS :

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: var(--codex-grain-opacity);
  mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.13 0 0 0 0 0.11 0 0 0 0 0.15 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
[data-theme='dark'] body::before,
body[data-theme='dark']::before {
  mix-blend-mode: screen;
}
```

- Désactivable dans Réglages › Apparence › Grain de papier (activé par défaut).

---

## 7. Mouvement

### 7.1 Durées et courbes

| Token                 | Valeur                              | Usage                                              |
| --------------------- | ----------------------------------- | -------------------------------------------------- |
| `--codex-dur-fast`    | 150 ms                              | survol, changement de couleur, focus, case cochée  |
| `--codex-dur-base`    | 220 ms                              | menu, onglet, info-bulle, toast, contrôle segmenté |
| `--codex-dur-slow`    | 300 ms                              | tiroir, boîte de dialogue, changement de page      |
| `--codex-dur-moment`  | 600 ms                              | barre de PV, révélation, dégâts flottants          |
| `--codex-dur-epic`    | 1 200 ms                            | dés, réussite critique, montée de niveau           |
| `--codex-ease-out`    | `cubic-bezier(0.22, 1, 0.36, 1)`    | toutes les entrées (courbe par défaut)             |
| `--codex-ease-in`     | `cubic-bezier(0.55, 0, 1, 0.45)`    | sorties                                            |
| `--codex-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`    | caméra, barres, traînée fantôme                    |
| `--codex-ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | rebond des dés et des chiffres                     |

Framer Motion, ressort des dés : `{ type: "spring", stiffness: 420, damping: 28, mass: 0.9 }`.

### 7.2 Trois niveaux

Le réglage « Animations » vaut `full`, `reduced` ou `off`. Il est initialisé à `reduced` quand `prefers-reduced-motion: reduce` est vrai, sinon à `full`. Il est exposé en `data-motion` sur `<html>`.

- `full` : chorégraphies ci-dessous.
- `reduced` : aucun déplacement, rotation, échelle ou particule ; uniquement des fondus d'opacité de 150 ms ; les durées « moment » et « épique » tombent à 200 ms.
- `off` : aucune transition (`transition: none`, `animation: none`) ; les résultats s'affichent immédiatement.

```css
[data-motion='reduced'] * {
  animation-duration: 150ms !important;
  animation-iteration-count: 1 !important;
  scroll-behavior: auto !important;
}
[data-motion='off'] *,
[data-motion='off'] *::before,
[data-motion='off'] *::after {
  transition: none !important;
  animation: none !important;
}
```

### 7.3 Chorégraphies

| Moment                                                             | Mode complet                                                                                                                                                                                                                                                                                                                                                                                                                                        | Mode réduit                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Survol de carte**                                                | `translateY(-2px)` + passage de `shadow-soft` à `shadow-lifted`, 150 ms, `ease-out`.                                                                                                                                                                                                                                                                                                                                                                | Ombre seule, 150 ms.                                                     |
| **Bouton primaire au repos sur l'écran En jeu (« Tour suivant »)** | Pulsation de lueur toutes les 2 400 ms quand le MJ n'a rien fait depuis 20 s : `box-shadow` 0 → `0 0 0 6px var(--codex-accent-soft)` → 0, 1 200 ms, `ease-in-out`.                                                                                                                                                                                                                                                                                  | Aucune pulsation.                                                        |
| **Lancer de dés**                                                  | 0 ms : les dés (SVG du polyèdre, 120–188 px) entrent depuis 40 px sous leur position, rotation −180° → 0°, échelle 0,6 → 1, 520 ms, ressort ci-dessus. 0–520 ms : la face affiche des chiffres aléatoires changés toutes les 60 ms. 520 ms : le vrai chiffre se fixe, rebond d'échelle 1 → 1,08 → 1, 180 ms, `ease-bounce`. 700 ms : libellé et détail du jet en fondu + `translateY(6px → 0)`, 220 ms. Total 920 ms.                               | Fondu du résultat final, 150 ms.                                         |
| **Réussite critique**                                              | Suite du lancer : 700 ms, halo `--codex-gold-glow` derrière le dé, échelle 0,6 → 1,2 → 1, 600 ms. 12 étincelles (losanges à 4 branches de 7–16 px, `--codex-gold`) jaillissent du centre sur des angles répartis à 30°, distance 120–220 px, rotation 0 → 90°, opacité 1 → 0, 900 ms, `ease-out`, départs décalés de 20 ms. Surtitre « RÉUSSITE CRITIQUE » en fondu + approche 0,4em → 0,22em, 400 ms. Total 1 600 ms. Son facultatif « carillon ». | Surtitre et dé dorés immédiatement, halo en fondu 200 ms.                |
| **Échec critique**                                                 | Tremblement du dé : `translateX` 0 → −6 → 6 → −4 → 4 → −2 → 0 px, 420 ms, linéaire ; teinte : la face passe à `--codex-hp-soft`, le chiffre à `--codex-hp-text`, 220 ms ; voile `rgb(227 93 93 / 0.10)` sur la scène, 0 → 1 → 0, 600 ms. Pas de tremblement de l'écran entier.                                                                                                                                                                      | Teinte rouge immédiate, aucun tremblement.                               |
| **Montée de niveau**                                               | Carte centrale (boîte de dialogue 480 px) : entrée en échelle 0,92 → 1 + fondu, 300 ms. Anneau doré autour du médaillon : `stroke-dashoffset` 100 % → 0, 900 ms, `ease-in-out`. Chiffre du niveau qui monte de l'ancien au nouveau (défilement vertical 24 px), 400 ms, démarre à 600 ms. 8 étincelles comme le critique, 700 ms. Coins enluminés tracés (`stroke-dashoffset`), 600 ms. Total 1 400 ms.                                             | Fondu de la carte, chiffre final affiché.                                |
| **Dégâts flottants (canvas)**                                      | Texte « −8 » au-dessus du jeton : départ à 0,6 case au-dessus du centre, monte de 32 px, échelle 0,8 → 1,15 (120 ms) → 1, opacité 1 jusqu'à 700 ms puis → 0 à 1 000 ms. Soin : même trajet en vert. Critique : taille 40 px et couleur `#EBC274`. Plusieurs nombres simultanés : décalage horizontal de ±14 px. Jeton touché : flash d'un cercle `rgb(227 93 93 / 0.45)` 0 → 1 → 0, 240 ms, et tremblement du jeton ±3 px, 200 ms.                  | Nombre affiché 800 ms sans déplacement, fondu 150 ms. Aucun tremblement. |
| **Barre de PV**                                                    | Dégâts : le remplissage rejoint la nouvelle valeur en 220 ms (`ease-out`) ; la traînée fantôme (`--codex-warning-soft`) reste 400 ms puis rejoint en 600 ms (`ease-in-out`). Soin : le remplissage monte en 600 ms (`ease-out`), pas de traînée, lueur `0 0 8px var(--codex-heal)` 0 → 1 → 0. Changement de seuil (sain → blessé → critique) : couleur en fondu 300 ms. À terre : barre vide + tremblement de la carte ±3 px, 200 ms.               | Valeur directe, couleur en fondu 150 ms, aucune traînée.                 |
| **Révélation (objet identifié, piège repéré, lore)**               | Retournement : `rotateY` 0 → 90° (180 ms, `ease-in`), changement de contenu, 90° → 0 (220 ms, `ease-out`), `perspective: 800px`. Sur le plateau, élément révélé : opacité 0 → 1 + anneau `--codex-gold` de 1 à 1,6 fois sa taille, opacité 1 → 0, 600 ms. Brouillard levé par le pinceau : bord adouci, fondu 300 ms.                                                                                                                               | Fondu croisé 150 ms.                                                     |
| **Apparition d'une liste**                                         | Chaque élément : opacité 0 → 1, `translateY(8px → 0)`, 220 ms, `ease-out`, décalage de 30 ms par élément, plafonné à 8 éléments (les suivants apparaissent avec le 8e).                                                                                                                                                                                                                                                                             | Fondu global 150 ms.                                                     |
| **Changement de page**                                             | Sortante : opacité 1 → 0, 120 ms, `ease-in`. Entrante : opacité 0 → 1 + `translateY(12px → 0)`, 300 ms, `ease-out`, démarre à 80 ms. Bascule Préparation → En jeu : fondu au brun `#15110D` 200 ms puis apparition de l'écran En jeu 300 ms.                                                                                                                                                                                                        | Fondu croisé 150 ms.                                                     |
| **Tiroir (fiche épinglée)**                                        | Glisse depuis la droite : `translateX(100% → 0)`, 300 ms, `ease-out` ; sortie 220 ms, `ease-in`.                                                                                                                                                                                                                                                                                                                                                    | Fondu 150 ms.                                                            |
| **Boîte de dialogue**                                              | Voile 0 → 1, 220 ms ; boîte : échelle 0,96 → 1 + opacité, 300 ms, `ease-out`.                                                                                                                                                                                                                                                                                                                                                                       | Fondu 150 ms.                                                            |
| **Toast**                                                          | Entrée : `translateY(16px → 0)` + opacité, 220 ms ; reste 5 000 ms (8 000 ms s'il contient « Annuler ») ; sortie : opacité, 180 ms.                                                                                                                                                                                                                                                                                                                 | Fondu 150 ms.                                                            |
| **Tour suivant**                                                   | Le portrait actif du bandeau glisse vers le suivant : halo doré qui se déplace (`layoutId` Framer), 300 ms, `ease-in-out` ; caméra du plateau vers le jeton actif, 500 ms, `ease-in-out`, uniquement si le jeton est hors de la zone centrale à 60 %. Halo du jeton actif : pulsation d'opacité 0,55 → 1 → 0,55, 1 600 ms, en boucle.                                                                                                               | Halo statique, caméra en coupe franche.                                  |
| **Ping**                                                           | 3 anneaux concentriques (diamètre de 0,4 à 1,6 case), opacité 1 → 0, 1 200 ms, décalés de 200 ms, joués 2 fois.                                                                                                                                                                                                                                                                                                                                     | Un anneau fixe 1 200 ms.                                                 |

---

## 8. Composants

Conventions : hauteur des cibles tactiles ≥ 44 px en mode En jeu et sur tablette ; en Préparation sur ordinateur, les boutons standards font 40 px. Tous les composants interactifs sont des primitives Radix (Dialog, DropdownMenu, Tabs, Toggle Group, Checkbox, Switch, Tooltip, Toast, Popover, Select) stylées avec les tokens. États communs :

- **Focus** : anneau défini en 5.3, sur tous les éléments focalisables, uniquement en `:focus-visible`.
- **Désactivé** : `opacity: 0.55`, `cursor: not-allowed`, aucune ombre, texte `--codex-ink-faint` quand le composant a un fond propre.
- **Chargement** : le libellé est conservé, une icône de 16 px qui tourne (cercle 3/4, trait 2 px, `currentColor`, rotation 800 ms linéaire) remplace l'icône de gauche ; `aria-busy="true"` ; la largeur ne change pas.

### 8.1 Boutons

| Variante                                                  | Fond                             | Texte / icône         | Bordure                                                 | Survol                                         | Actif (appui)                                         | Sélectionné                                                                       |
| --------------------------------------------------------- | -------------------------------- | --------------------- | ------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Primaire                                                  | `--codex-accent`                 | `--codex-on-accent`   | aucune                                                  | `--codex-accent-hover`                         | `--codex-accent-active`, `translateY(1px)`            | —                                                                                 |
| Secondaire                                                | `--codex-surface`                | `--codex-ink`         | 1 px `--codex-line-strong`                              | fond `--codex-surface-2`                       | fond `--codex-surface-2`, bordure `--codex-ink-muted` | fond `--codex-accent-soft`, bordure `--codex-accent`, texte `--codex-accent-text` |
| Fantôme                                                   | transparent                      | `--codex-accent-text` | aucune                                                  | fond `--codex-accent-soft`                     | fond `--codex-accent-soft`, `translateY(1px)`         | fond `--codex-accent-soft`                                                        |
| Danger                                                    | `--codex-danger`                 | `--codex-on-accent`   | aucune                                                  | `--codex-danger-hover`                         | `--codex-danger-hover`, `translateY(1px)`             | —                                                                                 |
| Doré (rare : « Monter de niveau », « Relancer · Chance ») | `--codex-gold-soft`              | `--codex-gold-text`   | 1 px `--codex-gold-line`                                | `box-shadow: 0 0 0 3px var(--codex-gold-glow)` | `translateY(1px)`                                     | —                                                                                 |
| Icône                                                     | `--codex-surface` ou transparent | `--codex-ink`         | 1 px `--codex-line-strong` (version encadrée) ou aucune | fond `--codex-surface-2`                       | fond `--codex-surface-2`                              | fond `--codex-accent-soft`, icône `--codex-accent-text`                           |

Tailles : S 32 px (padding 0 10 px, texte 13 px, icône 16 px, rayon 8), M 40 px (0 18 px, 15 px, icône 18 px, rayon 10), L 44 px (0 20 px, 15 px, icône 18 px, rayon 12), XL 48 px (0 24 px, 16 px, rayon 12). Bouton icône : carré de la hauteur, icône 20 px, `aria-label` obligatoire. Écart icône / texte : 8 px. Raccourci clavier affiché dans le bouton : pastille 11 px 600, padding 1 × 6 px, rayon 5 px, fond `rgb(255 255 255 / 0.18)` sur primaire, `--codex-surface-2` ailleurs. Erreur : non applicable (les boutons n'ont pas d'état d'erreur).

### 8.2 Champ texte

Anatomie : libellé (13 px 600, `--codex-ink`, 6 px au-dessus) · champ · aide ou erreur (13 px 500, 6 px dessous).
Champ : hauteur 40 px (44 px En jeu, 48 px pour la saisie rapide des PV en 20 px 700), padding 0 12 px, rayon 10 px, fond `--codex-surface`, texte 15 px 400 `--codex-ink`, indication (placeholder) `--codex-ink-muted`, bordure 1 px `--codex-line-strong`.
États : survol bordure `--codex-ink-muted` ; focus bordure 2 px `--codex-focus` + `0 0 0 3px var(--codex-accent-soft)` ; erreur bordure 2 px `--codex-hp` + message `--codex-hp-text` précédé d'une icône « cercle-alerte » 14 px ; désactivé fond `--codex-surface-2`, texte `--codex-ink-faint` ; chargement : icône de chargement 16 px à droite ; sélectionné : non applicable. Exemple d'erreur : « Indique d'où vient ton personnage pour terminer la fiche. »

### 8.3 Champ nombre

Comme le champ texte, plus : texte aligné à gauche en chiffres tabulaires, deux boutons « − » et « + » de 32 × 32 px (fantômes, icône 16 px) à droite à l'intérieur du champ, séparés par 1 px `--codex-line`. Molette et flèches haut/bas : ±1, Maj : ±5. Saisie tolérante : « −7 », « +5 », « t+4 » acceptés dans le champ de PV ; tout autre texte → état erreur « Tape un nombre, par exemple −7 ou +5. »

### 8.4 Liste déroulante (Radix Select)

Déclencheur identique au champ texte, chevron 16 px `--codex-ink-muted` à 12 px du bord droit. Menu : `--codex-surface-raised`, bordure 1 px `--codex-line`, rayon 12 px, `shadow-lifted`, padding 4 px, largeur = déclencheur (minimum 180 px), hauteur max 320 px avec défilement. Option : 36 px, padding 0 10 px, rayon 8 px, 14 px ; survol / surligné clavier : fond `--codex-surface-2` ; sélectionnée : coche 16 px `--codex-accent-text` à droite et texte 600 ; désactivée : `--codex-ink-faint`. Ouverture : opacité + `translateY(-4px → 0)`, 150 ms.

### 8.5 Case à cocher et interrupteur

Case : 18 × 18 px, rayon 5 px, bordure 1,5 px `--codex-line-strong`, fond `--codex-surface`. Cochée : fond `--codex-accent`, coche blanche trait 2,5 px, animation de tracé 150 ms. Indéterminée : barre 10 × 2 px blanche. Libellé à 8–10 px, 14 px. Survol : bordure `--codex-ink-muted`. Erreur : bordure `--codex-hp`. Zone cliquable : toute la ligne, 44 px de haut en mode En jeu.
Interrupteur (Radix Switch) : 48 × 28 px, rayon 999 px. Éteint : fond `--codex-surface-2`, bordure 1 px `--codex-line-strong`, pastille 20 px `--codex-line-strong` à 3 px à gauche. Allumé : fond `--codex-accent`, pastille 22 px blanche à 3 px à droite, glissement 150 ms.

### 8.6 Contrôle segmenté (Radix Toggle Group, sélection unique)

Conteneur : fond `--codex-surface-2`, bordure 1 px `--codex-line`, rayon 10–12 px, padding 3 px. Segment : hauteur 32–34 px (44 px En jeu), padding 0 12–14 px, rayon 8–9 px, texte 13–14 px 500 `--codex-ink-muted`. Segment sélectionné : fond `--codex-surface`, texte 600 `--codex-ink`, `shadow-soft`, glissement de la pastille 220 ms (`layoutId`). Survol d'un segment non sélectionné : texte `--codex-ink`. Exemples : « Désavantage · Normal · Avantage », « Préparation · En jeu », « Carrée · Hexagonale ».

### 8.7 Onglets (Radix Tabs)

Liste : ligne 1 px `--codex-line` sous les onglets, écart 24–28 px entre onglets. Onglet : padding 12 px 0, texte 15 px 500 `--codex-ink-muted`. Survol : texte `--codex-ink`. Sélectionné : texte 600 `--codex-ink` + soulignement 2 px `--codex-accent` qui glisse d'un onglet à l'autre en 220 ms. Désactivé : `--codex-ink-faint`. Ordre des onglets de la fiche : Identité, Statistiques, Compétences, État, Inventaire, Journal.

### 8.8 Boîte de dialogue (Radix Dialog)

Voile `--codex-scrim`. Boîte : `--codex-surface-raised`, bordure 1 px `--codex-line`, rayon 20 px, `shadow-overlay`, largeur 480 px (petite), 720 px (moyenne) ou 1040 px (lanceur de dés), `max-width: calc(100% - 32px)`. En-tête : padding 24 px, titre Alegreya SC 18 px 600 approche 0,06em, bouton fermer icône 36 px en haut à droite. Corps : padding 0 24 px. Pied : padding 16 24 24 px, boutons alignés à droite, écart 10 px, action principale à droite. En mode En jeu, seules la confirmation de suppression et le lanceur de dés utilisent une boîte de dialogue.

### 8.9 Tiroir

Fiche épinglée qui glisse depuis la droite par-dessus le plateau : largeur 420 px (ordinateur), 100 % (tablette portrait), hauteur pleine sous le bandeau des tours, fond `--codex-surface` (opaque, pas de verre : la lecture prime), bordure gauche 1 px `--codex-line`, `shadow-overlay`. En-tête 56 px : médaillon 32 px, nom Alegreya 16 px, boutons « Épingler », « Ouvrir en grand », « Fermer ». Jusqu'à 3 tiroirs épinglés côte à côte (le plus récent à droite) ; au-delà, le plus ancien se ferme.

### 8.10 Menu (Radix DropdownMenu et menu radial)

Menu déroulant : comme la liste de 8.4, éléments de 36 px avec icône 16 px à gauche et raccourci (12 px `--codex-ink-muted`) à droite, séparateur 1 px `--codex-line` avec 4 px de marge, élément danger en `--codex-hp-text`.
Menu radial (clic droit sur un jeton) : 6 segments sur un anneau de 168 px de diamètre extérieur, 64 px de diamètre intérieur, fond `--codex-surface-glass` + flou 16 px, bordure `--codex-glass-line`. Chaque segment : icône 20 px + libellé 11 px 600 dessous ; survol : fond `--codex-accent-soft`, icône `--codex-accent-text`. Ordre horaire depuis le haut : Dégâts, Soin, État, Test, Compétence, Fiche ; au centre : fermer. Entrée : échelle 0,85 → 1 + opacité, 150 ms.

### 8.11 Toast (Radix Toast)

Position : en bas à gauche de la zone centrale (En jeu), en bas à droite (Préparation), à 20 px des bords ; 3 visibles au maximum, empilés avec 8 px d'écart. Anatomie : point de 8 px (couleur sémantique : `--codex-hp`, `--codex-heal`, `--codex-warning`, `--codex-info`, `--codex-gold`) · message 14 px (nom en 600) · action fantôme « Annuler » (32 px). Fond `--codex-surface-glass` + flou (En jeu) ou `--codex-surface-raised` (Préparation), bordure 1 px `--codex-glass-line` / `--codex-line`, rayon 12 px, `shadow-lifted`, padding 10 10 10 14 px, largeur 320–420 px. Exemple : « **Goule affamée** perd 8 PV · Critique » [Annuler]. Rôle `status`, jamais d'interruption du focus.

### 8.12 Info-bulle (Radix Tooltip)

Fond `--codex-ink`, texte `--codex-bg` 12 px 500, padding 6 × 8 px, rayon 8 px, flèche 8 × 4 px, délai 400 ms (0 ms si une autre info-bulle était ouverte il y a moins de 300 ms), apparition opacité 150 ms. Largeur max 260 px. Contenu riche (état avec durée et effet) : 2 lignes max, la seconde en `opacity: 0.8`.

### 8.13 État vide

Conteneur centré, largeur max 520 px, colonne avec écart 18 px : illustration 280 × 200 px (section 11) · surtitre Alegreya SC 12 px `--codex-gold-text` · titre Alegreya 30 px 600 · texte 16 px / 1,6 `--codex-ink-muted` (2 phrases maximum, la seconde donne un raccourci ou une astuce) · deux boutons M ou L : secondaire puis primaire. Dans un panneau étroit (< 360 px), illustration 160 × 114 px et titre 20 px.

### 8.14 Barre de PV

Anatomie : libellé de seuil (13 px 600) · valeur « 14 / 31 » (chiffres tabulaires) · piste.
Piste : hauteur 12 px (fiche), 10 px (mini-fiche), 6 px (carte de groupe et liste), 5 px (colonne des groupes) ; rayon 999 px ; fond `--codex-surface-2` ; contour intérieur `inset 0 0 0 1px var(--codex-line)` sur les hauteurs ≥ 10 px.
Couches, de bas en haut : traînée fantôme (`--codex-warning-soft`, largeur de l'ancienne valeur) · remplissage (couleur de seuil) · PV temporaires (`--codex-hp-temp` avec contour intérieur 1 px `--codex-info`, placé juste après le remplissage).

| Seuil          | Condition        | Remplissage               | Libellé (texte)                   | Signal non coloré                                      |
| -------------- | ---------------- | ------------------------- | --------------------------------- | ------------------------------------------------------ |
| Sain           | PV > 50 %        | `--codex-heal`            | « Sain » `--codex-heal-text`      | aucun                                                  |
| Blessé         | 25 % < PV ≤ 50 % | `--codex-warning`         | « Blessé » `--codex-warning-text` | libellé affiché                                        |
| Critique       | 0 < PV ≤ 25 %    | `--codex-hp`              | « Critique » `--codex-hp-text`    | libellé + icône goutte 12 px                           |
| À terre        | PV = 0           | aucun (piste vide)        | « À terre » `--codex-ink-muted`   | libellé + icône crâne 12 px + portrait désaturé à 60 % |
| PV temporaires | PV temp > 0      | segment `--codex-hp-temp` | valeur « 22 +4 »                  | segment hachuré à 45° (1 px tous les 4 px)             |

### 8.15 Pastille de caractéristique

Deux tailles :

- **Pastille compacte** (mini-fiche, bestiaire, en-têtes) : 44 × 44 px minimum (cible tactile), rayon 8–10 px, fond `--codex-stat-X-soft`, sigle 9–11 px 700 `--codex-stat-X-text` en haut, valeur Source Sans 3 15 px 700 ou Alegreya SC 18–26 px 700 `--codex-ink` dessous. Survol : `box-shadow: inset 0 0 0 1px var(--codex-stat-X)`. Actif : `translateY(1px)`. Focus : anneau standard. Clic : test de la caractéristique ; clic droit / appui long : actions spécifiques.
- **Carte de caractéristique** (onglet Statistiques) : rayon 14 px, fond `--codex-surface`, bordure 1 px `--codex-line`, `border-top: 3px solid var(--codex-stat-X)`, padding 16 px, `shadow-soft`. Contenu : sigle en pastille (fond soft, 12 px 700, padding 3 × 8 px, rayon 999 px) + détail « Base 15 · +2 hache » (12 px `--codex-ink-muted`) · nom 14 px 600 · valeur Alegreya SC 44 px 700 · usage 12 px muted · bouton secondaire S pleine largeur « Tester · d20 ≤ 17 ». Valeur modifiée par un effet : petit chevron 12 px (haut `--codex-heal-text`, bas `--codex-hp-text`) à droite de la valeur.

Sigles : FOR, CON, DEX, INT, CHA (Charisme), SAG, CHN (Chance).

### 8.16 Pastille d'état

Hauteur 28 px (24 px dans la mini-fiche), padding 0 10 px, rayon 999 px, icône 14 px + nom 13 px 600 + « · durée » en tours. Couleurs par famille d'états :

- **Nuisible physique** (empoisonné, saignement) : fond `--codex-heal-soft`, texte `--codex-heal-text` pour le poison (vert venin) ; fond `--codex-hp-soft`, texte `--codex-hp-text` pour le saignement et « en feu ».
- **Contrôle** (étourdi, charmé, effrayé, aveuglé, à terre) : fond `--codex-warning-soft`, texte `--codex-warning-text`.
- **Bénéfique** (béni, invisible, protégé) : fond `--codex-gold-soft`, texte `--codex-gold-text`.
- **Neutre / personnalisé** : fond `--codex-surface-2`, texte `--codex-ink`.
  Durée qui expire au prochain tour : la pastille reçoit une bordure 1 px pointillée de sa couleur de texte. Expiration : échelle 1 → 0,8 + opacité → 0, 220 ms. Sur un jeton : voir 9.4.

### 8.17 Carte de personnage

Carte de liste (bestiaire, joueurs) : fond `--codex-surface`, bordure 1 px `--codex-line`, rayon 14 px, padding 14 px, `shadow-soft`, ligne : médaillon ou jeton 48 px · nom Alegreya 16 px 600 + « Mort-vivant · Nv 4 » 12 px muted · à droite PV 13 px 700 et XP 12 px 600 `--codex-gold-text`. Survol : `shadow-lifted` + `translateY(-2px)`. Sélectionnée : bordure 2 px `--codex-accent` + `0 0 0 3px var(--codex-accent-soft)`. Chargement : squelette (blocs `--codex-surface-2` avec balayage de lumière 1 400 ms, désactivé en mode réduit).

### 8.18 Médaillon de portrait

Diamètres : 132 px (fiche), 64 px (bestiaire, détail), 40 px (listes), 32–36 px (colonne des groupes, mini-fiche), 34 px (bandeau des tours). Structure (fiche) : image ronde recadrée · 4 px de vide `--codex-surface` · filet 1 px `--codex-gold-line` · 5 px de vide · filet 1 px `--codex-gold-line` (`box-shadow: 0 0 0 1px gold-line, 0 0 0 6px surface, 0 0 0 7px gold-line`). Petites tailles : un seul liseré 2 px `--codex-surface` + 1 px `--codex-gold-line`. Sans image : fond `--codex-stat-X-soft` de la caractéristique principale de la classe, initiales Source Sans 3 700 (40 % du diamètre) en `--codex-stat-X-text`. Ennemis : carré arrondi (rayon 25 % du côté), liseré `--codex-hp` (`token-foe`).

### 8.19 Case d'inventaire et cadres de rareté

Case : carré (84 px dans la vitrine, `aspect-ratio: 1` dans la grille du sac avec minimum 56 px, 52 px pour l'équipement), rayon 12 px (10 px sous 60 px), bordure 2 px de la rareté, fond de la rareté (`*-soft`), icône game-icons 50 % de la case en couleur `*-text`, quantité « ×3 » 11–12 px 700 `--codex-ink` en bas à droite (4 px du bord).

| Rareté                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Bordure                    | Fond                            | Texte                           | Marque (sous la case, en plus de la couleur) | Effet                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------- | ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commun                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `--codex-rarity-common`    | `--codex-rarity-common-soft`    | `--codex-rarity-common-text`    | « — »                                        | aucun                                                                                                                                                                                                                     |
| Peu commun                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `--codex-rarity-uncommon`  | `--codex-rarity-uncommon-soft`  | `--codex-rarity-uncommon-text`  | « ◆ »                                        | aucun                                                                                                                                                                                                                     |
| Rare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `--codex-rarity-rare`      | `--codex-rarity-rare-soft`      | `--codex-rarity-rare-text`      | « ◆◆ »                                       | aucun                                                                                                                                                                                                                     |
| Très rare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `--codex-rarity-very-rare` | `--codex-rarity-very-rare-soft` | `--codex-rarity-very-rare-text` | « ◆◆◆ »                                      | lueur `0 0 10px` de la couleur de bordure à 25 % (clair) / 35 % (sombre)                                                                                                                                                  |
| Légendaire                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `--codex-rarity-legendary` | `--codex-rarity-legendary-soft` | `--codex-rarity-legendary-text` | « ✦ »                                        | `0 0 0 1px var(--codex-gold), 0 0 14px var(--codex-gold-glow)` + reflet qui balaie la case toutes les 6 s (dégradé linéaire 110° transparent → `rgb(255 255 255 / 0.25)` → transparent, 900 ms), désactivé en mode réduit |
| Case vide : bordure 2 px `--codex-line`, fond `--codex-bg` (clair) / `--codex-surface` (sombre). États : survol `translateY(-2px)` + `shadow-lifted` ; sélectionnée : anneau `0 0 0 3px var(--codex-accent)` en plus de la bordure ; glissée : opacité 0,5 à l'origine, copie à 1,05 d'échelle sous le curseur ; cible de dépôt valide : fond `--codex-accent-soft`, bordure pointillée `--codex-accent` ; invalide (trop lourd) : bordure pointillée `--codex-hp` + info-bulle « Trop lourd : Gorak porte déjà 34 kg. » ; désactivé : opacité 0,55 ; chargement : squelette. Le panneau de détail d'un objet sélectionné (260 px) affiche surtitre de rareté Alegreya SC 12 px, nom Alegreya 20 px, type et poids, effet, propriété cachée sur fond `--codex-surface-2`, bouton primaire « Équiper ». |

### 8.20 Carte de groupe (colonne des groupes, En jeu)

Surface en verre, largeur 232 px, padding 14 px, écart 10 px. Titre de groupe : Alegreya SC 11 px 600 approche 0,16em `--codex-ink-muted` (« LE GROUPE », « ENNEMIS VISIBLES »). Ligne de membre (bouton, hauteur min 44 px, padding 6 px, rayon 10 px) : jeton 32 px · nom 13 px 600 et PV « 14/31 » à droite · barre de PV 5 px. Membre actif : fond `--codex-gold-soft`. Survol : fond `--codex-surface-2`. Sélectionné (ciblé) : anneau `--codex-accent` 2 px. À terre : nom barré d'un trait 1 px `--codex-ink-muted` + crâne 12 px. Tablette : la colonne se réduit à 72 px (jetons seuls, PV en anneau).

### 8.21 Bandeau des tours

Hauteur 64 px, fond `--codex-bar`, bordure basse 1 px `--codex-line`, padding 0 16 px, éléments écartés de 14 px. De gauche à droite : « ROUND 3 » (Alegreya SC 14 px 700, approche 0,14em, `--codex-gold-text`) · séparateur 1 × 28 px · groupes dans l'ordre d'initiative, séparés par un chevron 12 px `--codex-ink-muted` · « Tour du MJ » · à droite : « Historique » (secondaire), « Tour suivant · N » (primaire), lien « Préparation ».

- **Groupe** : conteneur rayon 14 px, padding 6 10 6 6 px, fond `--codex-surface-2`, libellé 12 px 700 capitales `--codex-ink-muted`, portraits 34 px (ronds pour joueurs/alliés/familiers, carrés arrondis 9 px pour ennemis) écartés de 6 px.
- **Groupe dont c'est le tour** : fond `--codex-gold-soft`, contour intérieur 1 px `--codex-gold-line`, libellé `--codex-gold-text`, portrait du personnage actif avec halo (`0 0 0 2px edge, 0 0 0 4px gold, 0 0 12px gold-glow`).
- **Personnage qui a déjà joué** : portrait à 50 % d'opacité.
- **Tour du MJ** : pastille 34 px de haut, bordure 1 px pointillée `--codex-line-strong`, texte 13 px 600 `--codex-ink-muted` ; quand c'est son tour : fond `--codex-accent-soft`, bordure pleine `--codex-accent`, texte `--codex-accent-text`.
- Débordement : défilement horizontal avec fondu de 24 px sur les bords.

### 8.22 Mini-fiche (au-dessus d'un jeton)

- **Compacte** (survol d'un jeton, 600 ms de délai) : 220 × auto, verre, rayon 12 px, padding 10 px : nom 14 px 600 · barre de PV 6 px · 3 pastilles d'état maximum. Positionnée 12 px au-dessus du jeton, flèche 20 × 10 px de la couleur du verre opaque (`#FBF8F1` clair, `--codex-surface` sombre).
- **Ouverte** (clic sur le jeton) : 300 px, verre, rayon 16 px, padding 16 px, écart 10 px : en-tête (jeton 36 px avec halo si actif, nom Alegreya 16 px, « Barbare · Nv 3 · à son tour » 12 px muted, bouton icône « Ouvrir la fiche ») · seuil + PV · barre 10 px · 7 pastilles compactes de caractéristiques en grille de 7 (chacune 44 px de haut) · pastilles d'état 24 px. Repositionnement automatique (Radix Popover, `collisionPadding: 16`) pour ne jamais sortir de l'écran ni couvrir le panneau rapide.

### 8.23 Barre d'outils de carte

Flottante, centrée en bas à 20 px, verre, rayon 14 px, padding 4 px, écart 4 px. Boutons icône 44 × 44 px, rayon 10 px, icône 20 px trait 1,75. Ordre : Sélection (V), Mesure (M), Zone d'effet (Z), Brouillard (F), Signaler (P), Lancer un dé (R), Vue joueurs. Actif : fond `--codex-accent-soft`, icône `--codex-accent-text`. Info-bulle : nom + raccourci. Dans l'éditeur, la barre devient un rail vertical de 60 px à gauche avec les outils d'édition (Sélection, Mur, Porte, Objet, Brouillard, Mesure, Texte, Main).

### 8.24 Résultat de dé

- **Dans le lanceur** : scène `--codex-surface-sunken` (sombre `#1A1510`, clair `#FBF6EA` pour la scène dorée), polyèdre SVG 188 px (face `#2A2116` sombre / `#FFF8E8` clair, arêtes `--codex-gold-line` 2 px, arêtes internes 1 px à 55 %), chiffre Alegreya SC 64 px 700. Surtitre (« RÉUSSITE CRITIQUE », « ÉCHEC CRITIQUE », « RÉUSSITE », « ÉCHEC ») Alegreya SC 14 px 700 approche 0,22em ; phrase Alegreya 22 px (« Gorak brise la porte ») ; détail 14 px muted (« Dés : 1 et 14 · avantage · sous Force 17 »). Actions : doré « Relancer · Chance 2 » et primaire « Appliquer ».
- **Réussite** : chiffre `--codex-ink`, surtitre `--codex-heal-text`. **Échec** : surtitre `--codex-hp-text`. **Critique** : chiffre et surtitre `--codex-gold-text`, halo `--codex-gold-glow`, étincelles. **Échec critique** : face `--codex-hp-soft`, chiffre `--codex-hp-text`.
- **Dans l'historique** : ligne de 58 px, carré 38 px rayon 10 px avec la valeur 15 px 700 (critique : fond `--codex-gold-soft`, texte `--codex-gold-text`, contour 1 px `--codex-gold-line` ; échec critique : fond `--codex-hp-soft`, texte `--codex-hp-text` ; jet secret : « •• » `--codex-ink-muted`), qui + quoi.
- **Jet secret MJ** : jamais affiché dans la Vue joueurs ; dans l'historique MJ, icône œil barré 14 px.

---

## 9. Plateau (canvas Konva)

Toutes les valeurs sont des littéraux à mettre dans `src/board/boardTheme.ts`, exporté en trois objets : `boardThemeLight`, `boardThemeDark`, `boardThemePlayers`. Le thème du plateau suit le thème de l'écran En jeu ; la Vue joueurs utilise toujours `boardThemePlayers`. Les tailles en « case » se calculent à partir de la taille de case de la carte (70 px par défaut). Les tailles en px sont données au zoom 100 % et ne sont pas mises à l'échelle avec le zoom (`strokeScaleEnabled: false`) sauf mention « suit le zoom ».

### 9.1 Fond, grille, murs, portes

| Élément                           | MJ clair                                                                                                                | MJ sombre                                             | Vue joueurs (1920 × 1080)                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Fond hors carte                   | `#E6DFD0`                                                                                                               | `#0E0B08`                                             | `#0B0907`                                                                           |
| Sol par défaut (carte sans image) | `#E8DFCC`                                                                                                               | `#3A3128`                                             | `#3A3128`                                                                           |
| Contour de la carte               | 1 px `rgba(33,28,38,0.20)`                                                                                              | 1 px `rgba(242,234,221,0.10)`                         | aucun                                                                               |
| Grille (carrée ou hexagonale)     | 1 px `rgba(33,28,38,0.16)`                                                                                              | 1 px `rgba(242,234,221,0.14)`                         | 2 px `rgba(242,234,221,0.18)`                                                       |
| Grille, toutes les 5 cases        | 1 px `rgba(33,28,38,0.26)`                                                                                              | 1 px `rgba(242,234,221,0.22)`                         | non affichée                                                                        |
| Mur                               | trait 6 px `#211C26`, contour extérieur 1 px `rgba(255,253,248,0.55)`, extrémités et jonctions arrondies (suit le zoom) | trait 6 px `#E9DFCF`, contour 1 px `rgba(0,0,0,0.55)` | trait 9 px `#E9DFCF`, contour 2 px `rgba(0,0,0,0.55)`                               |
| Porte fermée                      | rectangle épaisseur 16 px × longueur, rayon 3, fond `#A97B22`, contour 2 px `#FFFDF8`                                   | fond `#C9963A`, contour 2 px `#15110D`                | fond `#C9963A`, contour 3 px `#15110D`                                              |
| Porte ouverte                     | contour 3 px `#A97B22`, tirets [6, 4], fond transparent                                                                 | contour 3 px `#C9963A`, tirets [6, 4]                 | contour 4 px `#E0AE4E`, tirets [8, 6]                                               |
| Porte verrouillée                 | fond `#C43C3A`, contour 2 px `#FFFDF8`, cadenas blanc 12 px au centre, étiquette « Verrouillée · 15 »                   | fond `#C43C3A`, contour 2 px `#15110D`, cadenas blanc | affichée comme une porte fermée (les joueurs ne savent pas qu'elle est verrouillée) |

### 9.2 Brouillard de guerre

| Élément                 | MJ clair                                                                               | MJ sombre                                               | Vue joueurs                                          |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Zone masquée            | `rgba(33,28,38,0.45)` + hachures à 45° de 2 px `rgba(255,253,248,0.10)` tous les 12 px | `rgba(12,9,7,0.62)` + hachures `rgba(242,234,221,0.06)` | `#0B0907` opaque                                     |
| Bord de la zone révélée | net                                                                                    | net                                                     | adouci : dégradé de 48 px de `#0B0907` à transparent |
| Pinceau (aperçu)        | cercle 1 px `#6D5BD0` tirets [4, 4]                                                    | cercle 1 px `#B4A6F4` tirets [4, 4]                     | —                                                    |

Le MJ voit à travers son brouillard pour pouvoir préparer ; les joueurs, jamais.

### 9.3 Jetons

Structure, de l'intérieur vers l'extérieur : remplissage ou portrait recadré → anneau de PV 4 px → liseré 2 px → état (actif, sélection).

- **Taille** : 0,86 case pour une créature de taille 1 (60 px pour une case de 70 px) ; 1,86 case pour taille 2 ; familier : 0,66 case.
- **Forme selon le type** (signal non coloré) : joueur, allié, PNJ = rond ; familier = rond plus petit avec une pastille « patte » de 14 px en bas à droite ; ennemi = carré arrondi, rayon 22 % du côté ; allié = rond avec une pastille « écusson » de 14 px en bas à droite.

| Élément                       | MJ clair                                                                                                                                          | MJ sombre                                                                   | Vue joueurs                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Remplissage joueur            | `#6D5BD0`                                                                                                                                         | `#7562D8`                                                                   | `#7562D8`                                                                                            |
| Remplissage allié             | `#2B7D4C`                                                                                                                                         | `#2B7D4C`                                                                   | `#2B7D4C`                                                                                            |
| Remplissage familier          | `#137570`                                                                                                                                         | `#137570`                                                                   | `#137570`                                                                                            |
| Remplissage ennemi            | `#C43C3A`                                                                                                                                         | `#C43C3A`                                                                   | `#C43C3A`                                                                                            |
| Remplissage PNJ               | `#B23D73`                                                                                                                                         | `#B23D73`                                                                   | `#B23D73`                                                                                            |
| Initiales (sans portrait)     | Source Sans 3 700, 40 % du diamètre, `#FFFFFF`                                                                                                    | idem                                                                        | idem                                                                                                 |
| Liseré                        | 2 px `#FFFDF8`                                                                                                                                    | 2 px `#15110D`                                                              | 3 px `#15110D`                                                                                       |
| Piste de l'anneau de PV       | 4 px `rgba(33,28,38,0.18)`                                                                                                                        | 4 px `rgba(0,0,0,0.35)`                                                     | 5 px `rgba(0,0,0,0.35)`                                                                              |
| Anneau sain (> 50 %)          | `#2E9A5E`                                                                                                                                         | `#4CB97A`                                                                   | `#4CB97A`                                                                                            |
| Anneau blessé (26–50 %)       | `#B97A12`                                                                                                                                         | `#E8A33D`                                                                   | `#E8A33D`                                                                                            |
| Anneau critique (1–25 %)      | `#C23B3B`                                                                                                                                         | `#E35D5D`                                                                   | `#E35D5D`                                                                                            |
| À terre (0)                   | anneau `#8C8069`, portrait désaturé 60 %, crâne 16 px au centre                                                                                   | anneau `#85745F`, idem                                                      | idem                                                                                                 |
| PV temporaires                | arc extérieur 2 px `#3A80CC`, 2 px au-delà du liseré                                                                                              | `#8DBDF0`                                                                   | `#8DBDF0`                                                                                            |
| Anneau de PV des ennemis      | affiché                                                                                                                                           | affiché                                                                     | masqué par défaut ; réglage « Montrer l'état des ennemis » : couleur du seuil seule, sans proportion |
| Jeton actif                   | halo 3 px `#A97B22` à 3 px du liseré + ombre `rgba(217,164,65,0.55)` flou 18, pulsation 0,55 → 1 → 0,55 en 1 600 ms                               | halo 3 px `#E0AE4E` + ombre `rgba(224,174,78,0.45)` flou 16, même pulsation | halo 5 px `#E0AE4E` + ombre `rgba(224,174,78,0.50)` flou 28                                          |
| Sélection                     | contour 2 px `#6D5BD0`, tirets [6, 4], à 4 px du liseré                                                                                           | 2 px `#B4A6F4`, tirets [6, 4]                                               | jamais affichée                                                                                      |
| Jeton caché (MJ seul)         | opacité 0,45, liseré en tirets [4, 4] `#8C8069`, icône œil barré 14 px                                                                            | opacité 0,45, liseré `#B3A691` en tirets                                    | non rendu                                                                                            |
| Pastilles d'état sur le jeton | cercles 16 px sur l'arc haut-droite, fond `#FFFDF8`, contour 1 px `#8C8069`, icône 10 px de la couleur `*-text` de l'état ; 3 maximum puis « +2 » | fond `#1F1913`, contour `#85745F`                                           | cercles 24 px, 3 maximum                                                                             |
| Déplacement en cours          | copie fantôme à l'origine, opacité 0,35 ; cases de portée remplies `rgba(109,91,208,0.10)`                                                        | `rgba(180,166,244,0.10)`                                                    | non affiché                                                                                          |

### 9.4 Étiquette de nom

|            | MJ clair                                                                            | MJ sombre                         | Vue joueurs                                                       |
| ---------- | ----------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Texte      | Source Sans 3 600 12 px `#FFFDF8`                                                   | Source Sans 3 600 12 px `#F2EADD` | Source Sans 3 600 24 px `#F2EADD`                                 |
| Fond       | `rgba(33,28,38,0.86)`, rayon 6, padding 2 × 6 px                                    | `rgba(21,17,13,0.86)`             | `rgba(21,17,13,0.88)`, rayon 8, padding 4 × 12 px                 |
| Position   | centrée, 4 px sous le jeton                                                         | idem                              | 6 px sous le jeton                                                |
| Visibilité | joueurs et alliés toujours ; ennemis au survol, à la sélection et pendant leur tour | idem                              | joueurs toujours ; ennemis seulement si le MJ a « révélé le nom » |

### 9.5 Zones d'effet, mesure, signalement

| Élément                                     | MJ clair                                                                                                | MJ sombre                                           | Vue joueurs                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Zone de dégâts (cercle, cône, ligne, carré) | fond `rgba(224,82,82,0.16)`, contour 2 px `#C23B3B`                                                     | fond `rgba(227,93,93,0.18)`, contour 2 px `#E35D5D` | fond `rgba(227,93,93,0.22)`, contour 3 px `#E35D5D` |
| Zone de soin                                | fond `rgba(46,154,94,0.16)`, contour 2 px `#2E9A5E`                                                     | `rgba(76,185,122,0.18)`, `#4CB97A`                  | `rgba(76,185,122,0.22)`, 3 px `#4CB97A`             |
| Zone neutre / contrôle                      | fond `rgba(109,91,208,0.14)`, contour 2 px `#6D5BD0`                                                    | `rgba(180,166,244,0.16)`, `#B4A6F4`                 | `rgba(180,166,244,0.20)`, 3 px `#B4A6F4`            |
| Jetons touchés                              | reçoivent la sélection                                                                                  | idem                                                | aucun marquage                                      |
| Mesure : trait                              | 2 px `#211C26`, tirets [8, 6], extrémités : disques 4 px                                                | 2 px `#F2EADD`, tirets [8, 6]                       | 3 px `#F2EADD`, tirets [12, 8]                      |
| Mesure : bulle                              | fond `#D9A441`, texte Source Sans 3 700 13 px `#2A1E08`, rayon 999, padding 3 × 8 px, « 4 cases · 6 m » | fond `#E0AE4E`, texte `#2A1E08`                     | fond `#E0AE4E`, texte 22 px                         |
| Signalement (ping)                          | 3 anneaux contour 3 px `#A97B22` + point central 8 px                                                   | contour 3 px `#E0AE4E`                              | contour 4 px `#E0AE4E`, point 12 px                 |

### 9.6 Décor et objets interactifs

Chaque objet interactif est dessiné sur une **plaque** de 40 × 40 px (rayon 8) : fond `rgba(255,253,248,0.85)` (clair) / `rgba(21,17,13,0.80)` (sombre et joueurs), contour intérieur 2 px de la couleur de l'objet, icône 24 px trait 1,75 de la même couleur. Les zones (piège, passage) sont des rectangles qui couvrent leurs cases.

| Objet                           | MJ clair                                                                                                             | MJ sombre                                      | Vue joueurs                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Coffre                          | `#A97B22`                                                                                                            | `#E0AE4E`                                      | `#E0AE4E` (si visible) ; ouvert : icône couvercle levé |
| Piège repéré                    | zone : contour 2 px `#C23B3B` tirets [6, 4], fond `rgba(194,59,59,0.12)` ; triangle d'alerte 28 px                   | contour `#E35D5D`, fond `rgba(227,93,93,0.14)` | idem sombre, 3 px, seulement une fois détecté          |
| Piège non repéré                | idem repéré avec opacité 0,5 et œil barré 14 px                                                                      | idem                                           | non rendu                                              |
| Levier                          | `#2B66A8`                                                                                                            | `#93B1F2`                                      | `#93B1F2` ; activé : icône basculée de 40°             |
| Passage vers une autre carte    | zone : contour 2 px `#3D8F55`, fond `rgba(61,143,85,0.12)`, icône escalier 28 px, nom de la carte cible en étiquette | `#97C383`, fond `rgba(151,195,131,0.12)`       | idem sombre, sans le nom de la carte cible             |
| PNJ (non combattant)            | jeton rond `#B23D73`                                                                                                 | `#B23D73`                                      | `#B23D73`                                              |
| Note MJ                         | carré 34 px, rotation −4°, fond `#E8B04A`, contour 1 px `#82601B`, icône note 18 px `#2A1E08`                        | fond `#F0BF6E`, contour 1 px `#C9963A`         | jamais rendue                                          |
| Torche / source de lumière      | icône `#A97B22`, halo radial `rgba(217,164,65,0.18)` sur le rayon d'éclairage                                        | icône `#E0AE4E`, halo `rgba(224,174,78,0.14)`  | halo seul                                              |
| Décor (rocher, arbre, mobilier) | trait `#4A4252` 1,5 px, remplissage `#D8CDB6`                                                                        | trait `#CFC3AF`, remplissage `#4A3F33`         | idem sombre                                            |

Interaction : survol d'un objet → plaque en `shadow-lifted` et contour 3 px ; clic → panneau de réglages (éditeur) ou action (En jeu : ouvrir le coffre, actionner le levier, déclencher le passage).

---

## 10. Écrans

Repères communs : grand écran ≥ 1440 px ; ordinateur portable 1280 × 800 ; tablette 1024–1279 px (mode En jeu, cibles de 44 px) ; en dessous de 1024 px, les colonnes latérales passent sous le contenu. Tout le texte de l'interface tutoie le MJ.

### 10.1 Liste des campagnes

- En-tête 64 px (`--codex-surface`, bordure basse `--codex-line`) : monogramme + « CODEX », recherche 360 × 40 px (« Cherche une campagne, un PNJ, une carte… » + pastille « Ctrl K »), bouton icône Réglages.
- Contenu : largeur max 1 200 px centrée, padding 56 px 32 px. Surtitre « BON RETOUR, MAÎTRE DU JEU », titre « Tes campagnes » 40 px, filet à losange 160 px ; à droite « Importer » (secondaire) et « Nouvelle campagne » (primaire).
- Grille `repeat(auto-fill, minmax(320px, 1fr))`, écart 24 px. Carte de campagne : couverture 150 px (image importée, ou emblème SVG 96 px en trait 1,5 de la couleur de la campagne sur fond teinté), badge en haut à gauche, titre Alegreya 22 px, méta 14 px, avatars de joueurs 30 px chevauchés de 8 px, bouton « Reprendre » (primaire, campagne en cours) ou « Ouvrir » (secondaire). La campagne en cours a une bordure 1 px `--codex-gold-line` et `shadow-lifted`.
- Dernière case : carte en pointillés 2 px `--codex-line-strong` « Commence une nouvelle campagne ».

### 10.2 Tableau de bord de préparation

- En-tête 64 px : marque, nom de la campagne (Alegreya 16 px), contrôle segmenté « Préparation · En jeu » (au centre droit), recherche 260 px.
- Navigation latérale 248 px (`--codex-surface`, bordure droite) : 10 entrées de 40 px (icône 18 px + libellé + compteur) : Tableau de bord, Joueurs, Bestiaire, Alliés et familiers, Compétences, Objets, États, Cartes, Règles maison, Journal des séances. Entrée active : fond `--codex-accent-soft`, texte `--codex-accent-text`, barre intérieure gauche 3 px `--codex-accent`.
- Contenu : padding 36 px 40 px, titre « Tableau de bord » et surtitre « PRÉPARATION · SÉANCE 13 », bouton primaire L « Passer en jeu ».
- Grille 3 colonnes égales, écart 20 px : « Prochaine séance » (2 colonnes : liste de préparation en 2 colonnes avec statut Prêt / À faire, carte d'ouverture avec vignette), « Le groupe » (4 lignes, médaillon 40 px, barre 6 px), « Quêtes en cours », « Modifiés récemment », encadré doré « À NE PAS OUBLIER ».
- 1 280 px : navigation réduite à 72 px (icônes + info-bulles), grille 2 colonnes.

### 10.3 Fiche de personnage

- En-tête 56 px : fil d'Ariane « Joueurs / Gorak », à droite « Copier pour Discord » (secondaire) et « Placer sur la carte » (primaire).
- Colonne d'identité 340 px (300 px à 1 280 px) : carte avec coins enluminés, médaillon 132 px, surtitre « JOUEUR · NIVEAU 3 », nom 28 px, Discord, barre de PV 12 px, états, liste Classe / Arme / Provenance / Mindset (définitions alignées à droite).
- Zone principale : onglets, puis contenu.
  - **Statistiques** : grille 4 colonnes (3 à 1 280 px), écart 16 px, 7 cartes de caractéristique + carte « NIVEAU 3 » dorée (XP 820 / 1 000) ; en dessous 3 cartes dérivées (Initiative d20 + 9, Défense 12, Charge 23 / 34 kg).
  - **Inventaire (« façon jeu vidéo »)** : équipement 220 px (5 emplacements : Arme principale, Arme secondaire, Armure, 2 accessoires) · sac (barre de charge, monnaie « 142 po · 37 pa », grille 6 × 4 sur `--codex-surface-sunken`, écart 10 px, padding 14 px) · panneau de détail 260 px avec bordure dorée pour un légendaire. À 1 280 px, le panneau de détail passe sous le sac.
  - Identité, Compétences, État, Journal suivent la même grille de cartes.

### 10.4 Bestiaire

- Colonne de liste (flexible) : surtitre « 23 CRÉATURES », titre, « Nouvelle créature » ; recherche 280 px + puces de filtre (Tous, Morts-vivants, Bêtes, Humanoïdes, Boss) ; grille 3 colonnes (2 à 1 280 px), écart 14 px, cartes de personnage.
- Panneau de détail 360 px (`shadow-lifted`) : jeton carré 64 px, surtitre « ENNEMI · BOSS » `--codex-hp-text`, nom, ligne de méta ; 7 pastilles compactes ; Compétences ; Butin (objet légendaire en `--codex-gold-text` précédé de ✦) ; en bas, champ nombre 88 px « Nombre » + primaire L « Placer sur la carte ».

### 10.5 Éditeur de carte

- En-tête 56 px : fil d'Ariane, « Enregistré il y a 4 s », annuler, « Aperçu joueurs » (secondaire), « Jouer cette carte » (primaire).
- Rail d'outils 60 px · palette 232 px (Éléments en grille 3 colonnes de tuiles 64 px ; Calques : Annotations MJ, Brouillard, Jetons, Objets interactifs, Décor, Fond, avec œil de visibilité) · canvas (flexible, fond hors carte) · réglages 300 px (Grille : Carrée/Hexagonale, Taille de case, Une case vaut ; Élément sélectionné : nom, taille, champs propres au type, cases à cocher, bouton fantôme danger « Retirer le piège »).
- Contrôle de zoom en verre en bas à droite du canvas (« − 100 % + »).
- 1 280 px : la palette se replie dans un menu volant ouvert depuis le rail ; les réglages restent.

### 10.6 Écran En jeu

- **Le plateau occupe tout l'écran sous le bandeau des tours (64 px).** Aucune colonne fixe : tout le reste flotte en verre à 16 px des bords.
- Bandeau des tours (8.21).
- Colonne des groupes : 232 px, à 16 px à gauche, 16 px sous le bandeau.
- Panneau d'action rapide : 292 px, à 16 px à droite. Contenu : surtitre « ACTION RAPIDE · 3 CIBLES », saisie rapide des PV 48 px, « Infliger 8 » (danger L) et « Moitié si réussite » (secondaire L), test de groupe (7 puces de caractéristiques de 36 px), ajout d'état (puces + « Autre… »). Se replie en un bouton de 44 px quand rien n'est sélectionné.
- Mini-fiche ouverte au-dessus du jeton sélectionné (8.22).
- Barre d'outils de carte centrée en bas (8.23).
- Toasts en bas à gauche de la zone centrale (264 px du bord gauche, 20 px du bas).
- **Différences avec la Préparation** : thème sombre par défaut ; pas de grain de papier ; pas d'ornements (seul le doré du tour actif et des critiques) ; cibles de 44 px ; aucune boîte de dialogue hors confirmation de suppression et lanceur de dés ; contraste renforcé par les surfaces opaques à 82–94 %.
- **Tablette (1024–1279 px)** : colonne des groupes réduite à 72 px ; panneau rapide devenu un volet bas de 50 % de hauteur, ouvert à la sélection ; barre d'outils agrandie à 52 px.

### 10.7 Lanceur de dés et résultat critique

- Boîte de dialogue 1 040 px sur le voile du plateau, trois colonnes : choix (300 px : 8 tuiles de dés 52 px en grille de 4, Formule, avantage, jet secret, primaire XL « Lancer · R ») · scène (flexible, `--codex-surface-sunken` doré) · Historique (280 px).
- Ouverture aussi possible en « lancer express » : la touche R lance le dernier jet sans ouvrir la boîte, le résultat s'affiche en toast enrichi (dé 38 px + phrase).

### 10.8 Vue joueurs

- Fenêtre plein écran, aucun chrome, marge de sécurité de 5 % sur les bords (débordement des téléviseurs).
- **Carte** : plateau avec `boardThemePlayers`, caméra synchronisée avec le MJ ou indépendante ; bandeau en haut à gauche (32 px des bords à 1600 px de large, soit 38 px à 1 920 px), fond `rgba(21,17,13,0.86)`, contour 1 px `rgba(201,150,58,0.6)`, rayon 18 px : « ROUND 3 » + « Au tour de Gorak ». Aucun calque MJ, aucune sélection, aucun jet secret.
- **Image d'ambiance** : image plein écran `object-fit: cover`, titre optionnel en bas à gauche (Alegreya 43 px sur dégradé `rgba(11,9,7,0) → rgba(11,9,7,0.75)` de 240 px de haut).
- **Pause** : fond `#15110D` avec lueur radiale `rgba(224,174,78,0.10)` au centre (ellipse 60 % × 50 %), chandelle 64 × 96, « SÉANCE 13 », titre de campagne, filet 360 × 24, « Une courte pause. On reprend dans un instant. »
- Passage d'un mode à l'autre : fondu au noir chaud `#0B0907` 300 ms puis fondu d'entrée 400 ms.

### 10.9 Réglages

- Largeur max 1 120 px, navigation 220 px (Apparence, Animations et sons, Règles maison, Raccourcis clavier, Vue joueurs, Sauvegardes, À propos), contenu en sections-cartes dont chaque ligne fait au moins 72 px (titre 15 px 600 + aide 13 px, contrôle à droite).
- Apparence : Thème de la Préparation (Clair / Sombre / Automatique), « En jeu, toujours en sombre » (interrupteur, activé), Taille du texte (100 / 112 / 125 %), Animations (trois cartes radio : Complètes, Réduites, Désactivées), Grain de papier (activé), Sons (désactivé).
- « À propos » contient les crédits game-icons.net (CC BY 3.0) avec le nom de chaque auteur utilisé.

### 10.10 État vide

Voir 8.13 et 11.3. Exemple maquetté : Bestiaire vide, « Ton bestiaire attend ses premières créatures ».

---

## 11. Icônes et illustrations

### 11.1 Lucide (interface)

- Paquet `lucide-react`, trait 1,75 (2 pour les icônes de 16 px et moins), extrémités et jonctions arrondies.
- Tailles : 16 px (dans les champs, puces, menus), 18 px (navigation, boutons M/L), 20 px (boutons icône, barre d'outils), 24 px (en-têtes de section si besoin).
- Couleur : `currentColor` ; au repos `--codex-ink-muted` ou `--codex-ink`, actif `--codex-accent-text`.

### 11.2 game-icons.net (classes, armes, états, objets)

- Récupérer les SVG (licence CC BY 3.0) dans `src/assets/game-icons/`, nommés `<auteur>__<icone>.svg`, et générer un composant React par icône avec `fill="currentColor"`. Supprimer le carré de fond noir présent dans certains fichiers (`<path d="M0 0h512v512H0z"/>`).
- Elles sont pleines alors que Lucide est en trait : pour les harmoniser, elles ne sont jamais posées nues à côté d'une icône Lucide. Elles vivent toujours dans un **contenant** :
  - case d'inventaire (icône à 50 % de la case, couleur `*-text` de la rareté) ;
  - pastille ronde 32 px (classes, armes) : fond `--codex-surface-2`, icône 20 px `--codex-ink` ;
  - pastille d'état : icône 14 px de la couleur du texte de l'état ;
  - médaillon sans portrait (classe) : icône à 50 % du diamètre.
- Taille d'affichage minimale : 14 px. Jamais de couleur noire brute : toujours `currentColor`.
- Crédit obligatoire dans Réglages › À propos.

### 11.3 Illustrations des états vides

Style commun : dessin au trait, 280 × 200 px, trait 1,5 px `#4A4252` (clair) / `#CFC3AF` (sombre), remplissages à plat `--codex-surface` / `#241D16`, un seul accent doré (`--codex-gold-line`) et un seul accent améthyste (`--codex-accent` en clair, `--codex-accent-text` en sombre), ombre portée en ellipse `rgba(33,28,38,0.08)` / `rgba(0,0,0,0.35)`. Rôle `img` et `aria-label` descriptif.

| Écran vide                    | Illustration                                                                                                                    | Titre                                        | Texte                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bestiaire                     | Grimoire ouvert aux pages vierges, lignes en pointillés, plume posée, signet améthyste, coins et losange dorés (SVG ci-dessous) | Ton bestiaire attend ses premières créatures | Crée une créature, ou importe un bestiaire partagé. En partie, tape Ctrl K puis « Ajouter 3 Gobelins ». |
| Campagnes (premier lancement) | Chandelle éteinte sur un pupitre, une volute de fumée ; le bouton primaire « allume » la flamme (animation 600 ms)              | Allume ta première campagne                  | Donne-lui un nom, tu pourras tout changer ensuite.                                                      |
| Joueurs                       | Trois médaillons vides alignés, le central doré, une plume au-dessus                                                            | Aucun joueur pour l'instant                  | Ajoute un personnage avec l'assistant, ou colle une fiche Discord.                                      |
| Alliés et familiers           | Une lanterne et une petite empreinte de patte à côté                                                                            | Personne ne vous accompagne encore           | Crée un allié ou un familier et rattache-le à un joueur.                                                |
| Objets                        | Coffre ouvert vide, couvercle levé, deux étincelles dorées                                                                      | Le coffre est vide                           | Crée ton premier objet ou importe une bibliothèque.                                                     |
| États                         | Sablier dont le sable est à moitié écoulé                                                                                       | Aucun état personnalisé                      | Les états de base sont prêts. Crée les tiens pour tes règles maison.                                    |
| Cartes                        | Carte roulée à demi déroulée avec une rose des vents dorée                                                                      | Aucune carte                                 | Importe une image de carte ou dessine une salle avec l'éditeur.                                         |
| Journal des séances           | Encrier et plume, page avec une seule ligne                                                                                     | Rien d'écrit pour l'instant                  | Le journal se remplit tout seul pendant la partie.                                                      |
| Recherche sans résultat       | Loupe posée sur une page vierge                                                                                                 | Rien trouvé pour « liche rouge »             | Vérifie l'orthographe ou cherche par type : « mort-vivant ».                                            |
| En jeu, aucun ennemi          | Pas d'illustration (le plateau reste visible) : toast d'information                                                             | —                                            | « Aucun ennemi sur la carte. Ajoute-en avec Ctrl K. »                                                   |

SVG de l'illustration du bestiaire (les couleurs indiquées sont celles du thème clair ; remplacer selon le tableau ci-dessus en sombre) :

```html
<svg
  role="img"
  aria-label="Un grimoire ouvert aux pages vierges, une plume posée dessus"
  width="280"
  height="200"
  viewBox="0 0 280 200"
  fill="none"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <ellipse cx="140" cy="182" rx="112" ry="10" fill="rgba(33,28,38,0.08)" stroke="none" />
  <path
    d="M140 52 C112 38 72 36 34 44 L34 168 C72 160 112 162 140 176 Z"
    fill="#FFFDF8"
    stroke="#4A4252"
    stroke-width="1.5"
  />
  <path
    d="M140 52 C168 38 208 36 246 44 L246 168 C208 160 168 162 140 176 Z"
    fill="#FFFDF8"
    stroke="#4A4252"
    stroke-width="1.5"
  />
  <path d="M140 52 L140 176" stroke="#4A4252" stroke-width="1.5" />
  <path
    d="M54 74 C80 70 104 72 124 78 M54 92 C80 88 104 90 124 96 M54 110 C74 107 92 108 108 112"
    stroke="#CBC1AB"
    stroke-width="1.25"
    stroke-dasharray="3 5"
  />
  <path
    d="M44 54 L44 64 M44 54 L54 54 M236 54 L236 64 M236 54 L226 54"
    stroke="#A97B22"
    stroke-width="1.25"
  />
  <path d="M193 98 L201 106 L193 114 L185 106 Z" stroke="#A97B22" stroke-width="1.25" />
  <circle cx="193" cy="106" r="1.6" fill="#A97B22" stroke="none" />
  <path d="M166 106 L180 106 M206 106 L220 106" stroke="#A97B22" stroke-width="1" />
  <path d="M208 20 C228 26 238 48 226 72 L176 150" stroke="#4A4252" stroke-width="1.5" />
  <path
    d="M208 20 C196 40 190 62 196 84 L176 150"
    stroke="#4A4252"
    stroke-width="1.5"
    fill="#EFE9DC"
  />
  <path d="M206 44 L220 46 M200 62 L216 66" stroke="#4A4252" stroke-width="1" />
  <path d="M176 150 L170 162" stroke="#4A4252" stroke-width="2" />
  <path
    d="M150 176 L150 196 L156 190 L162 196 L162 178"
    fill="#ECE8FA"
    stroke="#6D5BD0"
    stroke-width="1.25"
  />
</svg>
```

Valeurs sombres : pages `#241D16`, traits `#CFC3AF`, pointillés `#4E4236`, or `#C9963A`, plume `#29211A`, signet `#2C2540` / `#B4A6F4`, ombre `rgba(0,0,0,0.35)`.

---

## 12. Plan d'application

Ordre à suivre, du plus impactant au plus fin. Chaque étape est un commit.

1. **Remplacer `src/styles/tokens.css`** par le bloc de la section 2 et brancher Tailwind v4 (`@theme inline`). _Visible_ : tout le logiciel se réchauffe ; le sombre passe du violacé au brun chandelle ; l'or et les PV deviennent lisibles ; les bordures de champs deviennent nettes.
2. **Installer les polices** (`@fontsource/alegreya-sc`, `@fontsource-variable/alegreya`, `@fontsource-variable/source-sans-3`), poser les variables `--codex-font-*`, appliquer l'échelle de la section 4 (titres d'écran Alegreya SC, titres de carte Alegreya, chiffres tabulaires). _Visible_ : le caractère « grimoire » apparaît dans tous les titres.
3. **Créer `src/board/boardTheme.ts`** (section 9) et remplacer toutes les couleurs codées en dur du plateau Konva ; appliquer la structure des jetons (forme par type, anneau de PV, liseré, halo actif, sélection en tirets). _Visible_ : le plateau et les jetons gagnent leur identité ; ennemis carrés, joueurs ronds.
4. **Écran En jeu** : supprimer les colonnes fixes, passer en surfaces flottantes `.codex-glass`, bandeau des tours par groupes, `data-theme="dark"` forcé selon le réglage. _Visible_ : le plateau devient le héros, l'ambiance chandelle s'installe.
5. **Composants de base** (section 8.1 à 8.13) : boutons, champs, segmentés, onglets, dialogues, tiroirs, menus, toasts, info-bulles. _Visible_ : états de survol, focus et appui cohérents partout.
6. **Composants de jeu** (8.14 à 8.24) : barre de PV à seuils et traînée, pastilles de caractéristiques à trois tokens, pastilles d'état par famille, cases de rareté, mini-fiche, résultat de dé. _Visible_ : la fiche et l'inventaire « façon jeu vidéo ».
7. **Mouvement** : tokens de durée et de courbe, `data-motion`, chorégraphies de la section 7 (dés et critique d'abord, puis barre de PV, dégâts flottants, montée de niveau, révélations, listes, pages). _Visible_ : les moments forts prennent vie, sans ralentir l'interface.
8. **Vue joueurs** : thème plateau joueurs, bandeau, écran de pause, image d'ambiance, marges de sécurité. _Visible_ : la télévision devient lisible à 3 mètres.
9. **Ornements** (section 6) : filet, coins enluminés, chandelle, monogramme, aux seuls emplacements prévus ; grain de papier. _Visible_ : la touche fantastique, discrète.
10. **Icônes et états vides** (section 11) : composants game-icons dans leurs contenants, crédits, dix états vides illustrés. _Visible_ : plus aucun écran vide « nu ».
11. **Écran Réglages** (10.9) : thème, En jeu sombre, taille du texte, animations, grain, sons.
12. **Vérification** : test axe-core sur chaque écran dans les deux thèmes, comparaison des ratios avec la section 3, test au clavier de tous les composants, test des trois niveaux d'animation, test de la Vue joueurs sur un téléviseur à 3 m.

---

## 13. Écarts assumés

1. **Valeurs de tokens existants modifiées (noms conservés).** Le sombre passe de `#14131C / #1E1C29 / #262435` (froid, violacé) à `#15110D / #1F1913 / #29211A` (brun chaud), avec un texte ivoire `#F2EADD`. Le clair est réchauffé d'un cran (`#F6F2E9`, `#FFFDF8`, `#EFE9DC`) et l'encre passe à `#211C26`. Raison : corriger le « froid et violacé » et le côté générique reprochés.
2. **`--codex-line-strong` passe de `#CFC9BB` à `#8C8069` (clair) et de `#423E57` à `#85745F` (sombre).** L'ancienne valeur ne donnait que 1,6:1 sur surface ; les bordures de champs doivent atteindre 3:1. Le rôle décoratif reste assuré par `--codex-line`.
3. **Accent en sombre : `#7562D8` au lieu de `#6D5BD0`.** L'améthyste d'origine ne donnait que 3,06:1 sur `--codex-surface-2` sombre ; `#7562D8` atteint 3,39:1 tout en gardant 4,67:1 pour le texte blanc. L'accent clair reste `#6D5BD0`.
4. **Couleurs sémantiques assombries en clair pour le 3:1** : soin `#3FA96B` → `#2E9A5E` (2,91 → 3,50:1), alerte `#E8A33D` → `#B97A12`, info `#4A90D9` → `#3A80CC`. En sombre, `--codex-hp` `#E35D5D`, `--codex-heal` `#4CB97A` et `--codex-gold` `#E0AE4E` sont légèrement éclaircis. Les teintes restent les mêmes.
5. **Trois caractéristiques ajustées en clair** : Dextérité `#1E9E95` → `#17908A`, Charisme `#D3558F` → `#C94A85`, Chance `#D9A441` → `#A87719` (2,21 → 3,56:1). La Chance devient un or ambré plus profond en clair, pour se distinguer de l'or « exceptionnel » (`--codex-gold`, inchangé). En sombre, les sept couleurs sont conservées.
6. **Ajout d'une troisième famille, Alegreya**, pour les titres de section et de carte et les noms de personnages. Alegreya SC (capitales seules) ne convient pas aux noms longs ni aux titres de carte ; Source Sans 3 seul donnait l'aspect générique reproché. Alegreya SC est conservé pour les titres d'écran, surtitres et chiffres.
7. **Sigle de la Chance : « CHN »**, car « CHA » est déjà celui du Charisme.
8. **Rareté « très rare » au lieu d'« épique »**, conformément à ce cahier des charges (le précédent prompt parlait d'« épique »).
9. **Jetons : mêmes couleurs dans les deux thèmes** (sauf joueur) et **formes différentes par type** (rond, carré arrondi, petit rond, écusson). Raison : reconnaissance immédiate quel que soit le thème, et information jamais portée par la couleur seule.
10. **Halo du jeton actif en clair : `#A97B22` (gold-line) au lieu de l'or `#D9A441`**, qui ne donnait que 1,70:1 sur le sol clair. La lueur reste dorée.
11. **Les anneaux de PV et objets du plateau ne sont jamais posés directement sur le sol** (liseré et plaques obligatoires) : sur un sol clair, le vert et l'ambre ne peuvent pas atteindre 3:1 sans perdre leur sens ; le liseré garantit le contraste.
12. **Vue joueurs toujours sombre**, quel que soit le thème choisi : lisibilité à distance et confort dans une pièce peu éclairée.
13. **En jeu : sombre par défaut** (réglage « En jeu, toujours en sombre » activé) ; le thème clair reste complet et disponible.
14. **Danger : nouveau token `--codex-danger` `#C43C3A`** pour les fonds de boutons, car `--codex-hp` (`#E05252`) ne donne que 3,8:1 avec du texte blanc.
15. **Grain de papier limité à la Préparation** et désactivable : il n'est jamais appliqué au plateau ni à la Vue joueurs, où il gênerait la lecture.
16. **Maquettes** : elles chargaient Cinzel, Fraunces et Inter depuis Google Fonts (polices d'avant D-239) pour l'aperçu uniquement ; le logiciel, lui, embarque les paquets Fontsource (section 4). Les portraits et icônes game-icons y sont remplacés par des initiales et des icônes au trait ; la production suit la section 11.
