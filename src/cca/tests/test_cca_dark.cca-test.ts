// Port of Godot tests/test_cca_dark.gd — Player FSM, DarknessGate aspect, and
// the Adventure orchestrator's bus dispatch loop, FSM-direct (mirrors
// `Cca.new()` + setup_default_aspects()). Same assertions, same expected
// values, same order. Verifies:
//   1. Initial registration via setup_default_aspects().
//   2. do_command in a lit room: bus passes, base handles.
//   3. do_command "move" transitions player into a dark room.
//   4. In darkness with lamp off: DarknessGate consumes "look"/"examine" with
//      the canon "pitch dark" message.
//   5. Lighting the lamp suppresses the gate (event passes).
//   6. The aspect's consume counter tracks accurately.
//   7. Player die/revive cycles + permadeath threshold.
//   8. save/restore round-trips bus + aspects + lamp + player.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_dark");

const adv = makeAdventure();
adv.setup_default_aspects();

// Initial state — end-of-road (1) is lit, lamp off:
expect("room", adv.player_room(), 1);
expect("dark now?", adv.room_is_dark_now(), false);
expect("lamp lit?", adv.is_lit(), false);

// look in lit room (passes bus, base handles):
const r1: string = adv.do_command("look", "");
expect("look response contains 'BUILDING'", r1.includes("BUILDING"), true);
expect("darkness consumed", adv.darkness_consumed_count(), 0);

// Move into the cave (debris room, dark with lamp off):
adv.player.move_to(11);
expect("room after move", adv.player_room(), 11);
expect("dark now?", adv.room_is_dark_now(), true);

// look in dark with lamp off (consumed by DarknessGate):
const r2: string = adv.do_command("look", "");
expect("look response", r2, "It is now pitch dark. If you proceed you will likely fall into a pit.");
expect("darkness consumed", adv.darkness_consumed_count(), 1);

// examine also gated:
const r3: string = adv.do_command("examine", "wall");
expect("examine response", r3, "It is now pitch dark. If you proceed you will likely fall into a pit.");
expect("darkness consumed", adv.darkness_consumed_count(), 2);

// light lamp, then look — passes through:
adv.do_command("light", "");
expect("lamp lit?", adv.is_lit(), true);
expect("dark now?", adv.room_is_dark_now(), false);
const r4: string = adv.do_command("look", "");
expect("look response (lit) contains 'DEBRIS'", r4.includes("DEBRIS"), true);
expect("darkness consumed", adv.darkness_consumed_count(), 2);

// save mid-state, mutate, restore:
const bytes = adv.save_state();
console.log(`  save bytes: ${bytes.length}`);

// Mutate after save
adv.extinguish_lamp();
adv.do_command("look", ""); // consumes; bumps to 3
expect("post-save consumed", adv.darkness_consumed_count(), 3);

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored room", adv2.player_room(), 11);
expect("restored lamp lit", adv2.is_lit(), true);
expect("restored consumed", adv2.darkness_consumed_count(), 2);
const r5: string = adv2.do_command("look", "");
expect("restored look contains 'DEBRIS'", r5.includes("DEBRIS"), true);
expect("restored consumed++", adv2.darkness_consumed_count(), 2);

// Player death/revive lifecycle on a fresh adventure:
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.player.move_to(47);
adv3.player.die();
expect("after 1st death", adv3.player_state(), "dead");
expect("deaths", adv3.player.get_deaths(), 1);
adv3.player.revive();
expect("after revive", adv3.player_state(), "alive");
expect("revived to start", adv3.player_room(), 1);
expect("inventory dropped", adv3.player.inventory_size(), 0);

// 2nd, 3rd deaths recoverable
adv3.player.die();
adv3.player.revive();
adv3.player.die();
adv3.player.revive();
expect("after 3rd revive", adv3.player_state(), "alive");
expect("deaths total", adv3.player.get_deaths(), 3);

// 4th death is permanent
adv3.player.die();
expect("after 4th death", adv3.player_state(), "permadead");
