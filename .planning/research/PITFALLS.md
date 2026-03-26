# Pitfalls Research

**Domain:** Legacy vanilla JS app migration to Vite + Vitest + Yarn PnP
**Researched:** 2026-03-26
**Confidence:** MEDIUM — training knowledge (cutoff Aug 2025) for tooling behavior; HIGH for codebase-specific risks derived from direct code inspection

---

## Critical Pitfalls

### Pitfall 1: box2d.js exports.\* pattern breaks under Vite ESM transformation

**What goes wrong:**
`lib/box2d.js` uses a bare `exports.*` pattern guarded by `if(typeof exports !== "undefined")` (line 11299). It has no `module.exports` assignment, no UMD wrapper, and no `define()`. When Vite processes this file as a module, its pre-bundler (esbuild) will attempt to convert it to ESM. The result is unpredictable: esbuild may produce an empty or malformed module because there is no single `module.exports` object to lift — only hundreds of individual `exports.b2*` assignments appended at the very end of an 11,408-line file. The b2\* globals (`b2Vec2`, `b2World`, `b2BodyDef`, etc.) will be undefined at runtime.

**Why it happens:**
Developers assume Vite's CJS-to-ESM transform handles all CJS patterns. It handles the common `module.exports = ...` pattern well. It handles `exports.foo = ...` patterns less reliably when the file does not declare `"use strict"`, has no module wrapper, and injects exports conditionally at the end of a large concatenated file. This specific box2d.js is a hand-compiled concatenation of many source files, not a proper CommonJS module — the `exports` block at the end was added as an afterthought.

**How to avoid:**
Do not import `lib/box2d.js` as an ES module. Instead, use one of two strategies:

Option A (recommended — least invasive): Add `lib/box2d.js` to Vite's `optimizeDeps.exclude` and serve it as a plain `<script>` tag in `index.html` before the Vite entry point. Vite respects non-module scripts. The b2\* names land on `window` as globals, exactly as they did before.

Option B (cleaner long-term): Wrap `lib/box2d.js` in a thin UMD shim that assigns `window.b2Vec2 = exports.b2Vec2`, etc. Import that shim as a Vite `?raw` import or a side-effect import with `optimizeDeps.include`. Do this in the Vite setup phase, not the test phase.

Do NOT attempt to `import * as Box2D from './lib/box2d.js'` in `src/app.js` during the initial tooling migration.

**Warning signs:**

- `b2Vec2 is not defined` or `b2World is not defined` in the browser console after Vite serves the page
- Vite pre-bundle output in `.vite/deps/` shows `box2d.js` as an empty or near-empty module
- esbuild warns "No inputs were resolved" or "This file uses CommonJS exports" during `vite build`

**Phase to address:**
Phase 1 (Vite setup and dependency wiring). Must be resolved before any other code runs.

---

### Pitfall 2: seedrandom.js global mutation races with ES module load order

**What goes wrong:**
`lib/seedrandom.js` mutates `Math.seedrandom` as a side effect of being evaluated. In the current `<script>` tag setup, load order is explicit and synchronous: seedrandom loads, then box2d loads, then app.js runs. Under Vite's ES module graph, browsers execute modules in dependency order but that order is determined by static `import` statements. If `seedrandom.js` is imported inside the IIFE in `src/app.js` — or if the import for it is placed after an import that calls `Math.random()` — the global mutation happens too late. The terrain becomes non-deterministic or uses the browser's native `Math.random` instead of the seeded one.

More critically: `src/app.js` calls `Math.seedrandom(floorseed)` at several points (lines 1336, 1398, 1533, 1875, 1882, 1927, 1971, 2006, 2092). If the module containing `Math.seedrandom = ...` has not been evaluated yet when any of these lines run, those calls throw `TypeError: Math.seedrandom is not a function`.

**Why it happens:**
Developers import side-effect dependencies at the top of the module that uses them, but assume the global mutation is instant. In a browser module graph, imports are resolved before the importing module's body executes — so the timing is actually correct IF the import is at the top of the ES module entry point. The risk is placing the import anywhere other than the very first line of the Vite entry point.

**How to avoid:**
In the Vite entry point (`main.js` or equivalent), import `seedrandom.js` as the absolute first side-effect import, before any other import:

```js
import "./lib/seedrandom.js"; // must be first — mutates Math.seedrandom
import "./lib/box2d.js"; // or via <script> tag
import "./src/app.js"; // IIFE runs after both are available
```

