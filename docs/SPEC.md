# Cahier des charges — Codex (logiciel de gestion de parties de JdR)

> Document de référence fourni par le MJ au démarrage du projet (2026-10-11). Ne pas modifier sans son accord ; les décisions d'implémentation vont dans `docs/DECISIONS.md`.

---

## 0. Ton rôle et ta manière de travailler

Tu es un développeur full-stack senior et un designer produit. Tu construis **Codex**, un logiciel de bureau et web, local-first, qui permet à un **Maître du Jeu (MJ)** de préparer et de mener des parties de jeu de rôle de type *Donjons & Dragons* avec un système maison décrit plus bas.

Règles de travail :
1. **Avance par phases** (section 12). À la fin de chaque phase : les tests passent, l'app se lance, tu fais un commit git clair, puis tu résumes ce qui est fait et ce qui reste.
2. **Avant de coder la phase 1**, pose-moi les questions de la section 13 (« Règles à confirmer »). Jusqu'à ma réponse, utilise les valeurs par défaut indiquées et rends-les **configurables**.
3. Toute règle de jeu (formules, arrondis, seuils) vit dans **un seul module de règles** configurable (`src/rules/`). Elle n'est jamais codée en dur dans un composant.
4. Écris les tests en même temps que le code, jamais après coup (section 11).
5. Si un choix technique ou d'UX n'est pas couvert ici, prends la décision la plus simple et la plus pratique pour un MJ en pleine partie, puis note-la dans `docs/DECISIONS.md`.
6. Code et commentaires en anglais. **Toute l'interface est en français.** Les chaînes passent par un fichier i18n pour permettre d'autres langues plus tard.

---

## 1. Stack technique

- **Front** : React 18 + TypeScript (strict) + Vite.
- **Style** : Tailwind CSS + variables CSS pour les tokens de design (section 9). Composants accessibles avec Radix UI (ou shadcn/ui).
- **Animations** : Framer Motion. Respecte `prefers-reduced-motion` partout.
- **État** : Zustand (stores découpés par domaine) avec un middleware d'historique pour annuler et rétablir.
- **Persistance** : IndexedDB via Dexie. Sauvegarde automatique, plus export et import JSON d'une campagne entière (images incluses en base64 ou dans un zip).
- **Plateau de jeu** : Konva (react-konva) ou PixiJS. Choisis selon les performances (objectif : 200 jetons à 60 fps).
- **Bureau** : enveloppe Tauri (optionnelle, phase 6) pour avoir une application installable et une **seconde fenêtre « Vue joueurs »** à afficher sur un autre écran ou un projecteur.
- **Tests** : Vitest + Testing Library, fast-check (tests par propriétés), Playwright (end-to-end), axe-core (accessibilité).
- **Qualité** : ESLint, Prettier, Husky (lint et tests unitaires au pre-commit).

---

## 2. Modèle de données

### 2.1 Entités jouables

Il y a **quatre types d'entités**, qui partagent la même fiche de base :

| Type | Particularités |
|---|---|
| **Joueur (avatar)** | Lié à un joueur réel (nom Discord). Expérience et montée de niveau. |
| **Ennemi** | Créé à partir d'un **modèle de bestiaire**. Peut être dupliqué en N exemplaires numérotés automatiquement (Gobelin 1, Gobelin 2…). Récompense en XP, table de butin. |
| **Familier** | Rattaché à un **propriétaire** (joueur ou allié). Jauge de loyauté. Option « agit au tour de son maître » ou « a sa propre initiative ». |
| **Allié (PNJ)** | Jauge de disposition envers le groupe. Peut être contrôlé par le MJ ou confié à un joueur. |

### 2.2 La fiche (structure exacte à respecter)

Le format de référence est la fiche Discord ci-dessous. L'app doit pouvoir **l'exporter à l'identique en Markdown** (bouton « Copier pour Discord ») et **l'importer** depuis un texte collé dans ce format.

