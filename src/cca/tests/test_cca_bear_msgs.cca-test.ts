// Port of Godot tests/test_cca_bear_msgs.gd — canon bear-state messages
// (advent.dat msgs #165-170), DRIVER-level (makeDriver + capture). Same
// assertions, same expected values, same order.
//
//   ATTACK BEAR (hungry)          → msg #165 ("bare hands... bear hands??")
//   ATTACK BEAR (tame/following)  → msg #166 ("only wants to be your friend")
//   TAKE BEAR (still chained)     → msg #169 ("still chained to the wall")
//   UNLOCK CHAIN (no keys)        → msg #170 ("chain is still locked")
//   FEED BEAR (success)           → msg #168 ("eagerly wolfs down your food")
import { file, expectContains, makeDriver, capture } from "./_harness";

file("test_cca_bear_msgs");

// Bear lives at canon BEAR_HOME_ROOM (130 in port). Player must be there for
// ATTACK / FEED / TAKE BEAR to address the bear; the FSM gates on bear state.

// ----- Phase 1: ATTACK BEAR (hungry) → msg #165 -----
const d1 = makeDriver();
d1.machine().player.move_to(d1.machine().BEAR_HOME_ROOM);
const l1: string[] = capture(d1, "attack bear");
expectContains("ATTACK BEAR hungry → msg #165 ('bare hands')", l1, "bare hands");

// ----- Phase 2: ATTACK BEAR (tame) → msg #166 -----
const d2 = makeDriver();
d2.machine().player.move_to(d2.machine().BEAR_HOME_ROOM);
d2.machine().bear.feed(); // hungry → tame
const l2: string[] = capture(d2, "attack bear");
expectContains("ATTACK BEAR tame → msg #166 ('wants to be your friend')", l2, "only wants to be your friend");

// ----- Phase 3: TAKE BEAR (hungry) → msg #169 -----
const d3 = makeDriver();
d3.machine().player.move_to(d3.machine().BEAR_HOME_ROOM);
const l3: string[] = capture(d3, "take bear");
expectContains("TAKE BEAR hungry → msg #169", l3, "still chained to the wall");

// ----- Phase 4: TAKE BEAR (tame, still chained) → msg #169 -----
const d4 = makeDriver();
d4.machine().player.move_to(d4.machine().BEAR_HOME_ROOM);
d4.machine().bear.feed();
const l4: string[] = capture(d4, "take bear");
expectContains("TAKE BEAR tame → msg #169", l4, "still chained to the wall");

// ----- Phase 5: UNLOCK CHAIN without keys → msg #170 -----
const d5 = makeDriver();
d5.machine().player.move_to(d5.machine().BEAR_HOME_ROOM);
const l5: string[] = capture(d5, "unlock chain");
expectContains("UNLOCK CHAIN without keys → msg #170", l5, "chain is still locked");

// ----- Phase 6: FEED BEAR with food → msg #168 -----
const d6 = makeDriver();
d6.machine().player.move_to(d6.machine().BEAR_HOME_ROOM);
// Force-take food: place at room then take.
d6.machine().food_item.place(d6.machine().player_room());
d6.machine().food_item.try_take(d6.machine().player_room());
d6.machine().player.take(d6.machine().FOOD_ID);
const l6: string[] = capture(d6, "feed bear");
expectContains("FEED BEAR (success) → canon msg #168 ('wolfs down')", l6, "wolfs down your food");
