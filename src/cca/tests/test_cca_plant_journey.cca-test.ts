// Port of Godot tests/test_cca_plant_journey.gd — the plant/beanstalk branch
// rail: win → BridgeBuilt → PlantJourney waters the west-pit plant twice, climbs
// the beanstalk, reaches the Giant Room (canon 92) and takes the eggs (id 116).
// Typed commands only, deterministic (chance reseed 42, dwarves dormant).
import { file, expect, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, PLANT_RAIL } from "./journeys";

file("test_cca_plant_journey");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, PLANT_RAIL);
expect("plant rail reaches the Giant Room (92)", d.machine().player_room(), 92);
expect("plant rail takes the eggs (id 116)", d.machine().player.carrying(116), true);
