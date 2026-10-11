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

- `src/app/` — providers (`AppProviders`), routes (hash router, Tauri-friendly), preference effects.
- `src/features/<domain>/` — screens and domain components (campaigns, shell, prep, play, settings).
- `src/components/ui/` — generic accessible primitives on top of Radix (Button, Dialog, SegmentedControl…).
- `src/db/` — Dexie schema (`db.ts`, never edit an existing `version()` block, add a new one + migration test) and repositories.
- `src/stores/` — Zustand stores. `history.ts` is the undo/redo middleware (`createHistory` + `withHistory`) every game-action store must use.
- `src/styles/tokens.css` — raw design tokens (`--codex-*`), mapped to Tailwind utilities in `index.css` (`bg-surface`, `text-ink-muted`, `bg-stat-strength`…). Use the `*-text` variants (`text-accent-text`, `text-gold-text`, `text-hp-text`) for coloured text so AA contrast holds in both themes.
- Tests: unit/component tests sit next to the code (`*.test.ts(x)`); `src/test/renderApp.tsx` renders the whole app on a memory router; e2e in `e2e/`.
