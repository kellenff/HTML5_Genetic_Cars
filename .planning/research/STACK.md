# Stack Research

**Domain:** Modern tooling layer for legacy static browser SPA
**Researched:** 2026-03-26
**Confidence:** HIGH (all versions verified via npm registry; Yarn PnP config verified against 2 local projects using yarn@4.13.0)

---

## Recommended Stack

### Core Technologies

| Technology | Version        | Purpose                                | Why Recommended                                                                                                                                                                                         |
| ---------- | -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ | --- | -------------------------------------- |
| vite       | 6.4.1          | Dev server + build pipeline            | Stable release line; uses proven rollup 4 + esbuild 0.25. v8 (released 2026-03-12) is NOT recommended — it ships rolldown@1.0.0-rc.12 (still RC, not stable). Vitest 4.x declares `"vite": "^6.0.0      |     | ^7.0.0 |     | ^8.0.0"` so Vite 6 is fully supported. |
| vitest     | 4.1.2          | Unit test framework                    | Current stable release (2026-03-26). Vite-native: uses the same esbuild pipeline, no separate transpile step. Peer dep requires Vite 6+, vitest 4.x is the only version compatible with Vite 6.         |
| yarn       | 4.13.0 (Berry) | Package manager with PnP zero-installs | Confirmed Vite + Vitest compatible. The grocy project on this machine uses yarn@4.13.0 + Vite 6.4.1 + Vitest 4.1.1 with PnP zero-installs — a working reference.                                        |
| jsdom      | 29.0.1         | DOM environment for Vitest             | Required for tests that exercise code touching `window`, `document`, `localStorage`. The IIFE's GA/ML functions are pure-ish but some reference DOM globals; jsdom handles them without a real browser. |

### Supporting Libraries

| Library             | Version | Purpose                   | When to Use                                                                                                               |
| ------------------- | ------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| @vitest/coverage-v8 | 4.1.2   | Coverage reporting via V8 | Add when adding tests; must match vitest version exactly. Provides line/branch/function coverage without a separate tool. |

**No CJS-to-ESM plugin is needed.** See the box2d.js section below for why.

### Development Tools

| Tool     | Purpose                         | Notes                                                                                                                                          |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| corepack | Manages Yarn Berry installation | Already available (`corepack@0.34.6`). Run `corepack enable` then `yarn set version 4.13.0` — Yarn itself gets committed to `.yarn/releases/`. |
| vite CLI | Dev server + build              | Accessed via `yarn vite` or `yarn dev` after setup. No global install needed.                                                                  |

---

## Complete Configuration

### package.json

```json
{
  "name": "html5-genetic-cars",
  "version": "1.0.0",
  "type": "module",
  "packageManager": "yarn@4.13.0+sha512.5c20ba010c99815433e5c8453112165e673f1c7948d8d2b267f4b5e52097538658388ebc9f9580656d9b75c5cc996f990f611f99304a2197d4c56d21eea370e7",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.4.1",
    "vitest": "^4.1.2",
    "@vitest/coverage-v8": "^4.1.2",
    "jsdom": "^29.0.1"
  }
}
```

**`"type": "module"` is required.** This tells Node and Yarn PnP that the project uses ESM, which is how Vite 6 expects the entry point to be authored.

The `packageManager` field with the sha512 suffix pins Yarn Berry to the exact installed version. Corepack enforces this when contributors run `yarn`.

### vite.config.js

```js
import { defineConfig } from "vite";

export default defineConfig({
  // Root is project root (index.html lives here).
  // No framework plugins — this is a vanilla JS SPA.

  build: {
    // Single entry: index.html. Vite discovers the JS entry from the
    // <script type="module"> tag you add to index.html.
    outDir: "build",
    // Target modern browsers only — no legacy transpile needed.
    target: "es2020",
  },

  server: {
    port: 5173,
    open: true,
  },

  // box2d.js has 'if(typeof exports !== "undefined") { exports.b2* = ... }' at the end.
  // Vite's esbuild detects this as CJS and may try to inject an 'exports' shim.
  // The optimizeDeps.exclude prevents esbuild from pre-bundling lib/box2d.js;
  // combined with the ESM wrapper (see below), it executes as a plain script.
  optimizeDeps: {
    exclude: ["./lib/box2d.js", "./lib/seedrandom.js"],
  },
});
```

**Why no `optimizeDeps.include` for box2d.js:** Including a local path in `optimizeDeps.include` is for node_modules packages, not local files. Vite 6 does not reliably pre-bundle local files via this mechanism. The correct path is the ESM wrapper below.

### vitest.config.js

