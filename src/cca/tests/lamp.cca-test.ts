// Port of Godot tests/test_cca_lamp.gd — Lamp HSM + Adventure, FSM-direct.
// Same assertions, same expected values (battery 330→31→30→0, dim threshold,
// $Out, save/restore round-trip preserving lamp state + battery + turn count).
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_lamp");

const adv = makeAdventure();

// Initial state.
expect("lamp state", adv.get_lamp_state(), "off");
expect("battery", adv.battery_left(), 330);
expect("is_lit", adv.is_lit(), false);
expect("turn count", adv.turn_count(), 0);

// After light_lamp().
adv.light_lamp();
expect("lamp state", adv.get_lamp_state(), "bright");
expect("is_lit", adv.is_lit(), true);
expect("battery", adv.battery_left(), 330);

// Tick 299 — still bright.
for (let i = 0; i < 299; i++) adv.tick();
expect("lamp state", adv.get_lamp_state(), "bright");
expect("battery", adv.battery_left(), 31);
expect("turn count", adv.turn_count(), 299);

// Tick once — cross dim threshold.
adv.tick();
expect("lamp state", adv.get_lamp_state(), "dim");
expect("battery", adv.battery_left(), 30);
ok("warning text begins canon", adv.get_lamp_message().startsWith("Your lamp is getting dim."));

// Tick 30 more — hit Out at battery 0.
for (let i = 0; i < 30; i++) adv.tick();
expect("lamp state", adv.get_lamp_state(), "out");
expect("battery", adv.battery_left(), 0);
expect("is_lit", adv.is_lit(), false);

// Save mid-Out, mutate, restore into a fresh Adventure.
const blob = adv.save_state();
ok("save_state returns non-empty string", typeof blob === "string" && blob.length > 0);

adv.refresh_lamp();
expect("post-refresh lamp", adv.get_lamp_state(), "bright");
expect("post-refresh battery", adv.battery_left(), 330);

const adv2 = makeAdventure();
adv2.restore_state(blob);
expect("restored lamp state", adv2.get_lamp_state(), "out");
expect("restored battery", adv2.battery_left(), 0);
expect("restored is_lit", adv2.is_lit(), false);
expect("restored turns", adv2.turn_count(), 330);

// From restored Out: refresh.
adv2.refresh_lamp();
expect("after refresh state", adv2.get_lamp_state(), "bright");
expect("after refresh battery", adv2.battery_left(), 330);

// Extinguish → off, then re-light.
adv2.extinguish_lamp();
expect("after extinguish", adv2.get_lamp_state(), "off");
expect("battery preserved", adv2.battery_left(), 330);
adv2.light_lamp();
expect("re-lit", adv2.get_lamp_state(), "bright");

// refresh() while in $Off — resets battery but stays $Off.
adv2.extinguish_lamp();
adv2.light_lamp();
for (let i = 0; i < 330; i++) adv2.tick();
expect("drained to out again", adv2.get_lamp_state(), "out");
adv2.extinguish_lamp();
expect("now off post-out", adv2.get_lamp_state(), "off");
expect("battery 0 in off", adv2.battery_left(), 0);
adv2.refresh_lamp();
expect("refresh from off keeps off", adv2.get_lamp_state(), "off");
expect("battery refilled in off", adv2.battery_left(), 330);
