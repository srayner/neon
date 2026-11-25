import { defineConfig } from "vitest/config";

// The agent against a real Docker daemon (docs/alerts.md 8.2): npm run test:docker.
// Kept out of npm test because it needs Docker and takes a minute. The tests
// use only containers labelled neon-test=agent and remove them afterwards.
// Files run one at a time: they watch the same daemon's events.
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/agent/src/**/*.docker.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
