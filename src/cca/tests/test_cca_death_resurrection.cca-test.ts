// Port of Godot tests/test_cca_death_resurrection.gd — verifies the canon
// death/resurrection ladder (advent.for STMT 16000-16100, msgs #81-#86):
//
//   1st death  → msg #81 ("Oh dear, ... reincarnate you?")
//   1st YES    → msg #82 ("All right... don't blame me ... orange smoke ... POOF!!")
//   2nd death  → msg #83 ("You clumsy oaf...")
//   2nd YES    → msg #84 ("...where did I put my orange smoke...")
//   3rd death  → msg #85 ("I'm out of orange smoke!")
//   NO/3rd     → msg #86 ("Okay, if you're so smart, do it yourself! I'm leaving!")
//
// Godot→JS mapping: H.make_driver() → makeDriver(); _capture(d,"yes") →
// d.input("yes"). The Godot _die_and_capture(d) calls d.fsm.player.die() then
// the driver's private _check_player_death() to surface the revive prompt. The
// JS CcaDriver has no public _check_player_death(); the equivalent is to kill
// the player via the FSM, then run one real turn so the driver's per-turn chain
// (afterTurn → checkPlayerDeath) arms + prints the revive prompt — exactly what
// a live player sees the turn after dying. We use a benign LOOK turn to surface
// it and slice d.captured for the prompt prose. Expected substrings copied
// VERBATIM from the Godot source.
import { file, ok, makeDriver } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_death_resurrection");

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}

// Force a death + surface the revive prompt. Mirrors Godot _die_and_capture:
// kill the player via the FSM, then let the driver's per-turn death check emit
// the prompt. A LOOK turn runs afterTurn → checkPlayerDeath; we slice the lines
// that turn emitted (which include the revive prompt).
function dieAndCapture(d: CcaDriver): string[] {
  d.machine().player.die();
  const pre: number = d.captured.length;
  d.input("look");
  return d.captured.slice(pre);
}

console.log("=== CCA death/resurrection ladder — canon msgs #81-86 ===");

// ----- Phase 1: 1st death → msg #81 -----
console.log("Phase 1: 1st death → msg #81 ('Oh dear...')");
const d = makeDriver();
const l1: string[] = dieAndCapture(d);
expectAnyMatch("1st death emits canon msg #81", l1, "Oh dear, you seem to have gotten yourself killed");

// 1st YES → msg #82.
console.log("Phase 2: 1st YES → msg #82 ('orange smoke')");
const l2: string[] = d.input("yes");
expectAnyMatch("1st revive emits canon msg #82 ('blame me')", l2, "don't blame me");
expectAnyMatch("1st revive includes orange-smoke prose", l2, "orange smoke");

// ----- Phase 3: 2nd death → msg #83 -----
console.log("Phase 3: 2nd death → msg #83 ('clumsy oaf')");
const l3: string[] = dieAndCapture(d);
expectAnyMatch("2nd death emits canon msg #83", l3, "clumsy oaf");

// 2nd YES → msg #84.
console.log("Phase 4: 2nd YES → msg #84 ('where did I put my orange smoke')");
const l4: string[] = d.input("yes");
expectAnyMatch("2nd revive emits canon msg #84", l4, "where did I put my orange smoke");

// ----- Phase 5: 3rd death → msg #85 -----
console.log("Phase 5: 3rd death → msg #85 ('out of orange smoke')");
const l5: string[] = dieAndCapture(d);
expectAnyMatch("3rd death emits canon msg #85", l5, "out of orange smoke");

// ----- Phase 6: NO at 1st death → msg #86 -----
console.log("Phase 6: NO at 1st death → msg #86 ('do it yourself')");
const d2 = makeDriver();
dieAndCapture(d2);
const l6: string[] = d2.input("no");
expectAnyMatch("NO emits canon msg #86", l6, "do it yourself");
