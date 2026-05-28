// Port of Godot tests/test_cca_fragile_vase.gd — fragile-treasure path,
// FSM-direct (mirrors `Cca.new()` + setup_default_aspects()). Same assertions,
// same expected values, same order. Vase is the only fragile treasure; dropping
// it anywhere except the deposit room (well house, room 3) shatters it. Once
// broken, it can't be re-taken, has zero value, and $Broken round-trips through
// @@[persist]. Also covers FILL VASE canon msgs #145 (cold shatter) / #144 (dry).
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_fragile_vase");

console.log("=== CCA fragile vase ===");

// --- Initial conditions ---
console.log("Initial — vase at home (room 97), uncarried, intact:");
const adv = makeAdventure();
adv.setup_default_aspects();
expect("vase state", adv.vase.get_state(), "in_room");
expect("vase location", adv.vase.get_location(), 97);
expect("vase value", adv.vase.get_value(), 14);
expect("vase intact", adv.vase.is_broken(), false);
expect("vase not deposited", adv.vase.is_deposited(), false);

// --- Take vase ---
console.log("Take vase from Oriental Room:");
adv.player.move_to(97);
adv.do_command("take", "vase");
expect("vase carried state", adv.vase.get_state(), "carried");
expect("vase location -1", adv.vase.get_location(), -1);

// --- Drop outside deposit room — fragile shatters ---
console.log("Drop vase in a non-deposit room (33 = Y2):");
adv.player.move_to(33);
adv.do_command("drop", "vase");
expect("vase broken state", adv.vase.get_state(), "broken");
expect("vase is_broken", adv.vase.is_broken(), true);
expect("vase value zeroed", adv.vase.get_value(), 0);
expect("vase location 33", adv.vase.get_location(), 33);

// --- Try to re-take a broken vase ---
console.log("Re-taking a broken vase fails (shards aren't a treasure):");
const retook: boolean = adv.vase.try_take(33);
expect("try_take returns false", retook, false);
expect("vase still broken", adv.vase.get_state(), "broken");

// --- Broken vase contributes 0 to treasure_score ---
console.log("Broken vase contributes 0 to treasure_score:");
expect("treasure_score 0", adv.treasure_score(), 0);

// --- Eggs (non-fragile) dropped non-deposit returns to InRoom ---
console.log("Eggs (non-fragile) dropped non-deposit go back to in_room:");
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.player.move_to(92);
adv2.do_command("take", "eggs");
expect("eggs carried", adv2.eggs.get_state(), "carried");
adv2.player.move_to(33);
adv2.do_command("drop", "eggs");
expect("eggs in_room", adv2.eggs.get_state(), "in_room");
expect("eggs not broken", adv2.eggs.is_broken(), false);
expect("eggs at room 33", adv2.eggs.get_location(), 33);

// --- Save / restore preserves $Broken ---
console.log("Save/restore round-trips broken state:");
const bytes = adv.save_state();
const adv3 = makeAdventure();
adv3.restore_state(bytes);
expect("restored vase state", adv3.vase.get_state(), "broken");
expect("restored is_broken", adv3.vase.is_broken(), true);
expect("restored value 0", adv3.vase.get_value(), 0);
expect("restored location", adv3.vase.get_location(), 33);

// --- Canon msg #145: FILL VASE at a water source shatters it ---
// advent.for STMT 9222: with VASE carried AND a liquid source in the player's
// room, the thermal shock breaks the vase in place.
console.log("FILL VASE at a water source — canon msg #145 cold shatter:");
const adv4 = makeAdventure();
adv4.setup_default_aspects();
adv4.player.move_to(97);
adv4.do_command("take", "vase");
expect("vase carried setup", adv4.vase.get_state(), "carried");
// Canon water source: room 4 (valley stream) — present in LIQLOC.
adv4.player.move_to(4);
const fill_result: string = adv4.do_command("fill", "vase");
expect("fill at water source emits canon msg #145", fill_result.includes("shattered"), true);
expect("vase broken after fill", adv4.vase.get_state(), "broken");
expect("vase shards at room 4", adv4.vase.get_location(), 4);

// --- FILL VASE in a no-liquid room still emits canon msg #144 ---
console.log("FILL VASE in dry room — canon msg #144:");
const adv5 = makeAdventure();
adv5.setup_default_aspects();
adv5.player.move_to(97);
adv5.do_command("take", "vase");
adv5.player.move_to(33); // Y2 — dry
const dry_result: string = adv5.do_command("fill", "vase");
expect("dry fill emits msg #144", dry_result.includes("nothing here with which to fill"), true);
expect("vase intact after dry fill", adv5.vase.get_state(), "carried");
