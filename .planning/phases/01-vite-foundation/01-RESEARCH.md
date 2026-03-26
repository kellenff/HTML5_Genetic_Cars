# Phase 1: Vite Foundation - Research

**Researched:** 2026-03-26
**Domain:** Yarn Berry PnP + Vite 6 dev server + ESM migration for a no-build legacy IIFE browser app
**Confidence:** HIGH (versions verified against npm registry; architecture derived from direct codebase inspection; Yarn + Vite combination confirmed on local grocy reference project)

---

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                        | Research Support                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| BUILD-01 | `yarn dev` starts Vite 6.x dev server at localhost:5173                                                            | Vite 6.4.1 `server.port: 5173` config; `"dev": "vite"` script                                                        |
| BUILD-02 | `yarn build` produces production-ready bundle in `dist/`                                                           | `vite build` command; `build.outDir: "dist"` config                                                                  |
| BUILD-03 | `yarn preview` serves production bundle locally                                                                    | `vite preview` command; `"preview": "vite preview"` script                                                           |
| BUILD-04 | Yarn 4.x Berry with PnP zero-installs — no `node_modules/`                                                         | `nodeLinker: pnp` in `.yarnrc.yml`; `enableGlobalCache: false`; `.yarn/cache/` committed                             |
| BUILD-05 | Clone + `yarn install` offline succeeds                                                                            | Zero-installs contract: cache committed, `.pnp.cjs` committed                                                        |
| BUILD-06 | `dist/` and `node_modules/` gitignored; `.yarn/cache/`, `.pnp.cjs`, `.pnp.loader.mjs`, `.yarn/releases/` committed | `.gitignore` update + Yarn PnP commit list                                                                           |
| BUILD-07 | `package.json` includes `dev`, `build`, `preview`, `test` scripts                                                  | Exact `package.json` content documented below                                                                        |
| DEP-01   | `lib/box2d.js` loaded via ESM wrapper injecting it as classic `<script>` tag                                       | `src/lib/box2d-init.js` with `?url` import + `document.createElement('script')`                                      |
| DEP-02   | All Box2D globals remain accessible to `src/app.js`                                                                | ESM wrapper loads box2d before app.js; all `b2*` land on `window` via classic script                                 |
| DEP-03   | `lib/seedrandom.js` imported as side-effect in `src/main.js`                                                       | Plain IIFE, no CJS markers; `import "../lib/seedrandom.js"` as first line of `src/main.js`                           |
| DEP-04   | CDN d3 and vis `<script>` tags removed                                                                             | Both confirmed unused in `src/app.js`; safe to remove                                                                |
| DEP-05   | CDN vis CSS `<link>` removed                                                                                       | Same CDN block — `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/...vis.min.css">` line 7 of `index.html` |
| DEP-06   | `src/main.js` is Vite entry point sequencing seedrandom → box2d → app                                              | Async entry design documented with exact code                                                                        |
| DEP-07   | `window.cw_setCameraTarget` accessible for inline onclick handlers                                                 | Assignment exists at line 2203 of `src/app.js`; only timing gap during module load needs guarding                    |
| FIX-01   | `cw_runningInterval` explicitly declared in `src/app.js`                                                           | Located at lines 1714 and 1722; no `var` declaration found; fix is `var cw_runningInterval;` at line 1477            |

</phase_requirements>

---

## Summary

