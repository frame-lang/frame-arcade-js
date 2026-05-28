// Port of Godot tests/test_cca_state_exploration.gd — state-space exploration of
// CCA's smaller @@systems via StateExplorer (save/restore teleport BFS of the
// (state, event) graph). Catches reachable-but-no-way-out states, documented
// states the generated code never enters, and transitions that land in
// unexpected states. Validates each FSM's discovered-state set + dead-ends
// against its expected canonical shape.
import { file, ok } from "./_harness";
import { exploreStates, type ExploreReport } from "./_modelcheck";
import { Bear } from "../npcs.machine.js";
import { Lamp, Plant, CrystalBridge, Grate, VendingMachine } from "../puzzles.machine.js";

file("test_cca_state_exploration");

function sortedEq(a: string[], b: string[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function validate(report: ExploreReport, label: string, expectedStates: string[], expectedDeadEnds: string[]): void {
  const problems: string[] = [];
  if (!report.states.includes(report.initial)) problems.push(`initial ${report.initial} not in states`);
  for (const t of report.transitions) {
    if (!report.states.includes(t.to)) problems.push(`transition ${t.from} -> ${t.to} targets unknown state`);
  }
  if (!sortedEq(report.states, expectedStates)) {
    problems.push(`states mismatch: got ${JSON.stringify([...report.states].sort())}, expected ${JSON.stringify([...expectedStates].sort())}`);
  }
  if (!sortedEq(report.dead_ends, expectedDeadEnds)) {
    problems.push(`dead-ends mismatch: got ${JSON.stringify([...report.dead_ends].sort())}, expected ${JSON.stringify([...expectedDeadEnds].sort())}`);
  }
  ok(`${label} structural checks${problems.length ? " — " + problems.join("; ") : ""}`, problems.length === 0);
}

validate(
  exploreStates(() => Bear._create(), [["feed", []], ["take_chain", []], ["drop_chain", []]]),
  "Bear", ["hungry", "tame", "following", "released", "attacking"], ["attacking", "released"],
);
// Lamp lifecycle subset (Dim/Out are battery-drain-driven; test_cca_lamp covers those).
validate(
  exploreStates(() => Lamp._create(), [["light", []], ["extinguish", []], ["refresh", []]]),
  "Lamp", ["off", "bright"], [],
);
validate(
  exploreStates(() => Plant._create(), [["water", []]]),
  "Plant", ["tiny", "tall", "huge"], [],
);
validate(
  exploreStates(() => CrystalBridge._create(), [["wave", []]]),
  "CrystalBridge", ["no_bridge", "built"], [],
);
validate(
  exploreStates(() => Grate._create(), [["unlock", [false]], ["unlock", [true]], ["lock", []]]),
  "Grate", ["locked", "unlocked"], [],
);
validate(
  exploreStates(() => VendingMachine._create(), [["insert", [false]], ["insert", [true]]]),
  "VendingMachine", ["loaded", "empty"], ["empty"],
);