Never rely on `<script>` + `import` interleaving to establish order. If `seedrandom.js` stays as a `<script>` tag, it must appear before the `<script type="module">` entry point in `index.html`.

**Warning signs:**

- `Math.seedrandom is not a function` in the console on first page load
- Terrain changes between page refreshes despite the same seed being entered
- Cars behave differently on a cold load vs. a hot reload (HMR re-executes modules in a different order)

**Phase to address:**
Phase 1 (Vite setup and dependency wiring). The entry point import order must be the first thing verified.

---

### Pitfall 3: window.cw_setCameraTarget disappears when src/app.js becomes a module

**What goes wrong:**
`src/app.js` is an IIFE. At the very end (line 2203), it explicitly exposes one function: `window.cw_setCameraTarget = cw_setCameraTarget`. This works today because `src/app.js` is a `<script>` tag — its IIFE runs in the global scope and writes to `window`.

When Vite imports `src/app.js` as part of an ES module graph (`import './src/app.js'`), the file is still an IIFE — so the IIFE itself still executes — but the assignment `window.cw_setCameraTarget = ...` does happen. This specific assignment is safe. The danger is in `index.html`: two elements use inline `onclick="cw_setCameraTarget(-1)"` and `onclick="cw_setCameraTarget(this.car_index)"` (lines 189, 300). Inline event handlers resolve names in the global scope (`window`). As long as `window.cw_setCameraTarget` is set before any user interaction, these handlers will work.

The real pitfall is: Vite's dev server inserts its HMR client script and module entry point as `<script type="module">`, which is deferred. If a user clicks one of these buttons before the module finishes loading, `cw_setCameraTarget` will be undefined. In the static file setup this was never a problem because the script ran synchronously.

**Why it happens:**
Developers assume module-loaded code and inline handlers are always in sync. Module scripts are deferred by the HTML spec — they run after the DOM is parsed, not during. Inline onclick handlers are available immediately when the element renders, creating a window where the handlers reference a function that doesn't exist yet.

**How to avoid:**
Disable the camera buttons until the module has initialized. Add a `disabled` attribute to the two camera-targeting buttons in `index.html` and remove it in `cw_init()` at the end of `src/app.js`. Alternatively, make `cw_setCameraTarget` a no-op stub on `window` in a synchronous inline script at the top of `<head>`, then overwrite it with the real implementation when the module loads.

The `window.cw_setCameraTarget = cw_setCameraTarget` assignment at line 2203 does not need to change — the exposure mechanism is correct. Only the timing gap during load needs handling.

**Warning signs:**

- `cw_setCameraTarget is not defined` error when clicking "Watch Leader" or a health bar very quickly after page load
- Works consistently in slow-network tests but fails on fast interactions
- DevTools Network tab shows the module script still loading when the click fires

**Phase to address:**
Phase 1 (Vite setup). Add the `disabled` guard in the same pass that adds the `<script type="module">` entry point.

---

### Pitfall 4: Vite optimizeDeps.include can cause double-evaluation of box2d.js

**What goes wrong:**
If `lib/box2d.js` is listed in `optimizeDeps.include`, Vite pre-bundles it into `.vite/deps/`. If the same file is also loaded via a `<script>` tag in `index.html`, the b2\* constructors are defined twice in two different closures. `b2Vec2` from the pre-bundled version and `b2Vec2` from the script tag are different constructor functions. `instanceof` checks silently fail: `new b2Vec2() instanceof b2Vec2` returns `false` depending on which copy each side of the expression resolves to. box2d.js uses `isInstanceOf()` internally, which is a custom check (not native `instanceof`), so the internal physics logic survives — but any user code that does `instanceof` checks would break.

**Why it happens:**
Developers try every option when box2d.js doesn't load cleanly. Adding it to both `optimizeDeps.include` and keeping a `<script>` tag is a common "belt and suspenders" mistake.

**How to avoid:**
Pick exactly one loading strategy for `box2d.js` and remove the other. If using `<script>` tag (recommended), remove it from `optimizeDeps` entirely. Verify with `console.log(typeof b2Vec2)` at two points: after the script tag would execute, and inside the IIFE. Both should be `"function"` and the same reference.

**Warning signs:**

- Physics objects appear to work (no exceptions) but cars pass through terrain
- `console.log(b2Vec2 === window.b2Vec2)` returns `false`
- `.vite/deps/` contains a `box2d.js` file despite it being excluded

**Phase to address:**
Phase 1 (Vite setup). Catch during initial smoke test by checking the `b2Vec2` reference.

---