This phase adds the Vite 6 build pipeline and Yarn Berry PnP zero-installs to an existing no-build static app. The simulation logic in `src/app.js` does not change — only the delivery mechanism changes. The key challenge is `lib/box2d.js`: it uses a bare `exports.*` CJS guard pattern that esbuild (Vite's transformer) would mishandle, binding all `b2*` constructors to an internal shim instead of `window`. The proven mitigation is to inject box2d as a classic `<script>` tag at runtime using a thin ESM wrapper (`src/lib/box2d-init.js`) with a `?url` import, keeping box2d entirely outside Vite's module graph.

The new entry point is `src/main.js` — an async module that controls load order: seedrandom side-effect import first (patches `Math.seedrandom`), then the async box2d loader (injects classic script, awaits load), then the app.js side-effect import (IIFE executes with all globals available). This replaces the five `<script>` tags in `index.html` with a single `<script type="module">`.

One critical prerequisite fix is required in `src/app.js` before the production build will succeed: `cw_runningInterval` is assigned without a `var`/`let`/`const` declaration (implicit global). Rollup's strict-mode production bundle throws `ReferenceError` at this assignment. The fix is a one-line `var` declaration in the state variables section.

**Primary recommendation:** Create `src/main.js` (async entry with `await loadBox2d()`), create `src/lib/box2d-init.js` (ESM wrapper with `?url` import), add `var cw_runningInterval;` to `src/app.js` line 1477, update `index.html`, initialize Yarn PnP, then run `yarn dev` and `yarn build && yarn preview` as smoke tests.

---

## Standard Stack

### Core

| Library  | Version                    | Purpose                                | Why Standard                                                                               |
| -------- | -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| vite     | 6.4.1                      | Dev server + production bundler        | Stable rollup 4 + esbuild 0.25; v8 excluded (rolldown RC); verified in local grocy project |
| yarn     | 4.13.0 (Berry)             | Package manager with PnP zero-installs | Contributors clone and run without `yarn install`; confirmed working with Vite 6.4.1       |
| corepack | 0.34.6 (already installed) | Manages Yarn Berry installation        | Bundled with Node 20; enables `yarn set version 4.13.0`                                    |

### Supporting (Phase 2 — declared in package.json now, used in Phase 2)

| Library             | Version | Purpose                    | When to Use                                                          |
| ------------------- | ------- | -------------------------- | -------------------------------------------------------------------- |
| vitest              | 4.1.2   | Unit test framework        | Phase 2 only; `package.json` declares it so `yarn test` has a target |
| @vitest/coverage-v8 | 4.1.2   | Coverage reporting         | Phase 2 only; must match vitest version exactly                      |
| jsdom               | 29.0.1  | DOM environment for Vitest | Phase 2 only                                                         |

**Installation — Phase 1 only:**

```bash
# Step 1: Enable corepack (manages Yarn Berry)
corepack enable

# Step 2: Navigate to project root and initialize
# (do NOT run `yarn init -2` — it auto-generates a package.json;
#  write package.json manually with the exact content below first)
yarn set version 4.13.0

# Step 3: Verify .yarnrc.yml was created/updated, then install
yarn install
```

**Version verification:**

```bash
npm view vite version          # 8.0.3 (latest) — use 6.4.1 pinned
npm view vite@6.4.1 version    # 6.4.1 confirmed
npm view vitest version        # 4.1.2 confirmed
```

---

## Architecture Patterns

### Recommended Project Structure (after Phase 1)

```
HTML5_Genetic_Cars/
├── package.json              # NEW — deps, scripts, Yarn config
├── vite.config.js            # NEW — Vite SPA config
├── .yarnrc.yml               # NEW — Yarn PnP config
├── yarn.lock                 # NEW — deterministic lockfile
├── .pnp.cjs                  # GENERATED + COMMITTED
├── .pnp.loader.mjs           # GENERATED + COMMITTED
├── .yarn/
│   ├── cache/                # GENERATED + COMMITTED (minus native binaries)
│   └── releases/
│       └── yarn-4.13.0.cjs   # COMMITTED — Yarn binary
├── index.html                # MODIFIED — 5 script tags → 1 module script
├── src/
│   ├── app.js                # MODIFIED — add var cw_runningInterval only
│   ├── main.js               # NEW — async module entry point
│   └── lib/
│       └── box2d-init.js     # NEW — ESM wrapper for box2d classic script injection
├── lib/
│   ├── box2d.js              # UNCHANGED
│   └── seedrandom.js         # UNCHANGED
└── styles.css                # UNCHANGED
```

### Pattern 1: Async ESM Entry Point for Legacy IIFE Apps

**What:** A `src/main.js` that uses top-level `await` to control load order: sync side-effect imports first, then async operations (classic script injection), then the IIFE side-effect import.

**When to use:** When a legacy IIFE depends on globals that must be populated before it executes, and one of those globals comes from a script that cannot be safely processed by the bundler.

**Example:**

```js
// src/main.js
// Source: Derived from codebase analysis + Vite 6 docs pattern

// 1. Patch Math.seedrandom — must run before app.js calls Math.seedrandom()
//    seedrandom.js is a plain IIFE with no CJS markers — side-effect import works directly.
import "../lib/seedrandom.js";

// 2. Load box2d.js as a classic script so the CJS guard never fires.
//    The ESM wrapper handles the async injection and returns only after
//    window.b2Vec2 etc. are guaranteed to be available.
import { loadBox2d } from "./lib/box2d-init.js";
await loadBox2d();

// 3. Execute the IIFE — all globals are now on window.
//    Dynamic import is required here because static imports are hoisted
//    and would run before the await above. Using dynamic import ensures
//    app.js does not execute until loadBox2d() resolves.
await import("./app.js");
```

**Critical note on static vs. dynamic import for app.js:** If you write `import "./app.js"` (static), ES module semantics hoist the import and execute it before the `await loadBox2d()`. You MUST use `await import("./app.js")` (dynamic import) so that execution is deferred until after box2d is loaded.

### Pattern 2: box2d ESM Wrapper via `?url` Import

**What:** A thin `src/lib/box2d-init.js` that uses Vite's `?url` suffix to get the resolved URL of `lib/box2d.js` (hashed in production), then injects it as a classic `<script>` tag.

**When to use:** For any vendored library that uses a bare `exports.*` CJS pattern without a proper module wrapper, where esbuild would misclassify it as CommonJS.

**Example:**

```js
// src/lib/box2d-init.js
// Source: Vite docs — ?url static asset imports

// ?url tells Vite: give me the URL of this file, don't transform it.
// In dev: "/lib/box2d.js"
// In prod: "/assets/box2d-[contenthash].js" (content-hashed, served from dist/assets/)
import box2dUrl from "/lib/box2d.js?url";

export async function loadBox2d() {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = box2dUrl; // Uses the resolved (possibly hashed) URL
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

**Why `/lib/box2d.js?url` not `../lib/box2d.js?url`:** The `/lib/box2d.js` path is an absolute path from the Vite root (project root where `index.html` lives). This is reliable across both dev and build modes. A relative path (`../../lib/box2d.js`) from `src/lib/box2d-init.js` also works but is more brittle if the file is moved.

### Pattern 3: Static vs. Dynamic Import Order for Globals

**What:** In an async entry point that depends on runtime globals, static `import` statements are hoisted and execute before any `await`. Use `await import()` for modules that must run AFTER an async operation.

**Anti-pattern (incorrect):**

```js
// WRONG — static import is hoisted, app.js runs BEFORE await loadBox2d() resolves
import "../lib/seedrandom.js";
import "./app.js"; // Hoisted! Runs before loadBox2d()
import { loadBox2d } from "./lib/box2d-init.js";
await loadBox2d();
```

**Correct pattern:**

```js
// CORRECT — dynamic import defers app.js until after loadBox2d() resolves
import "../lib/seedrandom.js"; // Static: hoisted, runs first (safe — no await needed)
import { loadBox2d } from "./lib/box2d-init.js"; // Static: hoisted (safe — imports fn)
await loadBox2d(); // Awaited: box2d globals now on window
await import("./app.js"); // Dynamic: runs after await, IIFE has all globals
```

### Anti-Patterns to Avoid

- **`import * as Box2D from "../lib/box2d.js"` + `Object.assign(globalThis, Box2D)`:** This approach is unreliable with the box2d.js file structure (bare `exports.*` at end of 11K-line file, no module wrapper). The `?url` + classic script approach is zero-risk.
- **Adding box2d.js `<script>` tag back to index.html alongside `<script type="module">`:** Creates a load order race. Module scripts are deferred; the plain `<script>` tag runs synchronously during HTML parsing, but the deferred module may reference `b2Vec2` before the script tag fires.
- **`optimizeDeps.include: ["./lib/box2d.js"]`:** This syntax is for node_modules package names, not local file paths. Silently ignored or causes errors.
- **`vite-plugin-commonjs` or `@originjs/vite-plugin-commonjs`:** Both abandoned or untested with Vite 6. The ESM wrapper is a zero-dependency 10-line solution.

---

## Don't Hand-Roll

| Problem                      | Don't Build                      | Use Instead                                              | Why                                                                                                                     |
| ---------------------------- | -------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Classic script injection     | Custom fetch-and-execute pattern | `document.createElement('script')` with `src` + `onload` | The `<script>` + `src` approach is the canonical browser mechanism with full browser security policy compliance         |
| CJS-to-ESM shim for box2d    | Custom transform plugin          | `?url` import + classic script                           | Plugin approach requires understanding esbuild's CJS detection internals; classic script sidesteps the problem entirely |
| Yarn PnP compatibility check | Manual dependency audit          | `yarn dlx @yarnpkg/doctor`                               | Doctor catches all PnP incompatibilities including esbuild native binary issues                                         |

**Key insight:** The fewer transformations applied to `lib/box2d.js`, the better. The file was designed to run as a plain browser script. The ESM wrapper preserves that contract rather than fighting the bundler.

---

## Common Pitfalls

### Pitfall 1: `src/main.js` Is Gitignored

**What goes wrong:** The existing `.gitignore` (line 20) contains a bare `main.js` pattern. The new `src/main.js` matches this pattern and will not be committed.

**Why it happens:** The gitignore predates the project — `main.js` likely referred to some old build artifact. No `main.js` currently exists at any path in the repo.

**How to avoid:** Remove `main.js` from `.gitignore` (line 20 — bare filename entry). Do this as the first step of the Yarn PnP plan, before creating `src/main.js`.

**Warning signs:** `git status` shows `src/main.js` as untracked even after `git add src/main.js`; `git add src/main.js` succeeds silently but nothing appears in `git status`.

### Pitfall 2: Static Import of app.js Bypasses `await loadBox2d()`

**What goes wrong:** ES module spec hoists all `import` declarations. If `src/main.js` uses `import "./app.js"` (static), the IIFE in `app.js` executes before `await loadBox2d()` resolves. Box2D globals (`b2Vec2`, `b2World`) are undefined when the IIFE runs, crashing on the first physics object construction.

**Why it happens:** Developers assume that because `import "./app.js"` appears after `await loadBox2d()` in the source text, it executes after the await. It does not — static imports are hoisted regardless of position.

**How to avoid:** Use `await import("./app.js")` (dynamic import) as the last line of `src/main.js`. This defers execution until the awaited promise resolves.

**Warning signs:** `b2Vec2 is not defined` in the browser console immediately on page load, even though box2d-init.js appears to be executing.

### Pitfall 3: `cw_runningInterval` Throws ReferenceError in Production Build

**What goes wrong:** `cw_runningInterval` is assigned at line 1714 and cleared at line 1722 in `src/app.js`, but is never declared with `var`/`let`/`const`. In the browser with plain `<script>` tags, assigning to an undeclared variable creates an implicit global — tolerated by the browser. In Vite's production build, Rollup wraps the module graph in its own strict-mode IIFE. Assigning to an undeclared variable in strict mode throws `ReferenceError: cw_runningInterval is not defined`.

**Location:** Lines 1714 and 1722 of `src/app.js`. The assignment is inside `toggleDisplay()` (the "Surprise!" button handler). The fix location is the state variables section at line 1477, alongside `var doDraw`, `var cw_paused`, `var cw_animationFrameId`.

**Exact fix:**

```js
// In src/app.js, at line 1477 (after the existing var declarations):
// Current state (lines 1477-1479):
var doDraw = true;
var cw_paused = false;
var cw_animationFrameId = null;

// ADD immediately after:
var cw_runningInterval; // Used by toggleDisplay() for the setInterval handle
```

**Why it happens:** Dev mode (esbuild transforms) is permissive; production build (Rollup) enforces strict mode.

**How to avoid:** Always run `yarn build && yarn preview` as the acceptance test for Phase 1, not just `yarn dev`.

**Warning signs:** App works in `yarn dev` but crashes immediately in `yarn preview`; `ReferenceError` in the production bundle's console.

### Pitfall 4: `window.cw_setCameraTarget` Timing Gap

**What goes wrong:** `index.html` has two inline onclick handlers: `onclick="cw_setCameraTarget(-1)"` (line 189, "Watch Leader" button) and `onclick="cw_setCameraTarget(this.car_index)"` (line 300, healthbar). These resolve from `window` at call time. The function is assigned to `window` at line 2203 of `src/app.js`, which runs when the module finishes loading. Module scripts are deferred — they execute after the DOM is parsed, not during. A user clicking "Watch Leader" before the module finishes loading will get `cw_setCameraTarget is not defined`.

**How to avoid:** Add `disabled` attribute to the "Watch Leader" button at line 189 of `index.html`. Remove the `disabled` attribute at the end of `cw_init()` (line 2100) in `src/app.js`. Health bars are generated dynamically by `cw_init()` so they are not accessible before init anyway.

**Minimal fix in `index.html` (line 189):**

```html
<!-- BEFORE: -->
<input type="button" value="Watch Leader" onclick="cw_setCameraTarget(-1)" />

<!-- AFTER: -->
<input
  type="button"
  value="Watch Leader"
  onclick="cw_setCameraTarget(-1)"
  id="watch-leader-btn"
  disabled
/>
```

**Minimal fix in `src/app.js` at the end of `cw_init()` body (line 2099, just before `cw_startSimulation()`):**

```js
var watchLeaderBtn = document.getElementById("watch-leader-btn");
if (watchLeaderBtn) {
  watchLeaderBtn.disabled = false;
}
```

**Note:** This is a low-risk timing issue. It only manifests if a user clicks before the module loads. For smoke testing purposes, it is acceptable to defer this fix if blocking progress, but it should be addressed before Phase 1 is declared complete.

### Pitfall 5: `.yarn/cache/` Binary Blob Inflation

**What goes wrong:** Vite's devDependencies include `@esbuild/darwin-arm64` (~5MB zip) and `@rollup/rollup-darwin-arm64` (~3MB zip). Committing these to `.yarn/cache/` inflates the initial commit by 8MB+. Every Vite or Rollup upgrade after this adds more blobs to git history permanently (requires `git filter-repo` to remove — expensive).

**How to avoid:** Add platform-specific zip exclusions to `.gitignore` BEFORE running `git add .yarn/cache`. The exact patterns:

```gitignore
# In .gitignore — add before committing .yarn/cache:
.yarn/cache/@esbuild-*
.yarn/cache/@rollup-*
```

**Run `du -sh .yarn/cache/` after `yarn install` to audit size.** Target: under 20MB after excluding native binary zips.

**Warning signs:** `du -sh .yarn/cache/` reports 50MB+; `ls .yarn/cache/` shows `@esbuild-*` or `@rollup-*` entries.

### Pitfall 6: Yarn PnP esbuild Native Binary Issues

**What goes wrong:** esbuild ships platform-specific native binaries. Yarn PnP resolves packages through its virtual filesystem. Some versions of esbuild use `require()` with `__dirname`-relative paths that fail under PnP because the physical path does not exist.

**How to avoid:** Run `yarn dlx @yarnpkg/doctor` immediately after `yarn install`. The doctor detects PnP incompatibilities. If esbuild issues appear, add to `.yarnrc.yml`:

```yaml
pnpIgnorePatterns:
  - "**/esbuild/**"
```

**Evidence:** The local `grocy` project uses Yarn 4.13.0 + Vite 6.4.1 with PnP successfully — HIGH confidence the combination works without the ignore pattern. The doctor check is cheap insurance.

### Pitfall 7: `build.outDir: "build"` vs `"dist"`

**What goes wrong:** The STACK.md example `vite.config.js` uses `build.outDir: "build"`. BUILD-02 requires the bundle in `dist/`. Both `dist/` and `build/` are already gitignored in `.gitignore` (lines 198-199). The conflict is only a matter of which directory name matches the stated requirement.

**How to avoid:** Set `build.outDir: "dist"` to match the BUILD-02 requirement and Vite's own convention.

---

## Code Examples

### Exact `package.json`

```json
{
  "name": "html5-genetic-cars",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "yarn@4.13.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^6.4.1",
    "vitest": "^4.1.2",
    "@vitest/coverage-v8": "^4.1.2",
    "jsdom": "^29.0.1"
  }
}
```

Notes:

- `"type": "module"` — required for Vite 6 ESM entry point
- `"private": true` — standard for non-published apps
- `packageManager` field without sha512 suffix is acceptable for initial setup; Yarn adds the hash on first `yarn install`
- Vitest, coverage-v8, and jsdom are declared here even though Phase 2 uses them — `package.json` is created once and both phases share it

### Exact `vite.config.js`

```js
import { defineConfig } from "vite";

