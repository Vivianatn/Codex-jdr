# Notice de confidentialité de Codex

_Dernière mise à jour : 12 octobre 2026 (comptes et chiffrement)._

Codex est un compagnon de maître de jeu qui fonctionne **entièrement hors ligne**. Cette notice explique quelles données il conserve, où, et comment tu gardes la main dessus, conformément au Règlement général sur la protection des données (RGPD, règlement UE 2016/679).

## 1. Qui traite les données ?

Codex n'a ni serveur, ni compte en ligne : ton compte n'existe que sur ton appareil. Son éditeur **ne reçoit, ne voit et ne stocke aucune donnée**. Tout reste sur l'appareil où Codex est ouvert.

Si tu utilises Codex pour ta table, **tu es responsable des données que tu y saisis**, en particulier celles qui concernent d'autres personnes (tes joueurs).

## 2. Quelles données sont conservées ?

| Donnée                                                                          | Où                                    | Pourquoi                        |
| ------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------- |
| Nom du compte (prénom ou pseudo), données de connexion chiffrées                | Base locale du navigateur (IndexedDB) | Te connecter                    |
| Campagnes, personnages, compétences, objets, bestiaire, notes                   | Base locale du navigateur (IndexedDB) | Faire fonctionner l'application |
| Historique des jets de dés                                                      | IndexedDB                             | Journal de partie               |
| Journal des modifications : nom de compte de qui a modifié quoi, et quand       | IndexedDB                             | Tableau de bord de la campagne  |
| Cartes et images importées (portraits, fonds de carte)                          | IndexedDB                             | Plateau et fiches               |
| Réglages d'affichage (thème, taille du texte, animations, dernier écran ouvert) | `localStorage` du navigateur          | Retrouver tes préférences       |

Codex n'utilise **aucun cookie, aucune mesure d'audience, aucun traceur, aucune police ou ressource chargée depuis Internet**. Hors mode en ligne, il ne se connecte à rien.

La fenêtre « Vue joueurs » communique avec l'écran du MJ par un canal local au navigateur (`BroadcastChannel`) ; rien ne sort de l'appareil.

### Mode en ligne

Quand tu ouvres une campagne en ligne ou rejoins celle de quelqu'un, les appareils communiquent **directement entre eux**, chiffrés, sans serveur de Codex :

- le MJ envoie aux éditeurs toute la campagne partagée, et aux joueurs seulement ce qu'ils peuvent voir à la table ;
- chacun voit le nom de compte des autres participants ;
- les éditeurs voient le journal des modifications (qui a modifié quoi, et quand) ; les joueurs ne le reçoivent jamais ;
- les appareils échangent leurs **adresses IP** pour se connecter ; un serveur STUN public (par défaut celui de Google, modifiable ou désactivable dans les Paramètres) les voit aussi, jamais les données ;
- la copie reçue par un invité est temporaire, chiffrée, et supprimée quand il quitte la partie.

Le MJ qui partage sa campagne reste responsable de ce qu'il partage : n'invite que des personnes que tu connais.

## 3. Données sur de vraies personnes

Une fiche peut contenir le prénom ou le pseudo Discord d'un joueur, ou un portrait. Dans ce cas :

- informe tes joueurs que ces informations sont notées dans Codex ;
- n'enregistre que ce qui est utile au jeu ;
- supprime-les quand la campagne est terminée ou si un joueur le demande.

## 4. Durée de conservation

Les données restent sur l'appareil tant que tu ne les supprimes pas. Vider les données du site dans le navigateur les supprime aussi.

## 5. Tes droits et comment les exercer

Tout se fait dans **Paramètres › Données et confidentialité** :

- **Accès et portabilité** : « Tout exporter » télécharge une archive JSON lisible contenant toutes les campagnes. Elle se réimporte depuis l'écran Campagnes, sur cet appareil ou un autre.
- **Rectification** : toutes les données se modifient directement dans l'application.
- **Effacement** : supprimer une campagne efface tout ce qui lui appartient ; « Tout effacer » supprime définitivement les campagnes et sauvegardes du compte ; « Supprimer le compte » (Paramètres › Compte) efface le compte et sa base entière.

## 6. Sécurité

Tes données sont **chiffrées** sur l'appareil avec une clé que seul ton mot de passe (ou ton code de secours) permet d'ouvrir ; Codex se verrouille après une période d'inactivité. Le détail est dans [SECURITE.md](SECURITE.md).

Les fichiers exportés, eux, ne sont pas chiffrés : ils quittent la protection de l'application, range-les en lieu sûr. Sans mot de passe ni code de secours, personne — pas même l'éditeur de Codex — ne peut récupérer les données.

## 7. Réclamation

En France, tu peux saisir la CNIL (<https://www.cnil.fr>) pour toute question sur la protection des données.
