import { defineConfig } from "vitest/config";

// Tests sit next to the code they test. The agent and shared packages are
// separate workspaces and are not part of this run.
//
// - unit: pure logic, no database.
// - integration (*.int.test.ts): run against the dev database, seeded first.
//   Each test removes what it created. Files run one at a time so tests don't
//   see each other's rows.
export default defineConfig({
  resolve: {
    alias: { "@": import.meta.dirname },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["app/**/*.test.ts", "lib/**/*.test.ts"],
          exclude: ["**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["app/**/*.int.test.ts", "lib/**/*.int.test.ts"],
          globalSetup: ["./test/seed.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
