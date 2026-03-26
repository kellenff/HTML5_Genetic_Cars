# Architecture Research

**Domain:** Vite SPA tooling migration for legacy IIFE browser app
**Researched:** 2026-03-26
**Confidence:** HIGH (based on direct codebase inspection + Vite 5 / Yarn PnP knowledge)

---

## System Overview

The migration transforms a no-build static app into a Vite-bundled SPA. The existing
application logic (src/app.js) does not change — only the delivery mechanism changes.

```
BEFORE (static):
┌──────────────────────────────────────────────────────────────────┐
│  index.html                                                       │
│   <script src="lib/seedrandom.js">  → patches Math.seedrandom()  │
│   <script src="lib/box2d.js">       → attaches globals to window  │
│   <script src="src/app.js">         → IIFE reads globals          │
└──────────────────────────────────────────────────────────────────┘

AFTER (Vite):
┌──────────────────────────────────────────────────────────────────┐
│  index.html (Vite entry point)                                    │
│   <script type="module" src="/src/main.js">                       │
│      import './lib/seedrandom.js'   → side-effect, patches Math   │
│      import box2d from './lib/box2d.js'  → CJS interop via Vite   │
│      globalThis.b2Vec2 = box2d.b2Vec2    → re-expose as globals   │
│      import './src/app.js'          → side-effect, IIFE runs      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### What Changes

| Component           | Current State                         | After Migration                                 | Notes                                    |
| ------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| `index.html`        | Five `<script>` tags (3 CDN, 2 local) | One `<script type="module" src="/src/main.js">` | CDN scripts removed; Vite processes HTML |
| `src/main.js`       | Does not exist                        | New module entry point                          | Import orchestration only                |
| `lib/box2d.js`      | Loaded via `<script>` tag             | Imported via CJS interop in `src/main.js`       | Must re-expose globals                   |
| `lib/seedrandom.js` | Loaded via `<script>` tag             | Imported as side-effect in `src/main.js`        | Already IIFE, import = execute           |
| `package.json`      | Does not exist                        | Created at repo root                            | Declares Vite, Vitest, Yarn fields       |
| `vite.config.js`    | Does not exist                        | Created at repo root                            | SPA config                               |
| `.yarnrc.yml`       | Does not exist                        | Created at repo root                            | PnP + zero-installs config               |
| `.yarn/`            | Does not exist                        | Created by `yarn install`                       | Cache + PnP runtime                      |
| `node_modules/`     | Stale, no package.json                | Deleted, replaced by PnP                        | PnP has no node_modules                  |
| Test files          | None                                  | `src/*.test.js` (co-located)                    | Vitest discovers by convention           |

### What Does Not Change

| Component                          | Reason                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `src/app.js` (entire IIFE)         | Out of scope for this milestone                      |
| `styles.css`                       | No build processing needed                           |
| `lib/box2d.js` (file content)      | Vite handles CJS interop at build time               |
| `lib/seedrandom.js` (file content) | IIFE executes on import                              |
| All DOM IDs in `index.html`        | Still referenced directly by app.js                  |
| `window.cw_setCameraTarget` global | Still set at line 2203, still used in inline onclick |
| localStorage persistence           | No change                                            |
| Simulation determinism             | seedrandom import order is controlled in main.js     |

---

## Integration Points

### 1. index.html → Vite Entry Point

Vite 5 uses `index.html` as the build entry. The HTML file itself becomes part of the
module graph. The only required change is replacing the five `<script>` tags with one
module script pointing to `src/main.js`.

**Exact change:**

```html
<!-- REMOVE these five lines: -->
<script src="lib/seedrandom.js"></script>
<script src="lib/box2d.js"></script>
<script src="https://d3js.org/d3.v3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js"></script>
<script src="src/app.js"></script>

<!-- ADD this one line: -->
<script type="module" src="/src/main.js"></script>
```

The `vis.min.css` CDN link in `<head>` is also removed (vis is unused per project
analysis). The seedrandom and box2d `<script>` loads are replaced entirely by imports
inside `src/main.js`.

**Vite HTML processing:** Vite scans `index.html` for `<script type="module">` tags and
makes that file the bundle entry. The `<link rel="stylesheet">` for `styles.css` stays —
Vite will process it as a CSS asset. No `base` configuration is needed for a standard
SPA deployment.

Confidence: HIGH — this is standard Vite 5 SPA pattern (index.html as entry).

### 2. src/app.js (IIFE) as ES Module Side-Effect

`src/app.js` is a self-executing IIFE. It does not import or export anything. Importing
it as a module causes the IIFE to execute, exactly as a `<script>` tag did.

```js
// src/main.js
import "./src/app.js"; // executes the IIFE immediately
```

The IIFE accesses:

- Box2D constructors (`b2Vec2`, `b2World`, `b2BodyDef`, etc.) — currently window globals
- `Math.seedrandom()` — patched by seedrandom.js at load time
- DOM via `document.querySelector()` — available in browser module scope
- `requestAnimationFrame` — available in browser module scope
- `window.cw_setCameraTarget` — set by the IIFE itself at line 2203

The critical constraint is that Box2D globals must be present on `globalThis` before
the IIFE executes. This is guaranteed by import order in `src/main.js` (see step 3
below).

The IIFE itself needs no modification. ES modules in browsers are deferred (execute
after DOM is parsed), so the DOMContentLoaded-equivalent timing is preserved.

Confidence: HIGH — IIFE-as-side-effect is a well-established import pattern.

### 3. box2d.js CommonJS Integration

`lib/box2d.js` uses a `typeof exports !== "undefined"` guard at line 11299:

```js
if (typeof exports !== "undefined") {
  exports.b2BoundValues = b2BoundValues;
  exports.b2Vec2 = b2Vec2;
  // ... ~120 more exports
}
```

When Vite processes this file, it detects the CommonJS pattern and applies its built-in
CJS interop (via the `@rollup/plugin-commonjs` integration that ships with Vite). The
result is a named-export ES module.

**Import approach in src/main.js:**

```js
import * as Box2D from "../lib/box2d.js";

// Re-expose all Box2D constructors as globals so app.js IIFE finds them
Object.assign(globalThis, Box2D);
```

This is the correct approach because `app.js` references ~12 distinct Box2D names
(`b2Vec2`, `b2World`, `b2BodyDef`, `b2Body`, `b2FixtureDef`, `b2PolygonShape`,
`b2CircleShape`, `b2RevoluteJointDef`, `b2ContactListener`, `b2Vec2.Make`). Assigning the
entire namespace to `globalThis` is cleaner than enumerating each name.

**Alternative — vite.config.js `define`:** The `define` config option can inline values
at build time, but it does not handle class constructors well (they're functions, not
primitives). `Object.assign(globalThis, Box2D)` is simpler and correct.

**Alternative — `optimizeDeps.include`:** Vite's dep optimization pre-bundles CJS
dependencies. Adding `lib/box2d.js` to `optimizeDeps.include` ensures Vite pre-converts
it to ESM. This is recommended for the `vite.config.js`.

Confidence: HIGH — CJS interop via namespace import + globalThis assignment is the
standard pattern for migrating global-access legacy code to Vite.

### 4. seedrandom.js Global Mutation via Module Import

`lib/seedrandom.js` is a self-executing IIFE (wraps with `(function(pool, math, ...) { })([], Math, ...)`)
that directly mutates `Math.seedrandom`. When imported as a module, the IIFE runs
exactly once, patching `Math` as expected.

```js
// src/main.js
import "../lib/seedrandom.js"; // patches Math.seedrandom — side-effect import
```

**Import order is critical.** `src/main.js` must import seedrandom before app.js
because `app.js` calls `Math.seedrandom()` during world initialization at line 1307
(via `setupScene`). ES module imports execute in declared order in a single module file,
so this is deterministic.

**No file modification needed.** seedrandom.js requires no changes — it is not
CommonJS (no `exports` block), just an IIFE that patches `Math`. Vite will treat it as a
script-mode file that evaluates as a side-effect.

Confidence: HIGH — IIFE mutation of Math via module import is reliable in modern bundlers.

### 5. Vitest Test File Locations

Vitest discovers tests using glob patterns. The default pattern finds `**/*.test.js`,
`**/*.spec.js`, and `**/__tests__/**/*.js`.

**Recommended layout:** Co-located with the logical sections they test.

The `src/app.js` IIFE cannot be unit-tested directly (it is not importable in pieces).
Tests target the extractable pure-logic sections that will eventually be split. For this
milestone, create a `src/` test file that imports named exports from a thin adapter, or
test the output functions by extracting them to a test helper.

**Practical test placement for this codebase:**

```
src/
└── app.js                      # existing IIFE (untouched)

