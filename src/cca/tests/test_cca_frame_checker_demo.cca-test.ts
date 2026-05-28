// Port of Godot tests/test_cca_frame_checker_demo.gd — demonstrates + validates
// the domain-agnostic FrameStateChecker on CCA via three classical model-checking
// properties:
//   1. Reachability cross-validation — generic checker explore() vs the bespoke
//      StateSpace at the same cap + seed (from BearReleased): same distinct-room
//      count pins the two independent engines against drift.
//   2. Liveness EF won — from InRepository (one BLAST from victory),
//      reachable_satisfying(is_won) finds a won state with a witness path.
//   3. Bisimulation / restore soundness — over [LampLit, SnakeGone, BearReleased].
import { file, expect, ok } from "./_harness";
import { CcaModelAdapter, FrameStateChecker, StateSpace, captureCanonicalMilestones } from "./_modelcheck";
import type { CcaDriver } from "../driver";

file("test_cca_frame_checker_demo");

const CAP = 2000;

function distinctRooms(visited: Map<string, boolean>): number {
  const rooms = new Set<number>();
  for (const h of visited.keys()) rooms.add(parseInt(h.slice(2).split("|")[0], 10));
  return rooms.size;
}

const registry = captureCanonicalMilestones();
const bear = registry.get_snapshot("canonical_journey", "BearReleased");
const repo = registry.get_snapshot("canonical_journey", "InRepository");
ok("captured BearReleased snapshot", bear.length > 0);
ok("captured InRepository snapshot", repo.length > 0);

// 1. Reachability cross-validation: generic checker vs bespoke state_space.
const adapter = new CcaModelAdapter(42, bear);
const checker = new FrameStateChecker(adapter);
checker.max_states = CAP;
checker.explore();
const genericRooms = distinctRooms(checker.visited);

const ss = new StateSpace();
ss.seed = 42;
ss.max_states = CAP;
ss.seedBytes = bear;
ss.run();
const bespokeRooms = ss.distinctRooms();

expect("distinct-room count matches (generic vs bespoke)", genericRooms, bespokeRooms);
expect("generic checker found 0 safety violations", checker.violations.length, 0);

// 2. Liveness: EF won from InRepository.
const adapter2 = new CcaModelAdapter(42, repo);
const checker2 = new FrameStateChecker(adapter2);
checker2.max_states = 200;
const result = checker2.reachable_satisfying((o: CcaDriver) => adapter2.is_won(o));
ok(`EF won satisfied from InRepository (explored ${result.states} states)`, result.found);

// 3. Bisimulation: restore soundness over shallow milestones.
const samples = ["LampLit", "SnakeGone", "BearReleased"]
  .filter((n) => registry.has("canonical_journey", n))
  .map((n) => ({ name: n, bytes: registry.get_snapshot("canonical_journey", n) }));
const adapter3 = new CcaModelAdapter(42);
const checker3 = new FrameStateChecker(adapter3);
const dirty = (_a: CcaModelAdapter, o: CcaDriver): void => {
  o.machine().player.die();
  o.promptMachine().offer_revive();
};
ok("restore observationally sound across samples", checker3.restore_soundness(samples, dirty).length === 0);
