# GUVs

Giant Unilamellar Vesicles: small membrane-bound browser tools for semantic testing, provenance, AI behavior, and post-slop workflows.

## Hosting shape

Observed current production:

- The GUVs registry and static apps publish from `main` through GitHub Pages at `https://coldysquares.github.io/guvs/`.
- AWD and Saperli also have standalone Vercel projects because they own server-side API routes.

Candidate replacement front door:

- One root Vercel project, provisionally named `guvs`, connected to this repository with Root Directory `.`.
- The root project serves the registry and all six registered GUVs from one deployment.
- Root Vercel Functions provide `/api/chat` and `/api/groq`.
- `substrate-001/` is intentionally not a GUV and is excluded from the registry and unified artifact. Its source remains untouched for a separate publication site.
- The existing standalone AWD and Saperli projects remain compatible direct-entry surfaces.

The candidate is implemented in source but is not an active production project until it receives an approved Vercel project creation and cutover. See `DEPLOYMENT_ARCHITECTURE.md`.

## Production build

```bash
npm run build
```

The build creates `dist/` from `registry.json`. It copies only registered application paths, skips app-local API/deployment metadata, and leaves Vercel Functions in the root `api/` directory. This makes the public artifact an explicit allowlist instead of publishing every tracked repository folder.

## Repo shape

- `index.html` is the public homepage.
- `registry.json` is the source of truth for public GUV cards and unified-build paths.
- Each GUV lives in its own folder, usually as `<slug>/index.html` plus local assets/scripts.
- Root `api/` contains the unified deployment's Vercel Functions.
- App-local `api/` folders remain canonical for standalone app deployments.
- `substrate-001/` remains source-only here until its standalone media/magazine site receives a separately approved project and publishing plan.

## Safe workflow

Use `./guv` for normal changes:

```bash
./guv add "Title" "Short description"
./guv replace slug
./guv remove slug
./guv publish "Commit message"
```

`add`, `replace`, and `remove` write a local publish manifest. `publish` only stages the files listed in that manifest and refuses unrelated modified files.

For a hand-edited file, explicitly name the file you want to publish:

```bash
./guv publish --paths registry.json "Update registry"
```
