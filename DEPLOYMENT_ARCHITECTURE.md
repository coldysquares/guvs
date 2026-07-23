# GUVs Deployment Architecture

Status: candidate unified-root migration. Current production surfaces remain unchanged.

Last architecture pass: 2026-07-23.

## Direct observations

- `https://coldysquares.github.io/guvs/` currently serves the GUVs registry.
- GitHub Pages currently returns `404` for `/api/chat` and `/api/groq`.
- The repository is approximately 1 MB, so GitHub Pages size and bandwidth limits are not the immediate constraint.
- Vercel projects `awd` and `saperli-popette` are connected to this repository with app-specific root directories and create branch previews on push.
- No Vercel project named `guvs` was present when projects were enumerated on 2026-07-23.

## Current production surfaces

| Surface | Repo path | Current production owner | State |
| --- | --- | --- | --- |
| GUVs registry and static apps | `/` and registered app folders | GitHub Pages from `main` | active |
| AWD | `/awd` | Vercel project `awd`, Root Directory `awd` | active |
| Saperli Popette | `/saperli-popette` | Vercel project `saperli-popette`, Root Directory `saperli-popette` | active |

## Recommended target

Create one additional Vercel project as the GUVs front door:

- Candidate project name: `guvs`
- Repository: `coldysquares/guvs`
- Production branch: `main`
- Root Directory: `.`
- Build command: `npm run build`
- Output directory: `dist`
- Required production secret for AWD: `GROQ_API_KEY`
- Preview protection: team-protected is acceptable; the final public production alias should be explicitly verified

Expected unified routes:

| Route | Owner |
| --- | --- |
| `/` | GUV registry |
| `/<registered-slug>/` | Registered static GUV |
| `/api/chat` | Root Saperli-compatible function |
| `/api/groq` | Root adapter to the canonical AWD handler |

The standalone AWD and Saperli projects remain in place. They preserve their stable direct URLs, independent environment variables, and rollback histories. The unified project becomes the coherent browse-and-try front door.

## Why Vercel is the bounded recommendation

GitHub Pages remains a good static fallback, but it cannot execute the two API handlers and does not provide this repo with per-branch application previews. Cloudflare Pages could supply both features, but it would add a second deployment account and require adapting the existing Node/Vercel function workflow. Vercel already owns both server-backed apps, already receives Git branch previews, and can serve the current static HTML without a framework rewrite.

## Build boundary

`scripts/build-site.mjs` treats `registry.json` as the deployment allowlist:

- Copies the root homepage and registry.
- Copies every registered app and its ordinary static assets.
- Skips hidden files, backup files, app-local `api/` folders, and app-local `vercel.json` files.
- Does not copy unregistered repository folders into `dist/`.

This keeps source, tooling, historical material, and app-local server code out of the unified static artifact.

## Substrate publication boundary

`substrate-001/` is intentionally absent from `registry.json`, and the build rejects that top-level path if it is accidentally re-added. This changes only GUV classification and publishing scope; it does not modify the Substrate source.

Substrate should receive its own standalone publication project for media, working ideas, issue pages, and the full magazine. That project creation, content model, domain, and deployment are a separate approved action—not an implicit part of the GUV cutover.

## API ownership

| Unified route | Root file | Canonical implementation |
| --- | --- | --- |
| `/api/chat` | `api/chat.js` | Kept compatible with `saperli-popette/api/chat.js` |
| `/api/groq` | `api/groq.js` | Adapter to `awd/api/groq.js` |

Do not commit API keys. Configure `GROQ_API_KEY` in the candidate root project before production verification.

## Migration sequence

1. Build and validate `dist/` locally.
2. Create the root `guvs` Vercel project and attach it to this repository.
3. Configure preview/production environment variables.
4. Deploy the current branch as a preview.
5. Run `GUVS_BASE_URL=<preview> GUVS_EXPECT_UNIFIED=1 npm run smoke`.
6. Verify the registry, Aster, AWD, Saperli, and both API routes.
7. Only then merge to `main` or promote the verified deployment.
8. Keep GitHub Pages and the two standalone Vercel projects available as rollback surfaces during cutover.

## Rollback

Do not delete existing deployments or projects during migration. If the unified front door fails, leave or restore the GitHub Pages URL as the registry entry point and roll back only the affected Vercel project alias.

Branch cleanup remains a separate tidy pass.
