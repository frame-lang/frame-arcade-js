// Port of Godot tests/test_cca_stochastic_probe_dwarf.gd — the DWARF's axe throw
// (canon advent.for STMT 6090ish): a stalking dwarf throws with hit rate
// 95*(DFLAG-2)/10 %, rolled on the Dwarf FSM's own (seed, attack_step) LCG
// (Dwarf.try_throw_axe), separate from the player-attacks-dwarf stream. Probed at
// anger 10 (canon "fully angry" → 76% hit). Per trial: a fresh Dwarf seeded to
// the trial seed, woken to $Stalking, one try_throw_axe(10). Over seeds 1..50 the
// golden tally is {hit(1): 39, miss(0): 11} — Godot's exact counts; 78% ≈ 76%.
import { file, expect, ok } from "./_harness";
import { StochasticProbe } from "./_probe";
import { Dwarf } from "../npcs.machine.js";

file("test_cca_stochastic_probe_dwarf");

const ANGER = 10;
const GOLDEN: Record<number, number> = { 1: 39, 0: 11 }; // 1 = hit, 0 = miss

const probe = new StochasticProbe(1, 50);
while (!probe.is_done()) {
  const seed = probe.next_seed();
  const dw = Dwarf._create(seed);
  dw.wake_up(20); // Hidden -> Stalking
  const hit = dw.get_state() === "stalking" && dw.try_throw_axe(ANGER);
  probe.record(hit ? 1 : 0);
}

for (const branch of Object.keys(GOLDEN).map(Number)) {
  ok(`outcome ${branch} occurred`, probe.count(branch) > 0);
}
for (const branch of Object.keys(GOLDEN).map(Number)) {
  expect(`count(${branch})`, probe.count(branch), GOLDEN[branch]);
}
expect("distinct outcomes", probe.distinct_outcomes(), Object.keys(GOLDEN).length);
expect("trials done", probe.trials_done(), 50);
