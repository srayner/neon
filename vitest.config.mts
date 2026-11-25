import { defineConfig } from "vitest/config";

// Tests sit next to the code they test.
//
// - unit: pure logic, no database.
// - agent: the agent's pure logic, no Docker. Its tests against a real Docker
//   daemon (*.docker.test.ts) run separately: npm run test:docker.
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
          name: "agent",
          include: ["packages/agent/src/**/*.test.ts"],
          exclude: ["**/*.docker.test.ts"],
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
