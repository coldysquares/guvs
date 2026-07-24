# GUVs

Giant Unilamellar Vesicles: small membrane-bound browser tools for semantic testing, provenance, AI behavior, and post-slop workflows.

## Hosting shape

Production front door:

- The root Vercel project `guvs` serves the registry and all seven registered GUVs at `https://guvs.vercel.app/`.
- Root Vercel Functions provide `/api/chat`, `/api/groq`, and `/api/wiki`.
- The build is registry-driven: only registered app paths enter the public `dist/` artifact.
- Aster Graf and Wiki Graf share the plain-JavaScript membrane runtime in `shared/`.
- `substrate-001/` is intentionally not a GUV and is excluded from the registry and unified artifact. Its source remains untouched for a separate publication site.

Compatibility surfaces:

- AWD and Saperli retain standalone Vercel projects because they also own direct-entry server-backed surfaces.
- GitHub Pages remains a static fallback, but cannot execute the API routes used by AWD, Saperli, or Wiki Constellation.

See `DEPLOYMENT_ARCHITECTURE.md` for route ownership and rollback boundaries.

## Production build

```bash
npm run build
```

The build creates `dist/` from `registry.json`. It copies the shared membrane runtime plus only registered application paths, skips app-local API/deployment metadata, and leaves Vercel Functions in the root `api/` directory. This makes the public artifact an explicit allowlist instead of publishing every tracked repository folder.

## Repo shape

- `index.html` is the public homepage.
- `registry.json` is the source of truth for public GUV cards and unified-build paths.
- Each GUV lives in its own folder, usually as `<slug>/index.html` plus local assets/scripts.
- `shared/membrane-model.js`, `shared/membrane-runtime.js`, and `shared/membrane-runtime.css` are the reusable P.O.N.D./membrane engine.
- Root `api/` contains the unified deployment's Vercel Functions.
- App-local `api/` folders remain canonical for standalone app deployments.
- `aster-graf/` supplies the family and pitch fixture lenses; neither lens owns rendering logic.
- `wiki-constellation/` adapts live Wikipedia results into the shared data contract; `api/wiki.js` owns its bounded lookup.
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
