# Project Research Summary

**Project:** HTML5 Genetic Cars — Vite + Vitest + Yarn PnP Tooling Migration (v1.0)
**Domain:** Legacy static vanilla JS browser app — modern build tooling migration
**Researched:** 2026-03-26
**Confidence:** HIGH (stack verified against npm registry and local working projects; architecture derived from direct codebase inspection)

## Executive Summary

This milestone is a pure tooling migration: the HTML5 Genetic Cars simulation (a 2200-line IIFE in `src/app.js` driving Box2D physics + a genetic algorithm) currently runs as a static browser app loaded by raw `<script>` tags. The goal is to introduce Vite 6 as the dev server and build pipeline, Vitest 4 as the test framework, and Yarn Berry (PnP, zero-installs) as the package manager — without changing any simulation behavior. No app code changes. No module splitting. The existing codebase is the constraint, and every tooling decision flows from that constraint.

The recommended approach is a strict sequential migration in two phases. Phase 1 wires the full Vite + Yarn PnP foundation: delete stale `node_modules`, initialize Yarn PnP with zero-installs, create `vite.config.js`, create a new `src/main.js` module entry point that controls load order (seedrandom first, then box2d globals via ESM wrapper, then the app IIFE), and update `index.html` to use a single `<script type="module">` tag. Phase 2 adds Vitest with a jsdom environment scoped exclusively to pure GA/ML functions — the IIFE cannot be directly imported into tests because it self-executes with hard canvas and DOM dependencies. The correct test boundary is pure logic functions only.

The primary risk in this migration is `lib/box2d.js`: it uses a bare `exports.*` CJS guard pattern that esbuild may mishandle, potentially binding all `b2*` constructors to an internal shim instead of `window`. The proven mitigation is to serve box2d.js as a classic script injected via a blob URL (the ESM wrapper pattern — see STACK.md), keeping it outside Vite's module graph entirely. Secondary risks are load order races (seedrandom must be first), a brief timing gap where `window.cw_setCameraTarget` is undefined before the module loads, and git repository bloat from platform-specific binary zips in `.yarn/cache/`. All of these have documented prevention strategies that must be applied in Phase 1 before any other work proceeds.

## Key Findings

### Recommended Stack

The stack is lean: Vite 6.4.1 + Vitest 4.1.2 + Yarn 4.13.0 (Berry/PnP). These three versions are verified compatible — Vitest 4.x declares an explicit peer dependency on `vite@^6.0.0 || ^7.0.0 || ^8.0.0`, and the local `grocy` project on this machine runs the identical Yarn + Vite + Vitest combination with PnP zero-installs. Vite 8 (released 2026-03-12) is explicitly excluded because it ships rolldown@1.0.0-rc.12, which is still a release candidate. jsdom 29.0.1 is the DOM environment for Vitest; happy-dom is excluded because its Canvas API implementation is incomplete and `src/app.js` touches canvas code paths.

**Core technologies:**

- **Vite 6.4.1:** Dev server + build pipeline — stable rollup 4 + esbuild 0.25; Vite 8 excluded (rolldown RC)
- **Vitest 4.1.2:** Unit test framework — Vite-native, same esbuild pipeline; only version compatible with Vite 6
- **Yarn 4.13.0 (Berry):** Package manager with PnP zero-installs — contributors clone and run without `yarn install`
- **jsdom 29.0.1:** DOM environment for Vitest — mature canvas stub, handles `window`, `document`, `localStorage`
- **@vitest/coverage-v8 4.1.2:** Coverage reporting — must match Vitest version exactly; add when test suite reaches meaningful size

The critical Vite configuration for this project is `optimizeDeps.exclude` for both `lib/box2d.js` and `lib/seedrandom.js`, combined with the ESM wrapper (`src/lib/box2d-init.js`) that injects box2d as a classic script. This is a zero-dependency solution that sidesteps esbuild's CJS detection entirely. See STACK.md for full `vite.config.js`, `vitest.config.js`, and `.yarnrc.yml` configurations.

### Expected Features

This is a tooling milestone. "Features" are developer-facing capabilities. All must function before the milestone is complete.

**Must have (table stakes — P1):**

