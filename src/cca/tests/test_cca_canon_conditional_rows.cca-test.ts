// Port of Godot tests/test_cca_canon_conditional_rows.gd — behavioural locks for
// the 6 canon section-3 conditional rows, DRIVER-level (mirrors H.make_driver()
// / d._process_input(); the JS d.input() is the public equivalent and returns the
// emitted lines). Same assertions, same expected values, same order. Asserts the
// canonical *behaviour* is preserved regardless of architectural routing:
//
//   1. `31 524089 1`   — plant-beanstalk climb (room 25; tall→escape, tiny→rebuff)
//   2. `33 159302 71`  — PLOVER at Y2 → Plover Room (canon 100)
//   3. `61 100107 46`  — south at long-hall-W → room 107
//   4. `100 159302 71` — PLOVER at Plover → back to Y2 (canon 33)
//   5. `103 114618 46` — south at Shell Room carrying clam → msg #118, no move
//   6. `103 115619 46` — south at Shell Room carrying oyster → msg #119, no move
import { CcaDriver } from "../driver";
import { file, ok, makeDriver } from "./_harness";

file("test_cca_canon_conditional_rows");

let lastLines: string[] = [];

function assertEq(label: string, observed: unknown, expected: unknown): void {
  ok(`[${label}] expected ${String(expected)}, observed ${String(observed)}`, observed === expected);
}

// Mirrors Godot _assert_captured: case-insensitive substring over the lines
// emitted by the most recent input.
function assertCaptured(label: string, lines: string[], needle: string): void {
  let hit = false;
  for (const line of lines) {
    if (line.toLowerCase().includes(needle.toLowerCase())) {
      hit = true;
      break;
    }
  }
  ok(`[${label}] '${needle}' in captured output`, hit);
}

console.log("=== CCA canon-conditional-row behavioural locks ===");
console.log("");

// Row `31 524089 1` half A: plant tiny / not tall → rebuff at room 25.
function testPlantClimbRebuff(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(25);
  // Plant defaults to $Tiny on a fresh FSM — no pour-water yet.
  const pre_room: number = d.machine().player_room();
  lastLines = d.input("up");
  const post_room: number = d.machine().player_room();
  assertEq("plant-tiny + 25:up stays put", pre_room, post_room);
  assertCaptured("plant-tiny rebuff message", lastLines, "nothing here to climb");
}

// Row `31 524089 1` half B: plant tall → climb succeeds, escape pit.
function testPlantClimbSuccess(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(25);
  d.machine().plant.water(); // $Tiny → $Tall
  d.input("up");
  // Canon: climbing the tall plant escapes West Pit.
  assertEq("plant-tall + 25:up escapes pit (not still at 25)", d.machine().player_room() !== 25, true);
}

// Row `33 159302 71`: PLOVER at Y2 → Plover Room (canon 100).
function testY2PloverToPloverRoom(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(33);
  d.input("plover");
  assertEq("PLOVER at Y2 → Plover Room (canon 100)", d.machine().player_room(), 100);
}

// Row `61 100107 46`: SOUTH at canon 61 → room 107 unconditionally.
function testRoom61SouthTo107(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(61);
  d.input("south");
  assertEq("SOUTH at canon 61 → room 107", d.machine().player_room(), 107);
}

// Row `100 159302 71`: PLOVER at Plover Room → back to Y2 (canon 33).
function testPloverPloverToY2(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(100);
  d.input("plover");
  assertEq("PLOVER at Plover → Y2 (canon 33)", d.machine().player_room(), 33);
}

// Row `103 114618 46`: SOUTH at Shell Room carrying clam → msg #118 + stay.
function testClamSouthRebuff(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(103);
  d.machine().clam_item.try_take(103);
  d.machine().player.take(d.machine().CLAM_ID);
  const pre_room: number = d.machine().player_room();
  lastLines = d.input("south");
  assertEq("clam-carrying + 103:south stays put", pre_room, d.machine().player_room());
  // Canon msg #118 — assert against the canon-distinctive phrase.
  assertCaptured("clam-carry rebuff prose", lastLines, "clam");
}

// Row `103 115619 46`: SOUTH at Shell Room carrying oyster → msg #119.
function testOysterSouthRebuff(): void {
  const d: CcaDriver = makeDriver();
  d.machine().player.move_to(103);
  // The oyster is dynamic-spawn; reach it via canon BREAK CLAM.
  d.machine().clam_item.try_take(103);
  d.machine().player.take(d.machine().CLAM_ID);
  d.machine().player.drop(d.machine().CLAM_ID);
  d.machine().clam_item.try_drop(103);
  d.input("break clam");
  // Now oyster is in-room at 103. Pick it up.
  d.machine().oyster_item.try_take(103);
  d.machine().player.take(d.machine().OYSTER_ID);
  const pre_room: number = d.machine().player_room();
  lastLines = d.input("south");
  assertEq("oyster-carrying + 103:south stays put", pre_room, d.machine().player_room());
  assertCaptured("oyster-carry rebuff prose", lastLines, "oyster");
}

// makeDriver() mirrors H.make_driver(): lamp pre-lit, default aspects, dormant.
testPlantClimbRebuff();
testPlantClimbSuccess();
testY2PloverToPloverRoom();
testRoom61SouthTo107();
testPloverPloverToY2();
testClamSouthRebuff();
testOysterSouthRebuff();

console.log("");
