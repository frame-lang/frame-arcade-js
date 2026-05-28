// Port of Godot tests/test_cca_prop_gates.gd — canon prop-conditioned gates,
// DRIVER-level (mirrors H.make_driver() / H.capture()). Same assertions, same
// expected values. Verifies the canon section-3 prop-gated rows:
//
//   `17 412021 7`   — FORWARD @ 17 with no bridge → die in canon 21
//   `27 412021 7`   — FORWARD @ 27 with no bridge → die in canon 21
//   `69 331120 46`  — SOUTH @ 69 after dragon killed → walk to 120
//   `74 331120 44`  — WEST  @ 74 after dragon killed → walk to 120
//   `117 332021 39` — JUMP @ 117 after bear-bridge collapsed → die
//   `122 332021 39` — JUMP @ 122 after bear-bridge collapsed → die
//
// Each phase sets up the FSM state directly (rather than walking the puzzle
// path) and drives the verb through the driver so the full bumper-dispatch
// ladder runs. d.machine() is the underlying Adventure (Godot: d.fsm).
import { file, expect, expectContains, makeDriver, capture } from "./_harness";

file("test_cca_prop_gates");

// ----- Phase 1: 17:forward + 27:forward — bridge missing → die -----
// Phase 1: fissure FORWARD with no bridge → death in canon 21
for (const room of [17, 27]) {
  const d = makeDriver();
  d.machine().player.move_to(room);
  expect(`setup: at room ${room}, bridge not built (room)`, d.machine().player_room(), room);
  expect(`setup: at room ${room}, bridge not built (bridge)`, d.machine().bridge_built(), false);
  const lines: string[] = capture(d, "forward");
  expect(`FORWARD @ ${room} walks to canon 21 (death)`, d.machine().player_room(), 21);
  expect(`FORWARD @ ${room} kills the player`, d.machine().player_state(), "dead");
  expectContains(`FORWARD @ ${room} emits canon broken-bones msg`, lines, "didn't make it");
}

// ----- Phase 2: 17:forward with bridge built — gate falls through -----
// Phase 2: fissure FORWARD with bridge built → no exit (gate falls through)
const d2 = makeDriver();
d2.machine().crystal_bridge.wave(); // build the bridge
expect("setup: bridge built", d2.machine().bridge_built(), true);
d2.machine().player.move_to(17);
capture(d2, "forward");
expect("FORWARD @ 17 with bridge stays at 17", d2.machine().player_room(), 17);
expect("FORWARD @ 17 with bridge: player alive", d2.machine().player_state(), "alive");

// ----- Phase 3: 69:south + 74:west pre-kill — topology fallback -----
// Phase 3: 69:south / 74:west pre-kill — topology fallback (snake-cleared 119/121)
for (const triple of [[69, "south", 119], [74, "west", 121]] as [number, string, number][]) {
  const d3 = makeDriver();
  expect("setup: dragon alive", d3.machine().dragon_alive(), true);
  d3.machine().player.move_to(triple[0]);
  capture(d3, triple[1]);
  expect(`pre-kill ${triple[0]}:${triple[1]} walks to canon ${triple[2]}`, d3.machine().player_room(), triple[2]);
}

// ----- Phase 4: 69:south + 74:west post-kill — gate to 120 -----
// Phase 4: 69:south / 74:west after dragon killed → walk to canon 120
for (const pair of [[69, "south"], [74, "west"]] as [number, string][]) {
  const d4 = makeDriver();
  // Direct state mutation: drive Dragon to $Dead.
  d4.machine().dragon.attack(); // → $Asked
  d4.machine().dragon.yes(); // → $Dead
  expect("setup: dragon killed", d4.machine().dragon_alive(), false);
  d4.machine().player.move_to(pair[0]);
  capture(d4, pair[1]);
  expect(`post-kill ${pair[0]}:${pair[1]} walks to canon 120 (connecting canyon)`, d4.machine().player_room(), 120);
}

// ----- Phase 5: 117:jump + 122:jump pre-bear — msg #96 bumper -----
// Phase 5: 117/122:jump pre-bear → canon msg #96 'use the bridge'
for (const room of [117, 122]) {
  const d5 = makeDriver();
  d5.machine().player.move_to(room);
  const lines5: string[] = capture(d5, "jump");
  expect(`pre-bear JUMP @ ${room} stays put`, d5.machine().player_room(), room);
  expectContains(`pre-bear JUMP @ ${room} emits msg #96`, lines5, "I respectfully suggest");
}

// ----- Phase 6: 117:jump + 122:jump after bridge collapsed → die in canon 21 -----
// Canon: after the bear-bridge collapses, JUMP into the chasm at either side
// walks to canon 21 (broken-neck death) per canon row `117/122 332021 39`.
// Phase 6: 117/122:jump after bridge collapsed → die in canon 21
for (const room of [117, 122]) {
  const d6 = makeDriver();
  d6.machine().collapse_troll_bridge();
  expect("setup: bridge collapsed", d6.machine().troll_bridge_collapsed(), true);
  d6.machine().player.move_to(room);
  const lines6: string[] = capture(d6, "jump");
  expect(`post-collapse JUMP @ ${room} walks to canon 21 (death)`, d6.machine().player_room(), 21);
  expect(`post-collapse JUMP @ ${room} kills the player`, d6.machine().player_state(), "dead");
  expectContains(`post-collapse JUMP @ ${room} emits broken-bones msg`, lines6, "didn't make it");
}
