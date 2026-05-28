// Port of Godot tests/test_cca_rod2_dynamite.gd — verifies canon ROD2 examine
// behavior. Canon obj#6 (ROD2) has only prop=0 — "A three foot black rod with a
// rusty mark on an end lies nearby." — and NO post-endgame dynamite reveal. The
// port mirrors canon: EXAMINE ROD always returns the rusty-mark prose,
// regardless of $InRepository state. Discovering that the rod is dynamite is
// canonically left to BLAST.
//
// Godot→JS mapping: _make_driver_with_mark_rod() builds a CapturedDriver, lights
// the lamp, places mark_rod (ROD2) at the player's room and takes it so
// mark_rod_here() is true on either examine path. We do the same via makeDriver
// (lamp pre-lit) + d.machine().mark_rod_item.place(here)/try_take(here).
// _force_repository drives the Endgame to $InRepository via 15
// endgame.treasure_deposited() calls + tick() until it leaves "closing".
// Expected substrings copied VERBATIM from the Godot source.
import { file, ok, makeDriver, capture } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_rod2_dynamite");

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}
function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} no line contained '${needle}'`, !lines.some((l) => l.includes(needle)));
}

// Place mark_rod (ROD2) at the player's room and pick it up so mark_rod_here()
// returns true regardless of which path the examine handler takes.
function makeDriverWithMarkRod(): CcaDriver {
  const d = makeDriver(); // lamp pre-lit (≈ do_command("light", ""))
  const here: number = d.machine().player_room();
  d.machine().mark_rod_item.place(here);
  d.machine().mark_rod_item.try_take(here);
  return d;
}

// Drive the Endgame to $InRepository: deposit triggers + tick.
function forceRepository(d: CcaDriver): void {
  for (let i = 0; i < 15; i++) d.machine().endgame.treasure_deposited();
  while (d.machine().endgame_state() === "closing") d.machine().endgame.tick();
}

console.log("=== CCA ROD2 examine — canon obj#6 prop=0 (no dynamite reveal) ===");

// ----- Phase 1: pre-CLOSED — EXAMINE ROD emits canon rusty-mark prose -----
console.log("Phase 1: pre-CLOSED — EXAMINE ROD → canon rusty-mark prose");
const d1 = makeDriverWithMarkRod();
const l1: string[] = capture(d1, "examine rod");
expectAnyMatch("EXAMINE ROD emits canon obj#6 prose", l1, "rusty mark");
expectNoMatch("port-only dynamite reveal does NOT fire", l1, "dynamite");

// ----- Phase 2: $InRepository — same canon prose, NO dynamite reveal -----
console.log("Phase 2: $InRepository — EXAMINE ROD still emits canon prose");
const d2 = makeDriverWithMarkRod();
forceRepository(d2);
const l2: string[] = capture(d2, "examine rod");
expectNoMatch("$InRepository: no port-only dynamite reveal", l2, "dynamite");
expectNoMatch("$InRepository: no flame caveat", l2, "flame");

// ----- Phase 3: READ ROD synonym — canon-aligned, no special endgame branch ---
console.log("Phase 3: READ ROD synonym at endgame — canon prose, no dynamite");
const d3 = makeDriverWithMarkRod();
forceRepository(d3);
const l3: string[] = capture(d3, "read rod");
expectNoMatch("READ ROD post-CLOSED has no dynamite reveal", l3, "dynamite");
