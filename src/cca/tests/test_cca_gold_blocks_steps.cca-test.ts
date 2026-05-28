// Port of Godot tests/test_cca_gold_blocks_steps.gd — canon "you can't get the
// gold up the steps" puzzle at canon 15 (row `15 150022 29 31 34 35 23 43`),
// DRIVER-level (mirrors H.CapturedDriver / d._process_input(); the JS d.input()
// is the public equivalent and returns the emitted lines). Same assertions,
// same expected values, same order.
//
// When at 15 carrying the gold nugget, UP/PIT/STEPS/DOME/PASSAGE/EAST all print
// "The dome is unclimbable." and leave the player at 15. Without gold, 15:up
// walks normally to canon 14.
import { CcaDriver } from "../driver";
import { file, expect, makeDriver } from "./_harness";

file("test_cca_gold_blocks_steps");

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  expect(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)), true);
}

// makeDriver() mirrors the Godot driver with the lamp lit (Godot's _init lights
// it via do_command("light")) so the dark-pit hazard doesn't interfere.
function makeDriverGold(): CcaDriver {
  return makeDriver();
}

// Try a movement verb starting at 15 with gold in hand. Returns the destination
// room and the captured lines from that single command. Resets to 15 with gold.
function tryBlocked(d: CcaDriver, verb: string): { room: number; lines: string[] } {
  d.machine().player.move_to(15);
  if (!d.machine().player.carrying(d.machine().GOLD_ID)) {
    d.machine().player.take(d.machine().GOLD_ID);
  }
  const lines: string[] = d.input(verb);
  return { room: d.machine().player_room(), lines };
}

console.log("=== CCA gold-blocks-the-steps (canon 15 / row `15 150022 ...`) ===");

// Phase 1: with gold, the six canon-blocked verbs all bumper and keep the
// player at 15.
console.log("Phase 1: gold in hand — UP/PIT/STEPS/DOME/PASSAGE/EAST blocked");
const d = makeDriverGold();

for (const verb of ["up", "pit", "steps", "dome", "passage", "east"]) {
  const r = tryBlocked(d, verb);
  expect(`with gold, ${verb} keeps player at 15`, r.room, 15);
  expectAnyMatch(`with gold, ${verb} emits dome-bumper`, r.lines, "dome is unclimbable");
}

// Phase 2: with gold, the other 15: exits still walk.
console.log("Phase 2: gold in hand — south/north/down/west still walk");

d.machine().player.move_to(15);
if (!d.machine().player.carrying(d.machine().GOLD_ID)) d.machine().player.take(d.machine().GOLD_ID);
d.input("south");
expect("with gold, 15:south → 18 (gold-nugget room)", d.machine().player_room(), 18);

d.machine().player.move_to(15);
d.input("north");
expect("with gold, 15:north → 19 (Hall of Mt King)", d.machine().player_room(), 19);

d.machine().player.move_to(15);
d.input("down");
expect("with gold, 15:down → 19 (Hall of Mt King)", d.machine().player_room(), 19);

d.machine().player.move_to(15);
d.input("west");
expect("with gold, 15:west → 17 (east bank fissure)", d.machine().player_room(), 17);

// Phase 3: without gold, UP walks normally to 14.
console.log("Phase 3: no gold — 15:up walks to 14");
const d2 = makeDriverGold();
d2.machine().player.move_to(15);
expect("d2: not carrying gold initially", d2.machine().player.carrying(d2.machine().GOLD_ID), false);
d2.input("up");
expect("without gold, 15:up → 14 (top of small pit)", d2.machine().player_room(), 14);

// Phase 4: dropping gold at 15 lifts the gate — UP walks again.
console.log("Phase 4: gold dropped at 15 — UP walks again");
const d3 = makeDriverGold();
d3.machine().player.move_to(15);
d3.machine().player.take(d3.machine().GOLD_ID);
expect("d3: carrying gold", d3.machine().player.carrying(d3.machine().GOLD_ID), true);
d3.machine().player.drop(d3.machine().GOLD_ID);
expect("d3: dropped gold", d3.machine().player.carrying(d3.machine().GOLD_ID), false);
d3.input("up");
expect("after dropping gold, 15:up → 14", d3.machine().player_room(), 14);
