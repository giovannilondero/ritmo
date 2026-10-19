# Releases

Every change to a published package needs a changeset (`pnpm changeset`). All `@typeonce/ritmo*` packages are one fixed group and always share a version. A breaking entry carries its fix (a short diff or the exact replacement): the shipped `CHANGELOG.md` is the upgrade guide.

On merge to `main`, the release workflow opens a "Version Packages" pull request. Merging it publishes to npm with trusted publishing and provenance. The workflow runs only while the repository variable `RITMO_RELEASES_ENABLED` is `true`.

If a publish fails, start a fresh run (`gh workflow run release.yml --ref main`) instead of re-running the job: a re-run fails with `TLOG_CREATE_ENTRY_ERROR (409)` because the first attempt already logged its provenance.

## Add a package

Trusted publishing cannot create a package, so a new `packages/<dir>` (`@typeonce/<name>`) is published once by hand:

1. In its PR: give it the group's current version, and add it to the `fixed` group in `config.json`, to `scripts/pack-check.ts`, and to `tsconfig.packages.json`, with a changeset.
2. After merge, from clean `main`:

   ```sh
   pnpm install --frozen-lockfile && pnpm run check && pnpm pack:check
   npm login
   mkdir -p /tmp/ritmo-bootstrap && pnpm build && pnpm --dir packages/<dir> pack --pack-destination /tmp/ritmo-bootstrap
   npm publish /tmp/ritmo-bootstrap/typeonce-<name>-<version>.tgz --access public --provenance=false --ignore-scripts
   ```

3. On npm, add a trusted publisher: `typeonce-dev` / `ritmo` / `release.yml` / environment `npm`, and tick **Allow npm publish** (without it the workflow gets `403 OIDC permission denied`). Do it close to the next release: an unvalidated publisher expires after two days.
4. After the next CI release publishes it, require 2FA and disallow token publishing in its npm settings.
