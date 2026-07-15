# GUVs Deployment Architecture

Status: repair branch documentation. Verify production URLs before treating this as final launch truth.

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
- Root Directory: `saperli-popette`
- Required environment variable: `GROQ_API_KEY` if using server-side key fallback
- Expected routes:
  - `/` serves `saperli-popette/index.html`
  - `/app.js` serves `saperli-popette/app.js`
  - `/api/chat` serves `saperli-popette/api/chat.js`

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

## Rollback notes

Do not delete old deployments during repair. If a production surface fails, reassign only the affected Vercel project to its last known-good deployment and leave the other surfaces untouched.
