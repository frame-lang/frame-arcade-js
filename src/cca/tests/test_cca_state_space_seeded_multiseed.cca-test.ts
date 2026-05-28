// Port of Godot tests/test_cca_state_space_seeded_multiseed.gd — milestone-seeded
// BFS at BearFed under multiple RNG seeds. The same milestone under different
// seeds may take different next-state branches (probabilistic gates), so re-walk
// the journey to BearFed per seed and BFS from each. PASS = 0 violations under all.
import { file, ok } from "./_harness";
import { captureCanonicalMilestones, seededBfs } from "./_modelcheck";

file("test_cca_state_space_seeded_multiseed");

const TARGET_MILESTONE = "BearFed";
const SEED_LIST = [42, 99, 1234, 7777];
const PER_SEED_CAP = 1000;

for (const seed of SEED_LIST) {
  const registry = captureCanonicalMilestones(seed);
  const s = seededBfs(registry, TARGET_MILESTONE, PER_SEED_CAP, seed);
  ok(
    `BearFed BFS clean under seed ${seed} (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations)`,
    s.violations.length === 0,
  );
}
