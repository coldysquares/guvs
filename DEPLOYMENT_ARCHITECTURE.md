# GUVs Deployment Architecture

Status: unified Vercel front door active.

Last architecture pass: 2026-07-24.

## Direct observations

- `https://guvs.vercel.app/` is the public GUVs production front door.
- GitHub repository `coldysquares/guvs`, branch `main`, is the canonical production source.
- A merge to `main` triggers production deployments for Vercel projects `guvs`, `awd`, and `saperli-popette`.
- The root Vercel project is linked locally as project `guvs`.
- The root build runs `npm run build` and serves `dist/`.
- Root Vercel Functions own the unified `/api/chat`, `/api/groq`, and `/api/wiki` routes.
- Standalone AWD and Saperli Vercel projects remain available as direct-entry surfaces.
- Standalone AWD team aliases are Vercel SSO-protected; authenticated checks use the linked AWD directory and `vercel curl`.
- GitHub Pages can serve the static collection but cannot execute the API routes.

## Production surfaces

| Surface | Repo path | Production owner | State |
| --- | --- | --- | --- |
| GUVs registry and registered apps | `/` and registry paths | Vercel project `guvs` | active |
| AWD direct entry | `/awd` | Vercel project `awd` | active; team alias SSO-protected |
| Saperli direct entry | `/saperli-popette` | Vercel project `saperli-popette` | active and public |
| GitHub Pages static copy | registered static paths | GitHub Pages from `main` | fallback |

## Unified routes

| Route | Owner |
| --- | --- |
| `/` | GUV registry |
| `/<registered-slug>/` | Registered static GUV |
| `/api/chat` | Root Saperli-compatible function |
| `/api/groq` | Root adapter to the canonical AWD handler |
| `/api/wiki` | Bounded English Wikipedia lookup for Wiki Constellation |

The standalone AWD and Saperli projects preserve stable direct URLs, independent environment variables, and rollback histories. The unified project is the coherent browse-and-try front door.

POND Graf is additive: `/aster-graf/` and `/wiki-constellation/` retain their V2 interfaces, while `/pond-graf/` owns the shared V3 membrane engine and `/pond-graf/wiki/` owns its live public-source lens.

`awd/vercel.json` and `saperli-popette/vercel.json` isolate each standalone build from the root `dist/` build. Their local `.vercel` links target the matching Vercel projects and remain untracked.

## Why Vercel is the bounded host

GitHub Pages remains a useful static fallback, but it cannot execute the API handlers and does not provide this repository with one server-backed branch-preview surface. Vercel already owns the server-backed GUV routes and serves the current static HTML without a framework rewrite.

## Build boundary

`scripts/build-site.mjs` treats `registry.json` as the deployment allowlist:

- Copies the root homepage and registry.
- Copies the explicit `shared/` membrane runtime used by POND Graf’s registered lenses.
- Copies every registered app and its ordinary static assets.
- Skips hidden files, backup files, app-local `api/` folders, and app-local `vercel.json` files.
- Does not copy unregistered repository folders into `dist/`.

This keeps source, tooling, historical material, and app-local server code out of the unified static artifact.

## Substrate publication boundary

`substrate-001/` is intentionally absent from `registry.json`, and the build rejects that top-level path if it is accidentally re-added. This changes only GUV classification and publishing scope; it does not modify the Substrate source.

Substrate should receive its own standalone publication project for media, working ideas, issue pages, and the full magazine. That project creation, content model, domain, and deployment are a separate approved action—not an implicit part of GUV work.

## API ownership

| Unified route | Root file | Canonical implementation |
| --- | --- | --- |
| `/api/chat` | `api/chat.js` | Kept compatible with `saperli-popette/api/chat.js` |
| `/api/groq` | `api/groq.js` | Adapter to `awd/api/groq.js` |
| `/api/wiki` | `api/wiki.js` | Root-owned, read-only MediaWiki Action API adapter |

`GROQ_API_KEY` remains a Vercel environment secret. No credential is required for the read-only Wikipedia endpoint.

The Wiki adapter:

- accepts only `GET` and `OPTIONS`;
- bounds query length and returned links;
- sends a descriptive Wikimedia user agent;
- times out slow upstream requests;
- caches successful responses at the Vercel edge.

## Canonical Git → Vercel transaction

1. Start a scoped branch from current `origin/main`; keep the primary checkout clean.
2. Run `npm run verify` and the relevant local desktop/mobile checks.
3. Commit only scoped files, push the branch, and open a pull request against `main`.
4. Require successful Vercel previews for `guvs`, `awd`, and `saperli-popette`.
5. Smoke-test the exact preview commit. Use authenticated `vercel curl` for protected preview or AWD aliases.
6. Merge the pull request only after explicit approval and green checks.
7. Let the Vercel Git integration deploy the resulting `main` SHA to production for all three projects.
8. Run the public production smoke suite plus bounded real POST checks, then record the `main` SHA and deployment IDs.

Routine production does not use `vercel --prod`, manual alias reassignment, or manual Preview promotion. Those are recovery actions and require separate explicit approval.

## Rollback

Do not delete existing deployments or projects during a feature rollout. If a promotion fails, restore the last known-good GUVs production deployment; standalone AWD, standalone Saperli, and the GitHub Pages static surface remain separate fallback paths.

Branch cleanup remains a separate tidy pass.
