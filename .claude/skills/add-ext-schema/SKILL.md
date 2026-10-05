---
name: add-ext-schema
description: Guide for creating a new isolated extension schema in packages/db/schema/ext_{name}.ts with generated migrations and re-exports.
---

# Add Extension Schema Skill

Enforces zero-conflict upstream synchronization when adding new database tables or enums.

## Rules
1. **Never modify vanilla schema files:** Never edit `packages/db/schema/*.ts` (except re-exporting in `packages/db/schema/index.ts`).
2. **File naming:** All new tables/enums must live in `packages/db/schema/ext_{name}.ts`.
3. **Table prefixes:** Table names should start with `ext_` (e.g. `ext_imaging_scans`, `ext_marketing_campaigns`).
4. **Re-export:** Add `export * from "./ext_{name}";` to `packages/db/schema/index.ts`.
5. **Generate Migration:**
   ```bash
   pnpm db:generate
   ```
   Verify that a new migration `NNNN_*.sql` is generated under `packages/db/drizzle/`, along with its snapshot and journal update.
   A second run of `pnpm db:generate` must produce no diffs.
6. **Verify:**
   ```bash
   pnpm --filter @openpims/db type-check
   ```
