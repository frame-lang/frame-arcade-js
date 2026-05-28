// Port of Godot tests/test_cca_attack_bird.gd — canon ATTACK BIRD
// (advent.for STMT 9120) → msg #137: "Oh, leave the poor unhappy bird alone."
//
// KILL BIRD is a synonym (canon verb 12 + KILL/FIGHT both map to attack via
// the synonym table), so it emits the same canon msg #137.
import { file, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_attack_bird");

// ----- Phase 1: ATTACK BIRD → msg #137 -----
const d = makeDriver();
const l1 = capture(d, "attack bird");
expectContains("ATTACK BIRD emits canon msg #137", l1, "leave the poor unhappy bird alone");

// ----- Phase 2: KILL BIRD synonym → msg #137 -----
const d2 = makeDriver();
const l2 = capture(d2, "kill bird");
expectContains("KILL BIRD emits canon msg #137", l2, "leave the poor unhappy bird alone");
