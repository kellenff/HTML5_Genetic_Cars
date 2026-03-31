# Minimum Viable Vite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the no-build static setup with Vite + Yarn Berry PnP so `yarn dev` and `yarn build && yarn preview` serve a working simulation.

**Architecture:** Move vendored libs to `public/lib/` (served as classic scripts outside the module graph). Add a minimal `src/main.js` Vite entry point that side-effect imports `app.js`. Yarn Berry PnP without zero-installs — `.yarn/cache/` gitignored, contributors run `yarn install`.

**Tech Stack:** Vite 6, Yarn Berry 4.x (PnP), Box2D (vendored), seedrandom (vendored)

**Spec:** `docs/superpowers/specs/2026-03-30-minimum-viable-vite-design.md`

---

### Task 1: Fix `.gitignore` and delete stale `node_modules`

**Files:**

- Modify: `.gitignore`
- Delete: `node_modules/` (stale directory, no package.json)

- [ ] **Step 1: Remove the bare `main.js` pattern from `.gitignore`**

Line 20 of `.gitignore` has a bare `main.js` pattern that would block `src/main.js` from being tracked. Delete only that line.

Before (line 20):

```
main.js
```

After: line removed entirely.

- [ ] **Step 2: Add Vite and Yarn sections to the end of `.gitignore`**

Append these lines at the end of `.gitignore`:

```gitignore

# Vite
dist/

# Yarn Berry PnP (without zero-installs)
# .yarn/cache/ is NOT committed — contributors run `yarn install`
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
```

Note: `.pnp.cjs` and `.pnp.loader.mjs` are NOT gitignored — they must be committed so PnP resolution works after clone + install. Line 1 already has `/node_modules` — keep it. Line 198 already has `dist/` under the Python section — leave it, having it twice is harmless and the new one is semantically correct.

- [ ] **Step 3: Delete the stale `node_modules/` directory**

```bash
rm -rf node_modules
```

This directory has no `package.json` and is leftover from an old Vite 5 experiment.

- [ ] **Step 4: Verify**

```bash
# main.js pattern removed
grep -n "^main\.js$" .gitignore
# Expected: no output

# dist/ present
grep "^dist/$" .gitignore
# Expected: dist/

# Yarn block present
grep "^\.yarn/\*$" .gitignore
# Expected: .yarn/*

# node_modules gone
test ! -d node_modules && echo "OK" || echo "FAIL"
# Expected: OK
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for Vite + Yarn PnP"
```

---

### Task 2: Move vendored libs to `public/lib/`

**Files:**

- Move: `lib/box2d.js` → `public/lib/box2d.js`
- Move: `lib/seedrandom.js` → `public/lib/seedrandom.js`

- [ ] **Step 1: Create `public/lib/` and move files**

```bash
mkdir -p public/lib
git mv lib/box2d.js public/lib/box2d.js
git mv lib/seedrandom.js public/lib/seedrandom.js
rmdir lib
```

- [ ] **Step 2: Verify**

```bash
test -f public/lib/box2d.js && echo "OK" || echo "FAIL"
# Expected: OK

test -f public/lib/seedrandom.js && echo "OK" || echo "FAIL"
# Expected: OK

test ! -d lib && echo "OK" || echo "FAIL"
# Expected: OK
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move vendored libs to public/lib/ for Vite"
```

---

### Task 3: Initialize Yarn Berry PnP and install Vite

**Files:**

- Create: `package.json`
- Create: `.yarnrc.yml`
- Create: `yarn.lock`
- Create: `.pnp.cjs`
- Create: `.pnp.loader.mjs`
- Create: `.yarn/releases/` (Yarn binary)

- [ ] **Step 1: Enable corepack and initialize Yarn Berry**

```bash
corepack enable
yarn init -2
```

This creates `package.json`, `.yarnrc.yml`, and `.yarn/releases/`.

- [ ] **Step 2: Overwrite `package.json` with the project manifest**

Replace the generated `package.json` with:

```json
{
  "name": "html5-genetic-cars",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^6"
  }
}
```

- [ ] **Step 3: Ensure `.yarnrc.yml` has PnP config**

Verify `.yarnrc.yml` contains at minimum:

```yaml
nodeLinker: pnp
```

If `yarn init -2` set a `yarnPath`, keep it. If it set `nodeLinker: node-modules`, change it to `pnp`.

- [ ] **Step 4: Install dependencies**

```bash
yarn install
```

This creates `yarn.lock`, `.pnp.cjs`, `.pnp.loader.mjs`, and populates `.yarn/cache/`.

- [ ] **Step 5: Verify PnP is active**

```bash
yarn --version
# Expected: 4.x.x

test -f .pnp.cjs && echo "OK" || echo "FAIL"
# Expected: OK

test ! -d node_modules && echo "OK" || echo "FAIL"
# Expected: OK
```

- [ ] **Step 6: Commit Yarn PnP artifacts**

```bash
git add package.json .yarnrc.yml yarn.lock .pnp.cjs .pnp.loader.mjs .yarn/releases/
git commit -m "chore: initialize Yarn Berry PnP with Vite 6"
```

Note: Do NOT `git add .yarn/cache/` — it is gitignored per our design (no zero-installs).

---

### Task 4: Create Vite config and entry point

**Files:**

- Create: `vite.config.js`
- Create: `src/main.js`

- [ ] **Step 1: Create `vite.config.js`**

