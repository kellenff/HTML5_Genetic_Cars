# Roadmap: HTML5 Genetic Cars — v1.0 Modern Tooling Refactor

## Overview

This milestone replaces the no-build static setup with Vite 6 + Vitest 4 + Yarn Berry PnP while keeping all simulation behavior identical. Phase 1 wires the full Vite and Yarn PnP foundation — the module graph, load order, and CJS compatibility shims — and validates it with both a dev and production build smoke test. Phase 2 adds the Vitest infrastructure and pure-function test suite on top of the working module graph Phase 1 establishes. Nothing ships until `yarn dev`, `yarn build && yarn preview`, and `yarn test` all pass cleanly.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Vite Foundation** - Yarn PnP zero-installs, Vite dev server + production build, CDN removal, dependency wiring, and undeclared variable fix
- [ ] **Phase 2: Vitest Foundation** - Vitest infrastructure and passing pure-function test suite

## Phase Details

### Phase 1: Vite Foundation

**Goal**: Developer can run `yarn dev` to serve the simulation and `yarn build && yarn preview` to produce and verify a working production bundle — with Yarn PnP zero-installs, no CDN dependencies, and simulation behavior identical to pre-migration
**Depends on**: Nothing (first phase)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-07, DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06, DEP-07, FIX-01
**Success Criteria** (what must be TRUE):

1. Running `yarn dev` starts Vite at `localhost:5173` and the simulation loads, runs cars, and advances generations in the browser with no console errors
2. Running `yarn build && yarn preview` produces a `dist/` bundle that serves the simulation identically in production mode — terrain is deterministic, camera buttons work, localStorage save/restore works
3. Cloning the repo and running `yarn install` succeeds without network access — no `node_modules/` directory exists, `.yarn/cache/` is committed, `.pnp.cjs` resolves all dependencies
4. `index.html` contains no CDN `<script>` or `<link>` tags for d3, vis, box2d, or seedrandom — a single `<script type="module">` entry point loads the entire app
5. All Box2D globals (`b2Vec2`, `b2World`, etc.) are accessible in the browser console after page load — `typeof b2Vec2 === 'function'` returns true in both dev and production builds

**Plans**: 5 plans

Plans:

- [ ] 01-01-PLAN.md — Yarn PnP foundation: fix .gitignore, initialize Yarn Berry 4.13.0, install Vite 6.4.1
- [ ] 01-02-PLAN.md — Vite config + box2d ESM wrapper + src/main.js entry point
- [ ] 01-03-PLAN.md — index.html migration: remove CDN tags, add module script entry
- [ ] 01-04-PLAN.md — Bug fixes: declare cw_runningInterval, add Watch Leader disabled guard
- [ ] 01-05-PLAN.md — Smoke test + acceptance: yarn dev, yarn build, yarn preview, git commit

### Phase 2: Vitest Foundation

**Goal**: Developer can run `yarn test` and get a passing test suite covering pure GA/ML functions — establishing an automated baseline that future test coverage can build on
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):

1. Running `yarn test` executes the Vitest suite and exits 0 — no failures, no skipped tests
2. Test output shows coverage of `createNormals`, `mapToFloat`, `mapToInteger`, `mapToShuffle`, and `mutateReplace` from the `random.js` section
3. Test output shows coverage of score update and health decrement logic from the `car-schema/run.js` section
4. No test file imports `src/app.js` directly — the suite runs without triggering the IIFE or touching canvas/DOM code paths
   **Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase                | Plans Complete | Status      | Completed |
| -------------------- | -------------- | ----------- | --------- |
| 1. Vite Foundation   | 0/5            | Not started | -         |
| 2. Vitest Foundation | 0/?            | Not started | -         |