export default defineConfig({
  // index.html at project root is the Vite entry (default — no change needed)

  build: {
    outDir: "dist",
    target: "es2020",
  },

  server: {
    port: 5173,
    open: true,
  },

  // optimizeDeps.exclude prevents esbuild from attempting to pre-bundle
  // these files. box2d.js uses `if(typeof exports !== "undefined")` which
  // esbuild detects as CJS and may mishandle. seedrandom.js is a plain IIFE
  // and likely safe, but excluding it is a precaution.
  optimizeDeps: {
    exclude: ["./lib/box2d.js", "./lib/seedrandom.js"],
  },
});
```

Note: Vitest config goes in a separate `vitest.config.js` (Phase 2). Do not add a `test:` key to this file in Phase 1.

### Exact `src/lib/box2d-init.js`

```js
// src/lib/box2d-init.js
//
// Loads lib/box2d.js as a classic <script> tag to preserve its global-assignment
// behavior. box2d.js ends with:
//   if (typeof exports !== "undefined") { exports.b2World = b2World; ... }
//
// In a classic script, `exports` is undefined — the guard never fires and all
// b2* constructors land on window. Under Vite's module graph, esbuild would
// provide an `exports` shim, routing all b2* into the shim instead of window.
//
// The `?url` suffix tells Vite: "give me the URL of this asset, don't process it."
// Dev: "/lib/box2d.js"
// Build: "/assets/box2d-[contenthash].js"