```
# fiche NOM DISCORD

## Identité :
- Pseudo
- Classe
- type d'arme
- provenance
- Description (texte ou photo) + Mindset :
## Statistiques :
- Niveau : 1
(DETERMINE PAR LANCES DE DES LORS DE LA PREMIERE SESSION)
- PV(points de vie): 10 + 1d20+Nv
- Force 2d20/2
- Constitution 2d20/2
- Dexterité 2d20/2
- Intelligence 2d20/2
- Charisme 2d20/2
- Sagesse 2d20/2
- Chance 2d20/2
## Compétences :
(2 actives 1 Passives au début + Passif de classe (Caractéristique physique)
----
## Etat :
----
## Inventaire :
----
```

Champs à modéliser :

- **Identité** : `discordName`, `pseudo`, `class`, `weaponType`, `origin` (provenance), `description` (texte riche), `portrait` (image importée, recadrable), `mindset` (texte).
- **Statistiques** : `level` (départ à 1), `hp.max`, `hp.current`, `hp.temp`, et les 7 caractéristiques `strength`, `constitution`, `dexterity`, `intelligence`, `charisma`, `wisdom`, `luck`. Chaque caractéristique stocke sa **valeur de base** (issue du jet), ses **modificateurs actifs** (états, équipement, passifs) et sa **valeur effective** calculée.
- **Formules par défaut** (dans `src/rules/`) :
  - Caractéristique = `2d20 / 2`, arrondi **au supérieur**. Plage de 1 à 20.
  - PV max au niveau 1 = `10 + 1d20 + Niveau`.
- **Compétences** : liste de compétences typées `active` ou `passive`, plus **un passif de classe** distinct (« caractéristique physique »). À la création : **exactement 2 actives, 1 passive et 1 passif de classe**. Le formulaire bloque tant que ce n'est pas respecté.
- **État** : liste d'états actifs (section 4.10).
- **Inventaire** : liste d'objets (section 4.11).
- **Journal** : historique horodaté de tout ce qui arrive à l'entité (dégâts, soins, jets, états, objets).

### 2.3 Autres entités

- **Campagne** : contient joueurs, bestiaire, alliés, plateaux, sessions, notes, quêtes, objets.
- **Session** : date, participants, journal automatique, notes du MJ, résumé exportable.
- **Plateau (carte)** : section 5.
- **Modèle d'objet** et **modèle d'ennemi** : bibliothèques réutilisables d'une campagne à l'autre.

---

## 3. Création de personnage : l'assistant de première session

Assistant en étapes, avec une barre de progression animée :

1. **Identité** : pseudo, nom Discord, classe, arme, provenance, portrait (glisser-déposer), description et mindset.
2. **Les jets de caractéristiques** : moment fort de la première session, à mettre en scène.
   - Chaque caractéristique a sa carte. Un clic lance **2d20 animés**, affiche la division par 2 et l'arrondi, puis la valeur se « grave » dans la carte avec une petite animation.
   - **Mode « dés physiques »** : le MJ saisit les résultats des vrais dés lancés à la table.
   - Option MJ « autoriser une relance » (une fois, ou par caractéristique), avec traçage dans le journal.
   - Bouton « Tout lancer » pour une création rapide de PNJ.
3. **Points de vie** : jet animé du `1d20`, affichage du calcul `10 + jet + Niveau`.
4. **Compétences** : choix ou création de 2 actives, 1 passive et du passif de classe.
5. **Inventaire de départ** : à partir de modèles par classe, modifiables.
6. **Récapitulatif** : aperçu de la fiche complète et bouton « Copier pour Discord ».

Pour les **ennemis**, il existe en plus un mode **génération rapide** : on choisit un modèle, un niveau et une quantité, et les jets sont faits automatiquement.

---

## 4. Une fonctionnalité dédiée par statistique

Chaque caractéristique est cliquable sur la fiche. Un clic lance un **test** ; un clic droit (ou un appui long) ouvre ses **actions spécifiques**.

**Méthode de résolution par défaut** (configurable, voir section 13) : *jet sous la caractéristique*, réussite si `1d20 ≤ valeur effective`. Un 1 naturel est une réussite critique, un 20 naturel un échec critique. Une méthode alternative est proposée : `1d20 + modificateur ≥ difficulté`, avec `modificateur = floor((valeur − 10) / 2)`. Chaque test peut être fait **avec avantage ou désavantage** (2d20, garder le meilleur ou le pire), avec un **bonus/malus de circonstance**, et en **jet secret MJ**.

