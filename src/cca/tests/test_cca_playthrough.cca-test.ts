// Port of Godot tests/test_cca_playthrough.gd — end-to-end playthrough exercising
// the verbs and rooms a real player would touch. No UI; drive the FSM directly
// via do_command and assert each response. Smoke test for the verb/noun → FSM
// mapping plus the save/restore round-trip.
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_playthrough");

function contains(label: string, actual: string, fragment: string): void {
  ok(`${label} (contains "${fragment}")`, actual.includes(fragment));
}

const adv = makeAdventure();
adv.setup_default_aspects();
adv.wake_dwarves();

// Start at end-of-road (1, lit, surface).
expect("starting room", adv.player_room(), 1);
expect("not dark", adv.room_is_dark_now(), false);
contains("look mentions building", adv.do_command("look", ""), "BUILDING");

// Move north → well house (3); driver-translated direction.
adv.do_command("move", "3");
expect("at well house", adv.player_room(), 3);

// XYZZY from well house → 11 (debris) — canon pair (3 ↔ 11).
adv.do_command("xyzzy", "");
expect("after xyzzy", adv.player_room(), 11);
// In room 11 with lamp off → DarknessGate consumes the look:
contains("dark consumes look", adv.do_command("look", ""), "dark");

// Light lamp.
adv.do_command("light", "");

// Teleport to gold-nugget room (canon 18); look mentions gold.
adv.player.move_to(18);
contains("look mentions gold", adv.do_command("look", ""), "gold");

// Take gold.
contains("take gold response", adv.do_command("take", "gold"), "OK");
expect("carrying gold", adv.player.carrying(110), true);

// Teleport back to well house, drop gold.
adv.player.move_to(3);
expect("at deposit room", adv.player_room(), 3);
contains("deposited", adv.do_command("drop", "gold"), "OK");
expect("treasures deposited", adv.treasures_deposited(), 1);
expect("score", adv.total_score(), 14);

// PLUGH from well house (3) → Y2 (33).
adv.do_command("plugh", "");
expect("at Y2", adv.player_room(), 33);

// Detour to cobbles (canon 10) for the cage — required to catch bird.
adv.player.move_to(10);
adv.do_command("take", "cage");
expect("cage carried", adv.player.carrying(adv.CAGE_ID), true);

// Move down to bird chamber (13), take bird.
adv.do_command("move", "13");
expect("at bird chamber", adv.player_room(), 13);
contains("caught bird", adv.do_command("take", "bird"), "OK");

// Move up to Y2, then to snake at canon 19 (Hall of Mt King).
adv.do_command("move", "33");
adv.do_command("move", "19");
expect("at snake room", adv.player_room(), 19);
expect("snake blocking", adv.snake.is_blocking(), true);

// Release bird in snake's room — snake flees.
contains("attacks snake", adv.do_command("release", "bird"), "attacks");
expect("snake gone", adv.snake.is_blocking(), false);

// Now to dragon canyon (canon 119).
adv.do_command("move", "119");
expect("at dragon", adv.player_room(), 119);

// Attack dragon, say YES.
contains("with what", adv.do_command("attack", "dragon"), "what");
contains("vanquished", adv.do_command("yes", ""), "vanquished");
expect("dragon dead", adv.dragon_alive(), false);

// Diamonds canonically live at room 27 (west bank fissure).
adv.player.move_to(27);
contains("took diamonds", adv.do_command("take", "diamonds"), "OK");
adv.player.move_to(119); // back to dragon canyon for next leg

// Detour to well house for food (canon 3).
adv.player.move_to(3);
adv.do_command("take", "food");
expect("food carried", adv.player.carrying(adv.FOOD_ID), true);

// To bear chamber (canon 130 — Barren Room), feed bear, take chain.
adv.do_command("move", "130");
expect("at bear room", adv.player_room(), 130);
contains("fed bear", adv.do_command("feed", "bear"), "wolfs down");
contains("got chain", adv.do_command("take", "chain"), "OK");

// Up to Bedquilt then east to troll bridge, drop chain — troll flees.
adv.do_command("move", "65");
adv.do_command("move", "117");
expect("at troll bridge", adv.player_room(), 117);
expect("troll blocking", adv.troll.is_blocking_bridge(), true);
contains("scurries away", adv.do_command("drop", "chain"), "scurries away");
expect("troll gone", adv.troll.is_blocking_bridge(), false);

// Jewelry now at south side chamber (canon 29).
adv.player.move_to(29);
expect("at south chamber", adv.player_room(), 29);
contains("took jewelry", adv.do_command("take", "jewelry"), "OK");

// Save / restore mid-game.
const bytes: string = adv.save_state();
adv.do_command("move", "117");

const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.restore_state(bytes);
expect("restored room", adv2.player_room(), 29);
expect("restored carrying jewelry", adv2.player.carrying(113), true);
expect("restored troll gone", adv2.troll.is_blocking_bridge(), false);
expect("restored snake gone", adv2.snake.is_blocking(), false);
expect("restored dragon dead", adv2.dragon_alive(), false);
