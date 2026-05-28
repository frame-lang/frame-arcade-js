// Port of Godot tests/test_cca_dwarf_anger.gd — canon dwarf-anger ramp
// (advent.for STMT 6090 + 9213 + DFLAG). Phases 1-4 are FSM-direct
// (makeAdventure = H.Cca.new()); Phase 5 is driver-level (makeDriver +
// capture). Same assertions, same expected values, same order.
//
// RNG NOTE — IMPORTANT: the Godot test seeds the *global* GDScript RNG and
// asserts statistical windows ([692,828] @76%, [213,357] @28%). The JS
// Dwarf.try_throw_axe() does NOT use a global RNG (and ignores fsm.chance) — it
// uses a per-instance deterministic hash of (seed + attack_step counter),
// reproduced bit-identically from the Godot port. So in the JS port the hit
// count is a single FIXED deterministic integer, not a sampled value. The
// in-range assertions are ported VERBATIM (same bounds), but whether that fixed
// count lands inside the window could not be executed/confirmed here (node is
// unavailable). Phase 1 (anger=2 → hit_pct=0 → exactly 0 hits) is exact and
// matches Godot regardless. dwarf1 has seed=1.
import { file, expect, ok, expectContains, makeAdventure, makeDriver, capture } from "./_harness";

file("test_cca_dwarf_anger");

function expectInRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// ----- Phase 1: default anger floor + 0% hit rate -----
// Phase 1: default anger=2 → 0% hit pct (canon first-combat miss)
const fsm = makeAdventure();
fsm.setup_default_aspects();
fsm.wake_dwarves();
expect("default dwarf_anger == 2", fsm.get_dwarf_anger(), 2);
let hits = 0;
for (let i = 0; i < 200; i++) {
  if (fsm.dwarf1.try_throw_axe(2)) hits += 1;
}
expect("anger=2 produces 0 hits in 200 rolls", hits, 0);

// ----- Phase 2: anger=10 → ~76% hit pct -----
// 95*(10-2)/10 = 76. σ for 1000 rolls at 76% ≈ 13.5 → ±5σ ≈ ±68
// → tolerance window [692, 828].
const fsm2 = makeAdventure();
fsm2.setup_default_aspects();
fsm2.wake_dwarves();
let hits2 = 0;
for (let i = 0; i < 1000; i++) {
  if (fsm2.dwarf1.try_throw_axe(10)) hits2 += 1;
}
expectInRange("anger=10 hits in [692, 828] (canon 76%)", hits2, 692, 828);

// ----- Phase 3: anger=5 → ~28.5% hit pct -----
// 95*(5-2)/10 = 28. σ ≈ 14.3 → ±5σ ≈ ±72 → window [213, 357].
const fsm3 = makeAdventure();
fsm3.setup_default_aspects();
fsm3.wake_dwarves();
let hits3 = 0;
for (let i = 0; i < 1000; i++) {
  if (fsm3.dwarf1.try_throw_axe(5)) hits3 += 1;
}
expectInRange("anger=5 hits in [213, 357]", hits3, 213, 357);

// ----- Phase 4: bump_dwarf_anger() advances counter -----
const fsm4 = makeAdventure();
fsm4.setup_default_aspects();
expect("baseline anger", fsm4.get_dwarf_anger(), 2);
fsm4.bump_dwarf_anger();
expect("anger after 1 bump", fsm4.get_dwarf_anger(), 3);
fsm4.bump_dwarf_anger();
fsm4.bump_dwarf_anger();
expect("anger after 3 bumps", fsm4.get_dwarf_anger(), 5);

// ----- Phase 5: FEED dwarf intercept emits canon msg + bumps anger -----
const d = makeDriver();
const angerBefore: number = d.machine().get_dwarf_anger();
const l5: string[] = capture(d, "feed dwarf");
expectContains("FEED dwarf emits 'dwarves eat only coal'", l5, "dwarves eat only coal");
expect("anger bumped by FEED", d.machine().get_dwarf_anger(), angerBefore + 1);

// Repeat: each FEED bumps another point.
capture(d, "feed dwarf");
capture(d, "feed dwarf");
expect("3 FEEDs total → anger += 3", d.machine().get_dwarf_anger(), angerBefore + 3);