### 4.1 Niveau
- Suivi de l'**XP** avec barre de progression et seuils configurables.
- **Assistant de montée de niveau** : animation de halo doré, nouveau calcul des PV selon la règle choisie, proposition de nouvelles compétences, historique des niveaux.
- Distribution d'XP de groupe en fin de combat : XP totale des ennemis vaincus partagée entre les joueurs présents.

### 4.2 Points de vie
- **Barre de PV animée** avec une « traînée fantôme » qui rattrape la valeur réelle après des dégâts. Vert, puis ambre sous 50 %, puis rouge sous 25 %.
- **Saisie rapide** : un champ unique où l'on tape `-7`, `+5` ou `t+4` (PV temporaires).
- Dégâts appliqués d'abord aux PV temporaires.
- **Seuils** : Blessé, Critique, À terre (0 PV), avec états ajoutés automatiquement et animation (tremblement, flash rouge).
- **Dégâts et soins de zone** : sélectionner plusieurs jetons et appliquer en une fois, avec option « moitié pour ceux qui réussissent leur test ».
- Historique des PV dans le journal, avec annulation.

### 4.3 Force
- Tests d'attaque au corps à corps et bonus de dégâts liés à la Force (règle configurable).
- **Capacité de charge** : le poids maximal de l'inventaire dépend de la Force. Au-delà, état « Surchargé » automatique (malus de Dextérité).
- **Test opposé** (bras de fer, lutte, enfoncer une porte) : deux entités, deux jets côte à côte, animation de duel.

### 4.4 Constitution
- **Jets de résistance** : poison, maladie, froid, fatigue. Bouton direct depuis la ligne d'un état qui demande un jet chaque tour.
- **Fatigue / endurance** : compteur de niveaux d'épuisement et suivi des repos (court ou long) qui restaurent PV et ressources.
- **Concentration** : quand une entité qui maintient un sort ou une capacité subit des dégâts, l'app propose automatiquement un test de Constitution.

### 4.5 Dextérité
- **Initiative** : lancer l'initiative de tout le monde en un clic (d20 + Dextérité ou règle choisie). L'ordre alimente le suivi de combat.
- **Esquive / défense** : valeur de défense dérivée de la Dextérité et de l'équipement, affichée sur le jeton.
- **Attaques à distance**, discrétion, crochetage : tests rapides prédéfinis.
- **Déplacement** sur le plateau : portée de mouvement optionnellement dérivée de la Dextérité, affichée en surbrillance quand on saisit un jeton.

### 4.6 Intelligence
- **Identification d'objets** : un objet peut avoir des propriétés cachées. Un test d'Intelligence réussi les révèle, avec une animation de carte qui se retourne.
- **Connaissances** : le MJ attache des notes de lore à des lieux, PNJ ou objets, avec une difficulté. Une réussite les rend visibles au joueur.
- Énigmes et déchiffrement : test avec indices révélés progressivement selon la marge de réussite.

### 4.7 Charisme
- **Jauge de disposition** des PNJ et alliés (Hostile → Méfiant → Neutre → Amical → Dévoué).
- Tests de persuasion, d'intimidation et de tromperie qui **déplacent la jauge**, avec animation.
- **Marchandage** : chez un marchand, un test de Charisme modifie le prix affiché des objets.

### 4.8 Sagesse
- **Perception** : le MJ place sur le plateau des éléments cachés (pièges, portes secrètes, indices) avec une difficulté. Un bouton « Perception de groupe » lance pour tous et révèle les éléments aux personnages qui réussissent.
- **Intuition** : détecter le mensonge d'un PNJ (jet secret, le MJ voit le résultat, le joueur voit seulement un ressenti).
- Résistance mentale contre la peur, le charme ou la confusion.

### 4.9 Chance
- **Points de chance** : réserve dérivée de la Chance, dépensable pour relancer un dé, avec animation de trèfle ou d'étincelle.
- **Butin** : la qualité du butin tiré sur une table d'ennemi est pondérée par la Chance de celui qui fouille.
- **Événements aléatoires** : tables personnalisables (rencontres, météo, rumeurs) pondérées par la Chance du groupe.
- Option de critique élargi pour les personnages à forte Chance (règle configurable).

