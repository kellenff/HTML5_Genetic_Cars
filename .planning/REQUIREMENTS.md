# Requirements — Milestone v1.0 Modern Tooling Refactor

**Milestone goal:** Replace the no-build static setup with Vite + Vitest + Yarn PnP while keeping simulation behavior identical.

## v1 Requirements

### Build Foundation

- [ ] **BUILD-01**: Developer can run `yarn dev` to start a Vite 6.x dev server at `localhost:5173` (replaces `python3 -m http.server`)
- [ ] **BUILD-02**: Developer can run `yarn build` to produce a production-ready bundle in `dist/`
- [ ] **BUILD-03**: Developer can run `yarn preview` to serve the production bundle locally and verify it works
- [ ] **BUILD-04**: Project uses Yarn 4.x Berry with PnP zero-installs — no `node_modules/` directory, `.yarn/cache/` committed to git
- [ ] **BUILD-05**: Cloning the repo and running `yarn install` (or `yarn`) succeeds without network access (zero-installs contract)
- [ ] **BUILD-06**: `dist/` and `node_modules/` are gitignored; `.yarn/cache/`, `.pnp.cjs`, `.pnp.loader.mjs`, `.yarn/releases/` are committed
- [ ] **BUILD-07**: `package.json` includes `dev`, `build`, `preview`, and `test` scripts

### Dependency Migration

- [ ] **DEP-01**: `lib/box2d.js` is loaded via an ESM wrapper that injects it as a classic `<script>` tag at runtime, keeping it outside Vite/esbuild's module graph
- [ ] **DEP-02**: All Box2D globals (`b2Vec2`, `b2World`, `b2BodyDef`, etc.) remain accessible to `src/app.js` after migration — simulation runs identically
- [ ] **DEP-03**: `lib/seedrandom.js` is imported as a side-effect module in `src/main.js` (replacing the `<script src="lib/seedrandom.js">` tag), with load order guaranteed before app.js
- [ ] **DEP-04**: CDN `<script>` tags for d3 v3 and vis 4.20.0 are removed from `index.html` (confirmed unused)
- [ ] **DEP-05**: CDN `<link>` stylesheet tag for vis CSS is removed from `index.html`
- [ ] **DEP-06**: `src/main.js` is the new Vite entry point — sequences seedrandom → box2d (async) → app.js in deterministic order
- [ ] **DEP-07**: `window.cw_setCameraTarget` remains accessible for the inline `onclick` handlers in `index.html` after migration

### Bug Fix (Required for Migration)

- [ ] **FIX-01**: `cw_runningInterval` is explicitly declared (`let cw_runningInterval`) in `src/app.js` — removes the implicit global that causes `ReferenceError` under Vite's strict-mode production build

### Test Foundation

- [ ] **TEST-01**: `vitest.config.js` (or `vitest.config.ts`) is configured with `jsdom` environment and Vitest globals enabled
- [ ] **TEST-02**: Developer can run `yarn test` to execute the test suite
- [ ] **TEST-03**: Test file exists covering the `random.js` section's pure functions — `createNormals`, `mapToFloat`, `mapToInteger`, `mapToShuffle`, `mutateReplace`
- [ ] **TEST-04**: Test file exists covering genome scoring logic from the `car-schema/run.js` section — score update and health decrement behavior
- [ ] **TEST-05**: Test suite passes (`yarn test` exits 0) — establishes baseline for future coverage

## Future Requirements

- Coverage reporting (v8 provider) — low value until test count grows
- TypeScript migration — enabled by this tooling foundation
- CI/CD pipeline — future milestone
- Splitting `src/app.js` into ES modules — separate refactor milestone; unlocks full testability

## Out of Scope

- Splitting `src/app.js` into multiple files — separate concern; this milestone is tooling only
- TypeScript strict checking — future milestone
- Changing simulation logic or behavior — pure tooling migration
- Legacy browser support (`@vitejs/plugin-legacy`) — not needed; modern browsers only
- Server-side rendering or edge deployment — static SPA only
- `vite-plugin-commonjs` or `@originjs/vite-plugin-commonjs` — abandoned/uncertain compat; ESM wrapper approach preferred

## Traceability

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| BUILD-01    | Phase 1 | Pending |
| BUILD-02    | Phase 1 | Pending |
| BUILD-03    | Phase 1 | Pending |
| BUILD-04    | Phase 1 | Pending |
| BUILD-05    | Phase 1 | Pending |
| BUILD-06    | Phase 1 | Pending |
| BUILD-07    | Phase 1 | Pending |
| DEP-01      | Phase 1 | Pending |
| DEP-02      | Phase 1 | Pending |
| DEP-03      | Phase 1 | Pending |
| DEP-04      | Phase 1 | Pending |
| DEP-05      | Phase 1 | Pending |
| DEP-06      | Phase 1 | Pending |
| DEP-07      | Phase 1 | Pending |
| FIX-01      | Phase 1 | Pending |
| TEST-01     | Phase 2 | Pending |
| TEST-02     | Phase 2 | Pending |
| TEST-03     | Phase 2 | Pending |
| TEST-04     | Phase 2 | Pending |
| TEST-05     | Phase 2 | Pending |
