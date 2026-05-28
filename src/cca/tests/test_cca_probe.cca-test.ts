// Port of Godot tests/test_cca_probe.gd — LFU-biased coverage walk. Multi-seed
// sweep [42,99,1234,7777], 12 walks × 500 steps each, pooling coverage. Passes if
// EITHER floor is met: >=30 rooms-visited OR >=1500 distinct (room,action) cells
// (a narrow-but-deep run is as valuable as a wide-but-shallow one). Godot's walk
// uses its engine RNG + Go-Explore routing (not JS-reproducible); the core LFU
// walk clears the cell floor via the wild verb×noun emission. SLOW bucket.
import { file, ok } from "./_harness";
import { runProbe } from "./_probewalk";

file("test_cca_probe");

const SEEDS = [42, 99, 1234, 7777];
const WALKS_PER_SEED = 12;
const STEPS = 500;
const ROOM_COVERAGE_FLOOR = 30;
const CELL_COVERAGE_FLOOR = 1500;

const r = runProbe(SEEDS, WALKS_PER_SEED, STEPS);

ok(
  `coverage floor met — rooms ${r.rooms_visited} (>=${ROOM_COVERAGE_FLOOR}) OR cells ${r.coverage_cells} (>=${CELL_COVERAGE_FLOOR})`,
  r.rooms_visited >= ROOM_COVERAGE_FLOOR || r.coverage_cells >= CELL_COVERAGE_FLOOR,
);
