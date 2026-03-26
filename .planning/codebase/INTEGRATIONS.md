# External Integrations

**Analysis Date:** 2026-03-26

## Third-Party Libraries

| Library          | Source                                    | Version                      | Usage                                                                                                            |
| ---------------- | ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Box2D.js         | Vendored `lib/box2d.js`                   | Unknown (11,408 lines)       | 2D physics engine: world creation, rigid body dynamics, joints, collision detection                              |
| seedrandom.js    | Vendored `lib/seedrandom.js`              | Unknown (by David Bau, 2010) | Deterministic PRNG; patches `Math.seedrandom()` globally for reproducible terrain                                |
| d3               | CDN `d3js.org`                            | v3                           | Loaded in `index.html:307`; available but not directly invoked in current `src/app.js`                           |
| vis.js           | CDN `cdnjs.cloudflare.com`                | 4.20.0                       | JS loaded in `index.html:308`, CSS in `index.html:7`; available but not directly invoked in current `src/app.js` |
| genetic-cars-sim | Local WASM `crates/genetic-cars-sim/pkg/` | 0.1.0                        | Rust-compiled simulation engine (WASM variant only, bundled into `dist/app.js`)                                  |

## CDN Dependencies

**Loaded from CDN:**

- d3 v3: `https://d3js.org/d3.v3.min.js` (loaded in `index.html:307`)
- vis.js 4.20.0 JS: `https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.js` (loaded in `index.html:308`)
- vis.js 4.20.0 CSS: `https://cdnjs.cloudflare.com/ajax/libs/vis/4.20.0/vis.min.css` (loaded in `index.html:7`)

**Vendored (committed to repo):**

- Box2D.js: `lib/box2d.js`
- seedrandom.js: `lib/seedrandom.js`

**Risk:** The CDN-loaded libraries (d3 v3, vis.js 4.20.0) are pinned to specific versions but depend on external CDN availability. Both are very old versions (d3 v3 is from ~2013, vis.js 4.20.0 from ~2017). The app requires an internet connection to load these, though they do not appear to be actively used in current `src/app.js` code.

## APIs & External Services

**None.** The app is entirely client-side with no API calls, no backend, no authentication, and no telemetry.

**External form (non-functional integration):**

- PayPal donate button in `index.html:55-61` - A static HTML form that posts to `https://www.paypal.com/cgi-bin/webscr` with a hosted button ID. This is purely a donation link, not an API integration.

## Data Storage

**Primary storage: `localStorage`**

The app persists state via browser `localStorage` with the following keys:

| Key                  | Format                         | Content                                | Read/Write Location    |
| -------------------- | ------------------------------ | -------------------------------------- | ---------------------- |
| `cw_savedGeneration` | JSON (array of genome objects) | Current generation's car definitions   | `src/app.js:1982,1996` |
| `cw_genCounter`      | Plain string (number)          | Current generation counter             | `src/app.js:1983,1997` |
| `cw_ghost`           | JSON (ghost replay object)     | Best-run replay frame data             | `src/app.js:1984,1998` |
| `cw_topScores`       | JSON (array of numbers)        | Top scores per generation for graphing | `src/app.js:1985,1999` |
| `cw_floorSeed`       | Plain string                   | Floor/terrain generation seed          | `src/app.js:1986,2000` |

**Save/restore functions:**

- `saveProgress()` at `src/app.js:1980` - Writes all 5 keys
- `restoreProgress()` at `src/app.js:1988` - Reads all 5 keys; silently returns if `cw_savedGeneration` is undefined/null

**File Storage:** None (no file system access)

**Caching:** None (no service worker, no application cache)

**Databases:** None

## Authentication & Identity

**None.** No auth provider, no user accounts, no sessions.

## Monitoring & Observability

**Error Tracking:** None

**Logs:** No structured logging. The app uses no `console.log` calls in the critical path. A `#debug` div exists in `index.html:48` but is not actively populated.

## CI/CD & Deployment

**Hosting:** Static files; deployable to any static host (GitHub Pages, S3, local file system)

**CI Pipeline:** None detected (no `.github/workflows/`, no CI config files)

**Deployment:** Manual. Open `index.html` in a browser or serve with any static file server.

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None

## Environment Configuration

**Required env vars:** None

**Secrets:** None (no API keys, no tokens, no credentials)

**Runtime configuration is entirely in-browser:**

- World seed: auto-generated or user-entered via `#newseed` input (`index.html:74`)
- Mutation rate: `#mutationrate` select (`index.html:106-120`, default 5%)
- Mutation size: `#mutationsize` select (`index.html:126-140`, default 100%)
- Gravity: `#gravity` select (`index.html:155-165`, default Earth 9.81)
- Floor mutability: `#floor` select (`index.html:146-151`, default fixed)
- Elite clones: `#elitesize` select (`index.html:169-183`, default 1)
- All defaults are set via `selected="selected"` attributes in HTML

---

_Integration audit: 2026-03-26_
