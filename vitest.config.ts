import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "bridge/**/*.test.js",
      "packages/forensics/src/**/*.test.ts",
      "packages/forensics/test/**/*.test.ts",
    ],
    environment: "node",
  },
});