### Pitfall 5: Vitest fails to import src/app.js — DOM and canvas APIs unavailable in jsdom

**What goes wrong:**
`src/app.js` is an IIFE that immediately runs `cw_init()` on import (line 2205). `cw_init()` calls `document.getElementById('mainbox').getContext('2d')` and accesses 30+ DOM elements by ID. Vitest's default environment is `node`. Even with `environment: 'jsdom'`, jsdom does not implement `HTMLCanvasElement.prototype.getContext` — it returns `null`. The IIFE crashes on `null.getContext is not a function` before any test code runs.

Additionally, `requestAnimationFrame` is not available in jsdom by default. The IIFE uses `window.requestAnimationFrame(gameLoop)` (line 1810, 1894). This throws `ReferenceError: requestAnimationFrame is not defined` in jsdom.

**Why it happens:**
Developers assume "jsdom = browser". jsdom implements the DOM and HTML spec up to a point but explicitly does not implement rendering APIs: Canvas 2D Context, WebGL, AudioContext. These require a real browser or a canvas mock library.

**How to avoid:**
Do not import `src/app.js` directly in any Vitest test. The IIFE is untestable as a unit because it self-executes and has hard DOM dependencies. Instead:

1. Extract the pure functions (genetic algorithm, random, crossover, mutation logic — everything in the `machine-learning/*` and `generation-config/*` sections) into their own testable functions that can be called with inputs and return outputs, with no DOM access.
2. Test only those extracted pure functions in Vitest.
3. Use `canvas` npm package (the `node-canvas` implementation) or `jest-canvas-mock` (adapted for Vitest) only if integration tests against the IIFE are truly needed.
4. For `requestAnimationFrame`, add a global stub in `vitest.setup.ts`: `global.requestAnimationFrame = (cb) => setTimeout(cb, 16)`.

The current milestone scope explicitly excludes splitting `src/app.js` into modules. This means Vitest coverage is limited to helper/utility functions that can be tested in isolation by copy-pasting their source or by setting up a minimal fixture. Do not attempt full-IIFE test coverage in this milestone.

**Warning signs:**

- `TypeError: Cannot read properties of null (reading 'getContext')` in test output
- `ReferenceError: requestAnimationFrame is not defined` in test output
- All tests fail immediately before the first `expect()` runs

**Phase to address:**
Phase 2 (Vitest setup). Define the test boundary explicitly in the test setup phase: "we test pure functions only; the IIFE is integration-tested manually."

---

### Pitfall 6: Yarn PnP breaks packages that use require() resolution at runtime

**What goes wrong:**
Yarn PnP intercepts Node's `require()` calls and resolves them through its own registry. Packages that construct require paths dynamically (e.g., `require(path.join(__dirname, 'plugin'))` or use `require.resolve()` with relative paths) will throw `Error: Your application tried to access [package] which is not declared in your dependencies` under PnP, even if the package is installed. This affects build-time tools more than Vite's runtime output.

Common packages that have historically had PnP issues:

- esbuild (used internally by Vite) — requires native binary resolution; Yarn PnP 4 handles this with `unplugged` entries, but the configuration must be explicit
- Some Rollup plugins that use `require()` to load sub-dependencies
- PostCSS and its plugin ecosystem (relevant if CSS processing is added later)
- node-canvas (if used for test mocking) — requires native bindings, must be unplugged

**Why it happens:**
PnP's virtual filesystem does not place packages in `node_modules/`. Tools that assume they can walk up the filesystem to find dependencies, or that use `__dirname`-relative requires, find nothing because the physical path doesn't exist.

**How to avoid:**
Use `nodeLinker: node-modules` in `.yarnrc.yml` as a fallback if PnP issues block progress. This defeats zero-installs but unblocks the milestone. Only commit to PnP after verifying each dependency in the stack works under PnP.

For esbuild specifically: add it to `pnpIgnorePatterns` or mark it as `unplugged` in `.yarnrc.yml`:

```yaml
pnpIgnorePatterns:
  - "**/esbuild/**"
```

Run `yarn dlx @yarnpkg/doctor` after install to detect PnP incompatibilities before they surface at runtime.

For IDE support: VSCode requires the `ZipFS` and `arcanis.vscode-zipfs` extensions plus `yarn sdks vscode` to be run once. Without these, TypeScript type checking in the editor will fail silently because the editor can't find packages in the PnP zip cache.

**Warning signs:**

- `Error: Your application tried to access esbuild, which is not declared in your dependencies` on `yarn vite`
- VSCode shows "Cannot find module" for every imported package even though `yarn install` succeeded
- `yarn vitest` hangs on startup with no output

