import { execFileSync } from "child_process";

// Seeds the dev database before the integration tests. The seed skips what
// already exists, so running it every time is safe.
export default function setup() {
  execFileSync("npx", ["tsx", "scripts/seed-servers.ts"], { stdio: "inherit" });
}
