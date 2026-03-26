---
phase: 1
slug: vite-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Framework**          | CLI commands (Vitest installed in Phase 2)                                     |
| **Config file**        | none — Phase 1 installs the foundation                                         |
| **Quick run command**  | `yarn dev --port 5173 &; sleep 3 && curl -sf http://localhost:5173 && kill %1` |
| **Full suite command** | `yarn build && yarn preview`                                                   |
| **Estimated runtime**  | ~30 seconds (build)                                                            |

---

## Sampling Rate

- **After every task commit:** Run `node --version && yarn --version` (verify tooling is intact)
- **After every plan wave:** Run `yarn build` (verify bundle still compiles)
- **Before `/gsd:verify-work`:** `yarn dev` opens, `yarn build && yarn preview` passes, `typeof b2Vec2 === 'function'` in browser
- **Max feedback latency:** 60 seconds (build time)

---

## Per-Task Verification Map

| Task ID              | Plan | Wave | Requirement            | Test Type | Automated Command                                                        | File Exists             | Status     |
| -------------------- | ---- | ---- | ---------------------- | --------- | ------------------------------------------------------------------------ | ----------------------- | ---------- |
| 1-01-yarn            | 01   | 1    | BUILD-04, BUILD-05     | cli       | `yarn --version \| grep -E '^4\.'`                                       | `.yarnrc.yml`           | ⬜ pending |
| 1-01-pnp             | 01   | 1    | BUILD-04, BUILD-05     | cli       | `test -f .pnp.cjs`                                                       | `.pnp.cjs`              | ⬜ pending |
| 1-01-no-node-modules | 01   | 1    | BUILD-04               | cli       | `test ! -d node_modules`                                                 | —                       | ⬜ pending |
| 1-01-gitignore       | 01   | 1    | BUILD-06               | cli       | `grep -q 'node_modules' .gitignore && grep -q 'dist/' .gitignore`        | `.gitignore`            | ⬜ pending |
| 1-02-vite-config     | 02   | 1    | BUILD-01               | file      | `test -f vite.config.js`                                                 | `vite.config.js`        | ⬜ pending |
| 1-02-box2d-init      | 02   | 1    | DEP-01, DEP-02         | file      | `test -f src/lib/box2d-init.js`                                          | `src/lib/box2d-init.js` | ⬜ pending |
| 1-02-main            | 02   | 1    | DEP-06                 | file      | `grep -q 'box2d-init' src/main.js`                                       | `src/main.js`           | ⬜ pending |
| 1-03-html            | 03   | 2    | DEP-03, DEP-04, DEP-05 | cli       | `grep -cE 'cdn\|d3\|vis\.min' index.html \| grep -q '^0'`                | `index.html`            | ⬜ pending |
| 1-03-module          | 03   | 2    | DEP-06                 | cli       | `grep -q 'type="module"' index.html`                                     | `index.html`            | ⬜ pending |
| 1-04-fix             | 04   | 2    | FIX-01                 | cli       | `grep -q 'var cw_runningInterval' src/app.js`                            | `src/app.js`            | ⬜ pending |
| 1-05-dev             | 05   | 3    | BUILD-01, BUILD-07     | manual    | `yarn dev` — sim loads at localhost:5173                                 | —                       | ⬜ pending |
| 1-05-build           | 05   | 3    | BUILD-02, BUILD-03     | cli       | `yarn build && test -d dist/`                                            | `dist/`                 | ⬜ pending |
| 1-05-b2vec2          | 05   | 3    | DEP-01, DEP-02         | manual    | browser: `typeof b2Vec2 === 'function'`                                  | —                       | ⬜ pending |
| 1-05-no-cdn          | 05   | 3    | DEP-03, DEP-04, DEP-05 | cli       | `grep -cE 'cdnjs\|jsdelivr\|unpkg\|vis-network' index.html \| grep '^0'` | `index.html`            | ⬜ pending |
| 1-05-zero-install    | 05   | 3    | BUILD-05               | cli       | `test -f .yarn/cache/vite-npm-*.zip`                                     | `.yarn/cache/`          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

_Phase 1 installs the tooling foundation — no test framework available yet. All automated checks use CLI commands (`test`, `grep`, `yarn build`). Full simulation verification (b2Vec2 global, car physics) requires manual browser check._

- [ ] Shell commands above must be runnable after each plan wave
- [ ] `yarn build` is the primary automated gate (fails fast on strict-mode errors)

---

## Manual-Only Verifications

| Behavior                                  | Requirement        | Why Manual                     | Test Instructions                                               |
| ----------------------------------------- | ------------------ | ------------------------------ | --------------------------------------------------------------- |
| Simulation loads and runs cars            | BUILD-01, DEP-02   | Canvas/physics require browser | Open localhost:5173, confirm cars spawn and advance generations |
| `typeof b2Vec2 === 'function'` in console | DEP-02             | Browser console only           | Open DevTools → Console, run `typeof b2Vec2`                    |
| localStorage save/restore works           | BUILD-02           | Browser API                    | Click Save, reload, click Restore — verify generation continues |
| Camera buttons respond to onclick         | DEP-07             | Inline onclick event           | Click "Watch Leader" and car minimap entries                    |
| Production preview identical to dev       | BUILD-02, BUILD-03 | Side-by-side manual check      | `yarn preview`, run 2 generations, compare terrain to dev       |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
