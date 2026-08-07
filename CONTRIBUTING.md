# Contributing

Thanks for your interest in contributing to AniList Tracker! This is a
solo/small-team project maintained in spare time, so please be patient with
review times.

## Getting started

1. Fork the repository (or, if you have write access, clone it directly)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in the required values (see the
   [README](./README.md) for details on the OAuth setup and the backend
   service)
4. For a stable extension ID during local development (useful for testing
   OAuth without re-registering a redirect URI on every reload), use:
   ```bash
   npm run build:dev
   ```
   This uses `dev-key.txt` to keep a consistent extension ID across reloads.

## Branch workflow

- `main` is protected and always reflects what's published on the stores.
  All changes land there via pull request only — no direct pushes, no force
  pushes.
- `dev` is where day-to-day work happens. Base your feature branches on
  `dev`, not `main`.
- Open pull requests against `dev`. Releases are cut by merging `dev` into
  `main` and tagging (`vX.Y.Z`).

## Code style

- **TypeScript**, strict mode.
- **No comments in code.** Code should be self-explanatory through clear
  naming and structure; comments are considered noise here and will be
  removed in review.
- Keep parsers consistent with the existing `SiteParser` interface pattern
  in `src/parsers/`. If you're adding support for a new site, see the
  "Adding a New Site" section in the README.
- Run the type checker before opening a PR:
  ```bash
  npm run typecheck
  ```

## Pull requests

- Every PR triggers CI (`typecheck` + `build`) — make sure both pass.
- Keep PRs focused on a single change (one site parser, one bug fix, one
  feature) where possible; it makes review much faster.
- Describe **what** changed and **why**, and mention which site(s) you
  tested on if relevant (DOM-based parsers are easy to break silently).

## Adding support for a new reading/streaming site

See the "Adding a New Site" section in the [README](./README.md) for the
exact steps (parser class, `SupportedSite` registration, manifest content
script matches, hostname mapping).

Only officially licensed sites are listed publicly in the README/store
descriptions — scanlation site support may still be accepted but won't be
advertised.

## Reporting bugs / requesting features

Please use the issue templates. For anything security-related, see
[SECURITY.md](./SECURITY.md) instead of opening a public issue.
