# indieReader Sunset

indieReader is sunsetting as of Monday, July 6th, 2026.

The pre-sunset site state is archived in git tag
`archive/pre-sunset-2026-07-06`.

The scheduled fetch, generated-post, and tweet workflows were moved out of
`.github/workflows/` into `.github/workflows-disabled/`.

The GitHub Pages deploy workflow remains active for pushes to `main`, so future
static sunset-page updates can publish automatically without re-enabling the
expensive content tooling.

## Deployment Rule

This repo uses workflow-based GitHub Pages. The public site updates only after
`.github/workflows/deploy.yml` builds and deploys the static artifact.

Do not move or disable `deploy.yml` before the sunset page change has deployed.
If the live domain still shows an older page, restore the deploy workflow,
trigger or push a deploy, wait for the Pages run to succeed, and verify the live
domain with:

```sh
curl -L -s https://indiereader.locopro.pw/ | rg "indieReader is signing off|Sunsetting Monday"
```

The archived fetch/generate/tweet workflows should remain in
`.github/workflows-disabled/` unless indieReader content operations are being
restarted intentionally.
