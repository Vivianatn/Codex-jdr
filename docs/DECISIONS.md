# Journal des décisions

Choix techniques et UX non couverts par le cahier des charges ([SPEC.md](SPEC.md)), du plus récent au plus ancien. Format : contexte → décision → raison.

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