- `yarn dev` starts Vite dev server, page loads, simulation runs, auto-reloads on file save
- `yarn build` produces a working `dist/` static SPA
- `yarn test` runs Vitest and passes tests for pure functions (random, createInstance)
- CDN `<script>` tags removed from `index.html` (d3 v3, vis 4.20.0 — confirmed unused)
- box2d.js CJS compat resolved (no `b2Vec2 is not defined` errors)
- seedrandom.js side-effect import in correct load order
- `window.cw_setCameraTarget` preserved as a global in both dev and build modes
- Yarn PnP zero-installs: `.yarn/cache` committed, `node_modules` absent
- Vitest with jsdom environment + `globals: true`
- Vitest setup file for global side-effects (seedrandom, box2d)
- Simulation behavior identical to pre-migration (terrain, physics, GA progression)

**Should have (differentiators — P2):**

- Yarn SDK setup for VSCode (`yarn dlx @yarnpkg/sdks vscode`)
- `server.open: true` in Vite config (browser opens automatically)
- Build sourcemaps enabled
- Vitest coverage via `@vitest/coverage-v8`

**Defer (v2+):**

- TypeScript migration — its own milestone; Vite foundation enables it
- Vitest browser mode — still experimental as of research date
- CI pipeline with `yarn test` + `yarn build` on push
- E2E tests with Playwright

**Anti-features (explicitly excluded):**

- Legacy browser transpilation (`@vitejs/plugin-legacy`) — modern browsers only, per project constraints
- TypeScript compilation — out of scope for this milestone
- CSS modules / PostCSS — `styles.css` is plain CSS, no processing needed
- Box2d.js npm replacement — behavior change risk; keep vendored `lib/box2d.js`

### Architecture Approach

The migration is a delivery mechanism change only — `src/app.js` is untouched. The key architectural addition is `src/main.js`: a new ES module entry point that replaces all five `<script>` tags in `index.html` with a single `<script type="module">`. This module controls load order deterministically via import declaration order: seedrandom (side-effect import, patches `Math`) → box2d (loaded as classic script via blob URL, globals land on `window`) → app.js (IIFE executes, reads globals). The IIFE's `window.cw_setCameraTarget` assignment at line 2203 is preserved; camera buttons need a `disabled` guard during the module loading window to prevent a race condition.

**Major components:**

1. **`src/main.js` (new)** — Module entry point; import orchestration; controls load order; re-exposes box2d globals
2. **`src/lib/box2d-init.js` (new)** — ESM wrapper that injects box2d.js as a classic script via blob URL; prevents esbuild CJS misdetection
3. **`package.json` + `vite.config.js` + `vitest.config.js` (new)** — Tooling configuration; Yarn PnP, Vite SPA, Vitest jsdom
4. **`.yarn/` directory (new, committed)** — Zero-install artifacts: `releases/` (Yarn binary), `cache/` (package zips), `.pnp.cjs`
5. **`src/__tests__/` (new)** — Vitest test files; pure function tests only; never imports `src/app.js` directly
6. **`index.html` (modified)** — Remove 5 script tags, add 1 module script; remove unused CDN CSS link

### Critical Pitfalls

1. **box2d.js CJS transform failure** — esbuild detects the `if(typeof exports !== "undefined") { exports.b2* = ... }` pattern and may inject a CJS shim, binding all `b2*` constructors to the shim's `exports` object instead of `window`. Prevention: use the ESM wrapper (`src/lib/box2d-init.js`) with `?url` import + classic script injection, combined with `optimizeDeps.exclude`. Verify with `typeof b2Vec2 === 'function'` in the browser console after `yarn dev`.

2. **seedrandom.js load order race** — `src/app.js` calls `Math.seedrandom()` at multiple points; if seedrandom hasn't patched `Math` yet, all calls throw `TypeError: Math.seedrandom is not a function`. Prevention: import seedrandom as the absolute first line of `src/main.js`. Verify by hard-refreshing and confirming terrain is deterministic across reloads.

3. **Vite dev vs. production build divergence** — `cw_runningInterval` is assigned without `var` in `src/app.js` (line ~1477), creating an implicit global. Dev mode tolerates this; Rollup's strict-mode production bundle throws `ReferenceError`. Prevention: add `var cw_runningInterval;` declaration before using it, and always run `vite build && vite preview` as the acceptance test — never just `vite dev`.

4. **Vitest crashes importing the IIFE** — `src/app.js` self-executes on import, immediately calling `cw_init()` which accesses 30+ DOM elements and calls `canvas.getContext('2d')`. jsdom does not implement Canvas 2D Context, so this throws `TypeError: Cannot read properties of null (reading 'getContext')`. Prevention: never import `src/app.js` in any test file. Scope all Vitest tests to pure GA/ML functions only.

