# Notice de confidentialité de Codex

_Dernière mise à jour : 13 octobre 2026 (compte en ligne, D-262). La version publique, qui fait foi, est la page `confidentialite.html` du site._

Codex est un compagnon de maître de jeu qui fonctionne **hors ligne**, et en ligne si tu relies ton compte à un compte en ligne. Cette notice explique quelles données il conserve, où, et comment tu gardes la main dessus, conformément au Règlement général sur la protection des données (RGPD, règlement UE 2016/679).

## 1. Qui traite les données ?

Sans compte en ligne, ton compte n'existe que sur ton appareil : l'éditeur de Codex **ne reçoit aucune donnée**. Avec un compte en ligne, l'éditeur (voir les mentions légales) héberge ton compte et tes campagnes en ligne sur son serveur, chez PulseHeberg, dans l'Union européenne.

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

Codex n'utilise **aucun traceur ni cookie publicitaire, aucune police ou ressource chargée depuis un tiers**. Le seul cookie est celui de la session du compte en ligne (indispensable). La mesure d'audience du site est anonyme et sans cookie.

La fenêtre « Vue joueurs » communique avec l'écran du MJ par un canal local au navigateur (`BroadcastChannel`) ; rien ne sort de l'appareil.

### Compte en ligne (D-257, D-262)

Quand tu relies ton compte à un compte en ligne :

- le serveur garde ton **adresse e-mail**, ton **nom affiché**, l'empreinte de ton mot de passe (scrypt, jamais le mot de passe), et tes dates d'inscription et de dernière connexion ;
- tes campagnes y sont copiées, **chiffrées** par le serveur ; il peut techniquement les lire, pour les synchroniser et contrôler qui y a accès ;
- le MJ et ses co-MJ voient toute la campagne et le journal des modifications ; un joueur ne reçoit, pendant une partie, que ce qui est visible à la table, dans une copie temporaire effacée quand il la quitte ;
- les membres d'une campagne voient le nom affiché des autres et qui est connecté ;
- l'adresse e-mail ne sert qu'à te connecter et à recevoir le lien de réinitialisation du mot de passe.

Le MJ qui invite des joueurs reste responsable de ce qu'il partage : n'accepte que des personnes que tu connais.

## 3. Données sur de vraies personnes

Une fiche peut contenir le prénom ou le pseudo Discord d'un joueur, ou un portrait. Dans ce cas :

- informe tes joueurs que ces informations sont notées dans Codex ;
- n'enregistre que ce qui est utile au jeu ;
- supprime-les quand la campagne est terminée ou si un joueur le demande.

## 4. Durée de conservation

Les données restent sur l'appareil tant que tu ne les supprimes pas. Vider les données du site dans le navigateur les supprime aussi. Sur le serveur : jusqu'à la suppression du compte en ligne (effacement immédiat, sauvegardes effacées sous 14 jours) ; un compte inutilisé pendant 3 ans est supprimé ; un lien de réinitialisation vaut une heure.

## 5. Tes droits et comment les exercer

Tout se fait dans **Paramètres › Données et confidentialité** :

- **Accès et portabilité** : « Tout exporter » télécharge une archive JSON lisible contenant toutes les campagnes. Elle se réimporte depuis l'écran Campagnes, sur cet appareil ou un autre.
- **Rectification** : toutes les données se modifient directement dans l'application.
- **Effacement** : supprimer une campagne efface tout ce qui lui appartient (sur le serveur aussi si tu en es le MJ) ; « Tout effacer » supprime définitivement les campagnes et sauvegardes du compte ; « Supprimer le compte » (Paramètres › Compte) efface le compte et sa base entière ; « Supprimer mon compte en ligne » efface le compte du serveur avec les campagnes dont tu es le MJ.

## 6. Sécurité

Tes données sont **chiffrées** sur l'appareil avec une clé que seul ton mot de passe (ou ton code de secours) permet d'ouvrir ; Codex se verrouille après une période d'inactivité. Le détail est dans [SECURITE.md](SECURITE.md).

Sur le serveur : HTTPS, campagnes chiffrées au repos (AES-256-GCM), mots de passe en empreinte scrypt, cookie de session inaccessible aux scripts. Les fichiers exportés, eux, ne sont pas chiffrés : ils quittent la protection de l'application, range-les en lieu sûr.

## 7. Réclamation

En France, tu peux saisir la CNIL (<https://www.cnil.fr>) pour toute question sur la protection des données.
