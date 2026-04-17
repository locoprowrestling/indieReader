# Operations Runbook

## Local commands

Run these from the repo root.

```bash
npm ci
node scripts/fetch.js
node scripts/run-generate.js morning
node scripts/run-generate.js evening
npm run build
```

Notes:

- `node scripts/run-generate.js morning` requires `OPENAI_API_KEY`.
- `node scripts/run-generate.js evening` requires `OPENAI_API_KEY`.
- Local generation updates `src/content/posts/` and `data/state.json`.

## GitHub Actions manual triggers

These require `gh` to be authenticated against the repo.

```bash
gh workflow run fetch.yml
gh workflow run morning.yml
gh workflow run evening.yml
gh workflow run deploy.yml
```

Useful checks:

```bash
gh run list --limit 10
gh run watch
```

## Common recovery flow

If the site is missing a scheduled post:

```bash
node scripts/run-generate.js evening
npm run build
git status --short
```

Or trigger the workflow remotely:

```bash
gh workflow run evening.yml
```
