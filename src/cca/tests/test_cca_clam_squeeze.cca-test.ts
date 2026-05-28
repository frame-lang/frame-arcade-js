// Port of Godot tests/test_cca_clam_squeeze.gd — canon clam carry-state branch
// at the Shell Room (canon 103), FSM-direct (mirrors `Cca.new()` +
// setup_default_aspects()). Same assertions, same expected values, same order.
// Going SOUTH from canon 103 with the five-foot clam — or its post-BREAK form,
// the oyster — in inventory canonically fails with a specific bumper message
// (the shellfish doesn't fit through the narrow passage to canon 64).
//
// Canon section 2 rows:
//   103 114618 46    only_if_toting(CLAM)   → msg #118
//   103 115619 46    only_if_toting(OYSTER) → msg #119
//   103 64 46        unconditional fall-through → 64
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_clam_squeeze");

function expectContains(label: string, haystack: string, needle: string): void {
  expect(`${label} contains '${needle}'`, haystack.includes(needle), true);
}

console.log("=== CCA clam carry-state at Shell Room (canon 103) ===");

// Phase 1: empty-handed — canon fall-through, walk to canon 64.
console.log("Phase 1: empty inventory — south works");
let adv = makeAdventure();
adv.setup_default_aspects();
adv.player.move_to(103);
expect("at shell room", adv.player_room(), 103);
expect("clam not carried", adv.player.carrying(adv.CLAM_ID), false);
expect("oyster not carried", adv.player.carrying(adv.OYSTER_ID), false);
const resp1: string = adv.do_command("move", "64");
expect("moved to canon 64", adv.player_room(), 64);
expect("response is movement, not bumper", resp1.includes("five-foot"), false);

// Phase 2: carrying the clam — canon msg #118 fires, no movement.
console.log("Phase 2: carrying clam — south rejected");
adv = makeAdventure();
adv.setup_default_aspects();
adv.player.move_to(103);
adv.do_command("take", "clam");
expect("clam carried", adv.player.carrying(adv.CLAM_ID), true);
expect("at shell room", adv.player_room(), 103);
const resp2: string = adv.do_command("move", "64");
expect("still at shell room (move blocked)", adv.player_room(), 103);
expectContains("response cites the clam", resp2, "five-foot clam");

// Phase 3: carrying the oyster — same gate, different message (msg #119). The
// port treats the oyster as uncarryable via TAKE OYSTER, so we force the
// inventory state directly via the player FSM so the squeeze-gate's oyster
// branch is reachable.
console.log("Phase 3: carrying oyster — south rejected with oyster prose");
adv = makeAdventure();
adv.setup_default_aspects();
adv.player.move_to(103);
adv.player.take(adv.OYSTER_ID);
expect("oyster carried", adv.player.carrying(adv.OYSTER_ID), true);
const resp3: string = adv.do_command("move", "64");
expect("still at shell room (move blocked)", adv.player_room(), 103);
expectContains("response cites the oyster", resp3, "five-foot oyster");

// Phase 4: drop the shellfish — south works again.
console.log("Phase 4: drop oyster — south unblocks");
adv.player.drop(adv.OYSTER_ID);
expect("oyster not carried", adv.player.carrying(adv.OYSTER_ID), false);
adv.do_command("move", "64");
expect("moved to canon 64", adv.player_room(), 64);
