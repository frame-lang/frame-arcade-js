// Port of Godot tests/test_cca_state_space_seeded.gd — RFC-0002 milestone-seeded
// BFS. Seed the state-space search from the LampLit canonical-journey snapshot
// (every seeded state is still player-reachable; the seed is a precomputed
// shortcut past BFS's action-ordering depth limit). PASS = 0 invariant violations.
import { file, ok } from "./_harness";
import { captureCanonicalMilestones, seededBfs } from "./_modelcheck";

file("test_cca_state_space_seeded");

const registry = captureCanonicalMilestones();
const s = seededBfs(registry, "LampLit", 10000);
ok(
  `milestone-seeded BFS (LampLit) clean (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations)`,
  s.violations.length === 0,
);
