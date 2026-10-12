# Codex

Le compagnon du Maître du Jeu : un logiciel **local-first** pour préparer et mener des parties de jeu de rôle (système maison inspiré de _Donjons & Dragons_). Toutes les données restent sur ton appareil, dans le navigateur (IndexedDB). Tu peux exporter une campagne en JSON à tout moment.

> État : **phase 4 — plateau** terminée, avec les mini-fiches en jeu et la direction artistique « Codex à la chandelle » ([docs/CODEX-DA.md](docs/CODEX-DA.md)) : préparation ivoire et or, mode En jeu sombre « à la lueur des bougies », plateau, vue joueurs, états vides illustrés. Voir [DECISIONS](docs/DECISIONS.md) D-228 à D-238.

## Démarrer

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Commande            | Rôle                                                    |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Serveur de développement                                |
| `npm run build`     | Vérification des types et build de production (`dist/`) |
| `npm run preview`   | Sert le build de production                             |
| `npm run lint`      | ESLint (aucun avertissement toléré)                     |
| `npm run typecheck` | TypeScript strict                                       |
| `npm run test:unit` | Tests unitaires et de composants (Vitest)               |
| `npm run test:e2e`  | Tests end-to-end et accessibilité (Playwright + axe)    |
| `npm run test:perf` | Mesure d’images/s du plateau avec 200 jetons            |
| `npm run screens`   | Captures des écrans principaux, thèmes clair et sombre  |
| `npm run format`    | Prettier                                                |

Le hook de pre-commit (Husky) lance le lint, la vérification des types et les tests unitaires.

Première exécution des tests e2e : `npx playwright install chromium`.

## Documentation

- [Cahier des charges](docs/SPEC.md)
- [Journal des décisions](docs/DECISIONS.md)
- [Direction artistique](docs/CODEX-DA.md)
- [Notice de confidentialité (RGPD)](docs/CONFIDENTIALITE.md)
- [Sécurité : comptes, chiffrement, modèle de menace](docs/SECURITE.md)

## Crédits

- Polices : [Alegreya et Alegreya SC](https://www.huertatipografica.com/en/fonts/alegreya-ht-pro) (Huerta Tipográfica) et [Source Sans 3](https://github.com/adobe-fonts/source-sans) (Adobe), SIL Open Font License, embarquées hors ligne.
- Icônes d'interface : [Lucide](https://lucide.dev) (ISC).
