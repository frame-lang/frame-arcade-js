// Port of Godot tests/test_cca_vending.gd — Vending Machine puzzle, FSM-direct.
// Same assertions, same expected values:
//   - Machine starts $Loaded; coins live in canon room 30.
//   - INSERT without coins / from wrong room is deflected.
//   - INSERT coins at room 140 consumes them, transitions to $Empty, dispenses
//     BATTERIES (an item); taking + inserting batteries refreshes the lamp.
//   - Coins are consumed, not deposited (no treasure points).
//   - Save/restore round-trips machine state + lamp battery + consumed coins.
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_vending");

// --- Initial conditions ---
// Initial — vending machine loaded, coins in canon home:
const adv = makeAdventure();
adv.setup_default_aspects();
expect("vending loaded", adv.vending_loaded(), true);
expect("vending state", adv.vending.get_state(), "loaded");
expect("coins in_room", adv.coins.get_state(), "in_room");
expect("coins location", adv.coins.get_location(), 30);

// --- INSERT without coins ---
// INSERT without coins deflects:
adv.player.move_to(140);
const r1 = adv.do_command("insert", "coins");
// Canon msg #29 — "You aren't carrying it!"
expectContains("response", [r1], "aren't carrying");
expect("still loaded", adv.vending_loaded(), true);

// --- INSERT from wrong room ---
// INSERT from wrong room deflects:
adv.player.move_to(11);
const r2 = adv.do_command("insert", "coins");
// Canon msg #76 — "Peculiar. Nothing unexpected happens."
expectContains("response", [r2], "Peculiar");
expect("still loaded", adv.vending_loaded(), true);

// --- Pick up coins, drain lamp partially, then insert ---
// Pick up coins, run the lamp down a bit, then insert:
adv.do_command("light", "");
adv.player.move_to(30);
adv.do_command("take", "coins");
expect("carrying coins", adv.player.carrying(adv.COINS_ID), true);
const bat_before: number = adv.battery_left();
// Drain a bit
for (let i = 0; i < 50; i++) adv.tick();
const bat_drained: number = adv.battery_left();
expect("battery dropped", bat_drained < bat_before, true);

// --- Insert at room 140 ---
// Insert at the vending machine room:
adv.player.move_to(140);
const r3 = adv.do_command("insert", "coins");
expectContains("response", [r3], "fresh set of lamp batteries");
expect("vending empty", adv.vending_loaded(), false);
expect("not carrying coins", adv.player.carrying(adv.COINS_ID), false);
expect("coins consumed (loc 0)", adv.coins.get_location(), 0);
// Canon: vending dispenses BATTERIES (an item). Player must take and
// insert them to refresh the lamp.
expect("batteries at vending", adv.batteries_item.get_location(), 140);
adv.do_command("take", "batteries");
expect("carrying batteries", adv.player.carrying(adv.BATTERIES_ID), true);
adv.do_command("insert", "batteries");
expect("lamp refreshed", adv.battery_left(), 330);

// --- Re-insert deflects (machine is now empty) ---
// Re-insert deflects — machine is empty:
const r4 = adv.do_command("insert", "coins");
expectContains("empty msg", [r4], "OUT OF BATTERIES");

// --- Coins not counted toward deposit (consumed, not deposited) ---
// Coins are consumed, not deposited — no points:
expect("coins not deposited", adv.coins.is_deposited(), false);

// --- Save / restore round-trips state ---
// Save / restore preserves vending state + refreshed lamp:
const bytes = adv.save_state();
// Mutate: drain the lamp some more
for (let i = 0; i < 100; i++) adv.tick();
const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored vending empty", adv2.vending_loaded(), false);
expect("restored battery", adv2.battery_left(), 330);
expect("restored coins consumed", adv2.coins.get_location(), 0);
