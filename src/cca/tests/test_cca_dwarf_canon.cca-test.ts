// Port of Godot tests/test_cca_dwarf_canon.gd — verifies three canon dwarf
// mechanics (advent.for STMT 71/6000/9010 + msgs #2/#3/#116):
//
//   msg #2  — movement into a stalking-dwarf room is blocked
//             ("A little dwarf with a big knife blocks your way.")
//   msg #3  — first stalking-dwarf encounter narrates the canon
//             "walked around a corner, threw a little axe..." prose
//   msg #116 — TAKE KNIFE always emits the "knives vanish" rebuff
//
// Godot→JS mapping: H.make_driver() → makeDriver(); d.fsm.X → d.machine().X;
// H.capture(d, x) → capture(d, x); d.captured persists across turns;
// d._print_room() → d.captureRoomRender() (the public room-render hook, which
// runs the same printRoom() that fires the first-encounter narration).
import { file, expect, ok, makeDriver, capture } from "./_harness";

file("test_cca_dwarf_canon");

// Godot _expect_any_match: needle is a substring of some captured line.
function expectAnyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}
// Godot _expect_no_match: needle appears in NO captured line.
function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} no line contained '${needle}'`, !lines.some((l) => l.includes(needle)));
}

console.log("=== CCA dwarf canon — msgs #2 / #3 / #116 ===");

// ----- Phase 1: movement into a stalking-dwarf room blocks → msg #2 -----
console.log("Phase 1: movement into stalking-dwarf room → msg #2");
const d1 = makeDriver();
d1.machine().wake_dwarves();
d1.machine().player.move_to(11); // canon East End of Hall of Mists
// Force dwarf1 into canon 12 so the WEST move into 12 is blocked.
d1.machine().dwarf_step_to(1, 12);
d1.machine().dwarf_step_to(1, 12);
const l1: string[] = capture(d1, "west"); // 11 → 12 has dwarf1
expectAnyMatch("walking into dwarf1's room emits msg #2", l1, "little dwarf with a big knife");
expect("player blocked, still at 11", d1.machine().player_room(), 11);

// ----- Phase 2: msg #2 doesn't fire when no dwarf is adjacent -----
console.log("Phase 2: movement with no dwarf at dest does NOT fire msg #2");
const d2 = makeDriver();
d2.machine().wake_dwarves();
d2.machine().player.move_to(3); // canon Inside Building
const l2: string[] = capture(d2, "out"); // 3 → 1 (no dwarf at 1)
expectNoMatch("no msg #2 when dest has no dwarf", l2, "little dwarf with a big knife");

// ----- Phase 3: msg #3 first-encounter narration -----
// Drive the player to dwarf1's room (canon 19) by force-placing. The room
// render is what fires the msg #3 narration on first entry; since we render
// directly the visit counts.
console.log("Phase 3: first stalking-dwarf encounter → msg #3");
const d3 = makeDriver();
d3.machine().wake_dwarves();
d3.machine().player.move_to(19);
const pre3: number = d3.captured.length;
d3.captureRoomRender();
const lines3: string[] = d3.captured.slice(pre3);
expectAnyMatch("first encounter narrates canon msg #3", lines3, "walked around a corner");
// Second visit: no second narration.
const pre3b: number = d3.captured.length;
d3.captureRoomRender();
const lines3b: string[] = d3.captured.slice(pre3b);
expectNoMatch("second visit does NOT re-narrate msg #3", lines3b, "walked around a corner");

// ----- Phase 4: TAKE KNIFE → msg #116 -----
console.log("Phase 4: TAKE KNIFE → canon msg #116");
const d4 = makeDriver();
const l4: string[] = capture(d4, "take knife");
expectAnyMatch("TAKE KNIFE emits canon msg #116", l4, "knives vanish as they strike");

// GET KNIFE synonym → same msg
const l4b: string[] = capture(d4, "get knife");
expectAnyMatch("GET KNIFE (synonym) emits canon msg #116", l4b, "knives vanish as they strike");