**Phase to address:**
Phase 1 (Yarn PnP setup). Run `yarn dlx @yarnpkg/doctor` immediately after the first `yarn install` and resolve all reported issues before proceeding.

---

### Pitfall 7: Zero-installs .yarn/cache contains binary artifacts that inflate git history

**What goes wrong:**
Yarn PnP zero-installs stores package zips in `.yarn/cache/`. These are binary `.zip` files. If esbuild, Rollup, or any native-addon package stores platform-specific binaries in their zip, committing `.yarn/cache/` to git means:

1. The initial commit that adds the cache is large (potentially 50-200MB for Vite + Vitest + their transitive deps)
2. Any package version upgrade replaces old zip files with new ones, but git stores both — the old blobs are never garbage collected from repo history without a rebase or `git filter-repo`
3. CI clone time grows with every dependency upgrade

**Why it happens:**
The zero-installs pitch ("clone and run, no install step") is accurate but the documentation undersells the git storage cost. Teams add zero-installs without auditing which packages have large or binary caches.

**How to avoid:**
Before committing `.yarn/cache/`:

1. Run `du -sh .yarn/cache/` — if it exceeds ~30MB, investigate what is large
2. Add platform-specific binaries to `.gitignore` within `.yarn/cache/`. The Yarn docs provide a `.gitignore` template that excludes native binaries while keeping pure-JS zips:
   ```
   .yarn/cache/@esbuild-*
   .yarn/cache/@rollup-*
   ```
   These must be reinstalled per platform, but they are platform-specific and can't be shared anyway.
3. Audit with `yarn why [package]` to understand the full dependency tree before committing

For this project specifically: Vite pulls in esbuild (a Go binary, ~5MB per platform) and Rollup (a Rust-compiled WASM + native, ~3MB). Both should be gitignored from the cache.

**Warning signs:**

- `git status` shows `.yarn/cache/` with 200+ changed files after `yarn install`
- `du -sh .yarn/cache/` reports more than 30MB
- `git log --stat` shows multi-MB commit sizes when updating any dependency

**Phase to address:**
Phase 1 (Yarn PnP setup). Set up the `.gitignore` for `.yarn/cache/` before the first commit of the cache.

---

### Pitfall 8: Vite dev vs. build behavior: IIFE global scope differs between modes

**What goes wrong:**
In Vite dev mode, `src/app.js` is served as-is (after light transformation). The IIFE runs in a module scope but `window` is available. In `vite build` (production), Rollup wraps the entire module graph in its own IIFE for bundling. If any code inside `src/app.js` relies on `this` at the top level of the IIFE referring to `window`, it will break in the production bundle — Rollup's output has strict mode semantics where top-level `this` is `undefined`.

This project's IIFE does not visibly use top-level `this`, but the pattern is a common trap in legacy code. More relevant here: `cw_runningInterval` is assigned without `var` (CONCERNS.md line 50-54) — this creates an implicit global. In dev mode, Vite's non-strict module transform may tolerate this. In Rollup's strict-mode build output, writing to an undeclared variable throws `ReferenceError: cw_runningInterval is not defined` at the point of the `setInterval` call in `toggleDisplay()`.

**Why it happens:**
Dev servers are permissive; bundlers enforce stricter semantics. Teams test in dev and ship bugs that only surface in the production build.

**How to avoid:**

1. Fix the undeclared `cw_runningInterval` variable (add `var cw_runningInterval;` near line 1477) before or during Phase 1. This is listed as a quick win in CONCERNS.md.
2. After completing Phase 1, always run `vite build && vite preview` as the acceptance test — not just `vite dev`. The preview server serves the production bundle from `dist/` and will surface strict-mode errors that dev mode hides.
3. Add `build: { minify: false }` temporarily during development to make build errors readable.

**Warning signs:**

- App works in `vite dev` but crashes on `vite preview`
- `ReferenceError` in the browser console only on the built version
- Rollup warns "Use of eval" or "Top-level `this` will be rewritten" during `vite build`

