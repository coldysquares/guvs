# GUVs Smoke Checklist

## Local artifact

```bash
npm run build
```

Confirm `dist/` contains the root registry, the explicit `shared/` membrane runtime, and exactly seven registered app directories: PSR, AWD, Router, Aster Graf, Fungi Cell Map, Wiki Graf, and Saperli Popette. `substrate-001/`, app-local `api/`, `.vercel`, backup, and deployment-config files must not appear in the static artifact.

## Current production baseline

```bash
npm run smoke
```

This checks the public GUVs registry and the standalone public Saperli surface.

## Unified Vercel preview

```bash
GUVS_BASE_URL=https://<preview-url>/ \
GUVS_EXPECT_UNIFIED=1 \
npm run smoke
```

The unified check requires:

- `/` serves the GUVs title.
- `registry.json` contains all seven GUVs and excludes Substrate 001.
- `/psr/`, `/awd/`, `/router/`, `/aster-graf/`, `/fungi-cell-map/`, `/wiki-constellation/`, and `/saperli-popette/` serve the correct applications.
- `/api/chat`, `/api/groq`, and `/api/wiki` return API-style statuses on incomplete or unsupported requests, not static HTML or `404`.
- `/api/wiki?q=Paul%20Thomas%20Anderson` returns a resolved origin article and a linked-page array.
- Aster opens Family and Pitch through the same membrane runtime; entering, Back, and Pond exit preserve state on mobile.
- Wiki Graf accumulates a second fetched ring without replacing the first and returns to the exact prior membrane.
- The AWD tab sends nothing until Run is tapped, then supports copy, keep, and discard without creating a thread.
- The standalone `https://saperli-popette.vercel.app` route and API remain healthy.

Before production promotion, also verify AWD and Saperli can make real POST requests with the project environment configured, and verify at least two Wiki Constellation searches on desktop and mobile.
