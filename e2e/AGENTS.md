# e2e — Agent Guide

Instructions for Playwright end-to-end testing in OpenVPM AI.

## 1. Prerequisites
- Local web dev server running on port 3001 (`pnpm dev` or `pnpm build && pnpm start`).
- Local PostgreSQL `openvpm-postgres-1` running and fully migrated (`pnpm db:bootstrap && pnpm db:rls && pnpm db:seed:sk`).

## 2. Execution Commands
- Run all E2E tests: `pnpm test:e2e`
- Run specific spec: `pnpm exec playwright test e2e/path/to/spec.test.ts`
- UI mode: `pnpm exec playwright test --ui`

## 3. Test Standards
- Never use real personal identifiable information (PII) or production credentials in test fixtures.
- Clean up test-created data or use isolated tenant / clinic scopes.
- Handle responsive breakpoints and theme states gracefully without brittle fixed-sleep timers.
