// Port of Godot tests/test_cca_state_space_seeded_post_bridge.gd — continues the
// milestone-seeded BFS progression past the troll bridge (TrollPaid / BearFed /
// ChainTaken). PASS = 0 violations across all runs.
import { file, ok } from "./_harness";
import { captureCanonicalMilestones, seededBfs } from "./_modelcheck";

file("test_cca_state_space_seeded_post_bridge");

const SEED_MILESTONES = ["TrollPaid", "BearFed", "ChainTaken"];
const PER_SEED_CAP = 1500;

const registry = captureCanonicalMilestones();
for (const milestone of SEED_MILESTONES) {
  const s = seededBfs(registry, milestone, PER_SEED_CAP);
  ok(
    `BFS from ${milestone} clean (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations)`,
    s.violations.length === 0,
  );
}
