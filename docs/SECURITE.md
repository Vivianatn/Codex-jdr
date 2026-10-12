# Sécurité de Codex

_Dernière mise à jour : 12 octobre 2026. Décisions : D-241 (comptes et chiffrement), D-242 (base de données), D-243 (durcissement)._

Codex est une application **locale** : pas de serveur, pas de réseau. La sécurité porte donc sur ce qui reste sur l'appareil et sur ce qui entre dans l'application (fichiers importés).

## 1. Ce qui est protégé, et contre qui

| Menace                                                                               | Protection                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quelqu'un copie le disque, le profil du navigateur ou une sauvegarde système         | Toutes les données de jeu sont chiffrées ; sans le mot de passe ni le code de secours, elles sont illisibles.                                                                              |
| Quelqu'un tente de deviner le mot de passe sur une copie des fichiers                | Chaque essai coûte 600 000 itérations PBKDF2-SHA-256 ; mots de passe de 15 caractères minimum, suites de touches et mots courants refusés.                                                 |
| Quelqu'un tente de deviner le mot de passe dans l'application                        | Après 5 échecs, attente de 30 s, doublée à chaque échec, jusqu'à 15 min.                                                                                                                   |
| Quelqu'un modifie les fichiers de la base (déplacer une fiche, changer une valeur)   | Chaque enregistrement est authentifié (Poly1305) avec sa table, son identifiant et ses index : toute modification est détectée et l'enregistrement est ignoré.                             |
| L'écran du MJ reste ouvert sans surveillance                                         | Verrouillage automatique après 15 min d'inactivité (réglable), bouton « Verrouiller » dans l'en-tête ; la clé est alors effacée de la mémoire.                                             |
| La fenêtre joueurs, projetée, montre une saisie de mot de passe                      | Elle ne demande jamais de mot de passe : elle reçoit la session de la fenêtre du MJ et se verrouille avec elle.                                                                            |
| Un fichier importé piégé (script, image SVG, pollution de prototype, fichier énorme) | Images matricielles uniquement, clés `__proto__`/`constructor`/`prototype` supprimées, 256 Mo au plus, validation de chaque enregistrement.                                                |
| Une faille d'injection de script                                                     | Politique de sécurité du contenu (CSP) : scripts du paquet uniquement, **aucune connexion réseau possible** (`connect-src 'none'`), pas d'`eval`, pas d'objets, pas de formulaire sortant. |
| Perte de données par erreur ou corruption                                            | Trois sauvegardes chiffrées (une par jour à l'ouverture, plus les manuelles), restauration en un clic ; la sauvegarde automatique réessaie si une écriture échoue.                         |

**Hors de portée** (aucun logiciel local ne peut s'en protéger) : un logiciel espion ou une extension malveillante sur l'appareil pendant que Codex est déverrouillé, l'observation de l'écran, un mot de passe noté à côté de l'ordinateur. Les fichiers exportés (« Exporter », « Tout exporter ») ne sont **pas** chiffrés : ils servent à la portabilité (RGPD) et doivent être rangés en lieu sûr.

## 2. Conception cryptographique

```
mot de passe ──PBKDF2-SHA-256 (600 000 it., sel 128 bits)──▶ clé d'enveloppe ─┐
code de secours ─PBKDF2-SHA-256 (sel distinct)─────────────▶ clé d'enveloppe ─┤
                                                                               ▼
                         clé de données (256 bits aléatoires, une par compte) — enveloppée deux fois
                                                                               │
                  XChaCha20-Poly1305 (nonce aléatoire 192 bits)               ▼
     chaque enregistrement IndexedDB : { id, index…, $v: 1, $e: nonce ‖ chiffré ‖ étiquette }
     données associées : [table, valeurs des index] — toute permutation ou modification échoue
```

- **Clé de données** : générée par `crypto.getRandomValues`, jamais écrite en clair. Changer de mot de passe ré-enveloppe la clé sans rechiffrer les données.
- **Code de secours** : 160 bits, 32 caractères en base32 de Crockford (pas de I, L, O, U). Montré une seule fois ; remplacé après usage.
- **Bibliothèques** : WebCrypto du navigateur (PBKDF2) et [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) (XChaCha20-Poly1305, auditée, sans dépendance). Le chiffrement synchrone est nécessaire pour chiffrer à l'intérieur des transactions IndexedDB.
- **En clair** : le registre des comptes (nom du compte, sels, clés enveloppées, compteur d'échecs) et, dans chaque base, les identifiants aléatoires et les champs d'index (`campaignId`, date des jets, date des sauvegardes). Aucun nom de campagne, de personnage ou d'objet n'est indexé (schéma v8).
- **Mémoire** : la clé n'existe qu'en mémoire (jamais dans `localStorage`, `sessionStorage` ni IndexedDB) ; elle est écrasée par des zéros au verrouillage. Recharger la page redemande le mot de passe.

## 3. Base de données

- Une base IndexedDB par compte (`codex-account-<id>`), plus le registre `codex-accounts`.
- Deux intergiciels Dexie sous toutes les tables (impossible de les contourner, y compris pendant les migrations) :
  - **intégrité** : refuse tout enregistrement sans identifiant, ou sans campagne pour les tables qui appartiennent à une campagne (D-224) ;
  - **chiffrement** : scelle à l'écriture, vérifie et déchiffre à la lecture ; un enregistrement non authentique est signalé et lu comme absent, pour qu'une seule fiche abîmée ne bloque pas une campagne.
- Le navigateur est prié de ne jamais évincer les données (`navigator.storage.persist()`).
- Les campagnes enregistrées avant les comptes (base `codex`, non chiffrée) sont reprises et chiffrées dans le premier compte créé, puis la base en clair est supprimée ; en cas d'échec, rien n'est supprimé.

## 4. Vérifications automatiques

- Tests unitaires : primitives (altération d'un octet, mauvaise clé, mauvaises données associées), base chiffrée (contenu brut illisible, index déplacés détectés, requêtes composées, `modify`), comptes (anti-force-brute, récupération, changement de mot de passe, suppression), mots de passe, sauvegardes, assainissement des imports.
- Tests de bout en bout (`e2e/security.spec.ts`) : lecture brute de tout le stockage du navigateur sans trouver ni campagne, ni personnage, ni mot de passe ; fenêtre joueurs verrouillée avec le MJ ; **build de production sous sa CSP sans aucune violation**, requête réseau effectivement bloquée.
- `npm audit` : aucune vulnérabilité connue dans les dépendances au 12 octobre 2026.

## 5. Signaler un problème

Codex n'envoie rien : un problème de sécurité se signale directement au mainteneur du dépôt, sans publier de détail exploitable avant correction.
