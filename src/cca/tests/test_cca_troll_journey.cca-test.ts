// Port of Godot tests/test_cca_troll_journey.gd — the troll-cross branch rail:
// win → BridgeBuilt → PlantJourney (Giant Room, carrying eggs) → TrollJourney
// navigates to the troll bridge, throws the eggs to pay the toll, and crosses to
// the far side (canon 122; troll vanished). Deterministic (chance reseed 42).
import { file, expect, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, PLANT_RAIL, TROLL_RAIL } from "./journeys";

file("test_cca_troll_journey");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, PLANT_RAIL);
feedCommands(d, TROLL_RAIL);
expect("troll rail crosses to the far side (122)", d.machine().player_room(), 122);
expect("troll vanished after eggs toll", d.machine().troll_state(), "vanished");
