// Shared harness for the JS CCA validation suite — the faithful counterpart to
// the Godot suite's scripts/_test_helpers.gd. Each test file calls file(name)
// then makes assertions via expect()/ok() at module scope (they run on import,
// mirroring the Godot SceneTree-per-file model); run.ts imports every test file
// and then calls summary(), which prints per-file PASS/FAIL and exits with the
// failed-file count — the same contract as run_tests.sh.
//
// Two drive modes mirror Godot:
//   - FSM-direct:   makeAdventure() ~ `Cca.new()` (raw Adventure FSM).
//   - driver-level: makeDriver() ~ make_driver() (a CcaDriver with the lamp
//     pre-lit and dwarves dormant — i.e. NOT started), capture() ~ capture().
//
// eslint-disable @typescript-eslint/no-explicit-any — the generated FSM is untyped.
import { CcaDriver } from "../driver";
import { Adventure } from "../cca.machine.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Adv = any;

let totalChecks = 0;
let totalFails = 0;
let curFile = "";
let curFails = 0;
const results: { name: string; fails: number; checks: number }[] = [];
let curChecks = 0;

export function file(name: string): void {
  if (curFile) results.push({ name: curFile, fails: curFails, checks: curChecks });
  curFile = name;
  curFails = 0;
  curChecks = 0;
  console.log(`\n=== ${name} ===`);
}

export function expect(label: string, actual: unknown, expected: unknown): void {
  totalChecks += 1;
  curChecks += 1;
  if (actual === expected) {
    console.log(`  ok   ${label} = ${String(actual)}`);
  } else {
    curFails += 1;
    totalFails += 1;
    console.log(`  FAIL ${label} = ${String(actual)} (expected ${String(expected)})`);
  }
}

export function ok(label: string, cond: boolean): void {
  expect(label, cond, true);
}

// Substring assertion against captured driver output (joined lines).
export function expectContains(label: string, lines: string[], needle: string): void {
  ok(`${label} ("${needle}")`, lines.join("\n").includes(needle));
}

// FSM-direct: a raw Adventure, no aspects, no dwarf wake — mirrors `Cca.new()`.
// Tests that need the aspect bus call adv.setup_default_aspects() themselves.
export function makeAdventure(): Adv {
  return Adventure._create();
}

// driver-level: a CcaDriver with the lamp pre-lit and dwarves dormant (start()
// is NOT called, so no wake / no welcome) — mirrors Godot make_driver().
export function makeDriver(): CcaDriver {
  const d = new CcaDriver();
  d.machine().light_lamp();
  return d;
}

// Drive one input and return the lines it emitted — mirrors capture().
export function capture(d: CcaDriver, input: string): string[] {
  return d.input(input);
}

export function summary(): number {
  if (curFile) results.push({ name: curFile, fails: curFails, checks: curChecks });
  console.log("\n=== CCA VALIDATION SUITE SUMMARY ===");
  let failedFiles = 0;
  for (const r of results) {
    if (r.fails > 0) failedFiles += 1;
    console.log(`  ${r.fails === 0 ? "PASS" : "FAIL"} ${r.name}  (${r.checks} checks${r.fails ? `, ${r.fails} fail` : ""})`);
  }
  console.log(
    `\n${failedFiles === 0 ? "PASS" : "FAIL"} — ${results.length} files, ${totalChecks} checks, ${totalFails} failures, ${failedFiles} failed file(s)`,
  );
  return failedFiles;
}
