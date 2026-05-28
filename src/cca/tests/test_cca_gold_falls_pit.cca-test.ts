// Port of Godot tests/test_cca_gold_falls_pit.gd — canon "you can't carry the
// gold up the pit" fall-to-death at canon 14 (row `14 150020 30 31 34`),
// DRIVER-level (mirrors H.CapturedDriver / d._process_input(); the JS d.input()
// is the public equivalent and returns the emitted lines). Same assertions,
// same expected values, same order.
//
// At canon 14 carrying gold, DOWN/PIT/STEPS dump the player into canon 20
// (broken-neck death). Without gold, DOWN walks normally to canon 15; PIT/STEPS
// have no unconditional canon row.
import { CcaDriver } from "../driver";
import { file, expect, makeDriver } from "./_harness";

file("test_cca_gold_falls_pit");

function expectEq(label: string, actual: unknown, expected: unknown): void {
  expect(label, JSON.stringify(actual), JSON.stringify(expected));
}

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  expect(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)), true);
}

// makeDriver() mirrors the Godot driver with the lamp lit (Godot's phases light
// it via do_command("light")) so the dark-pit hazard doesn't interfere.
function makeDriverGold(): CcaDriver {
  return makeDriver();
}

console.log("=== CCA gold-falls-pit (canon 14 / row `14 150020 ...`) ===");

// Phase 1: with gold, DOWN/PIT/STEPS at canon 14 walk the player into canon 20
// and trigger the broken-neck death.
console.log("Phase 1: gold in hand at 14 — DOWN/PIT/STEPS fall to 20 (death)");
for (const verb of ["down", "pit", "steps"]) {
  const d = makeDriverGold();
  d.machine().player.move_to(14);
  d.machine().player.take(d.machine().GOLD_ID);
  expectEq(
    `setup: at 14 with gold (${verb})`,
    [d.machine().player_room(), d.machine().player.carrying(d.machine().GOLD_ID)],
    [14, true],
  );
  const lines: string[] = d.input(verb);
  expect(`with gold, ${verb} walks to canon 20 (pit bottom)`, d.machine().player_room(), 20);
  expect(`with gold, ${verb} leaves player dead`, d.machine().player_state(), "dead");
  expectAnyMatch(`with gold, ${verb} emits broken-bone canon prose`, lines, "broke every bone");
}

// Phase 2: without gold, DOWN at canon 14 walks normally to canon 15. PIT and
// STEPS aren't unconditionally defined at 14 in canon.
console.log("Phase 2: no gold at 14 — DOWN walks to 15, PIT/STEPS not defined");
const d2 = makeDriverGold();
d2.machine().player.move_to(14);
expect("d2: not carrying gold initially", d2.machine().player.carrying(d2.machine().GOLD_ID), false);
d2.input("down");
expect("without gold, 14:down → 15 (Hall of Mists)", d2.machine().player_room(), 15);

const d3 = makeDriverGold();
d3.machine().player.move_to(14);
d3.input("pit");
expect("without gold, 14:pit stays at 14 (no canon row)", d3.machine().player_room(), 14);
expect("without gold, 14:pit doesn't kill the player", d3.machine().player_state(), "alive");

// Phase 3: drop gold at 14 → DOWN walks normally again.
console.log("Phase 3: gold dropped at 14 — DOWN walks to 15 (no death)");
const d4 = makeDriverGold();
d4.machine().player.move_to(14);
d4.machine().player.take(d4.machine().GOLD_ID);
expect("d4: carrying gold", d4.machine().player.carrying(d4.machine().GOLD_ID), true);
d4.machine().player.drop(d4.machine().GOLD_ID);
expect("d4: dropped gold", d4.machine().player.carrying(d4.machine().GOLD_ID), false);
d4.input("down");
expect("after dropping gold, 14:down → 15 (no fall)", d4.machine().player_room(), 15);
expect("after dropping gold, player still alive", d4.machine().player_state(), "alive");
