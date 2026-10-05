# apps/web — Agent Guide

Instructions for working on the Next.js web application and tRPC API routers.

## 1. Strict i18n & Translation
- **100% Dictionary Symmetry:** `apps/web/messages/en.json` and `sk.json` must have identical nested JSON keys (never dotted root keys).
- **Zero Hardcoded JSX Text:** All natural language UI text must go through `useI18n()`:
  ```tsx
  const { t } = useI18n();
  t("section.key", "Fallback text", { param });
  ```
- **No URL Locales:** Never add `app/[locale]/...` prefixes. URLs remain canonical (`/schedule`, `/billing`, `/patients`).
- **Scan Violations:** Run `pnpm --filter @openpims/web i18n:scan`.
- **Independent Translations:** Both EN and SK must be written independently with correct veterinary terminology.

## 2. tRPC Routers & Extensions
- **Mount Point:** All custom extension routers live in `server/routers/extensions/` and mount under `extensions: extensionsRouter` in `server/routers/_app.ts` (`trpc.extensions.*`).
- **Error Handling:** Routers throw errors in English; localization occurs on the client via `useI18n()`.

## 3. UI Kit & Dashboard Guidelines
- Follow `docs/UIKIT.md`.
- New list pages use `PageHeader`, `PageToolbar`, and `DataTableFrame` / `KpiGrid` from `components/layout/page-kit.tsx`.
- Every `<table>` in dashboard and portal must be wrapped in `<div className="overflow-x-auto">` or `<TableScroll>`.

## 4. Next.js 15 & React 19 Runtime
- `optimizePackageImports` in `next.config.js` is production only.
- Service workers never register on `localhost`.
- Theme-dependent UI must use a `mounted` guard to prevent SSR/CSR hydration mismatch.

## 5. Verification Commands
- Type-check: `pnpm --filter @openpims/web type-check`
- Run single test: `pnpm --filter @openpims/web exec vitest run path/to/file.test.ts`
- Filter tests: `pnpm --filter @openpims/web exec vitest run -t "test name"`
