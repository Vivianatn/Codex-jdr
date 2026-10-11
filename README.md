# Codex

Le compagnon du Maître du Jeu : un logiciel **local-first** pour préparer et mener des parties de jeu de rôle (système maison inspiré de _Donjons & Dragons_). Toutes les données restent sur ton appareil, dans le navigateur (IndexedDB). Tu peux exporter une campagne en JSON à tout moment.

> État : **phase 4 — plateau** terminée : cartes à grille carrée ou hexagonale, image de fond, décor, murs et portes, objets interactifs (coffres, pièges, leviers, passages, PNJ), brouillard de guerre, zones d’effet, mesures et vue joueurs sur un second écran (voir [DECISIONS D-228 à D-233](docs/DECISIONS.md)). Les tours par groupes (phase 3) remplacent le suivi de combat du cahier des charges.

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
| `npm run format`    | Prettier                                                |

Le hook de pre-commit (Husky) lance le lint, la vérification des types et les tests unitaires.

Première exécution des tests e2e : `npx playwright install chromium`.

## Documentation

- [Cahier des charges](docs/SPEC.md)
- [Journal des décisions](docs/DECISIONS.md)

## Crédits

- Polices : [Inter](https://rsms.me/inter/) et [Cinzel](https://fonts.google.com/specimen/Cinzel) (SIL Open Font License).
- Icônes d'interface : [Lucide](https://lucide.dev) (ISC).