```js
import { defineConfig } from "vite";

export default defineConfig({
  // box2d and seedrandom are in public/ — Vite never processes them.
});
```

- [ ] **Step 2: Create `src/main.js`**

```js
import "./app.js";
```

- [ ] **Step 3: Commit**

```bash
git add vite.config.js src/main.js
git commit -m "feat: add Vite config and module entry point"
```

---

### Task 5: Fix `cw_runningInterval` implicit global in `src/app.js`

**Files:**

- Modify: `src/app.js:1479`

- [ ] **Step 1: Add `var cw_runningInterval` declaration**

In `src/app.js`, after line 1479 (`var cw_animationFrameId = null;`), add:

```js
var cw_runningInterval = null;
```

The block should now read:

```js
var doDraw = true;
var cw_paused = false;
var cw_animationFrameId = null;
var cw_runningInterval = null;

var box2dfps = 60;
```

- [ ] **Step 2: Verify no other undeclared uses**

```bash
grep -n "cw_runningInterval" src/app.js
```

Expected output — 3 lines:

- The new declaration (~line 1480)
- `cw_runningInterval = setInterval(...)` (line 1714)
- `clearInterval(cw_runningInterval)` (line 1722)

- [ ] **Step 3: Commit**

```bash
git add src/app.js
git commit -m "fix: declare cw_runningInterval to avoid strict-mode ReferenceError"
```

---

### Task 6: Add Watch Leader button timing guard

**Files:**

- Modify: `index.html:189`
- Modify: `src/app.js:2099`

- [ ] **Step 1: Add `disabled` attribute to Watch Leader button in `index.html`**

Change line 189 from:

```html
<input type="button" value="Watch Leader" onclick="cw_setCameraTarget(-1)" />
```

To:

```html
<input
  type="button"
  value="Watch Leader"
  onclick="cw_setCameraTarget(-1)"
  disabled
/>
```

- [ ] **Step 2: Re-enable the button at the end of `cw_init()` in `src/app.js`**

In `src/app.js`, after line 2099 (`cw_startSimulation();`), before the closing `}` of `cw_init()`, add:

```js
document.querySelector('[value="Watch Leader"]').disabled = false;
```

The end of `cw_init()` should now read:

```js
    cw_drawMiniMap();
    cw_startSimulation();
    document.querySelector('[value="Watch Leader"]').disabled = false;

  }
```

- [ ] **Step 3: Commit**

```bash
git add index.html src/app.js
git commit -m "fix: guard Watch Leader button against pre-module-load clicks"
```

---

### Task 7: Migrate `index.html` to Vite module entry

**Files:**

- Modify: `index.html:7` (remove vis CSS CDN)
- Modify: `index.html:305-309` (replace script tags)

- [ ] **Step 1: Remove the vis CSS CDN link from `<head>`**

Delete line 7:

```html
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.css"
/>
```

Keep line 8 (`<link rel="stylesheet" href="styles.css">`).

- [ ] **Step 2: Replace all script tags at the bottom of `<body>`**

Remove lines 305-309:

```html
<script src="lib/seedrandom.js"></script>
<script src="lib/box2d.js"></script>
<script src="https://d3js.org/d3.v3.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js"></script>
<script src="src/app.js"></script>
```

Replace with:

```html
<script src="/lib/seedrandom.js"></script>
<script src="/lib/box2d.js"></script>
<script type="module" src="/src/main.js"></script>
```

Note the leading `/` on all paths — Vite serves from the project root.

- [ ] **Step 3: Verify no CDN references remain**

```bash
grep -n "cdnjs\|d3js.org" index.html
# Expected: no output

grep -n '<script' index.html
# Expected: 3 lines — seedrandom, box2d, main.js (plus any PayPal form scripts)
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: migrate index.html to Vite module entry, remove CDN deps"
```

---

### Task 8: Smoke test — dev server and production build

**Files:** None (verification only)

- [ ] **Step 1: Start Vite dev server**

```bash
yarn dev
```

Open `http://localhost:5173` in a browser. Verify:

- Page loads without console errors
- Cars spawn on terrain
- Generations advance when all cars die
- Graph renders scores

- [ ] **Step 2: Check Box2D globals in dev**

In the browser console:

```js
typeof b2Vec2 === "function";
// Expected: true
```

- [ ] **Step 3: Test Watch Leader button**

Wait for the page to fully load, then click "Watch Leader". It should follow the leading car. Verify the button is NOT clickable during the brief module loading phase (it should be disabled until init completes).

- [ ] **Step 4: Test terrain determinism**

Enter a seed value (e.g., "test123"), click "Go!". Note the terrain shape. Hard refresh (`Ctrl+Shift+R`). Enter the same seed. Terrain should be identical.

- [ ] **Step 5: Test save/restore**

Click "Save Population". Refresh the page. Click "Restore Saved Population". Verify the generation counter and population restore correctly.

- [ ] **Step 6: Build and preview production bundle**

Stop the dev server, then:

```bash
yarn build && yarn preview
```

Open `http://localhost:4173`. Repeat all checks from Steps 1-5 against the production build. This is critical — Rollup strict-mode only applies here.

- [ ] **Step 7: Verify no `node_modules/`**

```bash
test ! -d node_modules && echo "OK" || echo "FAIL"
# Expected: OK
```

- [ ] **Step 8: Final commit (if any fixes were needed)**

If any adjustments were made during smoke testing, commit them now with a descriptive message.
