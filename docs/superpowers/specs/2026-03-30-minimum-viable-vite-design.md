# Minimum Viable Vite — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Replaces:** `.planning/phases/01-vite-foundation/` (5-plan approach)

## Goal

Replace the no-build static setup with Vite + Yarn Berry PnP so that `yarn dev` serves the simulation with HMR and `yarn build && yarn preview` produces a working production bundle. Simulation behavior must be identical before and after.

## Scope

**In scope:**

- Yarn Berry PnP (without zero-installs)
- Vite dev server + production build
- CDN removal (d3, vis — confirmed unused)
- Move vendored libs to `public/lib/`
- Minimal `src/main.js` entry point
- Fix `cw_runningInterval` implicit global
- Watch Leader button timing guard

**Out of scope:**

- Automated tests (deferred until module split makes functions importable)
- Splitting `src/app.js` into ES modules
- TypeScript migration
- CI/CD pipeline
- box2d/seedrandom ESM wrapper or npm packaging

## Architecture

### Before

```
index.html
  ├── <link> vis CSS (CDN, unused)
  ├── <script> lib/seedrandom.js (classic, sync)
  ├── <script> lib/box2d.js (classic, sync)
  ├── <script> d3 v3 (CDN, unused)
  ├── <script> vis 4.20 (CDN, unused)
  └── <script> src/app.js (IIFE, sync)
```

### After

```
index.html
  ├── <script> /lib/seedrandom.js (classic, sync — served from public/)
  ├── <script> /lib/box2d.js (classic, sync — served from public/)
  └── <script type="module"> /src/main.js (Vite entry)
         └── import './app.js'  (IIFE runs as side-effect)
```

Classic `<script>` tags execute synchronously before deferred `<script type="module">` per the HTML spec. This guarantees seedrandom patches `Math` and box2d populates `window.b2*` before the IIFE runs — no async wrapper needed.

### File changes

| File             | Action                | Purpose                                                                    |
| ---------------- | --------------------- | -------------------------------------------------------------------------- |
| `lib/`           | Move to `public/lib/` | Vite copies `public/` to `dist/` verbatim; keeps libs outside module graph |
| `src/main.js`    | Create (1 line)       | Vite entry point: `import './app.js'`                                      |
| `vite.config.js` | Create (minimal)      | Vite SPA config with test block for future use                             |
| `package.json`   | Create                | Scripts, devDependencies, Yarn config                                      |
| `.yarnrc.yml`    | Create                | `nodeLinker: pnp`, `yarnPath`                                              |
| `.gitignore`     | Modify                | Add `dist/`, `.yarn/cache/`, `node_modules`; remove bare `main.js` pattern |
| `src/app.js`     | Modify (2 changes)    | Declare `cw_runningInterval`; re-enable Watch Leader in `cw_init()`        |
| `index.html`     | Modify                | Remove CDN tags, remove old script tags, add module entry                  |

### What stays the same

- `src/app.js` remains a single-file IIFE — no splitting
- `styles.css` unchanged
- `window.cw_setCameraTarget` exposure mechanism unchanged
- All simulation behavior identical

## Package Manager & Dependencies

**Yarn Berry PnP without zero-installs:**

- `nodeLinker: pnp` — no `node_modules/`
- `.yarn/cache/` is gitignored — contributors run `yarn install` after cloning
- `.pnp.cjs`, `.pnp.loader.mjs`, `.yarn/releases/`, `.yarnrc.yml` are committed

**Dev dependencies:**

```json
{
  "devDependencies": {
    "vite": "^6"
  }
}
```

**Scripts:**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

box2d and seedrandom stay as vendored files in `public/lib/`. They are not npm packages.

## Vite Configuration

```js
import { defineConfig } from "vite";

export default defineConfig({
  // No special config needed.
  // box2d and seedrandom are in public/ — Vite never processes them.
});
```

## Entry Point

`src/main.js`:

```js
import "./app.js";
```

## Bug Fixes

### Fix 1: `cw_runningInterval` implicit global

`src/app.js` assigns `cw_runningInterval = setInterval(...)` without declaring it. Rollup's strict-mode production build throws `ReferenceError`. Fix: add `var cw_runningInterval = null;` near the other state declarations (~line 1479).

### Fix 2: Watch Leader button timing

`<script type="module">` is deferred, so the DOM is interactive before the IIFE runs. If "Watch Leader" is clicked before load, `cw_setCameraTarget` is undefined. Fix: add `disabled` attribute to the button in `index.html`, remove it at the end of `cw_init()`.

The healthbar template `onclick` (line 300) does NOT need guarding — it's cloned dynamically by `cw_Car` which only runs after the IIFE initializes.

## `index.html` Changes

Remove:

- Line 7: `<link>` vis CSS CDN
- Lines 305-309: all five `<script>` tags (seedrandom, box2d, d3, vis, app.js)

Add (at bottom of `<body>`):

```html
<script src="/lib/seedrandom.js"></script>
<script src="/lib/box2d.js"></script>
<script type="module" src="/src/main.js"></script>
```

Modify:

- Watch Leader button (~line 189): add `disabled` attribute

## Success Criteria

All must be true:

1. `yarn dev` starts Vite at `localhost:5173` — simulation loads, cars spawn, generations advance, no console errors
2. `yarn build && yarn preview` produces a working production bundle at `localhost:4173` — identical behavior to dev
3. `typeof b2Vec2 === 'function'` returns true in the browser console (both dev and prod)
4. Terrain is deterministic — same seed produces same terrain across refreshes
5. localStorage save/restore works (save progress, refresh, restore)
6. Watch Leader button works after page finishes loading
7. No `node_modules/` directory — PnP is active
8. `index.html` has no CDN `<script>` or `<link>` tags

## Key Decisions

| Decision                                           | Rationale                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Yarn PnP without zero-installs                     | PnP benefits (speed, strictness) without git bloat of committed cache                                          |
| box2d + seedrandom as classic scripts in `public/` | Avoids fragile ESM wrapper; HTML spec guarantees load order; no real debt since these libs aren't npm packages |
| No Vitest in this milestone                        | Can't properly test IIFE internals without module split; deferred to avoid throwaway duplicate code            |
| Single-phase execution                             | Original 5-plan/3-wave structure was ceremony for what is fundamentally a small set of changes                 |
| Drop d3 + vis CDN tags                             | Confirmed unused in `src/app.js`                                                                               |

## Deferred Work

- **Module split**: Split `src/app.js` into ES modules — unlocks proper imports and testability
- **Vitest**: Add after module split when functions are importable
- **TypeScript**: Add after Vite foundation is stable
- **CI/CD**: Add after test suite exists
