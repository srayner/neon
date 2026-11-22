---
name: pre-merge-checks
description: The checks Neon must pass before a feature branch is merged into main. Used by the merge workflow; also use when asked whether a branch is ready to merge.
---

# Neon pre-merge checks

Run these in order on the committed code. All must pass.

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run build`
4. `npm run build:agent`: the agent package must still compile.
5. `docker build -t neon:premerge .`, the real production path. If Docker isn't available, say so: that check was skipped.

There is no unit or e2e test suite. Say so in the report rather than implying tests ran.
