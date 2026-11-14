/**
 * Rewrite scripts/guard-public-ci.allowlist.json from the committed
 * workflows and composite actions under .github. Every run/uses step
 * (and reusable-workflow job.uses) is hashed as the whole step + whole
 * job minus steps + whole workflow minus jobs. Composite action steps
 * hash the whole step + runs minus steps + document minus runs (job
 * key "composite"). Also records the ordered job list per file and the
 * ordered step-id list per job.
 *
 *   node scripts/regen-public-ci-allowlist.mjs
 *
 * Review the diff before committing. A new job, step, trigger, or env
 * change is supposed to fail the guard until the hash is regenerated
 * and reviewed.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(here, "guard-public-ci.mjs"), "--write-allowlist"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