import box2dUrl from "/lib/box2d.js?url";

export async function loadBox2d() {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = box2dUrl;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

### Exact `src/main.js`

```js
// src/main.js — Vite entry point
//
// Replaces the five <script> tags that were in index.html:
//   <script src="lib/seedrandom.js">     -> static side-effect import (first)
//   <script src="lib/box2d.js">          -> async classic script injection (second)
//   <script src=".../d3.v3.min.js">      -> removed (d3 unused in src/app.js)
//   <script src=".../vis.min.js">        -> removed (vis unused in src/app.js)
//   <script src="src/app.js">            -> dynamic import after loadBox2d() resolves
//
// Import order is deterministic:
//   Static imports are hoisted and evaluated before the module body.
//   `await loadBox2d()` blocks until box2d globals are on window.
//   `await import("./app.js")` is deferred until after the await above.

import "../lib/seedrandom.js"; // Side-effect: patches Math.seedrandom
import { loadBox2d } from "./lib/box2d-init.js";

await loadBox2d(); // Injects <script src="...box2d.js">
// and waits for onload. All b2* are
// now on window when this resolves.

await import("./app.js"); // IIFE executes; reads window.b2Vec2 etc.
// and calls Math.seedrandom() safely.
```

### Exact `index.html` Changes

```html
<!-- === REMOVE from <head> (line 7): === -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.css"
/>

<!-- === REMOVE from bottom of <body> (lines 305-309): === -->
<script src="lib/seedrandom.js"></script>
<script src="lib/box2d.js"></script>
<script src="https://d3js.org/d3.v3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js"></script>
<script src="src/app.js"></script>

<!-- === ADD at bottom of <body> (replacing the 5 removed lines): === -->
<script type="module" src="/src/main.js"></script>
```

Also add `disabled` to the Watch Leader button for the timing gap fix (line 189):

```html
<!-- BEFORE: -->
<input type="button" value="Watch Leader" onclick="cw_setCameraTarget(-1)" />

<!-- AFTER: -->
<input
  type="button"
  value="Watch Leader"
  onclick="cw_setCameraTarget(-1)"
  id="watch-leader-btn"
  disabled
/>
```

### Exact `cw_runningInterval` Fix in `src/app.js`

**Location:** `src/app.js` line 1477. The `cw_runningInterval` variable is used at lines 1714 and 1722 inside `toggleDisplay()` but never declared.

**Existing code at lines 1477-1479:**

```js
var doDraw = true;
var cw_paused = false;
var cw_animationFrameId = null;
```

**After fix (add one line):**

```js
var doDraw = true;
var cw_paused = false;
var cw_animationFrameId = null;
var cw_runningInterval; // setInterval handle for toggleDisplay() "Surprise!" mode
```

This is the minimal change to `src/app.js` required for Phase 1.

### Exact `.yarnrc.yml`

```yaml
nodeLinker: pnp

enableGlobalCache: false

yarnPath: .yarn/releases/yarn-4.13.0.cjs
```

`enableGlobalCache: false` forces package zips into `.yarn/cache/` (project-local) rather than `~/.yarn/berry/cache/`. This is what makes zero-installs portable — the cache travels with the repository.

### Yarn PnP Initialization Sequence

```bash
# Prerequisites confirmed: Node.js 20.20.1, corepack 0.34.6

# Step 1: Enable corepack (idempotent — safe to run even if already enabled)
corepack enable

# Step 2: Write package.json manually (see exact content above)
# Do NOT run `yarn init -2` — it auto-generates a package.json that
# differs from the exact content we need (version, private, type fields).

# Step 3: Pin Yarn 4.13.0 as the project Yarn version.
# This downloads yarn-4.13.0.cjs into .yarn/releases/ and
# writes yarnPath to .yarnrc.yml (creating .yarnrc.yml if absent).
yarn set version 4.13.0

# Step 4: Verify .yarnrc.yml has nodeLinker: pnp and enableGlobalCache: false.
# If `yarn set version` created .yarnrc.yml with only yarnPath,
# manually add the other two lines.
cat .yarnrc.yml

# Step 5: Install dependencies (creates .pnp.cjs, .yarn/cache/, yarn.lock)
yarn install

# Step 6: Run the PnP doctor IMMEDIATELY to detect native binary issues
yarn dlx @yarnpkg/doctor

# Step 7: Audit cache size before committing
du -sh .yarn/cache/
# Target: under 30MB. If over, inspect:
#   ls .yarn/cache/@esbuild-* .yarn/cache/@rollup-*

# Step 8: Update .gitignore (see section below) BEFORE committing .yarn/cache
```

### What to Commit vs. Gitignore for Yarn PnP

**Commit these (zero-installs contract):**

```
.yarn/cache/           # Package zip archives (minus native binary zips — see below)
.yarn/releases/        # yarn-4.13.0.cjs — Yarn itself
.yarn/plugins/         # Yarn plugins (empty initially)
.yarn/sdks/            # IDE integrations (empty until `yarn sdks vscode` is run)
.yarn/versions/        # Version constraint files (may be empty)
.pnp.cjs               # PnP runtime loader (CJS)
.pnp.loader.mjs        # PnP runtime loader (ESM)
yarn.lock              # Dependency lockfile
.yarnrc.yml            # Yarn configuration
package.json           # Project manifest
```

**.gitignore additions (add to existing `.gitignore`):**

```gitignore
# Yarn PnP zero-installs — keep cache and runtime, ignore generated state
.yarn/*
!.yarn/cache
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

# Exclude platform-specific native binary zips from cache
# (cannot be shared across platforms; inflate git history)
.yarn/cache/@esbuild-*
.yarn/cache/@rollup-*

# Vite build output
dist/

# No node_modules — Yarn PnP replaces it
node_modules
```

**Also remove `main.js` from `.gitignore` (currently line 20):**

The existing `.gitignore` contains `main.js` as a bare filename. This matches `src/main.js` and would prevent it from being committed. Remove this entry entirely — no `main.js` file exists at the project root, so removing this entry has no other effect.

**What is excluded by `.yarn/*` but re-included by negations:**

`.yarn/*` excludes everything under `.yarn/`. The `!.yarn/cache` negation re-includes `cache/`. The `!.yarn/releases` negation re-includes the Yarn binary. `.yarn/install-state.gz`, `.yarn/unplugged/`, and `.yarn/build-state.yml` are correctly excluded by `.yarn/*` and are NOT re-included — they are machine-generated state, not portable artifacts.

---

## box2d.js `?url` Import in Production — Gotchas

### Asset Hashing in Production Build

When `vite build` runs, the `?url` import causes Vite to copy `lib/box2d.js` into `dist/assets/` with a content hash:

```
dist/assets/box2d-[contenthash8].js   # e.g. dist/assets/box2d-c3d7a1e2.js
```

The `box2dUrl` variable in `src/lib/box2d-init.js` resolves to this hashed path at build time. This is correct behavior — the `?url` import resolves to the hashed URL automatically. No manual path configuration is needed.

**Verification:** After `yarn build`, inspect `dist/assets/` — a `box2d-*.js` file should exist. Run `yarn preview` and check the Network tab — the request for `box2d-[hash].js` should return 200 with the box2d source.

### Path Resolution

The `?url` import path `/lib/box2d.js` uses an absolute path from the Vite root. The Vite root is the project root (where `index.html` lives). This means `/lib/box2d.js` resolves to `<project-root>/lib/box2d.js`, which is correct.

**Caution:** If you write `../../lib/box2d.js?url` (relative from `src/lib/`), it also works but is more sensitive to directory restructuring. The absolute path `/lib/box2d.js` is preferred.

### Cache Busting

Content hashing means: if `lib/box2d.js` is unchanged between builds, it gets the same hash and the browser serves it from cache. This is correct — box2d.js never changes during development.

### Fallback Strategy (if `?url` approach fails)

If Vite does not copy box2d.js to `dist/assets/` during the build, the fallback documented in STATE.md is to keep box2d.js as a `<script>` tag in `index.html` with `optimizeDeps.exclude`. This fallback preserves simulation but keeps box2d.js outside the Vite-managed asset pipeline. Use only if the `?url` approach fails during Plan 5 smoke test.

---

## Environment Availability

| Dependency           | Required By                   | Available         | Version | Fallback                              |
| -------------------- | ----------------------------- | ----------------- | ------- | ------------------------------------- |
| Node.js              | Vite dev server, yarn         | Yes               | 20.20.1 | —                                     |
| corepack             | Yarn Berry install            | Yes               | 0.34.6  | —                                     |
| yarn (classic 3.6.4) | Not used after setup          | Yes               | 3.6.4   | Replaced by Berry                     |
| yarn (Berry 4.13.0)  | PnP zero-installs             | Not yet installed | —       | `yarn set version 4.13.0` installs it |
| git                  | Commit zero-install artifacts | Yes (assumed)     | —       | —                                     |
| Browser              | Smoke test                    | Yes               | Modern  | —                                     |

**Missing dependencies with no fallback:** None — all installation handled by `yarn set version 4.13.0`.

**Stale `node_modules/` present:** The project has `node_modules/` containing Vite 5.4.21 (from the WASM build variant's old dev tools) with no `package.json` at root. This directory must be deleted (`rm -rf node_modules/`) before Yarn PnP setup to prevent resolution conflicts.

**Existing `dist/` directory:** The project has a `dist/` directory containing the WASM variant's pre-built output. Running `vite build` will overwrite this. If the WASM variant's `dist/` output needs to be preserved, move it before running `vite build` (e.g., to `dist-wasm/`). This is a project decision, not a blocker — `dist/` is already gitignored.

---

## Validation Architecture

No `.planning/config.json` exists — treating `nyquist_validation` as enabled. Phase 1 has no automated test files (tests are Phase 2), but validation is enforced through smoke testing and build verification.

### Test Framework

| Property           | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Framework          | Vitest 4.1.2 (declared in package.json; no config file in Phase 1) |
| Config file        | None in Phase 1 — `vitest.config.js` is Phase 2                    |
| Quick run command  | `yarn test` (exits 0 with "No test files found")                   |
| Full suite command | `yarn build && yarn preview` (production smoke test)               |

### Phase Requirements to Verification Map

| Req ID    | Behavior                            | Verification                                                  | Automated?      |
| --------- | ----------------------------------- | ------------------------------------------------------------- | --------------- | --------- | --------------------- | --------- |
| BUILD-01  | `yarn dev` starts at localhost:5173 | `yarn dev` exits without error, browser opens                 | Manual          |
| BUILD-02  | `yarn build` produces dist/         | `yarn build` exits 0; `ls dist/index.html`                    | Semi-auto       |
| BUILD-03  | `yarn preview` works                | Run `yarn preview`, verify simulation                         | Manual          |
| BUILD-04  | No node_modules, cache committed    | `ls node_modules` fails; `ls .yarn/cache/*.zip` returns files | Semi-auto       |
| BUILD-05  | Offline install works               | `yarn install --offline` after initial setup                  | Manual          |
| BUILD-06  | Correct git tracking                | `git status` check                                            | Semi-auto       |
| BUILD-07  | All four scripts present            | `grep -E '"dev"                                               | "build"         | "preview" | "test"' package.json` | Semi-auto |
| DEP-01    | box2d loaded as classic script      | Network tab shows `box2d-*.js` loaded as `<script>`           | Manual          |
| DEP-02    | b2\* globals accessible             | `typeof b2Vec2 === 'function'` in browser console             | Browser console |
| DEP-03    | seedrandom determinism              | Terrain identical on two hard refreshes                       | Manual          |
| DEP-04/05 | CDN tags removed                    | `grep -c "d3js.org\|vis.min" index.html` returns 0            | Semi-auto       |
| DEP-06    | main.js is entry                    | `grep "main.js" index.html` returns 1 match                   | Semi-auto       |
| DEP-07    | Camera button works                 | Click Watch Leader after simulation starts                    | Manual          |
| FIX-01    | cw_runningInterval declared         | `grep "var cw_runningInterval" src/app.js` returns match      | Semi-auto       |

### Acceptance Criteria (Phase Gate — all required before Phase 2)

1. `yarn dev` — browser opens, simulation runs to at least Generation 2, no console errors
2. `yarn build` — exits 0, `dist/index.html` exists, `dist/assets/box2d-*.js` exists
3. `yarn preview` — simulation runs identically to `yarn dev`, no console errors
4. `typeof b2Vec2 === 'function'` in browser console (both dev and preview modes)
5. Terrain is identical on two consecutive hard refreshes (seedrandom determinism)
6. "Watch Leader" button works after simulation starts
7. "Surprise!" button toggles display without crashing (verifies `cw_runningInterval` fix)
8. `git status` — `.pnp.cjs`, `.yarn/cache/`, `.yarn/releases/` tracked; `node_modules/` absent; `dist/` untracked
9. `grep -n "d3js.org\|vis.min" index.html` returns no matches

### Wave 0 Gaps

- [ ] No `vitest.config.js` — intentional for Phase 1; created in Phase 2
- [ ] No test files — intentional for Phase 1; Phase 2 creates `tests/` directory
- [ ] Framework install: `yarn install` — part of Plan 1

---

## Recommended Plan Breakdown

The phase has clear dependency ordering that maps to 5 plans:

### Plan 1: Yarn PnP Foundation

**Scope:** Delete `node_modules/`, write `package.json`, initialize Yarn Berry 4.13.0, configure `.yarnrc.yml`, run `yarn install`, run `@yarnpkg/doctor`, configure `.gitignore`, commit zero-install artifacts.

**Rationale:** This is the base everything else depends on. Must complete and commit before any other plan.

**Key tasks:**

1. Delete `node_modules/` — `rm -rf node_modules/`
2. Write `package.json` (exact content above)
3. `corepack enable`
4. `yarn set version 4.13.0`
5. Verify and complete `.yarnrc.yml` (add `nodeLinker: pnp` and `enableGlobalCache: false` if missing)
6. `yarn install`
7. `yarn dlx @yarnpkg/doctor` — resolve any issues before proceeding
8. `du -sh .yarn/cache/` — audit size
9. Update `.gitignore`:
   - Remove `main.js` (line 20)
   - Add Yarn PnP block (`.yarn/*` + negations)
   - Add `@esbuild-*` and `@rollup-*` cache exclusions
   - Ensure `dist/` is listed (already present line 198)
10. Commit: `package.json`, `.yarnrc.yml`, `yarn.lock`, `.pnp.cjs`, `.pnp.loader.mjs`, `.gitignore`, `.yarn/cache/`, `.yarn/releases/`

**Success signal:** `yarn --version` reports `4.13.0`; `ls node_modules` fails; `ls .yarn/cache/*.zip | wc -l` returns > 5.

### Plan 2: Vite Config + box2d ESM Wrapper

**Scope:** Write `vite.config.js`, create `src/lib/` directory, write `src/lib/box2d-init.js`, write `src/main.js`.

**Rationale:** Config and new file creation — no existing file changes yet. These three files are the core of the Vite integration.

**Key tasks:**

1. Write `vite.config.js` at project root (exact content above)
2. `mkdir -p src/lib`
3. Write `src/lib/box2d-init.js` (exact content above)
4. Write `src/main.js` (exact content above)
5. Commit these four files

**Success signal:** `yarn vite --version` reports 6.x.x; files exist with correct content.

### Plan 3: index.html Migration

**Scope:** Remove 5 script/link tags from `index.html`, add `<script type="module" src="/src/main.js">`, add `disabled` to Watch Leader button.

**Rationale:** This is the point-of-no-return for the static serving approach. Do after `src/main.js` and `src/lib/box2d-init.js` exist.

**Key tasks:**

1. Remove `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/libs/vis/4.20.0/vis.min.css">` (line 7)
2. Remove the 5 `<script>` tags at lines 305-309
3. Add `<script type="module" src="/src/main.js"></script>` at bottom of `<body>`
4. Add `id="watch-leader-btn" disabled` to Watch Leader button (line 189)
5. Commit `index.html`

**Success signal:** `grep -c "seedrandom\|box2d.js\|d3.v3\|vis.min\|src/app.js" index.html` returns 0; `grep "main.js" index.html` returns 1.

### Plan 4: `cw_runningInterval` Fix in `src/app.js`

**Scope:** Add `var cw_runningInterval;` declaration at line 1477 of `src/app.js`. Add Watch Leader button re-enable in `cw_init()`.

**Rationale:** One-line fix isolated to its own plan for an atomic, reviewable commit. This is the only required change to `src/app.js`.

**Key tasks:**

1. Add `var cw_runningInterval;` after line 1479 (`var cw_animationFrameId = null;`)
2. Add Watch Leader button re-enable at end of `cw_init()` body (line 2099):
   ```js
   var watchLeaderBtn = document.getElementById("watch-leader-btn");
   if (watchLeaderBtn) {
     watchLeaderBtn.disabled = false;
   }
   ```
3. Commit `src/app.js`

**Success signal:** `grep "var cw_runningInterval" src/app.js` returns a match.

### Plan 5: Smoke Test + Acceptance Verification

**Scope:** Run `yarn dev`, verify simulation, run `yarn build && yarn preview`, verify production build, document all acceptance criteria results.

**Rationale:** Dedicated verification plan ensures every acceptance criterion is explicitly checked and documented before Phase 2 begins.

**Key tasks:**

1. `yarn dev` — run all manual smoke checks
2. Browser console: `typeof b2Vec2 === 'function'` check
3. Two hard refreshes — verify terrain determinism
4. Click "Watch Leader" — verify no error
5. Click "Surprise!" — verify simulation continues without crash
6. `yarn build` — inspect `dist/` contents
7. `yarn preview` — repeat all smoke checks on production bundle
8. `git status` — verify correct file tracking
9. `grep -n "d3js.org\|vis.min" index.html` — verify CDN removal
10. Update STATE.md to reflect Phase 1 complete

**Success signal:** All 9 acceptance criteria from the list above pass.

---

## Open Questions

1. **`await import("./app.js")` in Vite 6 top-level await context**
   - What we know: Vite 6 with `target: "es2020"` supports top-level `await` in module entry points. Modern browsers (Chrome 89+, Safari 15+) support TLA natively.
   - What's unclear: Whether Vite's production bundle wraps the entry in a way that prevents TLA. The `type: "module"` on `<script>` ensures TLA is available.
   - Recommendation: Use `await import("./app.js")` as written. If build fails citing TLA, the fallback is to wrap in an immediately-invoked async function: `(async function init() { await loadBox2d(); await import("./app.js"); })();`

2. **Existing WASM `dist/` directory**
   - What we know: `dist/` contains `app.js` (2118-line Vite bundle), `assets/` with WASM files. `vite build` will write to `dist/` and overwrite these.
   - What's unclear: Whether the WASM variant needs to be preserved. CLAUDE.md says it's an alternate build variant but the main app is the JS path.
   - Recommendation: Decide in Plan 1 whether to move the WASM dist to `dist-wasm/` before running `vite build`. If the WASM variant is still needed, it should be preserved. If it's purely historical, let `vite build` overwrite it.

3. **`?url` path — absolute `/lib/box2d.js` vs relative**
   - What we know: Both should work with Vite 6. The absolute path is more explicit.
   - Recommendation: Use `/lib/box2d.js?url` as documented. Verify in Plan 5 that `dist/assets/box2d-*.js` exists after build.

---

## State of the Art

| Old Approach                         | Current Approach                            | When Changed | Impact                                                   |
| ------------------------------------ | ------------------------------------------- | ------------ | -------------------------------------------------------- |
| `<script src="lib/box2d.js">` global | `?url` import + `createElement('script')`   | Phase 1      | box2d stays outside module graph; b2\* still on window   |
| `<script src="lib/seedrandom.js">`   | `import "../lib/seedrandom.js"` side-effect | Phase 1      | Same execution; load order now explicit and enforced     |
| CDN d3 + vis scripts                 | Removed entirely                            | Phase 1      | Eliminates external network dependency on unused scripts |
| `python3 -m http.server`             | `yarn dev` (Vite HMR)                       | Phase 1      | Auto-reload on file save; no manual refresh              |
| No build step                        | `yarn build` produces dist/                 | Phase 1      | Production bundle with content-hashed assets             |
| npm + node_modules                   | Yarn 4 PnP zero-installs                    | Phase 1      | Clone and run without install step                       |

**Deprecated in this codebase during Phase 1:**

- Stale `node_modules/` with Vite 5.4.21: deleted before Yarn PnP setup
- `main.js` gitignore entry (line 20 of `.gitignore`): removed so `src/main.js` can be tracked
- All CDN `<script>` and `<link>` tags for d3, vis: removed from `index.html`

---

## Sources

### Primary (HIGH confidence)

- Direct inspection: `lib/box2d.js` lines 11299–11408 — CJS guard `if(typeof exports !== "undefined")` confirmed at line 11299; 109 `exports.b2*` assignments ending at line 11406
- Direct inspection: `lib/box2d.js` lines 1-30 — no module wrapper, no UMD pattern at top of file; plain function definitions from line 1
- Direct inspection: `lib/seedrandom.js` lines 260-270 — plain IIFE pattern `(function(pool, math, ...) { })([], Math, ...)` confirmed; no `exports` block
- Direct inspection: `src/app.js` lines 1714, 1722 — `cw_runningInterval` used without declaration confirmed
- Direct inspection: `src/app.js` lines 1477-1479 — state variable section confirmed as correct insertion point
- Direct inspection: `src/app.js` lines 2202-2205 — `window.cw_setCameraTarget = cw_setCameraTarget` + `cw_init()` call
- Direct inspection: `index.html` lines 7, 305-309 — exact script/link tags to remove confirmed
- Direct inspection: `index.html` line 189 — Watch Leader button without `disabled`; line 300 — healthbar onclick
- Direct inspection: `.gitignore` line 20 — `main.js` entry confirmed; lines 198-199 — `dist/` and `build/` already gitignored
- Direct inspection: `node_modules/vite/package.json` — stale Vite 5.4.21 in node_modules confirmed (no root package.json)
- Local reference: `/Users/kellen/Projects/grocy/web` — Yarn 4.13.0 (`yarn-4.13.0.cjs` in `.yarn/releases/`) + Vite 6.4.1 + PnP zero-installs confirmed working
- npm registry: `npm view vite@6.4.1 version` = 6.4.1; `npm view vitest version` = 4.1.2; both confirmed
- System: `corepack --version` = 0.34.6; `node --version` = 20.20.1 — both confirmed on this machine

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — Yarn 4.13.0 + Vite 6.4.1 configuration templates; `vite.config.js`, `.yarnrc.yml`, `package.json` content
- `.planning/research/ARCHITECTURE.md` — migration sequence; component boundary analysis; CJS interop integration point map
- `.planning/research/PITFALLS.md` — 8 documented pitfalls with prevention strategies
- `.planning/research/SUMMARY.md` — executive summary confirming HIGH-confidence approach

### Tertiary (LOW confidence — verify during Plan 5)

- Training knowledge: Vite 6 `?url` import behavior in production build (content-hashed asset path) — verify `dist/assets/box2d-*.js` exists after `yarn build`
- Training knowledge: top-level `await` support in Vite 6 entry point module — verify `yarn dev` starts without error

---

## Project Constraints (from CLAUDE.md)

Per `CLAUDE.md` directives — all plans must comply:

- `src/app.js` must remain a single-file IIFE — do not split into multiple files (Phase 1 makes only one-line change)
- DOM IDs in `index.html` are referenced directly in `src/app.js` — no ID changes in Phase 1 (Watch Leader button gets an `id` added, which is additive and safe)
- For simulation changes, verify both init paths (`cw_generationZero`, `worldRun`) and reset paths — smoke test must verify "New Population" and "Restore Saved Population" still work
- Dependencies `lib/box2d.js` and `lib/seedrandom.js` are vendored (committed to repo) — do not replace with npm packages; files stay in `lib/`
- Persistence uses localStorage keys prefixed `cw_` — no changes to generation data structures in Phase 1; save/restore must work after migration

## Metadata

**Confidence breakdown:**

- Yarn PnP initialization sequence: HIGH — grocy reference project confirmed + npm registry versions verified
- package.json content: HIGH — versions verified against npm registry
- vite.config.js content: HIGH — derived from STACK.md + direct codebase inspection
- src/main.js design (static vs dynamic import): HIGH — ES module spec behavior is well-defined; dynamic import is the required mechanism
- src/lib/box2d-init.js: HIGH — `?url` is Vite static asset feature; classic script injection is standard browser API
- index.html changes: HIGH — exact line numbers confirmed by direct inspection
- cw_runningInterval fix: HIGH — exact location confirmed by code search (lines 1714, 1722) and context read
- `main.js` gitignore conflict: HIGH — confirmed by direct inspection of `.gitignore` line 20
- `?url` in production build: MEDIUM — behavior is documented Vite feature but not yet verified in this project

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (Vite 6.x stable; Yarn 4.13.0 pinned; no fast-moving components)
