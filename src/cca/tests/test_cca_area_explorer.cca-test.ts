// Port of Godot tests/test_cca_area_explorer.gd — rail to a waypoint, then
// seeded BFS bloom. Walk the win rail to the BridgeBuilt waypoint, snapshot, then
// run a bounded StateSpace BFS (cap 600) from it under several seeds with
// reseed_chance_after_restore (sampling the area's random branches), and union
// the covered rooms. PASS = union >= best single seed AND union >= 12 rooms.
import { file, ok } from "./_harness";
import { makeDriver } from "./_harness";
import { walkWinToBridgeBuilt } from "./journeys";
import { StateSpace } from "./_modelcheck";

file("test_cca_area_explorer");

const SEEDS = [42, 7, 99, 1234];

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
const snapshot = d.machine().save_state();

const union = new Set<number>();
let bestSingle = 0;
for (const seed of SEEDS) {
  const s = new StateSpace();
  s.seed = seed;
  s.max_states = 600;
  s.seedBytes = snapshot;
  s.reseedChanceAfterRestore = true;
  s.run();
  const cov = s.coveredRooms();
  bestSingle = Math.max(bestSingle, cov.size);
  for (const r of cov) union.add(r);
}

ok(
  `waypoint-seeded BFS bloom covers ${union.size} rooms (best single ${bestSingle}, floor 12)`,
  union.size >= bestSingle && union.size >= 12,
);
