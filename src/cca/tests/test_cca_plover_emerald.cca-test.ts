// Port of Godot tests/test_cca_plover_emerald.gd — canon routine 302
// (Plover-emerald drop; advent.for STMT 30200, section-3 rows `33 159302 71`
// and `100 159302 71`), DRIVER-level (mirrors H.make_driver() / H.capture()).
// Same assertions, same expected values, same order. Invoking PLOVER from canon
// Y2 (33) or Plover Room (100) while carrying the emerald drops it at the
// current room *before* the teleport fires.
import { file, expect, makeDriver, capture } from "./_harness";

file("test_cca_plover_emerald");

// Godot _expect uses GDScript array == (element-wise). Mirror that by comparing
// JSON encodings so the single labeled assertion is preserved.
function expectEq(label: string, actual: unknown, expected: unknown): void {
  expect(label, JSON.stringify(actual), JSON.stringify(expected));
}

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  expect(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)), true);
}

console.log("=== CCA canon routine 302 — Plover-emerald drop ===");

// ----- Phase 1: PLOVER from Y2 carrying emerald -----
console.log("Phase 1: PLOVER from Y2 (33) carrying emerald");
const d = makeDriver();
d.machine().player.move_to(33);
// Acquire emerald via Treasure FSM + player inventory.
d.machine().emerald.reappear(33);
d.machine().emerald.try_take(33);
d.machine().player.take(d.machine().EMERALD_ID);
expectEq(
  "setup: at Y2 (33) carrying emerald",
  [d.machine().player_room(), d.machine().player.carrying(d.machine().EMERALD_ID)],
  [33, true],
);
const l: string[] = capture(d, "plover");
expectAnyMatch("PLOVER emits canon emerald-drop prose", l, "OK");
expect("PLOVER teleports player to Plover Room (100)", d.machine().player_room(), 100);
expect("PLOVER routine 302: emerald no longer in inventory", d.machine().player.carrying(d.machine().EMERALD_ID), false);
expect("PLOVER routine 302: emerald left at canon 33", d.machine().emerald.get_location(), 33);

// ----- Phase 2: PLOVER from Plover Room carrying emerald -----
// Symmetric mirror — emerald drops at 100, player teleports to 33.
console.log("Phase 2: PLOVER from Plover Room (100) carrying emerald");
const d2 = makeDriver();
d2.machine().player.move_to(100);
d2.machine().emerald.reappear(100);
d2.machine().emerald.try_take(100);
d2.machine().player.take(d2.machine().EMERALD_ID);
expectEq(
  "setup: at Plover (100) carrying emerald",
  [d2.machine().player_room(), d2.machine().player.carrying(d2.machine().EMERALD_ID)],
  [100, true],
);
const l2: string[] = capture(d2, "plover");
expectAnyMatch("PLOVER emits canon emerald-drop prose (mirror)", l2, "OK");
expect("PLOVER teleports player to Y2 (33)", d2.machine().player_room(), 33);
expect("PLOVER routine 302 mirror: emerald left at canon 100", d2.machine().emerald.get_location(), 100);

// ----- Phase 3: PLOVER without emerald — no special handling -----
console.log("Phase 3: PLOVER without emerald — regular teleport (no drop)");
const d3 = makeDriver();
d3.machine().player.move_to(33);
capture(d3, "plover");
expect("PLOVER without emerald: walks to 100", d3.machine().player_room(), 100);
expect("PLOVER without emerald: not carrying emerald", d3.machine().player.carrying(d3.machine().EMERALD_ID), false);