**Phase to address:**
Phase 1 (Vite setup). The `cw_runningInterval` fix is a prerequisite for a clean production build. Add `vite preview` to the Phase 1 acceptance criteria explicitly.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut                                                 | Immediate Benefit                            | Long-term Cost                                                                                                  | When Acceptable                                                                       |
| -------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Keep box2d.js as `<script>` tag after adding Vite        | Avoids CJS interop entirely — zero risk      | box2d.js stays outside the module graph; tree-shaking, analysis tools, and future module refactors can't see it | Acceptable for this milestone; must be revisited in a future modularization milestone |
| Use `optimizeDeps.exclude` for box2d.js                  | Vite stops trying to transform it            | Vite's dev server still serves it as a static asset; HMR won't apply                                            | Acceptable if box2d.js never changes                                                  |
| Write Vitest tests only for pure GA functions            | Unblocks test coverage with minimal friction | Canvas rendering, DOM lifecycle, physics integration remain untested                                            | Acceptable for this milestone; integration tests are a separate milestone             |
| Set `nodeLinker: node-modules` fallback for PnP blockers | Immediately unblocks PnP-incompatible tools  | Defeats zero-installs; contributors need `yarn install` again                                                   | Acceptable only as a documented escape hatch, not the default                         |
| Skip `vite preview` in CI and only run `vite dev`        | Faster CI                                    | Prod-only bugs (strict mode, minification) go undetected until deploy                                           | Never acceptable; always run `vite preview`                                           |

---

## Integration Gotchas

Common mistakes when connecting these tools together.

| Integration                                    | Common Mistake                                                      | Correct Approach                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Vite + box2d.js                                | Adding to `optimizeDeps.include` expecting automatic ESM conversion | Use `<script>` tag in `index.html` or `optimizeDeps.exclude` + script injection plugin |
| Vite + seedrandom.js                           | Importing after app.js in entry point                               | Import seedrandom.js as the absolute first line of the Vite entry point                |
| Vitest + jsdom + canvas                        | Using jsdom environment expecting Canvas 2D to work                 | Install `canvas` (node-canvas) or `vitest-canvas-mock`; add to `setupFiles`            |
| Yarn PnP + VSCode                              | Expecting TypeScript to "just work" after `yarn install`            | Run `yarn sdks vscode` and install ZipFS extension; restart TS server                  |
| Yarn PnP + esbuild                             | Native binary not found during `vite dev`                           | Add esbuild to `pnpIgnorePatterns` or mark as `unplugged` in `.yarnrc.yml`             |
| Vite `<script>` tag + `<script type="module">` | Assuming synchronous execution order                                | `<script>` tags before the module entry point run first; module scripts are deferred   |

---

## Performance Traps

| Trap                                                      | Symptoms                                                                | Prevention                                                                                                                    | When It Breaks                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| HMR re-evaluates the entire IIFE on every save            | Page resets to generation 0 on every code change; simulation state lost | Add `import.meta.hot.accept()` handler that only reloads on explicit refresh; or accept this behavior as expected for an IIFE | Every dev-time edit                                 |
| Vite pre-bundling box2d.js (11K lines) on first dev start | Cold start takes 10-30 seconds; subsequent starts are fast              | Exclude box2d.js from pre-bundling entirely                                                                                   | Only on first run after clean `.vite/` cache        |
| `.yarn/cache/` binary zips in git causing slow clones     | `git clone` takes 2+ minutes                                            | Gitignore esbuild and rollup native zips                                                                                      | Immediately on first clone after cache is committed |

---

## "Looks Done But Isn't" Checklist

- [ ] **Vite dev server starts:** Verify `http://localhost:5173` loads AND cars spawn AND terrain appears. A blank canvas or JS error means box2d.js or seedrandom.js is not loading correctly.
- [ ] **Production build works:** Run `vite build && vite preview` — not just `vite dev`. Strict mode and Rollup transformations only apply to the production build.
- [ ] **seedrandom determinism intact:** Load the page, note the terrain, refresh hard (`Cmd+Shift+R`), verify the terrain is identical. If it differs, seedrandom load order is broken.
- [ ] **Camera buttons work:** Click "Watch Leader" immediately after the first car spawns. If `cw_setCameraTarget is not defined` appears, the window exposure timing fix is missing.
- [ ] **Yarn PnP zero-installs verified:** Delete `.yarn/cache/` and re-run `yarn install`. Verify the cache is restored without network access (using `--offline` flag). Then delete `node_modules/` (should not exist) and verify the app still runs.
- [ ] **Vitest runs without canvas errors:** `yarn vitest run` should produce passing tests, not a crash on IIFE evaluation.
- [ ] **IDE TypeScript works:** Open a `.ts` file (once any are created) and verify VSCode shows no "Cannot find module" errors for package imports.

---

## Recovery Strategies

