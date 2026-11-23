---
name: pre-merge-checks
description: The checks Neon must pass before a feature branch is merged into main. Used by the merge workflow; also use when asked whether a branch is ready to merge.
---

# Neon pre-merge checks

Run these in order on the committed code. All must pass.

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run build:agent`: the agent package must still compile.
6. `docker build -t neon:premerge .`, the real production path. When it passes, remove
   the image with `docker rmi neon:premerge` so nothing is left behind. If Docker isn't
   available, say so: that check was skipped.

There is no e2e test suite yet. Say so in the report rather than implying the change was
tested in a browser.
