# Feature Research

**Domain:** Modern build tooling migration for vanilla JS browser simulation (Vite + Vitest + Yarn PnP)
**Researched:** 2026-03-26
**Confidence:** MEDIUM (WebSearch/WebFetch unavailable; based on training data through Aug 2025 + local codebase analysis)

---

## Context

This is a tooling-only milestone. The "features" being catalogued are tooling capabilities, not app features. The audience is developers working on the project. The existing app already works; the goal is to improve the development and testing experience without changing behavior.

**Key codebase constraints that shape feature requirements:**

- `src/app.js` is a 2200-line IIFE — imported as a side-effect, not a module
- `lib/box2d.js` uses `if(typeof exports !== "undefined") { exports.b2... }` — CJS-guarded globals, no default export
- `lib/seedrandom.js` mutates `Math.seedrandom` as a pure side-effect, no exports at all
- `window.cw_setCameraTarget` is called via inline `onclick` in `index.html` — must remain a global at runtime
- d3 v3 and vis 4.20.0 CDN loads exist in `index.html` but are confirmed unused in `src/app.js`
- Simulation correctness depends on load order: seedrandom → box2d → app.js

---

## Feature Landscape

### Table Stakes (Without These, Tooling Migration Fails or Severely Degrades DX)

| Feature                                            | Why Expected                                                                                                                                                                                       | Complexity | Notes                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite dev server with HMR                           | Replaces python3 http.server; page reload on file save is minimum viable dev loop                                                                                                                  | LOW        | HMR for vanilla JS without framework falls back to full page reload automatically — this is fine for this app since the simulation reinitializes on load                                                                                                                                                            |
| Vite `server.port` configuration                   | Developers expect a predictable localhost port; Vite defaults to 5173 but this must be explicitly set                                                                                              | LOW        | Set in `vite.config.js`; `server.strictPort: true` prevents silent port fallback                                                                                                                                                                                                                                    |
| Static asset serving for lib/                      | `lib/box2d.js` and `lib/seedrandom.js` must be reachable; Vite serves `public/` and root by default                                                                                                | LOW        | These files can stay in `lib/` if referenced correctly, or moved to `public/` as static assets                                                                                                                                                                                                                      |
| CJS compat for box2d.js                            | box2d.js uses `exports.*` guard — Vite's ESM-first pipeline will fail without compat handling                                                                                                      | MEDIUM     | Vite 5.x includes `@vitejs/plugin-legacy` option and built-in `define` substitution, but the simplest path is using Vite's `optimizeDeps.include` + `build.commonjsOptions` to pre-bundle it as ESM. Alternatively treat it as a `public/` static asset and load via `<script>` tag in index.html (no-bundle path). |
| Side-effect import for seedrandom.js               | seedrandom.js has no exports — must be imported as a side-effect that mutates `Math` before app.js runs                                                                                            | LOW        | `import './lib/seedrandom.js'` works; Vite will bundle it inline. Must ensure load order: seedrandom → box2d → app.js                                                                                                                                                                                               |
| `window.cw_setCameraTarget` global preserved       | index.html has `onclick="cw_setCameraTarget(-1)"` — if Vite scopes the IIFE, this global disappears                                                                                                | MEDIUM     | Vite does not scope IIFE contents by default when imported as side-effects; the `window.cw_setCameraTarget = ...` assignment in app.js will still write to window. Needs verification in dev and build modes.                                                                                                       |
| `vite build` static SPA output                     | Production build to `dist/` as a deployable static site (HTML + JS + CSS, no server required)                                                                                                      | LOW        | Default Vite build behavior. `build.outDir: 'dist'` is the default.                                                                                                                                                                                                                                                 |
| Remove CDN script tags                             | d3 and vis CDN `<script>` tags in index.html must be removed (confirmed unused)                                                                                                                    | LOW        | Simple HTML edit; no JS changes needed since neither library is referenced in app.js                                                                                                                                                                                                                                |
| Yarn PnP with zero-installs                        | `.yarn/cache` committed so contributors clone and run without `yarn install`                                                                                                                       | MEDIUM     | Requires `nodeLinker: 'pnp'` in `.yarnrc.yml` and `enableGlobalCache: false`. Cache directory can reach 50–200MB for a small project. Requires Yarn 4.x.                                                                                                                                                            |
| `yarn dlx` or plugin for SDK compatibility         | VSCode and other editors need Yarn PnP SDKs to resolve modules                                                                                                                                     | LOW        | `yarn dlx @yarnpkg/sdks vscode` generates `.yarn/sdks/` directory. Required for IDE type resolution to work under PnP.                                                                                                                                                                                              |
| Vitest with jsdom environment                      | Pure logic tests (random, createInstance, carRun) need a DOM-like env for any `document` references, but the core pure functions don't need DOM — jsdom is still needed if any test imports app.js | MEDIUM     | Set `environment: 'jsdom'` in vitest.config. Without this, any accidental DOM reference throws ReferenceError in Node.                                                                                                                                                                                              |
| Vitest `globals: true`                             | Allows `describe/it/expect` without imports in test files — matches common test authoring expectations                                                                                             | LOW        | Set in vitest.config `test.globals: true`. Required if tests don't `import { describe, it } from 'vitest'` explicitly.                                                                                                                                                                                              |
| Vitest setup file for global side-effects          | seedrandom.js and box2d.js mutate globals; tests that exercise genome/physics logic need these loaded first                                                                                        | MEDIUM     | `test.setupFiles: ['./test/setup.js']` in vitest.config. Setup file imports seedrandom and box2d before tests run. Critical for `flatRankSelect`, `defToCar`, and seeded-RNG tests.                                                                                                                                 |
| `package.json` with `dev`, `build`, `test` scripts | Standard developer commands — `yarn dev`, `yarn build`, `yarn test`                                                                                                                                | LOW        | Expected by every developer who touches a JS project                                                                                                                                                                                                                                                                |

