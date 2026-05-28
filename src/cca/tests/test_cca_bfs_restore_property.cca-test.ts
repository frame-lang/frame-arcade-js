// Port of Godot tests/test_cca_bfs_restore_property.gd — property check on the
// BFS harness's restore path: a REUSED driver restored to state X via
// (restore_state + resetSession) produces the IDENTICAL observable signature as a
// FRESH driver restored to X, regardless of what the reused driver did before.
// This is the invariant the prompts-state-leak violated (a death in one branch
// left $AwaitingRevive active for every sibling). Remove resetSession and this
// fails loudly.
import { file, ok } from "./_harness";
import { StateSpace, captureCanonicalMilestones } from "./_modelcheck";
import type { CcaDriver } from "../driver";

file("test_cca_bfs_restore_property");

const TEST_MILESTONES = ["LampLit", "SnakeGone", "BearReleased"];

// Observable signature: everything that affects how BFS expands from this state.
function signature(d: CcaDriver): string {
  const keys = d
    .listActionsHere()
    .filter((a) => a.kind !== "wild")
    .map((a) => a.key)
    .sort();
  return `r=${d.machine().player_room()}|p=${d.machine().player.get_state()}|prompt=${d.promptMachine().is_active()}/${d.promptMachine().current_prompt()}|actions=${keys.join(",")}`;
}

function freshSignature(ss: StateSpace, bytes: string): string {
  const d = ss.prepareDriver();
  d.machine().restore_state(bytes);
  d.resetSession();
  return signature(d);
}

// Reused: restore to dirtyBytes, kill the player (would leak a revive prompt
// under the raw restore path), then restore to targetBytes via the harness path.
function reusedSignature(ss: StateSpace, dirtyBytes: string, targetBytes: string): string {
  const d = ss.prepareDriver();
  d.machine().restore_state(dirtyBytes);
  d.resetSession();
  d.machine().player.die();
  d.promptMachine().offer_revive();
  d.machine().restore_state(targetBytes);
  d.resetSession();
  return signature(d);
}

const registry = captureCanonicalMilestones();
const ss = new StateSpace();
ss.seed = 42;

for (const a of TEST_MILESTONES) {
  if (!registry.has("canonical_journey", a)) continue;
  const bytesA = registry.get_snapshot("canonical_journey", a);
  const sigFresh = freshSignature(ss, bytesA);
  for (const b of TEST_MILESTONES) {
    if (b === a || !registry.has("canonical_journey", b)) continue;
    const bytesB = registry.get_snapshot("canonical_journey", b);
    const sigReused = reusedSignature(ss, bytesB, bytesA);
    ok(`restore(${a}) after dirtying via ${b} — signatures match`, sigFresh === sigReused);
  }
}
