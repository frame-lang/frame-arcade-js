// Port of Godot tests/test_cca_back_verb.gd — canon BACK / RETREAT verb
// (advent.for STMT 20-25). Same assertions/expected values. Phase 4 exercises
// the RETREAT alias (now wired in the driver's synonym table).
import { file, expect, expectContains, makeDriver } from "./_harness";

file("test_cca_back_verb");

// Phase 1: simple BACK after a normal move (3 → west → 1, BACK → 3).
const d = makeDriver();
d.machine().player.move_to(3);
d.input("west");
expect("setup: walked 3 -> 1", d.machine().player_room(), 1);
d.input("back");
expect("BACK from 1 walks to 3", d.machine().player_room(), 3);

// Phase 2: BACK with no movement history → canon msg #140.
const d2 = makeDriver();
d2.machine().player.move_to(3);
const l = d2.input("back");
expectContains("BACK with no history emits canon 'remember how'", l, "no longer seem to remember");

// Phase 3: BACK from a forced room (canon 22 → 15 via topology).
const d3 = makeDriver();
d3.machine().player.move_to(22);
d3.input("back");
expect("BACK from 22 walks to 15", d3.machine().player_room(), 15);

// Phase 4: RETREAT alias routes to BACK.
const d4 = makeDriver();
d4.machine().player.move_to(3);
d4.input("north");
d4.input("retreat");
expect("RETREAT from 1 walks to 3", d4.machine().player_room(), 3);

// Phase 5: BACK uses the most recent old_loc.
const d5 = makeDriver();
d5.machine().player.move_to(3);
d5.input("west");
d5.input("east");
expect("d5: walked back to 3 via east", d5.machine().player_room(), 3);
d5.input("west");
expect("d5: at 1 again", d5.machine().player_room(), 1);
d5.input("back");
expect("BACK after sequence walks to 3", d5.machine().player_room(), 3);
