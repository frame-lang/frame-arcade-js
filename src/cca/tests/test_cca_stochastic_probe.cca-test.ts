// Port of Godot tests/test_cca_stochastic_probe.gd — verifies a RANDOMIZED
// section is canon-faithful. Where the win/death rails pin a probabilistic gate
// to one outcome (chance.force), this drives the gate across a fixed seed set
// and checks the spread.
//
// Gate under test: canon 65:north (Bedquilt). Its section-3 chain is
//   `60% bounce-back to 65 / 75% of the rest → 72 / else → 71`
// (topology.ts GATES "65:north"), so there are exactly three canonical
// outcomes {65, 72, 71}. The probe restores the same Bedquilt start for every
// trial and varies only the Chance seed, sampling the gate's distribution.
// Asserts branch coverage (all three occur) AND the golden exact counts over
// seeds 1..50: {65: 29, 72: 17, 71: 4} — the same tally Godot produces, which
// is what proves the JS Chance LCG reproduces Godot's rolls bit-for-bit.
import { file, expect, ok, makeDriver } from "./_harness";
import { WIN_JOURNEY } from "./journeys";
import { StochasticProbe } from "./_probe";

file("test_cca_stochastic_probe");

// Golden tally over seeds 1..50 (see header).
const GOLDEN: Record<number, number> = { 65: 29, 72: 17, 71: 4 };

// Build the Bedquilt (canon 65) start state once: walk the win journey to the
// BridgeBuilt checkpoint, then step into Bedquilt — exactly as the Godot test.
const build = makeDriver();
build.machine().dwarves_auto_woken = true;
build.machine().chance.reseed(42);
let bridge = "";
for (const m of WIN_JOURNEY) {
  for (const s of m.steps) if ("cmd" in s) build.input(s.cmd.toLowerCase());
  if (m.name === "BridgeBuilt") {
    bridge = build.machine().save_state();
    break;
  }
}

const setup = makeDriver();
setup.machine().dwarves_auto_woken = true;
setup.machine().restore_state(bridge);
for (const cmd of ["east", "north", "north", "down", "bedquilt"]) setup.input(cmd);
expect("setup reached Bedquilt (canon 65)", setup.machine().player_room(), 65);
const at65 = setup.machine().save_state();

// Run the probe loop: one trial per dispensed seed.
const probe = new StochasticProbe(1, 50);
while (!probe.is_done()) {
  const seed = probe.next_seed();
  const t = makeDriver();
  t.machine().dwarves_auto_woken = true;
  t.machine().restore_state(at65);
  t.machine().chance.reseed(seed); // vary only the roll
  t.input("north");
  probe.record(t.machine().player_room());
}

// Branch coverage: every canonical outcome occurs at least once.
for (const branch of Object.keys(GOLDEN).map(Number)) {
  ok(`branch ${branch} occurred`, probe.count(branch) > 0);
}
// Golden exact counts — locks determinism + LCG faithfulness.
for (const branch of Object.keys(GOLDEN).map(Number)) {
  expect(`count(${branch})`, probe.count(branch), GOLDEN[branch]);
}
expect("distinct outcomes", probe.distinct_outcomes(), Object.keys(GOLDEN).length);
expect("trials done", probe.trials_done(), 50);