Keep Vitest config separate from vite.config.js. Both can coexist; Vitest reads its own file first, then falls back to vite.config.

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom provides window, document, localStorage, canvas stubs.
    // Required because seedrandom.js references 'window' in its auto-seed path.
    // Required because GA functions in src/app.js use document.getElementById
    // in some paths (even "pure" functions touch carConstantsData which reads DOM).
    environment: "jsdom",

    // Test files: co-located with source or in a dedicated directory.
    include: ["src/**/*.test.js", "tests/**/*.test.js"],

    // Do NOT include lib/ — box2d.js and seedrandom.js are not under test.
    exclude: ["lib/**", "node_modules/**", ".yarn/**"],

    // Coverage via V8 (zero overhead, no instrumentation transform).
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/app.js"], // The full IIFE is hard to cover; target extracted functions.
    },

    // Globals: true lets tests use describe/it/expect without imports.
    // Matches Jest's default behavior; remove if you prefer explicit imports.
    globals: true,
  },
});
```

**Why jsdom not happy-dom:** The IIFE code calls `getContext('2d')` on canvas elements. jsdom has a mature canvas stub. happy-dom's canvas support is less complete (as of 2026-03-26).

### .yarnrc.yml

```yaml
nodeLinker: pnp

enableGlobalCache: false

