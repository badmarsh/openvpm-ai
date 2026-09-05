# Versioning policy

OpenVPM follows [Semantic Versioning 2.0.0](https://semver.org/).

While the product is pre-1.0:

- `0.y.z` — y increments for incompatible schema or API changes; z for fixes.
- Public REST `/api/v1` contracts must not break without a new version path or changelog entry.

## Artifacts

- `apps/web/package.json` `version` is the product version.
- Git tags: `v0.y.z` after owner approval.
- Do not retag.
- Changelog: root `CHANGELOG.md`.

## Compatibility

- Database: committed Drizzle migrations are append-only (CI `db:migrations:check`).
- REST mappers: contract tests under `lib/compat`.