### 4.10 État
- Bibliothèque d'états avec **icône, couleur, description et effets** : empoisonné, étourdi, en feu, aveuglé, charmé, effrayé, invisible, à terre, surchargé, saignement, béni, etc. Le MJ peut en créer.
- Chaque état peut avoir une **durée en tours** décomptée automatiquement par le suivi de combat, un **effet chiffré** (ex. Force −2, 1d4 dégâts au début du tour) et un **jet pour s'en libérer**.
- Les états s'affichent en petites pastilles sur le jeton et sur la fiche, avec infobulle.
- À l'expiration : notification discrète et animation de disparition.

### 4.11 Inventaire
- Vue liste ou grille, avec filtres (type, rareté) et recherche.
- **Emplacements d'équipement** (arme principale, secondaire, armure, accessoires) qui appliquent leurs modificateurs aux caractéristiques.
- **Poids total** comparé à la capacité de charge (Force).
- **Rareté** avec liseré coloré : commun, peu commun, rare, épique, légendaire.
- Objets **consommables** avec bouton « Utiliser » (ex. potion : +2d4 PV, quantité −1).
- **Glisser-déposer** d'objets entre personnages et depuis un coffre du plateau.
- Monnaie avec conversion automatique.

### 4.12 Compétences
- Chaque compétence : nom, type (active ou passive), caractéristique liée, description, **coût ou nombre d'utilisations**, **temps de recharge en tours**, effet (jet de dés, dégâts, soin, état appliqué).
- Une compétence active se lance d'un clic depuis la fiche ou le menu du jeton. L'app applique le jet, cible les jetons choisis sur le plateau et gère le temps de recharge.
- Les passives et le passif de classe appliquent leurs modificateurs en continu ; on peut les activer ou les désactiver pour tester.

---

## 5. Plateaux de jeu interactifs

