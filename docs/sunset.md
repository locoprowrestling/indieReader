# indieReader Sunset

indieReader is sunsetting as of Monday, July 6th, 2026.

The pre-sunset site state is archived in git tag
`archive/pre-sunset-2026-07-06`.

The scheduled fetch, generated-post, and tweet workflows were moved out of
`.github/workflows/` into `.github/workflows-disabled/`.

The GitHub Pages deploy workflow remains active for pushes to `main`, so future
static sunset-page updates can publish automatically without re-enabling the
expensive content tooling.