| Pitfall                              | Recovery Cost | Recovery Steps                                                                                                                             |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| box2d.js CJS transform failure       | LOW           | Add `optimizeDeps.exclude: ['./lib/box2d.js']` to `vite.config.js`; add `<script src="/lib/box2d.js">` before module entry in `index.html` |
| seedrandom load order broken         | LOW           | Move seedrandom import to the first line of the Vite entry point; or convert it to a `<script>` tag before the module script               |
| window.cw_setCameraTarget race       | LOW           | Add `disabled` attribute to the two camera buttons; remove in `cw_init()`                                                                  |
| Yarn PnP blocks esbuild/Rollup       | MEDIUM        | Set `nodeLinker: node-modules` as escape hatch; document why in `.yarnrc.yml` comments                                                     |
| Vitest crashes on IIFE import        | LOW           | Never import `src/app.js` in tests; scope tests to pure functions only                                                                     |
| Production build fails (strict mode) | LOW           | Fix `var cw_runningInterval` declaration; run `vite build` with `minify: false` to find remaining issues                                   |
| .yarn/cache bloat in git             | HIGH          | Requires `git filter-repo` to purge binary blobs from history; prevention is the only good option                                          |

---

## Pitfall-to-Phase Mapping

| Pitfall                                           | Prevention Phase                  | Verification                                                                        |
| ------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| box2d.js CJS transform failure                    | Phase 1: Vite setup               | `typeof b2Vec2 === 'function'` in browser console after `vite dev`                  |
| seedrandom load order race                        | Phase 1: Vite setup               | Hard refresh shows same terrain; no `Math.seedrandom is not a function` error       |
| window.cw_setCameraTarget timing gap              | Phase 1: Vite setup               | Click "Watch Leader" immediately after page load; no error thrown                   |
| box2d.js double-evaluation                        | Phase 1: Vite setup               | `b2Vec2 === window.b2Vec2` is `true`; no duplicate physics constructors             |
| cw_runningInterval implicit global in strict mode | Phase 1: Vite setup (or pre-work) | `vite build && vite preview` completes without ReferenceError                       |
| Vite dev vs. build behavior divergence            | Phase 1: Vite setup               | Acceptance criteria requires `vite preview` to pass, not just `vite dev`            |
| Yarn PnP esbuild/native binary compatibility      | Phase 1: Yarn PnP setup           | `yarn dlx @yarnpkg/doctor` reports zero issues; `yarn vite` starts without errors   |
| .yarn/cache binary bloat in git                   | Phase 1: Yarn PnP setup           | `.gitignore` for esbuild/rollup cache entries in place before first cache commit    |
| Yarn PnP IDE support missing                      | Phase 1: Yarn PnP setup           | `yarn sdks vscode` run; VSCode shows no "Cannot find module" for installed packages |
| Vitest crashes importing IIFE                     | Phase 2: Vitest setup             | First test file tests a pure function only; `yarn vitest run` exits 0               |
| jsdom Canvas/RAF unavailable                      | Phase 2: Vitest setup             | Test setup file adds `requestAnimationFrame` stub; canvas mock configured if needed |

---

## Sources

- Direct code inspection: `lib/box2d.js` lines 11299-11408 (conditional `exports.*` pattern)
- Direct code inspection: `lib/seedrandom.js` lines 1-40 (global `Math.seedrandom` mutation)
- Direct code inspection: `src/app.js` line 2203 (`window.cw_setCameraTarget` exposure)
- Direct code inspection: `src/app.js` lines 1714, 1722 (`cw_runningInterval` undeclared)
- Direct code inspection: `src/app.js` lines 1810, 1894 (`window.requestAnimationFrame` calls)
- Direct code inspection: `index.html` lines 189, 300 (inline `onclick` handlers)
- `.planning/codebase/CONCERNS.md` — Tech debt and fragile areas audit
- `.planning/PROJECT.md` — Migration constraints and key decisions
- Training knowledge: Vite 5/6 optimizeDeps behavior, esbuild CJS-to-ESM transform limitations
- Training knowledge: Yarn PnP 4 compatibility patterns, `@yarnpkg/doctor`, `pnpIgnorePatterns`
- Training knowledge: Vitest 2 jsdom environment, Canvas API absence in jsdom
- Note: Web search and WebFetch were unavailable during this research session. All tooling behavior claims are from training knowledge (cutoff August 2025) and should be verified against current Vite/Vitest/Yarn docs before implementation.

---

_Pitfalls research for: Legacy vanilla JS to Vite + Vitest + Yarn PnP migration_
_Researched: 2026-03-26_