src/__tests__/
├── random.test.js              # tests for genome random helpers
├── createInstance.test.js      # tests for crossbreed/clone logic
└── carRun.test.js              # tests for per-car state tracking
```

Since app.js is a monolithic IIFE, tests that require the actual functions must either:
(a) Import a thin harness file that re-exports them, or
(b) Wait for a future module-split milestone and test the IIFE output indirectly.

**For this milestone**, the recommended approach is (a): create `src/testable.js` that
extracts the pure math functions by calling into a test-mode version of the IIFE, then
test those. This is a thin shim — it does not require splitting app.js.

Vitest config location: `vitest.config.js` at repo root (or merged into `vite.config.js`
via the `test` key — preferred to keep one config file).

Confidence: MEDIUM — co-location is the Vitest default convention; the exact harness
pattern for testing an IIFE is project-specific and needs implementation experimentation.

### 6. Yarn PnP File Structure

Yarn PnP (Berry, v2+) with zero-installs generates the following structure:

```
HTML5_Genetic_Cars/
├── package.json              # NEW: declares deps, yarn config fields
├── yarn.lock                 # NEW: deterministic resolution (committed)
├── .yarnrc.yml               # NEW: nodeLinker: pnp, enableGlobalCache: false
├── .yarn/
│   ├── cache/                # NEW: zip archives of all packages (committed for zero-installs)
│   │   ├── vite-npm-5.x.x-...zip
│   │   ├── vitest-npm-x.x.x-...zip
│   │   └── ...
│   ├── releases/
│   │   └── yarn-4.x.x.cjs    # NEW: Yarn itself (committed — this is "zero-install Yarn")
│   └── sdks/                  # NEW: IDE integration shims (committed)
│       ├── eslint/
│       └── typescript/
├── .pnp.cjs                  # NEW: PnP runtime loader (committed)
└── .pnp.loader.mjs           # NEW: ESM PnP loader (committed)
```

**What is committed for zero-installs:**

- `yarn.lock` — always committed
- `.yarnrc.yml` — always committed
- `.yarn/releases/yarn-X.cjs` — the Yarn binary itself
- `.yarn/cache/*.zip` — package archives (this is what enables zero-installs)
- `.pnp.cjs` and `.pnp.loader.mjs` — PnP runtime hooks

**What is NOT present:**

- `node_modules/` — PnP does not create node_modules; resolution goes through `.pnp.cjs`

**`.gitignore` additions needed:**

```
# Keep (zero-installs needs these committed)
# .yarn/cache
# .pnp.cjs

# Ignore
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
```

**`.yarnrc.yml` minimum config:**

```yaml
nodeLinker: pnp
yarnPath: .yarn/releases/yarn-4.x.x.cjs
```

Confidence: HIGH — Yarn PnP zero-installs structure is well-documented and stable in
Yarn v4. The specific file names are version-stamped but the structure is consistent.

---

## New File Locations

```
HTML5_Genetic_Cars/               (repo root)
├── package.json                  # NEW — deps, scripts, Yarn config
├── vite.config.js                # NEW — Vite + Vitest config (merged)
├── .yarnrc.yml                   # NEW — Yarn PnP config
├── yarn.lock                     # NEW — dependency lockfile
├── .pnp.cjs                      # GENERATED + COMMITTED — PnP runtime
├── .pnp.loader.mjs               # GENERATED + COMMITTED — ESM PnP loader
├── .yarn/
│   ├── cache/                    # GENERATED + COMMITTED — package zips
│   ├── releases/
│   │   └── yarn-4.x.x.cjs        # GENERATED + COMMITTED — Yarn binary
│   └── sdks/                     # GENERATED + COMMITTED (if IDE integration added)
├── index.html                    # MODIFIED — remove 5 script tags, add 1 module script
├── src/
│   ├── app.js                    # UNCHANGED — monolith IIFE
│   ├── main.js                   # NEW — module entry: imports seedrandom, box2d, app.js
│   └── __tests__/                # NEW — Vitest test files
│       ├── random.test.js
│       ├── createInstance.test.js
│       └── carRun.test.js
├── lib/
│   ├── box2d.js                  # UNCHANGED — Vite CJS interop handles it
│   └── seedrandom.js             # UNCHANGED — IIFE side-effect import handles it
└── styles.css                    # UNCHANGED
```

---

## Migration Sequence

Order is constrained by dependency: each step must complete before the next is valid.

### Step 1: Delete stale node_modules, create package.json

**Why first:** package.json is the root of everything else. The stale `node_modules/`
without a package.json will confuse both Yarn and Vite.

```
Action: rm -rf node_modules/
Action: Create package.json with:
  - name, version, private: true
  - scripts: { dev, build, preview, test }
  - devDependencies: vite, vitest
  - packageManager: "yarn@4.x.x"
```

**Dependency:** None — this is the starting point.

### Step 2: Initialize Yarn PnP

**Why second:** Yarn must be initialized before packages can be installed.

```
Action: corepack enable
Action: yarn set version stable  (downloads yarn 4.x, creates .yarnrc.yml and .yarn/releases/)
Action: yarn install             (creates .pnp.cjs, .yarn/cache/, yarn.lock)
```

**Dependency:** Step 1 (package.json must exist).

### Step 3: Create vite.config.js

**Why third:** Vite config is needed before running the dev server or build. The config
must instruct Vite how to handle box2d.js as a CJS dependency.

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: ["./lib/box2d.js"],
  },
  test: {
    environment: "jsdom", // Vitest needs DOM for app.js tests
    globals: true, // allows describe/it/expect without imports
  },
});
```

**Dependency:** Step 2 (vite package must be installed for `import { defineConfig }`
to resolve via PnP).

### Step 4: Create src/main.js

**Why fourth:** This is the new module entry point. It replaces all five `<script>` tags.
The import order enforces the same load sequence the original HTML relied on:
seedrandom → box2d globals → app.js IIFE.

```js
// src/main.js

// 1. Patch Math.seedrandom — must run before app.js calls Math.seedrandom()
import "../lib/seedrandom.js";

// 2. Import Box2D and expose all constructors as globals
//    app.js accesses: b2Vec2, b2World, b2BodyDef, b2Body, b2FixtureDef,
//    b2PolygonShape, b2CircleShape, b2RevoluteJointDef (see app.js line 236)
import * as Box2D from "../lib/box2d.js";
Object.assign(globalThis, Box2D);

// 3. Execute the IIFE — reads DOM (deferred module timing handles this)
import "./app.js";
```

**Dependency:** Step 3 (vite.config.js controls how box2d.js CJS is resolved).

### Step 5: Modify index.html

**Why fifth:** index.html change is the final wiring step. Do it after main.js works
so that the old `<script>` tags can serve as a fallback for comparison during migration.

```html
<!-- REMOVE (5 lines, bottom of <body>): -->
<script src="lib/seedrandom.js"></script>
<script src="lib/box2d.js"></script>
<script src="https://d3js.org/d3.v3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js"></script>
<script src="src/app.js"></script>

<!-- ADD (1 line, bottom of <body>): -->
<script type="module" src="/src/main.js"></script>

<!-- ALSO REMOVE from <head>: -->
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.css"
/>
```

**Dependency:** Step 4 (main.js must exist before referencing it in HTML).

### Step 6: Verify dev server (smoke test)

**Why sixth:** Confirms the module graph wires correctly before adding tests.

```
Action: yarn dev
Verify: Page loads, cars spawn, generation 1 completes, terrain looks correct
```

**Dependency:** Steps 1-5 complete.

### Step 7: Write initial Vitest tests

**Why seventh:** Tests are added after the build works, not before. Writing tests against
a broken build wastes effort.

```
Action: Create src/__tests__/random.test.js
Action: Create src/__tests__/createInstance.test.js
Action: yarn test
```

**Dependency:** Step 6 passes (app module graph confirmed working).

### Step 8: Update .gitignore

Add PnP-specific entries. Remove the `/node_modules` entry that is currently there
(or keep it — it still applies since PnP does not create node_modules).

```
# PnP zero-installs: these must be committed
# .yarn/cache
# .pnp.cjs

# These should NOT be committed
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
node_modules
```

**Dependency:** Step 2 (need to know what was generated).

---

## Build Order Summary (Dependency Graph)

```
Step 1: delete node_modules, create package.json
    │
    ▼
Step 2: yarn install → PnP files (.pnp.cjs, .yarn/cache, yarn.lock)
    │
    ▼
Step 3: vite.config.js (needs vite package installed)
    │
    ▼
Step 4: src/main.js (needs vite.config.js for box2d interop)
    │
    ▼
Step 5: modify index.html (needs main.js to exist)
    │
    ▼
Step 6: smoke test (yarn dev)
    │
    ▼
Step 7: Vitest tests
    │
    ▼
Step 8: .gitignore update
```

---

## Architectural Patterns

### Pattern 1: Side-Effect Import for IIFE Libraries

**What:** Import a non-ESM file purely for its execution side-effects, without
destructuring or using its exports.

**When to use:** For libraries that patch globals (seedrandom, polyfills) or execute
setup code. The import statement causes the module to evaluate; globals are set as a
result.

**Example:**

```js
import "../lib/seedrandom.js"; // Math.seedrandom is now available globally
```

**Trade-offs:** Works reliably. Cannot tree-shake. Evaluation order is declaration order
within the module file (deterministic).

### Pattern 2: CJS Namespace Import + globalThis Assignment

**What:** Import a CommonJS module via Vite's CJS interop as a namespace, then copy all
named exports onto `globalThis` to restore the global-access pattern.

**When to use:** When legacy code reads globals set by a CJS library (box2d.js pattern),
and the legacy code cannot be modified.

**Example:**

```js
import * as Box2D from "../lib/box2d.js";
Object.assign(globalThis, Box2D);
// Now: b2Vec2, b2World, b2BodyDef, etc. are global
```

**Trade-offs:** Works without modifying app.js. Pollutes globalThis but this is
intentional to preserve compatibility. The pollution is bounded — only Box2D names are
added, same as the original `<script>` tag approach.

### Pattern 3: Merged vite.config.js + Vitest Test Config

**What:** Put Vitest configuration in the `test` key of `vite.config.js` rather than a
separate `vitest.config.js`.

**When to use:** Projects with a single test environment (browser simulation via jsdom).

**Example:**

```js
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

**Trade-offs:** One less config file. Works unless test config diverges significantly
from build config (unlikely for this project scope).

---

## Anti-Patterns

### Anti-Pattern 1: Adding `<script>` tags back to index.html

**What people do:** Hit a Vite error with box2d.js CJS interop and add `<script>` tags
back as a workaround alongside `<script type="module">`.

**Why it's wrong:** Creates a race condition — the IIFE in app.js may execute before
the legacy scripts run because module scripts are deferred. Also defeats the purpose of
the migration.

**Do this instead:** Fix the CJS interop in vite.config.js (`optimizeDeps.include` and/or
`Object.assign(globalThis, Box2D)` in main.js).

### Anti-Pattern 2: Wrapping app.js with `export` to test internals

**What people do:** Add `export { random, createInstance, manageRound }` to app.js to
expose internals for Vitest.

**Why it's wrong:** The milestone constraint is "src/app.js stays as single IIFE." Adds
exports to an IIFE body (the closing `})()` prevents top-level exports). Would require
restructuring the IIFE — a separate milestone.

**Do this instead:** Write a thin `src/testable.js` that reconstructs testable instances
from known inputs, or defer unit testing to the module-split milestone.

### Anti-Pattern 3: Using Yarn v1 (Classic) instead of Yarn Berry

**What people do:** Run `npm i -g yarn` which installs Yarn 1.x, then try to use PnP
zero-installs.

**Why it's wrong:** Yarn 1 has limited PnP support and no zero-installs. The `.yarn/cache`
and `.pnp.cjs` pattern requires Yarn v2+ (Berry).

**Do this instead:** Use `corepack enable && yarn set version stable` to get Yarn 4.x.
Corepack is bundled with Node 16.9+ and manages Yarn versions.

### Anti-Pattern 4: Committing `.yarn/unplugged`

**What people do:** Commit the entire `.yarn/` directory including `unplugged/`.

**Why it's wrong:** `unplugged/` contains packages that needed to be extracted from their
zip archives (typically native modules or packages with postinstall scripts). It can be
hundreds of MB and should be regenerated locally.

**Do this instead:** Add `.yarn/unplugged` to `.gitignore`. Only commit `cache/`,
`releases/`, and `sdks/`.

---

## Integration Points Summary

| Boundary                                       | Communication Pattern             | Notes                        |
| ---------------------------------------------- | --------------------------------- | ---------------------------- |
| index.html → src/main.js                       | `<script type="module">`          | Vite processes this          |
| src/main.js → lib/seedrandom.js                | Side-effect import                | Patches Math, must be first  |
| src/main.js → lib/box2d.js                     | CJS namespace import + globalThis | Vite CJS interop             |
| src/main.js → src/app.js                       | Side-effect import                | IIFE executes, reads globals |
| src/app.js → box2d globals                     | `globalThis.*` (reads window.\*)  | Globals set by main.js step  |
| src/app.js → Math.seedrandom                   | Direct call                       | Set by seedrandom import     |
| index.html onclick → window.cw_setCameraTarget | Inline onclick attr               | app.js sets at line 2203     |
| Vitest → src/app.js internals                  | Thin harness (testable.js)        | IIFE not directly importable |
| Vite dev server → index.html                   | Vite serves/transforms HTML       | Root index.html = entry      |

---

## Scalability Considerations

This is a static SPA targeting a single browser tab. Scaling in the traditional sense
does not apply. The relevant concern is build-time scalability:

| Concern                          | Approach                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| box2d.js is 11408 lines / ~400KB | Vite `optimizeDeps` pre-bundles it once per install; dev server is fast                 |
| .yarn/cache size                 | box2d, seedrandom are vendored — not in cache. Only Vite, Vitest, etc. (~20-30MB total) |
| Vitest test suite growth         | Co-located tests in `src/__tests__/` scale without config changes                       |

---

## Sources

- Direct inspection: `lib/box2d.js` line 11299 — CJS exports guard (`typeof exports !== "undefined"`)
- Direct inspection: `lib/seedrandom.js` lines 264-269 — IIFE with `Math` argument
- Direct inspection: `src/app.js` line 2203 — `window.cw_setCameraTarget` global exposure
- Direct inspection: `src/app.js` line 236 — Box2D globals comment (`globals b2RevoluteJointDef b2Vec2 ...`)
- Direct inspection: `index.html` lines 305-309 — current script load order
- Direct inspection: `node_modules/vite/package.json` — Vite 5.4.21 present in stale node_modules
- Codebase knowledge: Vite 5.x CJS interop via `@rollup/plugin-commonjs` integration (HIGH confidence)
- Codebase knowledge: Yarn PnP v4 zero-installs file layout (HIGH confidence)
- Codebase knowledge: Vitest co-location convention and jsdom environment (HIGH confidence)

---

_Architecture research for: Vite + Vitest + Yarn PnP migration of HTML5 Genetic Cars IIFE app_
_Researched: 2026-03-26_