### Differentiators (Nice to Have, Add Value but Not Blocking)

| Feature                                   | Value Proposition                                                  | Complexity | Notes                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------- |
| Vite `server.open: true`                  | Browser opens automatically on `yarn dev`                          | LOW        | One-line config change; saves a manual step but not essential                                            |
| Vite `build.sourcemap: true`              | Source maps in production build enable debugging deployed version  | LOW        | Add to `vite.config.js`; minimal cost                                                                    |
| Vitest coverage via `@vitest/coverage-v8` | HTML/text coverage reports show which pure functions are tested    | LOW        | `yarn vitest --coverage`. Requires separate package install. Useful for tracking test quality over time. |
| Vitest `--watch` mode (default in dev)    | Reruns affected tests on file change                               | LOW        | Default Vitest behavior in TTY; no config needed                                                         |
| Vitest `--reporter=verbose`               | Shows each test name in output, not just pass/fail count           | LOW        | Useful while building out test suite from zero                                                           |
| Vite `server.host: 'localhost'` explicit  | Prevents Vite from binding to 0.0.0.0 (LAN exposure) unless needed | LOW        | Security best practice for local dev                                                                     |
| `vite preview` command                    | Serves the `dist/` build locally for pre-deploy validation         | LOW        | Catches base path issues before deployment                                                               |
| Yarn workspaces (future)                  | If project later splits into packages (e.g., sim engine vs UI)     | HIGH       | Out of scope for this milestone; architecture is single-file for now                                     |
| Vite `define` for build-time constants    | Replace `__DEV__` or `process.env.NODE_ENV` checks at build time   | LOW        | Not currently needed; app has no environment-dependent code paths                                        |
| TypeScript checking via `tsc --noEmit`    | Type safety on JS files via JSDoc + tsconfig                       | HIGH       | Explicitly out of scope for this milestone per PROJECT.md                                                |

### Anti-Features (Deliberately NOT Configure)

| Feature                                                | Why Requested                                               | Why Problematic                                                                                                                               | Alternative                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| TypeScript compilation                                 | Natural "next step" after adding Vite                       | Out of scope per PROJECT.md; adds significant complexity to legacy codebase; TS errors in box2d.js globals would block the build              | Defer to a future TypeScript milestone; jsconfig.json with `checkJs: false` is sufficient |
| Legacy browser transpilation (`@vitejs/plugin-legacy`) | Tempting to add for compatibility                           | This app targets modern browsers per PROJECT.md constraints; Babel + polyfills inflate bundle size ~40KB+ and slow build                      | Set `build.target: 'es2020'` or `'esnext'`; no legacy plugin                              |
| CSS modules or PostCSS transforms                      | Vite auto-configures PostCSS if a config exists             | styles.css is plain CSS with no variables or nesting; adding PostCSS pipeline is unnecessary complexity                                       | Leave styles.css as a plain static import                                                 |
| SSR (server-side rendering)                            | Vite has SSR mode                                           | This is a client-side only canvas simulation; SSR serves no purpose                                                                           | `vite build` in SPA mode only                                                             |
| Vitest browser mode (experimental)                     | Running tests in a real browser via Vitest's browser runner | As of Vite 5.x/Vitest 1.x, browser mode is experimental and requires Playwright or WebdriverIO; overkill for unit-testing pure functions      | Use jsdom for unit tests; use manual browser testing for visual/integration validation    |
| ESLint integration into Vite build                     | Vite-plugin-eslint runs lint on every HMR update            | Slows dev server HMR response; lint errors block the dev build and interrupt the feedback loop                                                | Run `eslint` as a separate `yarn lint` script; do not integrate into Vite                 |
| Module federation / chunking strategy                  | Advanced build optimization                                 | Single-file app with small total bundle size; no benefit to code splitting                                                                    | Default Rollup chunking in `vite build` is sufficient                                     |
| Yarn constraints / PnP strict mode enforcement via CI  | Lint Yarn manifest for policy                               | CI pipeline is out of scope for this milestone                                                                                                | Add in a future CI milestone                                                              |
| Box2d.js npm package (box2d-wasm, planck, etc.)        | Swap vendored box2d.js for a maintained npm package         | Behavior change risk — the vendored box2d.js has specific quirks the simulation depends on; swapping physics engines could alter car behavior | Keep vendored lib/box2d.js; import it as-is                                               |

