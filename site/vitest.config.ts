import { defineConfig } from "vitest/config";

// Keep site tests from walking up to the app's vite.config.ts (which imports
// packages that are not installed in this workspace).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
