// Port of Godot tests/test_cca_bridge.gd — rod + crystal-bridge puzzle, FSM-direct.
// Same assertions, same expected values:
//   - Rod is initially in the debris room (room 11), uncarried.
//   - Wave-without-rod deflects ("aren't carrying"); no bridge.
//   - Wave-with-rod-elsewhere → "Nothing happens"; no bridge.
//   - Wave-with-rod-at-fissure (room 17) summons the bridge.
//   - Wave again toggles the bridge back to $NoBridge.
//   - Wave a non-rod → "Peculiar" flat deflection.
//   - Save/restore round-trips both rod state and bridge FSM compartment.
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_bridge");

// --- Initial conditions ---
// Initial — rod is in the debris room, bridge not built:
const adv = makeAdventure();
adv.setup_default_aspects();
expect("rod not carried", adv.rod_in_inventory(), false);
expect("rod location", adv.rod_item.get_location(), 11);
expect("bridge not built", adv.bridge_built(), false);
expect("bridge state", adv.crystal_bridge.get_state(), "no_bridge");

// --- Wave without rod ---
// Wave without rod gets a deflection:
const r1 = adv.do_command("wave", "rod");
// Canon msg #29 — "You aren't carrying it!"
expectContains("response", [r1], "aren't carrying");
expect("still no bridge", adv.bridge_built(), false);

// --- Take the rod ---
// Take the rod from the debris room:
adv.do_command("light", "");
adv.player.move_to(11);
const r2 = adv.do_command("take", "rod");
expectContains("take response", [r2], "OK");
expect("rod carried", adv.rod_in_inventory(), true);

// --- Wave-with-rod-elsewhere ---
// Wave with rod, but not at the fissure → no bridge:
const r3 = adv.do_command("wave", "rod");
expectContains("response", [r3], "Nothing happens");
expect("still no bridge", adv.bridge_built(), false);

// --- At the fissure with the rod, wave → bridge ---
// At the fissure with the rod, wave → bridge appears:
adv.player.move_to(17);
const r4 = adv.do_command("wave", "rod");
expectContains("response", [r4], "crystal bridge now spans");
expect("bridge built", adv.bridge_built(), true);
expect("bridge state", adv.crystal_bridge.get_state(), "built");

// --- Wave again toggles it back ---
// Wave again — bridge fades:
const r5 = adv.do_command("wave", "rod");
// Canon: bridge fade emits msg #54 "OK". The state change is
// observable via the bridge_built() assertion below.
expectContains("response", [r5], "OK");
expect("bridge gone", adv.bridge_built(), false);

// --- Wave non-rod ---
// Wave something else — flat deflection:
const r6 = adv.do_command("wave", "hand");
// Canon msg #76 fallback — "Peculiar. Nothing unexpected happens."
expectContains("response", [r6], "Peculiar");

// --- Save / restore ---
// Save with bridge built, mutate, restore:
adv.do_command("wave", "rod"); // build it again
expect("bridge built pre-save", adv.bridge_built(), true);
const bytes = adv.save_state();

// Mutate after save
adv.do_command("wave", "rod"); // tear it down
expect("bridge gone post-save", adv.bridge_built(), false);

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored bridge built", adv2.bridge_built(), true);
expect("restored rod carried", adv2.rod_in_inventory(), true);

// --- Drop the rod, leave it in the fissure room ---
// Drop the rod — it stays where dropped:
const r7 = adv2.do_command("drop", "rod");
expectContains("drop response", [r7], "OK");
expect("rod not carried", adv2.rod_in_inventory(), false);
expect("rod at fissure", adv2.rod_item.get_location(), 17);
