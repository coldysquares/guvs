# GUVs / Saperli Smoke Checklist

Run this after changing Saperli, AWD, registry routing, Vercel project settings, or production aliases.

```bash
node scripts/smoke-check.mjs
```

Manual checks:

- `https://saperli-popette.vercel.app/` serves the Saperli Popette page, not the GUVs registry.
- `https://saperli-popette.vercel.app/api/chat` exists. A `GET` should return an API-style status such as `405`, not the static app shell or a registry page.
- `https://coldysquares.github.io/guvs/registry.json` includes both `AWD` and `Saperli Popette`.
- If Vercel has `GROQ_API_KEY` set for the `saperli-popette` project, the app should chat without a browser key.
- If Vercel does not have `GROQ_API_KEY`, the app should open the key panel after the first chat attempt and accept a local browser key.

Current recommended posture:

- Groq key mode: hybrid. Prefer a Vercel `GROQ_API_KEY` for Nick/demo use; keep the browser-key fallback for easy personal/local testing.
- Access mode: keep the stable public share URL `https://saperli-popette.vercel.app` public. Team-scoped Vercel aliases can remain SSO-protected unless every alias needs to be shareable.
