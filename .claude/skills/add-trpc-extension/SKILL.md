---
name: add-trpc-extension
description: Guide for adding a custom tRPC extension router under apps/web/server/routers/extensions/ mounted in _app.ts.
---

# Add tRPC Extension Router Skill

Standard procedure for adding custom backend API routes without conflicting with upstream OpenVPM routers.

## Rules
1. **Directory:** Place the new router in `apps/web/server/routers/extensions/{name}.ts`.
2. **Procedure types:** Use `protectedProcedure` for authenticated clinic actions; `publicProcedure` only where unauthenticated access is explicitly required.
3. **Mount in `extensionsRouter`:**
   Export the router from `apps/web/server/routers/extensions/index.ts` and mount it strictly under `extensions: extensionsRouter` in `apps/web/server/routers/_app.ts`.
   The frontend calls it as `trpc.extensions.{name}.{procedure}.useQuery()`.
4. **Error Handling:** Routers must throw standard English TRPCError instances (e.g. `new TRPCError({ code: "NOT_FOUND", message: "Patient record not found" })`). All localization is handled client-side.
5. **Verify:**
   ```bash
   pnpm --filter @openpims/web type-check
   ```