5. **`.yarn/cache` binary bloat in git** — Vite pulls in esbuild (a Go binary, ~5MB per platform) and Rollup (Rust/WASM, ~3MB). Committing these inflates the initial cache commit and every future upgrade adds to git history permanently (requires `git filter-repo` to remove). Prevention: add `.yarn/cache/@esbuild-*` and `.yarn/cache/@rollup-*` to `.gitignore` before the first cache commit. Run `du -sh .yarn/cache/` after install; it should be under 30MB.

## Implications for Roadmap

Based on research, the migration splits naturally into two sequential phases with a hard dependency boundary between them. Phase 1 must be fully working (smoke-tested, production-built) before Phase 2 begins.

### Phase 1: Vite Foundation + Yarn PnP Setup

**Rationale:** Everything else depends on the module graph being correctly wired. All 8 critical pitfalls identified in Phase 1 must be resolved before tests can be written or the build can be trusted. This phase has the most risk and the most precise sequencing requirements.
**Delivers:** Working `yarn dev`, working `yarn build && yarn preview`, Yarn PnP zero-installs committed, CDN scripts removed, simulation behavior identical to pre-migration.
**Addresses:** All P1 table-stakes features: Vite dev server, `vite build` SPA output, CDN removal, box2d CJS compat, seedrandom side-effect import, `window.cw_setCameraTarget` global, Yarn PnP zero-installs, `package.json` scripts.
**Avoids:** Pitfalls 1 (box2d CJS), 2 (seedrandom order), 3 (dev/build divergence), 4 (double-evaluation of box2d), 5 (`cw_runningInterval` implicit global), 6 (Yarn PnP esbuild binary), 7 (`.yarn/cache` git bloat).
**Required sub-steps (in order):**

1. Delete `node_modules/`, create `package.json`
2. Initialize Yarn PnP (corepack enable → yarn set version 4.13.0 → yarn install)
3. Audit and configure `.gitignore` for `.yarn/cache` before first commit
4. Create `vite.config.js` + `vitest.config.js` with `optimizeDeps.exclude` for lib files
5. Create `src/lib/box2d-init.js` (ESM wrapper)
6. Create `src/main.js` (import orchestration: seedrandom → box2d → app)
7. Modify `index.html` (remove 5 script tags, add 1 module script; remove vis CSS link)
8. Fix `cw_runningInterval` undeclared variable in `src/app.js`
9. Smoke test: `yarn dev` → verify simulation runs, terrain deterministic, camera buttons work
10. Acceptance test: `yarn build && yarn preview` → verify production build passes

### Phase 2: Vitest Test Foundation

**Rationale:** Tests are written after the build works, not before. Writing tests against a broken module graph wastes effort. Phase 1's working module graph is the prerequisite.
**Delivers:** Working `yarn test` with passing tests for pure GA/ML functions; Vitest infrastructure that future test suites can build on.
**Uses:** Vitest 4.1.2 + jsdom 29.0.1, configured in `vitest.config.js`; Yarn PnP from Phase 1.
**Implements:** `src/__tests__/` test directory with setup file for global side-effects; tests for random genome generation and createInstance (crossover/clone logic).
**Avoids:** Pitfall 5 (Vitest IIFE crash) — test boundary is pure functions only, never imports `src/app.js`; Pitfall 6 (jsdom canvas absence) — addressed by scoping tests away from DOM-dependent code.
**Test boundary constraint:** The IIFE cannot be directly unit-tested. Pure functions in the `machine-learning/*` and `generation-config/*` sections are the only testable targets in this milestone. Either duplicate the function bodies in a test helper or create a thin `src/testable.js` shim. Full IIFE unit testing requires a module-split milestone (deferred).

### Phase Ordering Rationale

- Phase 1 must precede Phase 2 because Vitest runs through Vite's module pipeline — tests cannot be written or run until the Vite module graph is stable.
- Within Phase 1, the Yarn PnP + `.gitignore` setup must precede committing any `.yarn/cache` — this order cannot be reversed without a costly `git filter-repo` operation to purge binary blobs.
- The `src/main.js` entry point must be written before `index.html` is modified — the module reference in the HTML tag must point to a file that exists.
- The `cw_runningInterval` fix should be applied in Phase 1 (not deferred) because it is a prerequisite for a clean `vite build` output and is a one-line change.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1, box2d ESM wrapper:** The blob URL approach in `src/lib/box2d-init.js` is the primary recommendation, but its behavior under `vite build` (the `?url` import producing a hashed asset path) should be verified against a working build before committing to it. Alternative: `optimizeDeps.exclude` + plain `<script>` tag kept in `index.html` as a fallback.
- **Phase 1, Yarn PnP + esbuild compatibility:** STACK.md confirms the local `grocy` project runs Yarn 4.13.0 + Vite 6.4.1 with PnP successfully, which is HIGH confidence. Run `yarn dlx @yarnpkg/doctor` immediately after first install to catch any esbuild native binary issues before they block progress.

