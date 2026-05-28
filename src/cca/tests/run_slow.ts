// Slow CCA validation suite — the long-running BFS / state-space / fuzzer tests,
// the JS counterpart to the Godot run_tests.sh SLOW_TESTS set (skipped by
// --fast / pre-commit; run on demand + in CI). Same harness + PASS/FAIL contract
// as run.ts. Run: `npm run test:cca:slow`.
import "./test_cca_state_space.cca-test";

import { summary } from "./_harness";

declare const process: { exit(code: number): void };
process.exit(summary());
