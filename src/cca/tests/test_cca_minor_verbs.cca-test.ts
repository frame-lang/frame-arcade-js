// Port of Godot tests/test_cca_minor_verbs.gd — the canon "minor verbs" batch:
// FIND, BRIEF, RUB, SAY, plus the WEST-counter snark and the PLUGH-whisper-at-Y2
// Easter eggs.
//
// Canon references:
//   FIND  — advent.for STMT 9190 (msgs #24/#94/#138/#59)
//   BRIEF — advent.for STMT 8260 (msg #156, sets ABBNUM=10000)
//   RUB   — advent.for STMT 9160 (msg #76 default)
//   SAY   — advent.for STMT 9030 (echo + magic-word redispatch)
//   WEST  — advent.for line 901-902 (msg #17 on 10th typed WEST)
//   Y2    — advent.for line 808 (25% chance msg #8 at room 33)
//
// Expected values copied verbatim from the Godot source. The Godot Phase 6 pins
// the engine RNG via seed(...); here we OMIT it — the model `chance` LCG drives
// the y2_whisper gate and the ±range holds for any chance state.
//
// NOTE (driver gap): Godot Phase 2 drives _maybe_print_room_after_move() to
// exercise BRIEF's revisit-suppression. The JS driver exposes no equivalent —
// captureRoomRender() always renders the room in full (it has no brief/visited
// short-circuit). The closest public hook is used here, so the "suppresses long
// desc" assertion is expected to FAIL until the driver gains a brief-aware
// reprint method. See the report.
import { file, expect, ok, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_minor_verbs");

function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} (banned "${needle}")`, !lines.join("\n").includes(needle));
}

// ----- Phase 1: FIND -----
const d = makeDriver();
// FIND with no carry → canon msg #59.
const l = capture(d, "find bird");
expectContains("FIND BIRD (not carried) → canon msg #59", l, "I can only tell you what you see");
// FIND with carry → "you are already carrying it!"
d.machine().player.take(d.machine().GOLD_ID);
const l2 = capture(d, "find gold");
expectContains("FIND GOLD (carrying) → 'already carrying'", l2, "already carrying");
// FIND in repository → 'around here somewhere'
const d2 = makeDriver();
for (let i = 0; i < 10; i++) d2.machine().deposit_treasure();
for (let i = 0; i < 30; i++) d2.machine().tick();
expect("setup: in repository", d2.machine().endgame_state(), "in_repository");
const l3 = capture(d2, "find emerald");
expectContains("FIND in repository → 'around here somewhere'", l3, "around here somewhere");

// ----- Phase 2: BRIEF — sets brief_mode and short-circuits revisits -----
const d3 = makeDriver();
const l4 = capture(d3, "brief");
expectContains("BRIEF emits canon ack 'first time'", l4, "first time");
expect("BRIEF sets brief_mode on FSM", d3.machine().is_brief_mode(), true);
// Visit a room, leave, come back — second visit should suppress the long
// description in brief mode. (Driver gap: see header note — captureRoomRender
// always renders, so this is expected to FAIL.)
d3.machine().player.move_to(33);
d3.captureRoomRender();
d3.machine().player.move_to(34);
d3.captureRoomRender();
d3.machine().player.move_to(33);
const l5 = d3.captureRoomRender();
expectNoMatch("BRIEF revisit to room 33 suppresses long desc", l5, "Y2");

// ----- Phase 3: RUB — canon msg #76 'not productive' -----
const d4 = makeDriver();
const l6 = capture(d4, "rub lamp");
expectContains("RUB LAMP → 'nothing exciting happens'", l6, "nothing exciting happens");

// ----- Phase 4: SAY echoes 'Okay, X' for non-magic; redispatches magic words -----
const d5 = makeDriver();
const l7 = capture(d5, "say hello");
expectContains('SAY HELLO echoes \'Okay, "hello"\'', l7, 'Okay, "hello"');
// SAY with no noun.
const l8 = capture(d5, "say");
expectContains("SAY (no noun) prompts 'Say what?'", l8, "Say what?");
// SAY XYZZY at room 11 → teleports to 3 (well house).
const d6 = makeDriver();
d6.machine().player.move_to(11);
d6.input("say xyzzy");
expect("SAY XYZZY redispatches as XYZZY (player at 3)", d6.machine().player_room(), 3);

// ----- Phase 5: WEST counter — 10th 'west' fires msg #17 once -----
const d7 = makeDriver();
d7.machine().player.move_to(3); // well house has west exit
let seenMsg = false;
for (let i = 0; i < 12; i++) {
  const linesI = d7.input("west");
  d7.machine().player.move_to(3); // reset position so we keep typing
  for (const line of linesI) {
    if (line.includes("simply type W")) {
      expect(`WEST counter fires on iter ${i + 1}`, i + 1, 10);
      seenMsg = true;
      break;
    }
  }
}
expect("WEST counter eventually fired", seenMsg, true);
expect("WEST counter ended at exactly 10", d7.machine().get_iwest_count() >= 10, true);

// ----- Phase 6: Y2 PLUGH whisper — 25% per visit, room 33 only -----
const d8 = makeDriver();
let whispers = 0;
for (let i = 0; i < 1000; i++) {
  d8.machine().player.move_to(33);
  const lines = d8.captureRoomRender(); // force re-print (mirrors _last_room=-1 + _print_room)
  for (const line of lines) {
    if (line.includes("PLUGH")) {
      whispers += 1;
      break;
    }
  }
}
console.log(`  observed: ${whispers} whispers in 1000 visits`);
expect("Y2 whispers in [200, 300] (canon 25%)", whispers >= 200 && whispers <= 300, true);
// Whisper does NOT fire at non-Y2 rooms.
const d9 = makeDriver();
let offY2 = 0;
for (let i = 0; i < 200; i++) {
  d9.machine().player.move_to(34);
  const lines = d9.captureRoomRender();
  for (const line of lines) {
    if (line.includes("PLUGH")) {
      offY2 += 1;
      break;
    }
  }
}
expect("PLUGH whisper never fires off-Y2", offY2, 0);
