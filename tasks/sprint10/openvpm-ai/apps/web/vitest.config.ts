import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" -> "./*" path alias used across apps/web.
    alias: [{ find: /^@\//, replacement: resolve(__dirname, "./") + "/" }],
  },
  test: {
    environment: "node",
    // Ensure data-import legacy compatibility checks see test mode even when
    // vitest is invoked without NODE_ENV explicitly set (e.g. raw `npx vitest run`).
    env: { NODE_ENV: "test" },
    // Unit tests only — pure logic (mappers, auth helpers). The Playwright
    // e2e suite lives under /e2e and is run separately via `pnpm test:e2e`.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "../../e2e/**"],
  },
});
