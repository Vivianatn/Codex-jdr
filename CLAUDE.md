# Codex — notes for Claude

Local-first GM companion for a homebrew D&D-like RPG. **The full product spec is [docs/SPEC.md](docs/SPEC.md)** — read the relevant sections before starting a phase. Technical and UX decisions not covered by the spec are logged in [docs/DECISIONS.md](docs/DECISIONS.md); add an entry whenever you make one.

## Working rules (from the spec)

- Work phase by phase (SPEC §12). End of phase = tests green, app launches, one clear git commit, then a summary of done / remaining.
- Every game rule (formulas, rounding, thresholds) lives in `src/rules/` and is configurable per campaign. Never hard-code a rule in a component.
- Write tests with the code, not after.
- Code and comments in English. **All UI text in French**, through `src/i18n/locales/fr.ts` (typed: `const t = useT(); t.nav.players`). Address the GM with « tu ».
- During play: no blocking modals (except delete confirmations) — use drawers and toasts.

## Environment

- Node is a portable install at `%LOCALAPPDATA%\Programs\nodejs` (v24 LTS). In Git Bash, prefix commands with `export PATH="/c/Users/agath/AppData/Local/Programs/nodejs:$PATH"` if `node` is not found.
- React must stay on 18 (spec). React Router is pinned to v7 because v8 requires React 19. ESLint stays on v9 because `eslint-plugin-jsx-a11y` does not support v10 yet.

## Commands

| Command                              | Purpose                                               |
| ------------------------------------ | ----------------------------------------------------- |
| `npm run dev`                        | Dev server (http://localhost:5173)                    |
| `npm run build`                      | Typecheck + production build                          |
| `npm run typecheck` / `npm run lint` | `tsc -b` / ESLint (zero warnings allowed)             |
| `npm run test:unit`                  | Vitest, once (also runs in the pre-commit hook)       |
| `npm run test:e2e`                   | Playwright + axe (starts its own dev server on :4173) |

## Architecture

- `src/rules/` — **every house rule** (config + pure functions: stats, HP, skills, checks, grid). `DEFAULT_RULES` holds the GM's confirmed rules (DECISIONS D-101); each campaign stores its own copy (`campaign.rules`, read with `useCampaign().rules`).
- `src/domain/` — pure game model: `types.ts` (Entity union by `kind`), `entity.ts` (factories, derived values, numbered enemy copies), `discord.ts` (Discord sheet export/import).
- `src/dice/` — dice notation parser and roller (`roll('2d20kh1+3', { rng, rounding })`), seeded rng for tests.
- `src/domain/` also holds gameplay rules on data: `items.ts` (equipment, weight, money), `conditions.ts` (library, `startOfTurn`), `progress.ts` (XP, luck, rests, skills), `checks.ts` (`performCheck`, opposed, quick HP input).
- `src/features/game/gameActions.ts` — every in-play action (checks, damage, turns, skills, items…): records rolls, applies effects as ONE undoable change, triggers toasts/visual effects. UI calls it through `useGameActions()`.
- `src/features/characters/` — sheets, creation wizard, bestiary, Discord import. Sheet edits go through `useSheetEditor` (one undo entry + journal line per edit).
- `src/app/` — providers (`AppProviders`), routes (hash router, Tauri-friendly), preference effects.
- `src/features/<domain>/` — screens and domain components (campaigns, shell, prep, play, settings).
- `src/components/ui/` — generic accessible primitives on top of Radix (Button, Dialog, SegmentedControl…).
- `src/db/` — Dexie schema, v3: campaigns (+ library), entities, shared bestiary and item library, rolls (`db.ts`, never edit an existing `version()` block, add a new one + migration test) and repositories.
- `src/stores/` — Zustand stores. `history.ts` is the undo/redo middleware (`createHistory` + `withHistory`) every game-action store must use. `campaignStore.ts` holds the open campaign's characters in memory (source of truth) and auto-saves them to Dexie; call `flushAutosave()` before reading Dexie directly.
- `src/styles/tokens.css` — raw design tokens (`--codex-*`), mapped to Tailwind utilities in `index.css` (`bg-surface`, `text-ink-muted`, `bg-stat-strength`…). Use the `*-text` variants (`text-accent-text`, `text-gold-text`, `text-hp-text`) for coloured text so AA contrast holds in both themes.
- Tests: unit/component tests sit next to the code (`*.test.ts(x)`); `src/test/renderApp.tsx` renders the whole app on a memory router; e2e in `e2e/`.
