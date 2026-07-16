# Operations Runbook

## Local commands

Run these from the repo root.

```bash
npm ci
npm run build
```

Notes:

- indieReader is currently sunset. The fetch and generation scripts remain in
  the repo for archive/history, but they should not be run unless content
  operations are intentionally restarted.
- `node scripts/run-generate.js morning` requires `OPENAI_API_KEY`.
- `node scripts/run-generate.js evening` requires `OPENAI_API_KEY`.
- Local generation updates `src/content/posts/` and `data/state.json`.

## GitHub Actions

Only the Pages deploy workflow should be active while indieReader is sunset.
It deploys on pushes to `main` and can also be manually dispatched:

```bash
gh workflow run deploy.yml --repo locoprowrestling/indieReader --ref main
```

Useful checks:

```bash
gh run list --repo locoprowrestling/indieReader --workflow deploy.yml --limit 1
gh run watch <run-id> --repo locoprowrestling/indieReader --exit-status
curl -L -s https://indiereader.locopro.pw/ | rg "indieReader is signing off|Sunsetting Monday"
```

The content-generation workflows are archived in `.github/workflows-disabled/`.
Do not move them back into `.github/workflows/` unless restarting the product.

## Common recovery flow

If a pushed static sunset-page edit does not appear live, confirm that
`.github/workflows/deploy.yml` still exists, then inspect the latest Pages run:

```bash
gh run list --repo locoprowrestling/indieReader --limit 10
gh run watch <run-id> --repo locoprowrestling/indieReader --exit-status
```
