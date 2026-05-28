// Port of Godot tests/test_cca_state_space_seeded_endgame.gd — milestone-seeded
// BFS for the late-game / endgame mechanics (BearReleased / GoldDeposited /
// InRepository). InRepository is reached via the canonical FSM shortcuts
// (TreasuresFilled ×13 + tick ×35) applied during capture. PASS = 0 violations.
import { file, ok } from "./_harness";
import { captureCanonicalMilestones, seededBfs } from "./_modelcheck";

file("test_cca_state_space_seeded_endgame");

const SEED_MILESTONES = ["BearReleased", "GoldDeposited", "InRepository"];
const PER_SEED_CAP = 1500;

const registry = captureCanonicalMilestones();
for (const milestone of SEED_MILESTONES) {
  const s = seededBfs(registry, milestone, PER_SEED_CAP);
  ok(
    `BFS from ${milestone} clean (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations)`,
    s.violations.length === 0,
  );
}
