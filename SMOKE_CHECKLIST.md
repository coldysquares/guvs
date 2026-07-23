# GUVs Smoke Checklist

## Local artifact

```bash
npm run build
```

Confirm `dist/` contains the root registry plus exactly six registered app directories: PSR, AWD, Router, Aster Graf, Fungi Cell Map, and Saperli Popette. `substrate-001/`, app-local `api/`, `.vercel`, backup, and deployment-config files must not appear in the static artifact.

## Current production baseline

```bash
npm run smoke
```

This checks the GitHub Pages registry and the standalone public Saperli surface.

## Unified Vercel preview

```bash
GUVS_BASE_URL=https://<preview-url>/ \
GUVS_EXPECT_UNIFIED=1 \
npm run smoke
```

The unified check requires:

- `/` serves the GUVs title.
- `registry.json` contains all six GUVs and excludes Substrate 001.
- `/psr/`, `/awd/`, `/router/`, `/aster-graf/`, `/fungi-cell-map/`, and `/saperli-popette/` serve the correct applications.
- `/api/chat` and `/api/groq` return API-style statuses on `GET`, not static HTML or `404`.
- The standalone `https://saperli-popette.vercel.app` route and API remain healthy.

Before production cutover, also verify AWD and Saperli can make real POST requests with the project environment configured.
