import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests sit next to the code they test. The agent and shared
    // packages are separate workspaces and are not part of this run.
    include: ["app/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
});
