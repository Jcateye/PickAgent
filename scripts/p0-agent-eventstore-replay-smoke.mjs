#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  [
    "--yes",
    "tsx",
    "--test",
    "apps/backend/tests/integration/p0AgentEventStorePersistence.test.ts",
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
