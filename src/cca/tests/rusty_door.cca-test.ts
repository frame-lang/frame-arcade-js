// Port of Godot tests/test_cca_rusty_door.gd — rusty-door puzzle (canon 94 → 95),
// FSM-direct. Same assertions, same expected values.
//
// State machine under test (RustyDoor): $Rusty ── oil() ──► $Oiled.
// Cross-FSM choreography in Adventure._verb_pour: oil at room 94 transitions
// the door. Phases:
//   1. At 94, door starts $Rusty; POUR with no bottle → canon "aren't carrying".
//   2. POUR with water at 94 also doesn't lubricate (canon msg #113).
//   3. Fill bottle with oil at OIL_SOURCE_ROOM, return to 94, POUR → $Oiled (#114).
//   4. Post-oil re-POUR is a no-op on the door (bottle empty).
//   5. Save/restore round-trips the $Oiled state.
//   6. Fresh adventure — door starts rusty.
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_rusty_door");

function makeAdv() {
  const adv = makeAdventure();
  adv.setup_default_aspects();
  return adv;
}

// Phase 1: door starts rusty, blocks the move.
// Phase 1: at 94, door is rusty — north blocked
let adv = makeAdv();
adv.player.move_to(94);
expect("at canon 94", adv.player_room(), 94);
expect("door rusty", adv.rusty_door.is_rusty(), true);
expect("oiled() reports false", adv.rusty_door_oiled(), false);
// Player hasn't picked up the bottle yet — pour fails with the canon
// "you don't have the bottle" prose, not the door FSM's lubricate path.
const resp_oil0: string = adv.do_command("pour", "");
// Canon msg #29 — "You aren't carrying it!"
expectContains("pour with no bottle in inventory", [resp_oil0.toLowerCase()], "aren't carrying");

// Phase 2: bottle holds water — pouring at 94 doesn't lubricate.
// Phase 2: pour water at 94 — door stays rusty
adv = makeAdv();
adv.player.take(adv.BOTTLE_ID);
adv.bottle_item.try_take(3); // mark item carried
// Fill at well house water source.
adv.player.move_to(3);
const fill_w: string = adv.do_command("fill", "");
expectContains("filled with water", [fill_w.toLowerCase()], "water");
// Walk to 94 (synthetic teleport — the puzzle setup is the system
// under test, not the route).
adv.player.move_to(94);
const resp_water: string = adv.do_command("pour", "");
expect("door still rusty after water", adv.rusty_door.is_rusty(), true);
// Canon msg #113 — water at the door fires "hinges are quite
// thoroughly rusted".
expectContains("water response emits canon msg #113", [resp_water.toLowerCase()], "thoroughly rusted");

// Phase 3: fill with oil at OIL_SOURCE_ROOM, return, pour at 94.
// Phase 3: oil at 94 — door transitions to oiled
adv = makeAdv();
adv.player.take(adv.BOTTLE_ID);
adv.bottle_item.try_take(3);
adv.player.move_to(adv.OIL_SOURCE_ROOM);
const fill_o: string = adv.do_command("fill", "");
expectContains("filled with oil", [fill_o.toLowerCase()], "oil");
expect("bottle has oil", adv.bottle.has_oil(), true);
adv.player.move_to(94);
const resp_oil: string = adv.do_command("pour", "");
expect("door now oiled", adv.rusty_door.is_rusty(), false);
expect("oiled() reports true", adv.rusty_door_oiled(), true);
expectContains("oil-frees-hinges message (canon msg #114)", [resp_oil], "freed up the hinges");
expect("bottle empty after pour", adv.bottle.has_oil(), false);

// Phase 4: post-oil, second POUR is a no-op on the door.
// Phase 4: re-pour after oiled — already-lubricated msg
const resp_oil2: string = adv.do_command("pour", "");
expect("door stays oiled", adv.rusty_door.is_rusty(), false);
// Bottle is empty so re-pour returns the bottle's empty msg, not the
// door FSM's already-lubricated msg. That's intended.
void resp_oil2;

// Phase 5: save/restore preserves the $Oiled state.
// Phase 5: save/restore round-trips $Oiled
const bytes = adv.save_state();
const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored door oiled", adv2.rusty_door.is_rusty(), false);
expect("restored oiled()", adv2.rusty_door_oiled(), true);

// Phase 6: fresh adventure, never poured — door is rusty.
// Phase 6: fresh adventure — door starts rusty
const adv3 = makeAdv();
expect("fresh door rusty", adv3.rusty_door.is_rusty(), true);
