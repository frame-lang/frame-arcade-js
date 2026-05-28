// Port of Godot tests/test_cca_dwarf_hitrate_curve.gd — dwarf axe-throw hit rate
// as a FUNCTION of anger (canon advent.for STMT 6090ish: 95*(anger-2)/10 %).
// FSM-direct on the standalone Dwarf system (Godot: NPCs.Dwarf._create(seed)).
// Same assertions, same expected values, same order.
//
// RNG NOTE — IMPORTANT: the JS Dwarf.try_throw_axe() does NOT use a global RNG.
// It rolls a per-instance deterministic hash of (seed + attack_step), reproduced
// bit-identically from the Godot port. So for a fixed seed set (1..400) the hit
// COUNT at each anger level is a single FIXED deterministic integer, not a
// sampled value. The Godot original is likewise deterministic (it constructs a
// fresh Dwarf per seed, never touching a global RNG), so the empirical-vs-formula
// |delta| <= TOL and the monotonicity assertions are ported VERBATIM. Whether the
// fixed empirical counts land inside TOL=5 of the formula could NOT be
// executed/confirmed here (node is unavailable). The anger==2 anchor (hit_pct=0 →
// exactly 0 hits) is exact and matches Godot regardless of LCG constants.
import { file, ok } from "./_harness";
import { Dwarf } from "../npcs.machine.js";

file("test_cca_dwarf_hitrate_curve");

const N = 400; // throws per anger level
const TOL = 5; // max |empirical − formula| in percentage points

const fails: string[] = [];
let prevEmp = -1;

for (let anger = 2; anger <= 12; anger++) {
  // GDScript int division: 95 * (anger - 2) / 10 (truncating).
  let pct: number = Math.floor((95 * (anger - 2)) / 10);
  if (pct > 100) {
    pct = 100;
  }
  let hits = 0;
  for (let seed = 1; seed <= N; seed++) {
    const dw = Dwarf._create(seed);
    dw.wake_up(20);
    if (dw.try_throw_axe(anger)) {
      hits += 1;
    }
  }
  const emp: number = Math.round((100.0 * hits) / N);
  const delta: number = emp - pct;
  console.log(
    `  anger ${String(anger).padStart(2)}: formula ${String(pct).padStart(3)}%  empirical ${String(emp).padStart(3)}%  (${delta >= 0 ? "+" : ""}${delta})`,
  );

  if (Math.abs(delta) > TOL) {
    fails.push(`anger ${anger}: empirical ${emp}% off formula ${pct}% by ${Math.abs(delta)} (> ${TOL})`);
  }
  if (emp < prevEmp) {
    fails.push(`anger ${anger}: curve dropped (${emp}% < prev ${prevEmp}%)`);
  }
  prevEmp = emp;
}

// Anchor checks: the canon endpoints must be exact-ish.
// anger 2 = first combat, always misses (0%).
let missHits = 0;
for (let seed = 1; seed <= N; seed++) {
  const dw = Dwarf._create(seed);
  dw.wake_up(20);
  if (dw.try_throw_axe(2)) {
    missHits += 1;
  }
}
if (missHits !== 0) {
  fails.push(`anger 2 (first combat) must always miss; got ${missHits} hits`);
}

// Faithful to the .gd final verdict: PASS iff no failures accumulated. Reported
// as a single assertion so the harness records pass/fail (the .gd prints each
// fail line then quit(1)); the per-fail detail is logged here too.
for (const f of fails) console.log(`  FAIL ${f}`);
ok("dwarf hit-rate curve matches canon across anger 2..12 (no fails)", fails.length === 0);
