# Codex — notes for Claude

Local-first GM companion for a homebrew D&D-like RPG. **The full product spec is [docs/SPEC.md](docs/SPEC.md)** — read the relevant sections before starting a phase. Technical and UX decisions not covered by the spec are logged in [docs/DECISIONS.md](docs/DECISIONS.md); add an entry whenever you make one.

## Working rules (from the spec)

- Work phase by phase (SPEC §12). End of phase = tests green, app launches, one clear git commit, then a summary of done / remaining.
- Every game rule (formulas, rounding, thresholds) lives in `src/rules/` and is configurable per campaign. Never hard-code a rule in a component.
- **Everything belongs to its campaign (D-224):** characters, skills, conditions, bestiary templates, item library, rolls, maps and images. Nothing is shared between campaigns.
- **Codex imposes no mechanic (D-217).** Any new optional mechanic ships disabled (0 / empty / false) and its UI stays hidden until the GM enables it in Préparation › Règles. Only the rules the GM confirmed (D-101) are on by default. Tests of optional mechanics use `configuredRules()` from `src/test/fixtures.ts`.
- Write tests with the code, not after.
- Code and comments in English. **All UI text in French**, through `src/i18n/locales/fr.ts` (typed: `const t = useT(); t.nav.players`). Address the GM with « tu ».
- During play: no blocking modals (except delete confirmations) — use drawers and toasts.
- **Art direction: [docs/CODEX-DA.md](docs/CODEX-DA.md)** (« Codex à la chandelle »). Every UI change follows it: tokens only (no raw colours outside `boardTheme.ts` and illustrations), type styles (`type-screen-title`, `type-eyebrow`, `type-section`…), glass only over the board, ornaments only where §6 allows. Gaps and deviations are logged in DECISIONS (D-235–238).

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
| `npm run test:perf`                  | 200-token map FPS measurement (run alone)             |
| `npm run screens`                    | Screenshots of the main screens, both themes          |

## Architecture

- `src/rules/` — **every house rule** (config + pure functions: stats, HP, skills, checks, grid). `DEFAULT_RULES` holds the GM's confirmed rules (DECISIONS D-101); each campaign stores its own copy (`campaign.rules`, read with `useCampaign().rules`).
- `src/domain/` — pure game model: `types.ts` (Entity union by `kind`), `entity.ts` (factories, derived values, numbered enemy copies), `discord.ts` (Discord sheet export/import).
- `src/dice/` — dice notation parser and roller (`roll('2d20kh1+3', { rng, rounding })`), seeded rng for tests.
- `src/domain/` also holds gameplay rules on data: `items.ts` (equipment, weight, money), `conditions.ts` (library, `startOfTurn`), `progress.ts` (XP, luck, rests, skills), `checks.ts` (`performCheck`, opposed, quick HP input).
- `src/features/game/gameActions.ts` — every in-play action (checks, damage, turns, skills, items…): records rolls, applies effects as ONE undoable change, triggers toasts/visual effects. UI calls it through `useGameActions()`.
- Skills are campaign entities (D-218): `src/domain/skills.ts` (attach / sync / adopt); the library lives in `useCampaignStore().skills` next to the characters so edits are undoable together. Characters hold synced copies (`skill.sourceId`).
- Play mode (D-226/227): `src/domain/turns.ts` (groups, turn order, GM turn — pure), state in `useCampaignStore().play` (undoable, saved on the campaign record); UI in `src/features/play/` (`TurnBanner`, `GroupsPanel`, `QuickPanel`). Phase 3 combat/initiative of the spec is abandoned.
- Maps (D-228–233): `src/domain/maps.ts` (grid square/hex, fog, walls, line of sight, areas — pure), maps in `useCampaignStore().maps` (undoable), images in the `assets` table. Canvas = Konva in `src/features/maps/` (`MapCanvas`, lazy-loaded: never import it from eagerly loaded modules; shared constants live in `dragTypes.ts` / `mapGeometry.ts`). View state (tool, camera, selection) in `src/stores/mapViewStore.ts`. In-play map actions in `src/features/game/mapActions.ts`. The players' window (`#/c/:id/view`) reads Dexie live and gets camera/pings via `BroadcastChannel` — it never loads the campaign store. Konva cannot render in jsdom: test the canvas in e2e (DEV hook `window.__codexMap`).
- `src/features/characters/` — sheets, creation wizard, bestiary, Discord import. Sheet edits go through `useSheetEditor` (one undo entry + journal line per edit).
- `src/app/` — providers (`AppProviders`), routes (hash router, Tauri-friendly), preference effects.
- `src/features/<domain>/` — screens and domain components (campaigns, shell, prep, play, settings).
- `src/components/ui/` — generic accessible primitives on top of Radix (Button, Dialog, SegmentedControl…).
- `src/db/` — Dexie schema, v7 (+ `maps`, `assets`; v6 added `skills`, bestiary & items per campaign): campaigns (+ library), entities, per-campaign bestiary and item library, rolls (`db.ts`, never edit an existing `version()` block, add a new one + migration test) and repositories.
- `src/stores/` — Zustand stores. `history.ts` is the undo/redo middleware (`createHistory` + `withHistory`) every game-action store must use. `campaignStore.ts` holds the open campaign's characters in memory (source of truth) and auto-saves them to Dexie; call `flushAutosave()` before reading Dexie directly.
- `src/styles/tokens.css` — design tokens of the DA (`--codex-*`, light and dark), mapped to Tailwind utilities in `index.css` (`bg-surface`, `text-ink-muted`, `bg-stat-strength-soft`, `border-rarity-legendary`…). Coloured text always uses a `*-text` token, pill backgrounds a `*-soft` token. Type styles and `codex-glass` live in `index.css`. The board's colours are literals in `src/features/maps/boardTheme.ts` (canvas cannot read CSS variables); board icons are Lucide paths in `boardIcons.ts`; empty-state drawings in `src/components/illustrations.tsx`; ornaments in `src/components/Brand.tsx`.
- Theme: `useResolvedTheme()` (preparation theme, play screen forced dark by default, players' window always dark — D-235). Screens declare themselves with `useSurface('play' | 'players')`.
- Tests: unit/component tests sit next to the code (`*.test.ts(x)`); `src/test/renderApp.tsx` renders the whole app on a memory router; e2e in `e2e/`.