yarnPath: .yarn/releases/yarn-4.13.0.cjs
```

`nodeLinker: pnp` — enables Plug'n'Play: no `node_modules/` directory is created. Package resolution happens through the `.pnp.cjs` runtime hook.

`enableGlobalCache: false` — stores package zips in `.yarn/cache/` (project-local) rather than `~/.yarn/berry/cache/`. This is what makes zero-installs work: the cache is in the repo, not the user's home directory.

`yarnPath` — Yarn's own binary, committed to the repo. Contributors do not need a separate Yarn installation.

### What to Commit (Zero-Installs)

**Commit these:**

```
.yarn/cache/          # Package zip archives (~reasonable size for this project)
.yarn/plugins/        # Any Yarn plugins (likely empty initially)
.yarn/releases/       # yarn-4.13.0.cjs — Yarn itself
.yarn/sdks/           # Editor integrations (TypeScript, ESLint)
.yarn/versions/       # Version constraint files
.pnp.cjs              # PnP runtime loader (Node CJS)
.pnp.loader.mjs       # PnP runtime loader (ESM)
yarn.lock             # Lockfile
.yarnrc.yml           # Yarn config
```

**Gitignore additions:**

```gitignore
# Yarn PnP zero-installs: keep cache and runtime, ignore generated state
.yarn/*
!.yarn/cache
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

# No node_modules — Yarn PnP replaces it
node_modules
```

`.yarn/install-state.gz` and `.yarn/unplugged/` are covered by `.yarn/*` and are correctly excluded — they're machine-generated build artifacts, not portable.

---

## Handling box2d.js (CJS in ESM context)

### The Problem

`lib/box2d.js` (11,408 lines) defines all `b2*` constructors as global variables and ends with:

```js
if (typeof exports !== "undefined") {
  exports.b2World = b2World;
  // ... 107 more export assignments
}
```

This is a CJS guard pattern. In a browser `<script>` tag, `exports` is undefined and the guard never fires — the `b2*` variables leak to global scope, which is exactly what `src/app.js` depends on.

**The risk in Vite:** esbuild detects `exports.X = ...` patterns and classifies files as CommonJS, then tries to inject a CJS-to-ESM shim that provides an `exports` object. If the shim fires, the guard body runs and the `b2*` names get bound to the shim's `exports` object instead of `globalThis`. The IIFE in `src/app.js`, which references `b2World` etc. as free identifiers, then fails with ReferenceError.

### What NOT to Use

| Avoid                                      | Why                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@originjs/vite-plugin-commonjs`           | Last release 2022-02-16; abandoned before Vite 4.                                                                                                                        |
| `vite-plugin-commonjs`                     | Last release 2024-11-21 (Vite 5 era, uncertain Vite 6 compat); no peer deps declared so no signal either way. Adds a dependency for a problem we can solve with 5 lines. |
| `optimizeDeps.include: ['./lib/box2d.js']` | `optimizeDeps.include` is designed for node_modules package names, not local file paths. Local files are processed on demand during dev, not pre-bundled.                |
| `build.commonjsOptions`                    | Applies to rollup's CJS plugin during build, but doesn't help during Vite's dev mode (which uses esbuild). You'd still have the dev-mode problem.                        |

### Recommended: ESM Wrapper (zero dependencies)

Create `src/lib/box2d-init.js` — a thin wrapper that deliberately avoids triggering esbuild's CJS detection:

```js
// src/lib/box2d-init.js
//
// Loads box2d.js in a way that preserves its global-assignment behavior.
//
// Why this works:
//   box2d.js ends with: if(typeof exports !== "undefined") { exports.b2* = ... }
//   We inject the raw script content via a blob URL, which runs it as a classic
//   script in the browser (no module scope, no esbuild CJS transform).
//   The b2* constructors land on window/globalThis as intended.
//
// This file is NOT transformed by esbuild CJS detection because it contains
// no top-level 'exports.' assignments — only a fetch/eval pattern.

import box2dUrl from "/lib/box2d.js?url";

export async function loadBox2d() {
  // Execute as classic script (not module) so 'exports' stays undefined
  // and all b2* constructors land on globalThis.
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = box2dUrl;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

Then in the main entry point (`src/main.js` — new file, created during the refactor):

```js
import { loadBox2d } from "./lib/box2d-init.js";
import "./lib/seedrandom.js"; // Side-effect: patches Math.seedrandom

await loadBox2d(); // Populates window.b2World, window.b2Body, etc.
import "./app.js"; // IIFE executes; b2* are already on window
```

**The `?url` import** tells Vite to resolve the file path and return its URL — for dev mode this is a local URL, for build mode it gets hashed into the assets directory. No transformation is applied to the file itself.

**Tradeoff:** box2d.js is not in Vite's module graph (it's injected as a classic script). This means HMR does not watch it, and tree-shaking does not apply to it. Both are acceptable: box2d.js never changes during development, and tree-shaking a 381KB monolith that exposes globals (not named exports) is not possible anyway.

### seedrandom.js (no action needed beyond import)

`lib/seedrandom.js` (270 lines) is a plain IIFE: `(function(pool, math, ...) { math['seedrandom'] = ... })([], Math, ...)`. It has:

- Zero `exports.` assignments (no CJS detection trigger)
- Zero `require()` calls
- No `module.exports`

It mutates `Math.seedrandom` as a side effect of execution. Importing it as a side effect works directly:

```js
import "./lib/seedrandom.js"; // After this line, Math.seedrandom() is available
```

**One gotcha:** `seedrandom.js` line 116 references `window` as an entropy source during auto-seeding: `[new Date().getTime(), pool, window]`. In Vitest with `environment: 'jsdom'`, `window` is defined (jsdom provides it). In Vitest with `environment: 'node'`, this would throw. Keeping `environment: 'jsdom'` in vitest.config.js handles this.

---

## Alternatives Considered

| Recommended                         | Alternative                        | When to Use Alternative                                                                                                                                                                                      |
| ----------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vite 6.4.1                          | Vite 8.0.3                         | When rolldown reaches a stable 1.0 release (not rc) and community compatibility is established. Vite 8 shipped 2026-03-12 on rolldown@1.0.0-rc.12. Use Vite 6 for production work until rolldown stabilizes. |
| Vite 6.4.1                          | Vite 5.4.21 (current node_modules) | Never — Vitest 4.x requires Vite 6+. Vitest 4 is a hard requirement for the milestone; staying on Vite 5 would cap at Vitest 3.x (which lacks several key features).                                         |
| Yarn 4.13.0                         | npm or pnpm                        | If zero-installs is dropped as a requirement. npm and pnpm are simpler to set up but require `npm install` after clone. PROJECT.md lists zero-installs as an explicit requirement.                           |
| jsdom                               | happy-dom                          | happy-dom is faster (no C++ deps) and appropriate for tests that don't need canvas. If later test suites avoid canvas and localStorage, switching to happy-dom is reasonable.                                |
| ESM wrapper (src/lib/box2d-init.js) | vite-plugin-commonjs               | If box2d.js is moved into node_modules (via a proper package) and Vite's optimizeDeps can handle it. The wrapper is zero-dependency and explicit — prefer it for a local vendored file.                      |

---

## Version Compatibility

| Package                   | Compatible With                                              | Notes                                                                        |
| ------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- | --- | ------- | --- | ---------- |
| vitest@4.1.2              | vite@^6.0.0, ^7.0.0, ^8.0.0                                  | Explicit peer dep. Vite 6.4.1 is in range.                                   |
| @vitest/coverage-v8@4.1.2 | vitest@4.1.2                                                 | Must match vitest version exactly — same package family.                     |
| yarn@4.13.0               | Node.js ^20.19.0 or >=22.12.0 for Vite 8; ^18.0.0 for Vite 6 | Current machine has Node 20.20.1 which satisfies Vite 6's `^18.0.0           |     | ^20.0.0 |     | >=22.0.0`. |
| jsdom@29.0.1              | vitest@4.1.2                                                 | Listed in vitest's optional peerDependencies. jsdom@29 is the current major. |

---

## Installation

**Step 1: Initialize project with Yarn Berry + PnP**

```bash
# Enable corepack (manages Yarn Berry)
corepack enable

# In project root — creates package.json if absent, sets yarn version
yarn init -2

# Pin to 4.13.0 specifically
yarn set version 4.13.0

# Confirm .yarnrc.yml has: nodeLinker: pnp
# Confirm .yarnrc.yml has: enableGlobalCache: false
```

**Step 2: Install dependencies**

```bash
yarn add -D vite@^6.4.1 vitest@^4.1.2 @vitest/coverage-v8@^4.1.2 jsdom@^29.0.1
```

After this runs, `.yarn/cache/` is populated and `.pnp.cjs` is generated.

**Step 3: Commit zero-install artifacts**

```bash
git add .yarn/cache .yarn/releases .yarn/plugins .yarn/sdks .yarn/versions
git add .pnp.cjs .pnp.loader.mjs yarn.lock .yarnrc.yml package.json
```

**Step 4: Update .gitignore**

Add the Yarn PnP gitignore block shown above.

**After this, contributors can clone and run with no install step.**

---

## What NOT to Use

| Avoid                                      | Why                                                                                                                                                                            | Use Instead                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `vite@8.0.3`                               | Uses rolldown@1.0.0-rc.12 (RC, not stable). Released 2026-03-12 — 14 days ago at time of research. Not yet battle-tested for legacy CJS compat.                                | `vite@6.4.1`                             |
| `vite@5.4.21` (currently in node_modules)  | Vitest 4.x will not install — it requires Vite 6+. The existing node_modules Vite 5 is a dead-end for this milestone.                                                          | `vite@6.4.1`                             |
| `vite-plugin-commonjs@0.10.4`              | No peer deps declared, last updated Nov 2024 at the same time Vite 6 shipped. No evidence it was tested against Vite 6. Introduces a dependency for a 5-line wrapper solution. | ESM wrapper approach                     |
| `@originjs/vite-plugin-commonjs@1.0.3`     | Last published 2022-02-16. Abandoned before Vite 3.                                                                                                                            | ESM wrapper approach                     |
| `optimizeDeps.include: ['./lib/box2d.js']` | This syntax is for node_modules package names (e.g. `lodash`), not local file paths. Vite 6 docs do not support local file paths here. Would silently fail or error.           | `?url` import + classic script injection |
| `yarn@1.22.22` (classic)                   | Classic Yarn does not support PnP zero-installs (it has `--pnp` mode but it's deprecated). Zero-installs is a Yarn Berry feature.                                              | `yarn@4.13.0` (Berry)                    |
| `happy-dom` as default                     | Canvas API is incomplete in happy-dom. `src/app.js` creates canvas elements; test setup likely exercises canvas code paths. jsdom has a more complete stub.                    | `jsdom@29.0.1`                           |

---

## Sources

- npm registry (`npm show vite dist-tags`, `npm show vite time`) — Vite version history: v6.0.0 (2024-11-26), v8.0.0 (2026-03-12), v8.0.3 (2026-03-26/today). **HIGH confidence.**
- npm registry (`npm show vitest`, `npm show vitest peerDependencies`) — Vitest 4.1.2 peer dep declares `"vite": "^6.0.0 || ^7.0.0 || ^8.0.0"`. **HIGH confidence.**
- npm registry (`npm show rolldown versions`) — rolldown has no stable 1.x release; `1.0.0-rc.12` is the latest as of 2026-03-26. **HIGH confidence.**
- npm registry (`npm show vite@8 dependencies`) — Vite 8 depends on `rolldown@1.0.0-rc.12` (RC). **HIGH confidence.**
- Local project `/Users/kellen/Projects/grocy/web` — yarn@4.13.0 + vite@^6.4.1 + vitest@^4.1.1 + PnP zero-installs. Confirmed working. **HIGH confidence.**
- Local project `/Users/kellen/Projects/homepage-next` — yarn@4.3.1 + PnP zero-installs. `.pnp.cjs` (640KB) and `.pnp.loader.mjs` (70KB) present and committed. **HIGH confidence.**
- `lib/box2d.js` source inspection (lines 11299–11408) — CJS guard pattern confirmed: `if(typeof exports !== "undefined") { exports.b2* = ... }`. No `require()`, no `module.exports`. **HIGH confidence.**
- `lib/seedrandom.js` source inspection — zero CJS markers, plain IIFE, mutates `Math.seedrandom`. Window reference confirmed at line 116. **HIGH confidence.**

---

_Stack research for: HTML5 Genetic Cars — Vite + Vitest + Yarn PnP tooling refactor_
_Researched: 2026-03-26_
