// Port of Godot tests/test_cca_canon_38.gd — canon row `38 595 60 14 30 4 5`,
// DRIVER-level (mirrors H.make_driver() / H.capture()). Same assertions, same
// expected values, same order. At canon 38 (Bottom of Pit with Stream), the
// verbs SLIT / STREAM / DOWN / UPSTREAM / DOWNSTREAM all emit canon msg #95
// ("You don't fit through a two-inch slit!"). UP at canon 38 is the legitimate
// exit (back to canon 37) and is NOT bumpered.
import { CcaDriver } from "../driver";
import { file, expect, makeDriver, capture } from "./_harness";

file("test_cca_canon_38");

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  expect(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)), true);
}

// Mirrors the Godot _make_driver(): default driver (lamp pre-lit) at canon 38.
function makeDriver38(): CcaDriver {
  const d = makeDriver();
  d.machine().player.move_to(38);
  return d;
}

function checkBumper(verb: string): void {
  const d = makeDriver38();
  const lines: string[] = capture(d, verb);
  expectAnyMatch(`'${verb}' @ 38 emits canon msg #95`, lines, "two-inch slit");
  expect(`'${verb}' @ 38 player still at 38`, d.machine().player_room(), 38);
}

console.log("=== CCA canon-38 directional bumpers (msg #95) ===");

console.log("Canon `38 595 60 14 30 4 5` — 5 verbs all bumpered:");
checkBumper("slit");
checkBumper("stream");
checkBumper("down");
checkBumper("upstream");
checkBumper("downstream");

// UP is the legitimate exit — should walk to canon 37, not bumper.
console.log("UP @ 38 is the legitimate exit (canon 37):");
const d = makeDriver38();
const lines: string[] = capture(d, "up");
let saw_bump = false;
for (const line of lines) {
  if (line.includes("two-inch slit")) {
    saw_bump = true;
    break;
  }
}
expect("UP @ 38 does NOT emit msg #95", saw_bump, false);
expect("UP @ 38 walks to canon 37", d.machine().player_room(), 37);
