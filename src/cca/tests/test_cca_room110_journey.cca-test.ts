// Port of Godot tests/test_cca_room110_journey.gd — the bedquilt → room-110
// branch rail: win → BridgeBuilt → Room110Journey crawls through Bedquilt (canon
// 65) and lands in canon 110. Room 110 is the one graph room a blind walker can't
// reach: every Bedquilt exit is a probability gate, so the rail pins those rolls
// to MISS (force:travel_gate=0) so 65:north falls through to its topology exit
// (71 → 110), then unpins (clear:travel_gate). Deterministic (chance reseed 42).
import { file, expect, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands } from "./journeys";

file("test_cca_room110_journey");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);

// First reach Bedquilt (65), then pin the gates and crawl to 110.
feedCommands(d, ["east", "north", "north", "down", "bedquilt"]);
expect("rail passes through Bedquilt (65)", d.machine().player_room(), 65);
feedCommands(d, ["force:travel_gate=0", "north", "north", "clear:travel_gate"]);
expect("room-110 rail crawls Bedquilt → 110", d.machine().player_room(), 110);
