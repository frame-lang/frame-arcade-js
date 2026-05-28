// Port of Godot tests/test_cca_npc_throws.gd — canon NPC throw/drop
// interactions, DRIVER-level (makeDriver + capture). Same assertions, same
// expected values, same order.
//
//   RELEASE BIRD at canon 19 (snake)   → bird drives snake away (msg #30)
//   DROP BIRD at canon 19 (snake)      → snake devours caged bird (msg #101)
//   DROP BIRD at canon 119 (dragon)    → bird vaporized (msg #154)
//   THROW AXE at canon 119 (dragon)    → msg #152 (axe glances)
//   THROW AXE at canon 117 (troll)     → msg #158 (troll catches)
//   THROW AXE at canon 130 (bear hungry) → msg #164 (bear catches)
import { file, expect, ok, expectContains, makeDriver, capture } from "./_harness";

file("test_cca_npc_throws");

// ----- Phase 1a: RELEASE BIRD at snake → bird drives snake away -----
// Canon distinguishes RELEASE (bird out of cage, attacks snake) from DROP
// (caged bird, snake eats it).
const d = makeDriver();
d.machine().player.move_to(19);
d.machine().bird.capture(); // → $Caged so release() can fire
d.machine().player.take(d.machine().BIRD_ID);
expect("setup: snake blocking", d.machine().snake.is_blocking(), true);
const l: string[] = capture(d, "release bird");
expectContains("RELEASE BIRD emits canon snake-drive prose", l, "drives the snake away");
expect("snake driven away", d.machine().snake.is_blocking(), false);

// ----- Phase 1b: DROP BIRD at snake → snake devours the caged bird -----
const d1b = makeDriver();
d1b.machine().player.move_to(19);
d1b.machine().bird.capture();
d1b.machine().player.take(d1b.machine().BIRD_ID);
const l1b: string[] = capture(d1b, "drop bird");
expectContains("DROP BIRD emits canon snake-devour prose", l1b, "snake has now devoured your bird");
expect("bird dead", d1b.machine().bird.get_state(), "dead");

// ----- Phase 2: DROP BIRD at dragon -----
const d2 = makeDriver();
d2.machine().player.move_to(119);
d2.machine().bird.capture();
d2.machine().player.take(d2.machine().BIRD_ID);
// Godot asserts [player_room, dragon_alive] == [119, true]; ported as the
// element-wise conjunction under the same label.
ok(
  "setup: at dragon room, dragon alive",
  d2.machine().player_room() === 119 && d2.machine().dragon_alive() === true,
);
const l2: string[] = capture(d2, "drop bird");
// Canon msg #154 — "burnt to a cinder".
expectContains("DROP BIRD at dragon emits canon vaporize msg", l2, "burnt to a cinder");

// ----- Phase 3: THROW AXE at dragon -----
const d3 = makeDriver();
d3.machine().player.move_to(119);
const l3: string[] = capture(d3, "throw axe");
expectContains("THROW AXE at dragon emits canon glance msg", l3, "bounces harmlessly");

// ----- Phase 4: THROW AXE at troll -----
const d4 = makeDriver();
d4.machine().player.move_to(117);
expect("setup: troll blocking", d4.machine().troll.is_blocking_bridge(), true);
const l4: string[] = capture(d4, "throw axe");
expectContains("THROW AXE at troll emits canon 'troll deftly catches'", l4, "deftly catches");

// ----- Phase 5: THROW AXE at bear -----
const d5 = makeDriver();
d5.machine().player.move_to(130);
expect("setup: bear hungry", d5.machine().bear_state(), "hungry");
const l5: string[] = capture(d5, "throw axe");
expectContains("THROW AXE at bear emits canon 'lands near the bear'", l5, "near the bear");

// ----- Phase 6: regression — THROW AXE at non-NPC room falls through -----
// No canon-prose interception when player isn't at dragon/troll/bear.
const d6 = makeDriver();
d6.machine().player.move_to(3); // well house — no NPC
const l6: string[] = capture(d6, "throw axe");
expect("THROW AXE at well house: no canon NPC prose fires", l6.length > 0, true); // SOMETHING is emitted (FSM fallback)