### 5.1 Éditeur de carte
- Grille **carrée ou hexagonale**, taille de case réglable, affichage optionnel.
- **Image de fond** importée (calage de la grille sur l'image avec un outil dédié).
- **Calques** : fond, décor, objets interactifs, jetons, brouillard, annotations MJ (invisibles aux joueurs).
- **Palette de tuiles et d'éléments** : murs, portes, arbres, rochers, eau, mobilier. Placement par clic et glisser, rotation, magnétisme sur la grille.
- **Murs et portes** qui bloquent le déplacement et, en option, la ligne de vue.
- Plusieurs cartes par campagne, et **liens entre cartes** (un escalier ou une porte qui envoie vers une autre carte).

### 5.2 Interaction pendant la partie
- **Jetons** avec portrait, anneau de PV coloré autour, pastilles d'état, nom. Taille selon la créature (1×1, 2×2…).
- Déplacement au glisser avec **règle de mesure** (distance en cases et en mètres) et zone de portée.
- **Brouillard de guerre** : pinceau de révélation et de masquage, révélation automatique autour des joueurs (option).
- **Objets interactifs** avec déclencheurs : coffre (contient un inventaire), piège (difficulté de détection, effet), levier, porte verrouillée (difficulté de crochetage), PNJ (ouvre sa fiche).
- **Zones d'effet** : cercle, cône, ligne, carré. Les jetons touchés sont sélectionnés automatiquement pour appliquer dégâts, états ou jets.
- **Ping** (clic long) visible sur la vue joueurs, avec une onde animée.
- Dessin libre et annotations rapides, effaçables.
- **Ligne de vue** et lumière (torche, rayon de vision) : optionnel, phase avancée.
- Zoom et déplacement fluides (molette, pincement, barre d'espace + glisser).

### 5.3 Vue joueurs
- Seconde fenêtre ou onglet synchronisé qui affiche la carte **sans les calques MJ**, avec le brouillard, et suit la caméra du MJ ou une caméra indépendante.
- Le MJ choisit ce qui est montré : la carte, une image d'ambiance plein écran, ou un écran de pause.

---

## 6. Suivi de combat

- Bandeau d'**ordre d'initiative** en haut de l'écran, sous forme de portraits. Le jeton actif est mis en avant sur le plateau et la caméra peut le suivre.
- Boutons **Tour suivant / précédent**, compteur de **rounds**.
- Au début de chaque tour : effets d'états appliqués, durées décomptées, temps de recharge réduits, rappel des jets à faire.
- Ajout ou retrait d'un combattant en cours de combat, retard d'action.
- Fin de combat : récapitulatif (dégâts infligés et subis, ennemis vaincus), distribution d'XP et ouverture du butin.
- Minuteur de tour optionnel.

---

## 7. Lanceur de dés

- Analyseur de notation complète : `1d20`, `2d20/2`, `3d6+2`, `2d20kh1` (avantage), `2d20kl1` (désavantage), `4d6dl1`, expressions combinées.
- **Dés animés** (2D soigné ou 3D léger) avec un résultat lisible immédiatement. Le MJ peut couper l'animation pour aller vite.
- Effets spéciaux : critique → éclat de particules dorées ; échec critique → tremblement et teinte rouge.
- **Historique des jets** dans un panneau latéral, filtrable par personnage.
- **Jets secrets MJ** (masqués côté vue joueurs).
- Macros et jets favoris enregistrables.
- Optionnel : envoi des jets vers un salon Discord via un **webhook** configuré par le MJ.

---

## 8. Navigation et confort du MJ (priorité forte)

Objectif : le MJ ne doit **jamais quitter la carte** pendant une partie et doit atteindre n'importe quoi **en moins de deux actions**.

1. **Palette de commandes** (`Ctrl/Cmd + K`) : recherche floue sur tout (personnages, ennemis, objets, cartes, états, notes), et actions directes (« Ajouter 3 Gobelins », « Lancer l'initiative », « Aller à la carte Crypte », « Infliger 6 à Gorak »).
2. **Raccourcis clavier** pour toutes les actions fréquentes, avec une aide affichée par `?` : tour suivant (`N`), lancer un dé (`R`), brouillard (`F`), mesure (`M`), annuler (`Ctrl+Z`).
3. **Fiches en tiroir** : cliquer un jeton ouvre sa fiche dans un panneau latéral qui glisse par-dessus la carte, sans changer d'écran. Possibilité d'**épingler** plusieurs fiches côte à côte.
4. **Menu radial** au clic droit sur un jeton : dégâts, soin, état, test d'une caractéristique, compétence, fiche, retirer.
5. **Deux modes clairement séparés** : **Préparation** (éditeurs, bibliothèques) et **En jeu** (carte + combat + fiches, interface épurée). Bascule d'un clic.
6. **Barre latérale d'accès rapide** : groupe de joueurs avec mini-barres de PV toujours visibles, ennemis présents, favoris.
7. **Signets de caméra** sur la carte (« Entrée », « Salle du trône ») accessibles par les touches 1 à 9.
8. **Éléments récents** et **favoris** partout.
9. **Annuler / rétablir** global sur toutes les actions de partie (dégâts, déplacements, états), avec l'historique visible.
10. **Écran du MJ** : tableau de bord personnalisable (notes de scène, tables aléatoires, statistiques du groupe, rappel des règles maison).
11. **Notes contextuelles** : une note du MJ attachée à une carte, une zone ou un PNJ apparaît quand on y va.
12. **Journal de session automatique** : tout est consigné (jets, dégâts, morts, objets trouvés). Export en Markdown pour Discord à la fin de la séance.
13. Notifications discrètes (toasts) non bloquantes, jamais de fenêtres modales pendant le jeu sauf confirmation d'une suppression.

---

## 9. Direction artistique, UI et UX

### 9.1 Intention
**« Grimoire moderne »** : l'élégance d'un vieux manuel de jeu, traduite en interface contemporaine, claire et aérée. Pas de parchemin chargé ni de textures lourdes : un clin d'œil fantastique dans les détails (typographie des titres, ornements fins, icônes), et une base d'interface propre et légère.

### 9.2 Tokens de design (variables CSS)
- **Thème clair (par défaut)** : fond `#F7F5F0` (ivoire), surfaces `#FFFFFF`, texte `#1F1D2B` (encre), texte secondaire `#6B6880`.
- **Thème sombre** (bascule, idéal en partie le soir) : fond `#14131C`, surfaces `#1E1C29`, texte `#EDEAF5`.
- **Accent principal** : améthyste `#6D5BD0`. **Accent secondaire** : or `#D9A441` (niveau, critiques, légendaire).
- **Sémantique** : PV et dégâts `#E05252`, soin `#3FA96B`, alerte `#E8A33D`, info `#4A90D9`.
- **Une couleur par caractéristique**, reprise sur la fiche, les jets et l'historique : Force (rouge brique), Constitution (vert mousse), Dextérité (turquoise), Intelligence (bleu), Charisme (rose), Sagesse (violet), Chance (or).
- **Rayons** 12–16 px, ombres douces et diffuses, espacement sur une grille de 4 px.
- **Typographie** : titres en *Cinzel* ou *Fraunces* (caractère fantastique), texte en *Inter* (lisibilité), chiffres de statistiques en chiffres tabulaires.
- **Icônes** : Lucide pour l'interface, game-icons.net (licence CC BY, créditer) pour les classes, armes, états et objets.

### 9.3 Composants clés
- **Carte de personnage** : portrait en médaillon, nom, classe, barre de PV, sept caractéristiques en pastilles colorées, pastilles d'état.
- **Fiche complète** : en onglets (Identité, Statistiques, Compétences, État, Inventaire, Journal), en respectant l'ordre de la fiche Discord.
- Surfaces flottantes (tiroirs, palette, menus) en verre dépoli léger sur la carte.

### 9.4 Animations (sympathiques, rapides, jamais gênantes)
- Durées courtes : 150–300 ms pour l'interface, plus long seulement pour les moments forts (dés, montée de niveau, création).
- Dés qui roulent puis se posent avec un petit rebond ; critique en particules dorées ; échec critique en tremblement.
- Barre de PV fluide avec traînée fantôme ; chiffres de dégâts qui flottent au-dessus du jeton.
- Cartes qui se retournent (objet identifié, élément révélé), apparition en cascade des listes, transitions de pages en fondu glissé.
- Micro-interactions au survol (légère élévation des cartes, pulsation du bouton d'action principal).
- **Sons optionnels** (désactivés par défaut) : dés, coup, soin, montée de niveau.
- Réglage global « Animations : complètes / réduites / désactivées ».

### 9.5 UX
- Saisies tolérantes (`-7` dans le champ PV suffit), valeurs par défaut sensées, aucun formulaire bloquant inutile.
- États vides illustrés et utiles (« Aucun ennemi. Ajoute-en depuis le bestiaire ou avec Ctrl+K »).
- Accessibilité : contraste AA minimum, navigation clavier complète, focus visible, information jamais transmise par la couleur seule.
- Responsive : utilisable sur grand écran, ordinateur portable et tablette (mode « En jeu » tactile).

---

## 10. Extras pratiques

- Bibliothèque de **modèles** : classes, ennemis, objets, états, tables aléatoires. Import et export pour les partager.
- **Générateurs rapides** : nom de PNJ, butin, rencontre selon le niveau du groupe.
- **Quêtes** : liste avec statut, objectifs à cocher, récompenses.
- **Notes de campagne** liées entre elles (`[[nom]]`), recherchables.
- **Marchands** : inventaire et prix, achat et vente qui mettent à jour l'inventaire et la monnaie du joueur.
- **Sauvegarde automatique** et **points de restauration** (instantané avant chaque session).
- Import et export de fiche au format Discord, export PDF imprimable d'une fiche.

---

## 11. Tests et validation

### 11.1 Tests unitaires (Vitest)
- **Dés** : l'analyseur accepte toutes les notations de la section 7 et rejette les invalides avec un message clair.
- **Tests par propriétés (fast-check)** :
  - `2d20/2` arrondi au supérieur donne toujours un entier entre 1 et 20.
  - PV au niveau 1 entre 12 et 31 (`10 + 1..20 + 1`).
  - Un jet avec avantage n'est jamais inférieur au pire des deux dés.
  - Les PV ne passent jamais sous 0 et les dégâts consomment d'abord les PV temporaires.
- **Règles** : calcul des valeurs effectives avec modificateurs empilés, capacité de charge, seuils de PV, décompte des états, temps de recharge, partage d'XP.
- **Distribution** : sur 100 000 tirages simulés avec une graine fixe, la répartition de `2d20/2` est conforme à la distribution théorique (tolérance documentée).
- **Import/export Discord** : aller-retour fiche → Markdown → fiche sans perte.
- **Migrations** de schéma Dexie testées.

### 11.2 Tests de composants (Testing Library)
Fiche, barre de PV, champ de saisie rapide, assistant de création (dont le blocage 2 actives / 1 passive / 1 passif de classe), palette de commandes, menu radial.

### 11.3 Scénarios end-to-end (Playwright), à faire tourner à chaque phase
1. Créer une campagne, créer un joueur avec l'assistant complet (jets animés et mode dés physiques), copier sa fiche pour Discord.
2. Créer 5 Gobelins depuis le bestiaire avec Ctrl+K, les placer sur une carte.
3. Lancer l'initiative, jouer 3 rounds : dégâts de zone, état empoisonné qui expire, compétence avec temps de recharge.
4. Tuer les ennemis, distribuer l'XP, ouvrir le butin, transférer un objet par glisser-déposer.
5. Révéler une salle avec le brouillard, déclencher un piège détecté par un test de Perception de groupe.
6. Annuler les 5 dernières actions et vérifier l'état exact.
7. Exporter la campagne en JSON, la supprimer, la réimporter, vérifier que tout est identique.
8. Mener un combat entier **uniquement au clavier**.

### 11.4 Accessibilité et performances
- axe-core sans violation sérieuse sur chaque écran principal.
- Carte avec 200 jetons et brouillard actif : 60 fps au déplacement et au zoom (mesure documentée).
- Ouverture de l'app et chargement d'une campagne moyenne en moins de 2 s.

### 11.5 Tests d'usage « MJ » (checklist manuelle dans `docs/TESTS_MJ.md`)
Rédige une checklist chronométrée que je pourrai suivre, par exemple :
- Infliger des dégâts à un ennemi depuis la carte : **2 actions maximum**.
- Retrouver la fiche d'un PNJ par son nom : **moins de 3 secondes**.
- Ajouter un état avec durée à 3 jetons : **moins de 10 secondes**.
- Passer de « Préparation » à « En jeu » et retrouver la carte de la séance : **1 action**.
Pour chaque point qui échoue, propose une amélioration de navigation.

---

## 12. Feuille de route par phases

| Phase | Contenu | Livrable |
|---|---|---|
| **0. Fondations** | Projet, outillage, tokens de design, thème clair et sombre, coquille de l'app (navigation, modes Préparation / En jeu), i18n, persistance. | App vide mais belle, qui se lance, tests qui tournent. |
| **1. Fiches** | Modèle de données, module de règles, 4 types d'entités, fiche complète, assistant de création, import/export Discord. | On peut créer et éditer tous les personnages. |
| **2. Dés et statistiques** | Lanceur de dés animé, fonctionnalités par statistique (section 4), états, inventaire, compétences. | La fiche est jouable. |
| **3. Combat** | Suivi d'initiative, rounds, effets automatiques, fin de combat, XP et butin. | Un combat complet est jouable sans carte. |
| **4. Plateau** | Éditeur de carte, jetons, mesure, brouillard, objets interactifs, zones d'effet, vue joueurs. | Un combat complet est jouable sur carte. |
| **5. Navigation MJ** | Palette de commandes, raccourcis, menu radial, tiroirs épinglés, signets, journal de session, écran du MJ. | Tous les tests d'usage MJ passent. |
| **6. Finitions** | Animations, sons, extras (section 10), Tauri, export PDF, optimisation. | Version 1.0 installable. |

---

## 13. Règles à confirmer avant la phase 1

En attendant la réponse du MJ, utiliser la valeur par défaut et rendre la règle configurable dans les paramètres de campagne.

1. **Arrondi de `2d20/2`** : supérieur (défaut), inférieur, ou garder la demi-valeur ?
2. **PV lors d'une montée de niveau** : refaire `10 + 1d20 + Nv`, ajouter `1d20` au total, ou ajouter seulement +1 par niveau (défaut : ajouter `1d20 / 2` arrondi au supérieur + 1, à valider) ?
3. **Méthode de résolution des tests** : jet sous la caractéristique (défaut) ou d20 + modificateur contre une difficulté ?
4. **Les caractéristiques progressent-elles** avec le niveau ? Si oui, comment ?
5. **Gain de compétences** : combien d'actives et de passives à chaque niveau ?
6. **Valeurs du critique** : 1 naturel = réussite critique et 20 naturel = échec critique (en jet sous) ?
7. **Unité de distance** de la grille (1 case = 1,5 m par défaut) ?
