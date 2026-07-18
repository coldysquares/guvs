# GUVs Deployment Architecture

Status: repair branch documentation. Verify production URLs before treating this as final launch truth.

Last ops pass: 2026-07-18.

## Surfaces

| Surface | Repo path | Owner | Intended production owner |
| --- | --- | --- | --- |
| GUVs registry | `/index.html`, `/registry.json` | Root of `coldysquares/guvs` | GitHub Pages from `main` at `https://coldysquares.github.io/guvs/` |
| AWD | `/awd` | AWD only | Vercel project `awd`, root directory `awd` |
| Saperli Popette | `/saperli-popette` | Saperli only | Vercel project `saperli-popette`, root directory `saperli-popette` |

## Directory rules

- Root `index.html` belongs only to the GUV registry homepage.
- Root `registry.json` controls registry cards only.
- AWD code lives under `awd/`.
- Saperli code lives under `saperli-popette/`.
- New app APIs should live inside the owning app directory, such as `awd/api/groq.js` or `saperli-popette/api/chat.js`.
- Do not add new root-level APIs unless the root deployment is deliberately meant to own that API.

## Current API ownership

| Route | File | Purpose |
| --- | --- | --- |
| `/api/groq` in the AWD Vercel project | `awd/api/groq.js` | AWD Groq proxy |
| `/api/chat` in the Saperli Vercel project | `saperli-popette/api/chat.js` | Saperli Groq chat proxy |
| `/api/chat` at repo root | `api/chat.js` | Legacy/root fallback; keep until standalone Saperli preview is verified |

## Vercel settings to verify

### AWD

- Project name: `awd`
- Repository: `coldysquares/guvs`
- Production branch: `main`
- Root Directory: `awd`
- Required environment variable: `GROQ_API_KEY`
- Expected routes:
  - `/` serves `awd/index.html`
  - `/api/groq` serves `awd/api/groq.js`

### Saperli Popette

- Project name: `saperli-popette`
- Repository: `coldysquares/guvs`
- Production branch: `main`
- Root Directory: `saperli-popette` (verified via Vercel API on 2026-07-15)
- Groq key mode: hybrid. The app can use a browser-provided Groq key, or the Vercel function can use `GROQ_API_KEY` when it is set on the `saperli-popette` project.
- Current Vercel env state: no `GROQ_API_KEY` was present on `saperli-popette` when checked via Vercel API on 2026-07-18.
- Expected routes:
  - `/` serves `saperli-popette/index.html`
  - `/app.js` serves `saperli-popette/app.js`
  - `/api/chat` serves `saperli-popette/api/chat.js`

Recommended key posture:

- For private testing and fast local iteration, the browser-key path is fine.
- For Nick/demo use, set `GROQ_API_KEY` in Vercel for the `saperli-popette` project so Saperli can chat without pasting a key into the browser.
- Do not commit Groq keys to the repository or place them in static frontend files.

Recommended access posture:

- Keep `https://saperli-popette.vercel.app` as the stable public Saperli share URL.
- Keep team-scoped Vercel aliases SSO-protected unless all aliases need to be externally shareable.
- Current Vercel protection observed on 2026-07-18: `all_except_custom_domains`, which keeps the public custom alias shareable while protecting team-scoped deployment URLs.

## GitHub Pages

GitHub Pages should keep serving the registry homepage from the repository root:

```text
https://coldysquares.github.io/guvs/
```

GitHub Pages can show static sub-app files, but it cannot execute Vercel API functions. Server-backed app links should point to their stable Vercel production URLs once those URLs are verified.

## Required checks before release

- Does this change touch root `index.html`?
- Does it alter `registry.json`?
- Does it add, remove, or change a root-level API?
- Which app owns each changed route?
- Which Vercel project will deploy this commit?
- Were the registry, AWD, and Saperli preview URLs tested?
- Are rollback deployment URLs recorded before assigning production aliases?
- Did `node scripts/smoke-check.mjs` pass?

## Smoke check

Run:

```bash
node scripts/smoke-check.mjs
```

This checks:

- `https://saperli-popette.vercel.app/` returns a Saperli page title.
- `https://saperli-popette.vercel.app/api/chat` returns an API-style response on `GET` instead of serving the wrong static app.
- `https://coldysquares.github.io/guvs/registry.json` includes both `AWD` and `Saperli Popette`.

## Branch cleanup backlog

Remote branch clutter observed on 2026-07-18:

- `origin/fix/separate-guv-deployments`
- `origin/saperli-vercel-proxy`
- `origin/saperli-vercel-proxy-main2`
- `origin/vercel-agent/safe-guv-publish`

Do not delete these during normal Saperli/AWD work. Treat cleanup as a separate tidy pass after confirming none are needed for rollback, open PRs, or deployment history.

## Rollback notes

Do not delete old deployments during repair. If a production surface fails, reassign only the affected Vercel project to its last known-good deployment and leave the other surfaces untouched.
