// Run: node --experimental-strip-types worker/src/ai.check.ts
// Source-only: Node strip-types cannot follow api/_lib/*.js → *.ts. Wire-shape
// coverage lives in worker/src/ai.test.ts (npm test).
import { assertNoWorkerAiBypass } from './ai.guard.ts'

assertNoWorkerAiBypass()
console.log('worker AI gateway source: ok')
