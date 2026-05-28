// Port of Godot tests/test_cca_witts_end.gd — the canonical Witt's End (canon
// 108) probabilistic bounce-back. Per advent.dat `108 95556 ...`: 95% of any of
// E/N/S/NE/SE/SW/NW/UP/DOWN prints msg #56 ("wound up back in the main passage")
// and stays put; EAST has a 5% fall-through to canon 106 (the only real exit);
// WEST always prints the cave-in msg #126. Distribution uses ±tolerance ranges.
import { file, expect, ok, makeDriver } from "./_harness";

file("test_cca_witts_end");

function anyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}
function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// Phase 1: WEST always emits the cave-in msg #126.
const d = makeDriver();
const a = d.machine();
// Isolate the gate under test (the Witt's End 95/5 distribution). The loop pins
// the player at canon 108 every turn, so once the dwarf clock wakes a wanderer
// (canon turn 13) any dwarf visit to 108 blocks the escape. Godot's run happened
// to see no dwarf reach 108; the JS wanderer does (a seed-level dwarf-movement
// difference, irrelevant to the gate). Suppressing the wanderer reproduces
// Godot's exact count (44 escapes) and keeps the GATE the system under test.
a.dwarves_auto_woken = true;
a.player.move_to(108);
expect("at Witt's End", a.player_room(), 108);
const westLines = d.input("west");
expect("WEST keeps player at 108", a.player_room(), 108);
anyMatch("WEST emits cave-in prose", westLines, "blocked by a recent cave-in");

// Phase 2: EAST distribution — canon 95/5. Refresh lamp + reset position +
// revive each iteration so Witt's End is the system under test (not the lamp
// draining past LIMIT=330 or a stray dwarf).
let bounces = 0;
let escapes = 0;
let sawBounceMsg = false;
let sawEscape = false;
for (let i = 0; i < 1000; i++) {
  a.refresh_lamp();
  a.player.move_to(108);
  a.player.revive();
  const lines = d.input("east");
  if (a.player_room() === 106) {
    escapes += 1;
    sawEscape = true;
  } else {
    bounces += 1;
    if (lines.some((l) => l.includes("wound up back in the main passage"))) sawBounceMsg = true;
  }
}
inRange("escapes (canon ~50)", escapes, 25, 80);
inRange("bounces (canon ~950)", bounces, 920, 975);
ok("saw at least one canon bounce msg", sawBounceMsg);
ok("saw at least one 5% escape", sawEscape);

// Phase 3: NORTH never lets the player leave 108.
let moved = 0;
for (let i = 0; i < 200; i++) {
  a.refresh_lamp();
  a.player.move_to(108);
  a.player.revive();
  d.input("north");
  if (a.player_room() !== 108) moved += 1;
}
expect("NORTH keeps player at 108 in 200 attempts", moved, 0);
