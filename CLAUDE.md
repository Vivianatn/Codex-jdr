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
- **No horizontal scrolling, ever (D-246):** everything is reachable as shown, from 390 px phones to desktops — wrap, stack or reflow instead of `overflow-x-auto`; a `<button>` used as a row needs `w-full`. `e2e/layout.spec.ts` checks every screen at six sizes.
- **Art direction: [docs/CODEX-DA.md](docs/CODEX-DA.md)** (« Codex à la chandelle »). Every UI change follows it: tokens only (no raw colours outside `boardTheme.ts` and illustrations), type styles (`type-screen-title`, `type-eyebrow`, `type-section`…), glass only over the board, ornaments only where §6 allows. Gaps and deviations are logged in DECISIONS (D-235–238).

## Environment

- Node is a portable install at `%LOCALAPPDATA%\Programs\nodejs` (v24 LTS). In Git Bash, prefix commands with `export PATH="/c/Users/agath/AppData/Local/Programs/nodejs:$PATH"` if `node` is not found.
- React must stay on 18 (spec). React Router is pinned to v7 because v8 requires React 19. ESLint stays on v9 because `eslint-plugin-jsx-a11y` does not support v10 yet.

## Commands

| Command                              | Purpose                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `npm run dev`                        | Dev server (http://localhost:5173)                                         |
| `npm run build`                      | Typecheck + production build                                               |
| `npm run typecheck` / `npm run lint` | `tsc -b` / ESLint (zero warnings allowed)                                  |
| `npm run test:unit`                  | Vitest, once (also runs in the pre-commit hook)                            |
| `npm run test:e2e`                   | Playwright + axe (dev server on :4173, production build with CSP on :4174) |
| `npm run test:perf`                  | 200-token map FPS measurement (run alone)                                  |
| `npm run screens`                    | Screenshots of the main screens, both themes                               |
| `npm run launch:check`               | Build + the 20-point launch checklist (D-248)                              |
| `npm run brand:assets`               | Regenerate favicons, social card, landing screenshot                       |

## Architecture

- **Public website + app (D-248)**: the public pages are plain HTML at the repo root (`index.html` landing, `confidentialite.html`, `cgu.html`, `mentions-legales.html`, `404.html`); the app lives at `/app/` (`app/index.html`). `site/plugin.ts` injects head/header/footer and `{{site.…}}` facts from `site/config.ts`, emits robots/sitemap and serves pretty URLs + the real 404 in dev/preview. Never invent legal facts: they stay `TO_FILL` until the GM gives them (`.env.production.local`). `scripts/launch-check.ts` + `e2e/site.spec.ts` check the 20 launch points: fix the site rather than weakening a check. Audience measurement: `src/lib/analytics.ts` (Umami, cookieless, opt-out). Deployment: `deploy/` (Caddy + Docker Compose), guide `docs/DEPLOIEMENT.md`. Online-with-server roadmap: D-249 (phases 7–10).

- `src/rules/` — **every house rule** (config + pure functions: stats, HP, skills, checks, grid). `DEFAULT_RULES` holds the GM's confirmed rules (DECISIONS D-101); each campaign stores its own copy (`campaign.rules`, read with `useCampaign().rules`).
- `src/domain/` — pure game model: `types.ts` (Entity union by `kind`), `entity.ts` (factories, derived values, numbered enemy copies), `discord.ts` (Discord sheet export/import).
- `src/dice/` — dice notation parser and roller (`roll('2d20kh1+3', { rng, rounding })`), seeded rng for tests.
- `src/domain/` also holds gameplay rules on data: `items.ts` (equipment, weight, money), `conditions.ts` (library, `startOfTurn`), `progress.ts` (XP, luck, rests, skills), `checks.ts` (`performCheck`, opposed, quick HP input).
- `src/features/game/gameActions.ts` — every in-play action (checks, damage, turns, skills, items…): records rolls, applies effects as ONE undoable change, triggers toasts/visual effects. UI calls it through `useGameActions()`.
- Skills are campaign entities (D-218): `src/domain/skills.ts` (attach / sync / adopt); the library lives in `useCampaignStore().skills` next to the characters so edits are undoable together. Characters hold synced copies (`skill.sourceId`).
- Play mode (D-226/227): `src/domain/turns.ts` (groups, turn order, GM turn — pure), state in `useCampaignStore().play` (undoable, saved on the campaign record); UI in `src/features/play/` (`TurnBanner`, `GroupsPanel`, `QuickPanel`). Phase 3 combat/initiative of the spec is abandoned.
- Maps (D-228–233): `src/domain/maps.ts` (grid square/hex, fog, walls, line of sight, areas — pure), maps in `useCampaignStore().maps` (undoable), images in the `assets` table. Canvas = Konva in `src/features/maps/` (`MapCanvas`, lazy-loaded: never import it from eagerly loaded modules; shared constants live in `dragTypes.ts` / `mapGeometry.ts`). View state (tool, camera, selection) in `src/stores/mapViewStore.ts`. In-play map actions in `src/features/game/mapActions.ts`. The players' window (`#/c/:id/view`) reads Dexie live and gets camera/pings via `BroadcastChannel` — it never loads the campaign store. Konva cannot render in jsdom: test the canvas in e2e (DEV hook `window.__codexMap`).
- Sessions & live game (D-244): `src/domain/sessions.ts` (plans = former quests, runs), `src/db/sessions.ts`, UI in `src/features/sessions/`. `play.live` = game in progress with ONE operator; `createLiveActions` starts/ends/hands over (clears undo history). The play screen shows `StartPlayPanel` until someone starts; non-operators get an `inert` table. Unit tests use `startLocalGame()` (fixtures), e2e `startGame()`.
- Activity log (D-247): `src/domain/activity.ts` (merge rule, host-side validation — pure), `src/stores/activityLog.ts` (`recordActivity`, `withActivityAuthor`), table `activity`. Every `campaignHistory` change/undo/redo is logged automatically (`history.onEvent`); writes that bypass the store (repositories, campaign record) call `recordActivity(campaignId, label)` themselves. Synced to editors only; the host accepts only lines signed by the sending editor. Shown on the dashboard (`src/features/prep/DashboardPage.tsx`).
- Online mode (D-245): `src/online/` — WebRTC peer-to-peer, no server, codes swapped by hand (`signaling.ts`, `rtc.ts`, `link.ts`). `HostSession` (owner, source of truth: filtered sync via `projection.ts` + `Replica` diffs, validates editors' writes, plays players' intents), `GuestSession` (temporary encrypted copy made active with `enterRemoteDb`), `controller.ts` (the device's single session; locking ends it). Writes are observed through `db.onChanges` (change-feed middleware; `markRemote(tx.idbtrans)` for received ones); stores take peers' changes with `applyExternalChanges` / `applyExternalRolls`. Unit-test with `memoryLinkPair()`; `e2e/online.spec.ts` runs real WebRTC between browser contexts.
- `src/features/characters/` — sheets, creation wizard, bestiary, Discord import. Sheet edits go through `useSheetEditor` (one undo entry + journal line per edit).
- `src/app/` — providers (`AppProviders`), routes (hash router, Tauri-friendly), preference effects.
- `src/features/<domain>/` — screens and domain components (campaigns, shell, prep, play, settings).
- `src/components/ui/` — generic accessible primitives on top of Radix (Button, Dialog, SegmentedControl…).
- `src/db/` — Dexie schema, v10 (+ `activity`; v9 added `sessions`, `sessionRuns`; v8 only queried indexes, `backups`; v7 added `maps`, `assets`): campaigns (+ library), entities, per-campaign bestiary and item library, rolls (`db.ts`, never edit an existing `version()` block, add a new one + migration test) and repositories. **One encrypted database per account (D-241/242): always reach it through `activeDb()`** (throws while locked); repositories take a `() => CodexDB` accessor. `middleware.ts` = integrity guard + record encryption under every table; index fields stay in clear, so never index a name or free text. `backups.ts` = daily encrypted snapshots; `sanitize.ts` = import hardening (D-243).
- `src/security/` — local accounts (`accounts.ts`: password/recovery key wrapping, throttling, legacy migration), crypto primitives (`crypto.ts`: XChaCha20-Poly1305 via `@noble/ciphers`, PBKDF2 via WebCrypto), password rules, session (`session.ts`: key in memory only, `lockSession()` wipes it) and the players' window hand-off (`sessionChannel.ts`). Threat model: [docs/SECURITE.md](docs/SECURITE.md). UI in `src/features/account/` (`LockScreen`, `SessionGate`, settings sections). Unit tests run unlocked on a plain DB (`src/test/setup.ts`); e2e scenarios call `createAccount()` / `reloadAndUnlock()` and read data through the DEV hook `window.__codexDb` (`dumpTable`, `putRows`).
- `src/stores/` — Zustand stores. `history.ts` is the undo/redo middleware (`createHistory` + `withHistory`) every game-action store must use. `campaignStore.ts` holds the open campaign's characters in memory (source of truth) and auto-saves them to Dexie; call `flushAutosave()` before reading Dexie directly.
- `src/styles/tokens.css` — design tokens of the DA (`--codex-*`, light and dark), mapped to Tailwind utilities in `index.css` (`bg-surface`, `text-ink-muted`, `bg-stat-strength-soft`, `border-rarity-legendary`…). Coloured text always uses a `*-text` token, pill backgrounds a `*-soft` token. Type styles and `codex-glass` live in `index.css`. The board's colours are literals in `src/features/maps/boardTheme.ts` (canvas cannot read CSS variables); board icons are Lucide paths in `boardIcons.ts`; empty-state drawings in `src/components/illustrations.tsx`; ornaments in `src/components/Brand.tsx`.
- Theme: `useResolvedTheme()` (preparation theme, play screen forced dark by default, players' window always dark — D-235). Screens declare themselves with `useSurface('play' | 'players')`.
- Tests: unit/component tests sit next to the code (`*.test.ts(x)`); `src/test/renderApp.tsx` renders the whole app on a memory router; e2e in `e2e/`.
