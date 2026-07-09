# GUVs

Giant Unilamellar Vesicles: small membrane-bound browser tools for semantic testing, provenance, AI behavior, and post-slop workflows.

## Repo shape

This repository publishes one GitHub Pages site:

- `index.html` is the public homepage.
- `registry.json` is the source of truth for which GUV cards appear on the homepage.
- Each GUV lives in its own folder, usually as `<slug>/index.html` plus any local assets/scripts.
- Removing an entry from `registry.json` removes it from the public homepage without deleting or unhosting the underlying app folder.

## Safe workflow

Use `./guv` for normal changes:

```bash
./guv add "Title" "Short description"
./guv replace slug
./guv remove slug
./guv publish "Commit message"
```

`add`, `replace`, and `remove` write a local publish manifest. `publish` only stages the files listed in that manifest and refuses unrelated modified files, so changing one GUV cannot accidentally commit another folder.

For a hand-edited file, explicitly name the file you want to publish:

```bash
./guv publish --paths registry.json "Update registry"
```

## Seeded GUVs

- PSR — Post-Slop Reagent
- AWD — AI Waste Deleter
- Substrate 001
- Ticket Monitor
