// Port of Godot tests/test_cca_find_msg94.gd — canon msg #94: FIND when the
// object is visible in the player's current room (advent.for STMT 9190 AT(OBJ)
// branch).
//
// Canon FIND priority:
//   TOTING(OBJ)            → msg #24 ("already carrying")
//   AT(OBJ) (here visible) → msg #94 ("right here with you")
//   CLOSED                 → msg #138 ("around here somewhere")
//   otherwise              → msg #59 ("can only tell you what you see")
//
// Expected substrings copied verbatim from the Godot source.
import { file, ok, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_find_msg94");

function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} (banned "${needle}")`, !lines.join("\n").includes(needle));
}

// ----- Phase 1: KEYS at canon room 3 (well-house) — FIND while elsewhere → #59 -----
// Keys start at canon 3, player starts at canon 1. FIND KEYS at canon 1 → msg
// #59 (no AT match). Walk to canon 3 → msg #94.
const d1 = makeDriver();
const l1 = capture(d1, "find keys");
expectContains("FIND keys far away → canon msg #59", l1, "I can only tell you what you see");

// Phase 2: walk to keys' room → FIND keys → canon msg #94.
d1.machine().player.move_to(3); // well-house, where keys live
const l2 = capture(d1, "find keys");
expectContains("FIND keys @ canon 3 → canon msg #94", l2, "right here with you");

// ----- Phase 3: pick up keys → msg #24 (already carrying) -----
d1.machine().keys_item.try_take(3);
d1.machine().player.take(d1.machine().KEYS_ID);
const l3 = capture(d1, "find keys");
expectContains("FIND keys (carrying) → canon msg #24", l3, "already carrying");

// ----- Phase 4: bird at canon 13 (Bird Chamber) — FIND bird in room → #94 -----
const d2 = makeDriver();
d2.machine().player.move_to(13); // canon Bird Chamber
const l4 = capture(d2, "find bird");
expectContains("FIND bird @ canon 13 → canon msg #94", l4, "right here with you");

// ----- Phase 5: treasure (gold) at canon 18 — FIND gold in room → #94 -----
const d3 = makeDriver();
d3.machine().player.move_to(18);
const l5 = capture(d3, "find gold");
expectContains("FIND gold @ canon 18 → canon msg #94", l5, "right here with you");

// ----- Phase 6: msg #94 does NOT fire when object isn't here -----
const d4 = makeDriver();
d4.machine().player.move_to(2); // canon hill, no objects
const l6 = capture(d4, "find diamond");
expectNoMatch("no msg #94 when object isn't visible", l6, "right here with you");
expectContains("falls through to canon msg #59", l6, "I can only tell you what you see");
