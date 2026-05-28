// Port of Godot tests/test_cca_maze_sweep.gd — the counter-driven area-sweep LOOP
// (the cyclic counterpart to the acyclic rails). Walk win → BridgeBuilt → maze
// edge (canon 131), then drive MazeSweep: feed it the current room, take the
// direction it returns, repeat — until it declares the 12-room cyclic maze
// (107/112/131-140) mapped. Asserts full coverage + a success exit (not the cap).
import { file, expect, ok, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, MAZE_RAIL } from "./journeys";
import { MazeSweep } from "./_loops";

file("test_cca_maze_sweep");

const TARGET = [107, 112, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140];

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, MAZE_RAIL);
expect("entered maze at canon 131", d.machine().player_room(), 131);

// Drive the sweep loop.
const sweep = new MazeSweep();
sweep.arrive(d.machine().player_room());
while (!sweep.is_done()) {
  const dir = sweep.next_dir();
  d.input(dir);
  sweep.arrive(d.machine().player_room());
}

const mapped = sweep.is_done() && sweep.steps_taken() < 400; // success, not cap
const missing = TARGET.filter((r) => !sweep.seen(r));
ok(`maze-sweep mapped all 12 cyclic rooms (missing ${JSON.stringify(missing)})`, missing.length === 0);
ok(`exited on success in under cap (${sweep.steps_taken()} steps)`, mapped);
expect("covered count", sweep.covered_count(), TARGET.length);
