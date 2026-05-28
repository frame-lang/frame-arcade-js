// Port of Godot tests/test_cca_death_scenarios.gd — canon-fidelity coverage for
// the multi-step death scenarios driven through real player commands (DRIVER-
// level; mirrors H.make_driver() / H.capture()). Same assertions, same expected
// values, same order. Each scenario sets up FSM state directly (bear/troll/
// bridge transitions) then triggers the death through a real player verb.
//
//   • Bear take-chain at $Hungry — at the bear's home room with the bear
//     unfed, TAKE CHAIN transitions Bear $Hungry → $Attacking AND kills the
//     player. Canon: "With a roar the bear lunges at you..."
//   • Bridge collapse with bear following (canon msg #162) — bear in
//     $Following, troll paid, bridge built, player at canon 117. CROSS fires
//     the collapse prose; player dies.
import { file, expect, ok, makeDriver, capture } from "./_harness";

file("test_cca_death_scenarios");

// Godot _assert_lines lowercases both haystack and needle before comparing.
function assertLines(label: string, lines: string[], needle: string): void {
  ok(label, lines.join("\n").toLowerCase().includes(needle.toLowerCase()));
}

// ----- Scenario 1: bear take-chain at $Hungry -----
// Default state: bear $Hungry, chain at bear's home room. Move to
// BEAR_HOME_ROOM (canon 130) and attempt to take chain — bear lunges + die.
const d = makeDriver();
d.machine().player.move_to(d.machine().BEAR_HOME_ROOM);
const lines: string[] = capture(d, "take chain");
assertLines("bear-hungry take-chain prose", lines, "with a roar the bear lunges");
expect("player_state", d.machine().player_state(), "dead");

// ----- Scenario 2: bridge collapse with bear following -----
// Set up: bear $Following (fed + chain taken via FSM-direct transitions),
// troll paid, crystal bridge built. Player at canon 117 with chain carried.
const d2 = makeDriver();
d2.machine().bear.feed(); // $Hungry → $Tame
d2.machine().bear.take_chain(); // $Tame → $Following
d2.machine().player.take(d2.machine().CHAIN_ID); // chain into player inv
d2.machine().chain.try_take(d2.machine().BEAR_HOME_ROOM); // chain treasure $Carried
d2.machine().troll.pay_toll(); // troll vanished
d2.machine().crystal_bridge.wave(); // bridge built
d2.machine().player.move_to(117);
const lines2: string[] = capture(d2, "cross");
assertLines("bridge collapse prose", lines2, "bridge buckles beneath the weight of the bear");
expect("player_state", d2.machine().player_state(), "dead");
