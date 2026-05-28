// Port of Godot tests/test_cca_forest_selfloop.gd — regression for the doubled
// room-description bug on self-loop moves, DRIVER-level (mirrors H.make_driver()
// / H.capture()). Same assertions, same expected values, same order.
//
// Canon forest rooms 5 and 6 have directions that lead back to the SAME room
// (5: WEST/SOUTH → 5; 6: SOUTH → 5). A self-loop move must emit the room
// description exactly once (the suppression guard must include dest != current).
import { file, ok, makeDriver, capture } from "./_harness";

file("test_cca_forest_selfloop");

let failures = 0;

// Move the player into `room`, issue a self-loop `direction`, and assert the
// canonical room text (`needle`) appears in exactly one captured line.
function assertSingleDescription(label: string, room: number, direction: string, needle: string): void {
  console.log(`--- ${label} ---`);
  const d = makeDriver();
  d.machine().player.move_to(room);
  const lines: string[] = capture(d, direction);
  let hits = 0;
  for (const line of lines) {
    if (String(line).toLowerCase().includes(needle.toLowerCase())) hits += 1;
  }
  if (hits === 1) {
    console.log(`    ok — '${needle}' printed once`);
  } else {
    console.log(`    FAIL — '${needle}' printed ${hits} times (expected 1)`);
    for (const line of lines) console.log(`        | ${line}`);
    failures += 1;
  }
  ok(`${label}: '${needle}' printed exactly once`, hits === 1);
}

console.log("=== CCA forest self-loop (no doubled description) ===");
console.log("");

assertSingleDescription("room 5 WEST → 5", 5, "west", "OPEN FOREST");
assertSingleDescription("room 5 SOUTH → 5", 5, "south", "OPEN FOREST");
assertSingleDescription("room 6 SOUTH → 5", 6, "south", "OPEN FOREST");

console.log("");
if (failures === 0) {
  console.log("PASS — forest self-loop moves describe the room exactly once");
} else {
  console.log(`FAIL — ${failures} self-loop move(s) doubled the room description`);
}
