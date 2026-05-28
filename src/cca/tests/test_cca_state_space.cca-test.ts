// Port of Godot tests/test_cca_state_space.gd — single-sweep canonical-start BFS
// over the reachable state graph. Every visited state is player-reachable (arrived
// at via driver.input from the canonical start). Opts into the save/restore
// round-trip soundness check. PASS = no invariant violations across all reachable
// states. SLOW (cap 10000) — runs in the slow bucket, not the fast suite.
import { file, ok } from "./_harness";
import { StateSpace } from "./_modelcheck";

file("test_cca_state_space");

const s = new StateSpace();
s.seed = 42;
s.checkSaveRestore = true;
s.max_states = 10000;
s.run();

ok(
  `canonical-start BFS clean (${s.states_visited} states, ${s.distinctRooms()} rooms, ${s.violations.length} violations${s.hit_cap ? ", hit cap" : ""})`,
  s.violations.length === 0,
);
