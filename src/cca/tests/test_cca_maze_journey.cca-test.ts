// Port of Godot tests/test_cca_maze_journey.gd — the all-alike maze branch rail:
// win → BridgeBuilt → MazeJourney steps into the maze (lands in canon 131).
// Typed commands only, deterministic (chance reseed 42, dwarves dormant).
import { file, expect, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, MAZE_RAIL } from "./journeys";

file("test_cca_maze_journey");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, MAZE_RAIL);
expect("maze rail steps into the all-alike maze (131)", d.machine().player_room(), 131);
