// Port of Godot tests/test_cca_state_space_seeded_progression.gd — milestone-
// seeded BFS from successively deeper canonical-journey milestones, each
// unlocking a deeper coverage cluster. PASS = 0 violations across all runs.
import { file, ok } from "./_harness";
import { captureCanonicalMilestones, seededBfs } from "./_modelcheck";

file("test_cca_state_space_seeded_progression");

const SEED_MILESTONES = ["SnakeGone", "DragonDead"];
const PER_SEED_CAP = 2000;

const registry = captureCanonicalMilestones();
for (const milestone of SEED_MILESTONES) {
  const s = seededBfs(registry, milestone, PER_SEED_CAP);
  ok(
    `BFS from ${milestone} clean (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations)`,
    s.violations.length === 0,
  );
}