Phases with standard patterns (skip research-phase):

- **Phase 2, Vitest pure function tests:** Well-documented pattern. The constraint (don't import the IIFE) is clear. The test harness approach (thin shim or function body copy) is a bootstrapping compromise documented in ARCHITECTURE.md with no novel technical risk.

## Confidence Assessment

| Area         | Confidence                                           | Notes                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH                                                 | Versions verified against npm registry; compatible combination confirmed via local `grocy` project running identical Yarn + Vite + Vitest stack                                                                    |
| Features     | MEDIUM                                               | Tooling features derived from codebase analysis and training knowledge; Vite/Vitest docs at training cutoff Aug 2025; verify against current docs for Vite 6 / Vitest 4 specifics                                  |
| Architecture | HIGH                                                 | Migration approach derived from direct codebase inspection; IIFE + CJS interop patterns are well-established; `src/main.js` orchestration is confirmed correct pattern                                             |
| Pitfalls     | HIGH (codebase-specific) / MEDIUM (tooling behavior) | CJS guard pattern confirmed by direct inspection of `lib/box2d.js` line 11299; undeclared `cw_runningInterval` confirmed in `src/app.js`; esbuild/Yarn PnP behavior from training knowledge, not live verification |

**Overall confidence:** HIGH for the approach; MEDIUM for exact tooling behavior details that should be verified against Vite 6 + Vitest 4 release notes.

### Gaps to Address

- **box2d ESM wrapper behavior in production build:** The `?url` import producing a content-hashed asset path is documented Vite behavior but has not been tested in this specific project. Verify during Phase 1 smoke test that the hashed URL is correctly resolved at runtime.
- **Vitest 4 + jsdom 29 specific API changes:** Research was conducted against training knowledge (cutoff Aug 2025); Vitest 4 was released after this cutoff. Verify `globals: true`, `environment: 'jsdom'`, and `setupFiles` behavior against current Vitest 4 docs before finalizing `vitest.config.js`.
- **Test harness pattern for IIFE pure functions:** ARCHITECTURE.md recommends a thin `src/testable.js` shim but acknowledges this is "project-specific and needs implementation experimentation." The exact approach for extracting testable functions without splitting `src/app.js` is a Phase 2 implementation decision, not a pre-planned pattern.
- **`.yarn/cache` size after install:** The 30MB threshold cited in PITFALLS.md is an estimate. Run `du -sh .yarn/cache/` after first install and audit before committing. If esbuild + rollup native zips are excluded via `.gitignore`, the committed cache should be significantly smaller.

## Sources

### Primary (HIGH confidence)

- npm registry live queries — Vite version history, Vitest peer dependencies, rolldown release status (verified 2026-03-26)
- Local project `/Users/kellen/Projects/grocy/web` — Yarn 4.13.0 + Vite 6.4.1 + Vitest 4.1.1 + PnP zero-installs confirmed working
- `lib/box2d.js` direct inspection (lines 11299–11408) — CJS guard pattern confirmed
- `lib/seedrandom.js` direct inspection — IIFE mutation of `Math.seedrandom`, zero CJS markers
- `src/app.js` direct inspection — `window.cw_setCameraTarget` at line 2203, `cw_runningInterval` undeclared, `requestAnimationFrame` usage
- `index.html` direct inspection — current 5-script load order, inline `onclick` handlers

### Secondary (MEDIUM confidence)

- Training knowledge (cutoff Aug 2025): Vite 5/6 `optimizeDeps` behavior, esbuild CJS detection, Yarn PnP 4 file layout, Vitest jsdom environment configuration
- `.planning/codebase/TESTING.md` — testability assessment (current analysis)
- `.planning/PROJECT.md` — milestone constraints and key decisions

### Tertiary (LOW confidence)

- Training knowledge: specific Vitest 4 API details (released after knowledge cutoff) — verify against https://vitest.dev before finalizing config
- Training knowledge: exact esbuild behavior with the box2d.js `exports.*` guard pattern — verify by running `yarn dev` and checking `.vite/deps/` output

---

_Research completed: 2026-03-26_
_Ready for roadmap: yes_
