import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/** Integration tests: real route handlers against the real Supabase project (needs .env.local + network). */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
