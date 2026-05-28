// Port of Godot tests/test_cca_npc_spec.gd — Phase C Layer 3 canon-fidelity
// check for NPC INITIAL STATES. Builds a fresh Cca FSM (makeAdventure +
// setup_default_aspects) and asserts every spec'd NPC starts in its
// canon-declared state. Dwarves are intentionally NOT woken — their wake
// transitions to Stalking, and the NPC spec describes the pre-wake initial.
// The pirate stays at its own pre-activation state. Companion to
// test_cca_world_spec (item placements): the smallest possible canon-fidelity
// check is "a fresh world before any commands matches canon."
//
// NOTE ON THE SPEC TABLE: the Godot test reads world_spec.gd's NPC_SPEC and
// calls WorldSpec.check_initial_npc_states(fsm). There is no world_spec module
// in the JS port, so we inline the canon NPC_SPEC rows (name → initial_state)
// VERBATIM from world_spec.gd and reimplement observed_npc_state() — including
// the canon dragon collapse: world_spec maps every pre-death dragon state to
// the single label "alive" (canon Dragon has Sleeping/Dying/Dead; only "dead"
// is reported distinctly). Same data, same logic, same expected result: zero
// violations.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_npc_spec");

// Inlined VERBATIM from world_spec.gd NPC_SPEC (name → canon initial_state),
// in GDScript Dictionary order.
const NPC_SPEC: Record<string, string> = {
  bird: "free",
  snake: "blocking",
  bear: "hungry",
  troll: "demanding",
  dragon: "alive",
  pirate: "dormant",
  plant: "tiny",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fsm = any;

// Reimplements world_spec.gd observed_npc_state(). Each NPC FSM exposes
// get_state() returning a String. Dragon's "alive" is a synthesised label:
// canon maps the pre-Dying states to "alive" for spec comparison.
function observedNpcState(fsm: Fsm, name: string): string {
  switch (name) {
    case "bird": return fsm.bird.get_state();
    case "snake": return fsm.snake.get_state();
    case "bear": return fsm.bear.get_state();
    case "troll": return fsm.troll.get_state();
    case "dragon": {
      const s: string = fsm.dragon.get_state();
      return s === "dead" ? "dead" : "alive";
    }
    case "pirate": return fsm.pirate.get_state();
    case "plant": return fsm.plant.get_state();
  }
  return "";
}

console.log("=== CCA NPC-spec init check (Phase C Layer 3) ===");
console.log("");

const fsm = makeAdventure();
fsm.setup_default_aspects();
// Dwarves intentionally NOT woken — the spec describes the pre-wake initial.

interface Violation {
  npc: string;
  expected: string;
  observed: string;
}
const violations: Violation[] = [];
for (const name of Object.keys(NPC_SPEC)) {
  const expected = NPC_SPEC[name];
  const observed = observedNpcState(fsm, name);
  if (observed !== expected) {
    violations.push({ npc: name, expected, observed });
  }
}

console.log(`NPCs checked:    ${Object.keys(NPC_SPEC).length}`);
console.log(`Init violations: ${violations.length}`);
console.log("");
for (const v of violations) {
  console.log(`  ${v.npc}: expected state '${v.expected}', observed '${v.observed}'`);
}
if (violations.length === 0) {
  console.log("PASS — every spec'd NPC is in its canon-declared state");
}

expect("init violations (fresh world matches canon)", violations.length, 0);
