// Port of Godot tests/test_cca_rusty_journey.gd — the rusty-door branch rail:
// win → BridgeBuilt → PlantJourney (Giant Room) → RustyJourney climbs down for
// oil, pours it on the sealed iron door at canon 94, and passes through to canon
// 95 and 91 (door oiled). Deterministic (chance reseed 42, dwarves dormant).
import { file, expect, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, PLANT_RAIL, RUSTY_RAIL } from "./journeys";

file("test_cca_rusty_journey");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, PLANT_RAIL);
feedCommands(d, RUSTY_RAIL);
expect("rusty rail oils the door", d.machine().rusty_door_oiled(), true);
expect("rusty rail reaches canon 91 via 95", d.machine().player_room(), 91);
