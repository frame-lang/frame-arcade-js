// Port of Godot tests/test_cca_plant.gd — bottle + water + plant chain, FSM-direct.
// Same assertions, same expected values:
//   - Bottle starts $Empty in the well house, plant starts $Tiny.
//   - TAKE BOTTLE, FILL at well house (water source); FILL-when-full deflects.
//   - DRINK empties the bottle; FILL away from water deflects (canon #106).
//   - POUR at West Pit (25) grows the plant Tiny→Tall, then Tall→Huge.
//   - Third pour over-waters (canon obj #500): plant resets to Tiny.
//   - WATER PLANT works as a canon synonym.
//   - Save/restore round-trips bottle contents + plant state.
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_plant");

// --- Initial conditions ---
// Initial — bottle empty in well house, plant tiny:
const adv = makeAdventure();
adv.setup_default_aspects();
expect("bottle state", adv.bottle.get_state(), "empty");
expect("bottle in well house", adv.bottle_item.get_location(), 3);
expect("plant state", adv.plant.get_state(), "tiny");
expect("plant not tall", adv.plant_is_tall(), false);
expect("plant not huge", adv.plant_is_huge(), false);

// --- TAKE BOTTLE ---
// Take bottle from well house:
adv.player.move_to(3);
const r1 = adv.do_command("take", "bottle");
expectContains("take response", [r1], "OK");
expect("bottle carried", adv.bottle_in_inventory(), true);

// --- FILL at water source ---
// FILL at well house (water source):
const r2 = adv.do_command("fill", "bottle");
expectContains("fill response", [r2], "now full of water");
expect("bottle has water", adv.bottle_has_water(), true);

// --- FILL again deflects (already full) ---
// FILL when full deflects:
const r3 = adv.do_command("fill", "bottle");
expectContains("already full", [r3], "already full");

// --- DRINK empties it ---
// DRINK empties the bottle:
const r4 = adv.do_command("drink", "");
expectContains("drink response", [r4], "bottle of water is now empty");
expect("bottle empty", adv.bottle_has_water(), false);

// --- FILL away from water deflects ---
// FILL away from water deflects:
adv.player.move_to(11); // debris room — no water
const r5 = adv.do_command("fill", "bottle");
// Canon msg #106 — "There is nothing here with which to fill the bottle."
expectContains("canon msg #106", [r5], "nothing here with which to fill");

// --- Refill at the valley stream (room 4) ---
// Refill at the valley stream (4):
adv.player.move_to(4);
adv.do_command("fill", "bottle");
expect("bottle has water", adv.bottle_has_water(), true);

// --- POUR on plant at West Pit grows it ---
// POUR at the West Pit (canon 25) — plant grows:
adv.player.move_to(25);
const r6 = adv.do_command("pour", "");
expectContains("grow msg", [r6], "spurts into furious growth");
expect("plant tall", adv.plant_is_tall(), true);
expect("plant not huge yet", adv.plant_is_huge(), false);
expect("bottle empty", adv.bottle_has_water(), false);

// --- 23→24 now works, 24→25 still gated ---
// Tested via the FSM's gating proxy — we just confirm the FSM-side
// query reads true/false.
expect("plant climb-mid OK", adv.plant_is_tall(), true);
expect("plant climb-top NOT", adv.plant_is_huge(), false);

// --- Refill at the underground stream (84) ---
// Refill at the underground stream (84):
adv.player.move_to(84);
adv.do_command("fill", "bottle");
expect("bottle has water", adv.bottle_has_water(), true);

// --- Second pour grows plant to Huge ---
// Second POUR — plant becomes huge:
adv.player.move_to(25);
const r7 = adv.do_command("pour", "");
expectContains("grow huge", [r7], "grows explosively");
expect("plant huge", adv.plant_is_huge(), true);

// Capture save state with plant huge — used at the bottom to confirm
// save/restore round-trips the Huge state.
const huge_bytes = adv.save_state();

// --- Third pour at huge plant — canon over-water ---
// Third POUR — canon over-water msg (obj #500), plant resets:
adv.player.move_to(4);
adv.do_command("fill", "bottle");
adv.player.move_to(25);
const r8 = adv.do_command("pour", "");
expectContains("over-water msg", [r8], "shriveling");
expect("plant back to tiny", adv.plant.get_state(), "tiny");

// --- WATER verb (canonical) ---
// WATER PLANT works as canon synonym at the West Pit:
const adv_w = makeAdventure();
adv_w.setup_default_aspects();
adv_w.player.move_to(3);
adv_w.do_command("take", "bottle");
adv_w.do_command("fill", "bottle");
adv_w.player.move_to(25);
const r9 = adv_w.do_command("water", "plant");
expectContains("water msg", [r9], "spurts into furious growth");
expect("water grew plant", adv_w.plant_is_tall(), true);

// --- Save / restore ---
// Save / restore preserves bottle + plant state:
const adv2 = makeAdventure();
adv2.restore_state(huge_bytes);
expect("restored plant huge", adv2.plant_is_huge(), true);
expect("restored bottle carried", adv2.bottle_in_inventory(), true);