---

## Feature Dependencies

```
[Yarn PnP zero-installs]
    └──requires──> [package.json with dependencies declared]
                       └──requires──> [.yarnrc.yml with nodeLinker: pnp]

[Vitest test suite]
    └──requires──> [package.json scripts: test]
    └──requires──> [vitest.config.js]
                       └──requires──> [test setupFiles for global side-effects]
                                          └──requires──> [box2d.js + seedrandom.js importable as side-effects]

[vite build SPA output]
    └──requires──> [vite.config.js with build.outDir]
    └──requires──> [CDN script tags removed from index.html]
    └──requires──> [box2d.js CJS compat resolved]

[box2d.js CJS compat]
    └──resolves via──> EITHER [Vite optimizeDeps pre-bundling as CommonJS]
                       OR [box2d.js moved to public/ as static asset, loaded via <script>]

[window.cw_setCameraTarget global]
    └──requires──> [src/app.js imported before DOMContentLoaded resolves onclick handlers]
    └──depends on──> [Vite not stripping window assignments from IIFE in tree-shaking]

[seedrandom.js side-effect]
    └──must load before──> [src/app.js]
    └──must load before──> [box2d.js] (order: seedrandom → box2d → app)
```

### Dependency Notes

- **box2d.js CJS compat requires a decision before vite.config.js is finalized:** The two paths (pre-bundle vs static asset) have different implications. Pre-bundling via `optimizeDeps` brings it into the ESM graph and allows tree-shaking inspection. Static asset path keeps it out of Vite's module graph entirely (simpler, lower risk of breakage). For a vendored 381KB file with 100+ exports all used as globals, static asset path is lower risk.

- **Vitest test setupFiles requires box2d.js importable in Node:** box2d.js uses `if(typeof exports !== "undefined")` — so it CAN be required in Node for Phase 2 integration tests. Pure function tests (random, createInstance, carRun) do not need box2d loaded at all.

- **Yarn PnP requires editor SDK setup for IDE integration:** Without `yarn dlx @yarnpkg/sdks vscode`, VSCode will show "Cannot find module" errors even though the app runs fine. This is a one-time setup step per contributor.

- **window.cw_setCameraTarget and tree-shaking conflict:** Vite/Rollup's tree-shaking does NOT strip `window.X = ...` assignments (side-effects to global state are preserved). This is safe. The risk is only if the app.js import is marked `sideEffects: false` in package.json — which it should NOT be.

---

## MVP Definition

### Launch With (v1 — this milestone)

These are the capabilities that must work before this milestone is considered complete:

- [ ] `yarn dev` starts Vite dev server, loads simulation in browser, auto-reloads on file save
- [ ] `yarn build` produces a `dist/` directory that works as a static SPA
- [ ] `yarn test` runs Vitest and passes tests for at least the pure functions (random, createInstance)
- [ ] No CDN script tags in `index.html` (d3, vis removed; box2d + seedrandom bundled or static)
- [ ] `.yarn/cache` committed, `node_modules/` absent — contributors run `yarn` (or nothing with zero-installs) and immediately use `yarn dev`
- [ ] `window.cw_setCameraTarget` works as a global in both dev and built modes
- [ ] Simulation behavior identical to pre-migration (terrain, physics, GA progression)

### Add After Validation (v1.x)

- [ ] Vitest coverage reporting — add when test suite has enough tests to measure
- [ ] `@vitest/coverage-v8` installed — trigger: test suite reaches 20+ test cases
- [ ] ESLint config — trigger: second contributor joins or codebase starts accumulating obvious style drift

### Future Consideration (v2+)

- [ ] TypeScript migration — requires its own milestone; Vite foundation enables this
- [ ] Vitest browser mode for integration tests — when browser-mode exits experimental status
- [ ] CI pipeline with `yarn test` + `yarn build` on push — future milestone per PROJECT.md
- [ ] E2E tests with Playwright — after CI milestone

