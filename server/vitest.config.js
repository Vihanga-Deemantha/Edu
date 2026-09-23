import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.js"],
    hookTimeout: 30000,
    testTimeout: 15000,
    // All test files share one in-memory MongoDB instance (see src/test/setup.js) —
    // running files in parallel would race multiple instances against each other.
    fileParallelism: false,
  },
});
