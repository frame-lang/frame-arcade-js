// Port of Godot tests/test_cca_stochastic_probe_pirate.gd — the PIRATE's steal
// roll, a 25% gate on the Pirate FSM's own (seed, step) LCG (Pirate.try_steal),
// a different random subsystem than the Chance-system travel gates. Per trial: a
// fresh Pirate seeded to the trial seed, activated to $Stalking (treasures_carried
// >= threshold), one try_steal(). Outcome 1 = stole (→ $Vanished), 0 = no. Over
// seeds 1..50 the golden tally is {stole(1): 12, no(0): 38} — Godot's exact
// counts; 24% ≈ canon 25%.
import { file, expect, ok } from "./_harness";
import { StochasticProbe } from "./_probe";
import { Pirate } from "../npcs.machine.js";

file("test_cca_stochastic_probe_pirate");

const GOLDEN: Record<number, number> = { 1: 12, 0: 38 }; // 1 = stole, 0 = no steal

const probe = new StochasticProbe(1, 50);
while (!probe.is_done()) {
  const seed = probe.next_seed();
  const p = Pirate._create(seed);
  p.treasures_carried(3); // Dormant -> Stalking
  const stole = p.get_state() === "stalking" && p.try_steal();
  probe.record(stole ? 1 : 0);
}

for (const branch of Object.keys(GOLDEN).map(Number)) {
  ok(`branch ${branch} occurred`, probe.count(branch) > 0);
}
for (const branch of Object.keys(GOLDEN).map(Number)) {
  expect(`count(${branch})`, probe.count(branch), GOLDEN[branch]);
}
expect("distinct outcomes", probe.distinct_outcomes(), Object.keys(GOLDEN).length);
expect("trials done", probe.trials_done(), 50);