---

## Feature Prioritization Matrix

| Feature                          | Developer Value | Implementation Cost | Priority |
| -------------------------------- | --------------- | ------------------- | -------- |
| Vite dev server (HMR + port)     | HIGH            | LOW                 | P1       |
| `vite build` SPA output          | HIGH            | LOW                 | P1       |
| CDN removal (d3, vis)            | HIGH            | LOW                 | P1       |
| box2d.js CJS compat              | HIGH            | MEDIUM              | P1       |
| seedrandom.js side-effect import | HIGH            | LOW                 | P1       |
| window.cw_setCameraTarget global | HIGH            | LOW                 | P1       |
| Yarn PnP zero-installs           | HIGH            | MEDIUM              | P1       |
| Vitest + jsdom + globals         | HIGH            | LOW                 | P1       |
| Vitest setupFiles for globals    | HIGH            | MEDIUM              | P1       |
| package.json scripts             | HIGH            | LOW                 | P1       |
| Yarn SDK setup for VSCode        | MEDIUM          | LOW                 | P2       |
| `server.open: true`              | LOW             | LOW                 | P2       |
| Build sourcemaps                 | LOW             | LOW                 | P2       |
| Vitest coverage                  | MEDIUM          | LOW                 | P2       |
| TypeScript checking              | MEDIUM          | HIGH                | P3       |
| Legacy browser support           | LOW             | HIGH                | P3       |

**Priority key:**

- P1: Must have for this milestone to succeed
- P2: Should have, add when possible in same milestone
- P3: Nice to have, future milestone

---

## Tooling-Specific Notes

### Vite and Canvas/Physics Simulations

Vite's HMR has no special canvas support. For a simulation that initializes on page load (not a component framework), HMR triggers a full page reload. This is expected and acceptable — the simulation reinitializes naturally. No special HMR handling is needed.

Vite does not interfere with `requestAnimationFrame` loops, canvas 2D context, or synchronous physics stepping. The simulation's animation loop is browser-native and independent of the module system.

### Vitest and Legacy IIFE/Global-Style Code

The IIFE cannot be unit-tested as-is. The pure functions identified in TESTING.md (random, createInstance, carRun, flatRankSelect, manageRound) can only be tested if:

1. They are extracted to their own files (separate refactor milestone, explicitly out of scope), OR
2. The test imports the entire app.js as a side-effect and then accesses the globals it leaks (fragile), OR
3. The functions are duplicated/inlined in test files (maintenance burden)

The practical approach for this milestone: write tests for the pure logic in isolation by duplicating only the function bodies needed. This is a bootstrapping compromise — the TypeScript/module refactor milestone will enable proper unit testing.

The jsdom environment is still required even for pure function tests that don't directly use DOM, because app.js (if imported as a side-effect in any test file) will immediately call `cw_init()` which queries the DOM.

### Yarn PnP Zero-Installs Size Estimate

For a project with ~5 dependencies (vite, vitest, @vitest/coverage-v8, jsdom), `.yarn/cache` will be approximately 30–80MB. This is reasonable to commit. Yarn 4.x cache uses zip files per package, making git diffs readable at the file level.

### Base Path for `vite build`

The default `base: '/'` works for GitHub Pages deployment to a root domain. If deployed to a subdirectory (e.g., `username.github.io/HTML5_Genetic_Cars/`), `base: '/HTML5_Genetic_Cars/'` must be set. This should be a configurable build option, not hardcoded, unless the deploy target is known.

---

## Sources

- Codebase analysis: `/Users/kellen/Projects/HTML5_Genetic_Cars/src/app.js`, `lib/box2d.js`, `lib/seedrandom.js`, `index.html` (direct inspection, HIGH confidence)
- `.planning/codebase/TESTING.md`: testability assessment (HIGH confidence — current analysis)
- `.planning/PROJECT.md`: milestone requirements and constraints (HIGH confidence — current)
- Vite 5.x documentation: training knowledge through Aug 2025 (MEDIUM confidence — verify against https://vitejs.dev)
- Vitest 1.x/2.x documentation: training knowledge through Aug 2025 (MEDIUM confidence — verify against https://vitest.dev)
- Yarn 4.x PnP documentation: training knowledge through Aug 2025 (MEDIUM confidence — verify against https://yarnpkg.com/features/pnp)
- Installed Vite version confirmed: 5.4.21 (from `node_modules/vite/package.json` — HIGH confidence for version)

---

_Feature research for: Vite + Vitest + Yarn PnP tooling migration_
_Researched: 2026-03-26_
