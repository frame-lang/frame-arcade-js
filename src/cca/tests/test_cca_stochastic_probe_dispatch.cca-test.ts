// Port of Godot tests/test_cca_stochastic_probe_dispatch.gd — a THREE-way Chance
// gate: the unknown-verb message mix (canon STMT 3000). The parser routes the
// rolls through Chance (driver dispatchToFsm):
//   decide("dispatch_13", 20)      → msg #13 "I don't understand that!"
//   elif decide("dispatch_61", 20) → msg #61 "What?"
//   else                           → msg #60 "I don't know that word."
// Net 20 / 16 / 64 %. Per trial: fresh driver, reseed Chance, type an unknown
// word, classify the rebuke. Over seeds 1..50 the golden tally is
// {13: 11, 61: 7, 60: 32} — Godot's exact counts.
import { file, expect, ok, makeDriver } from "./_harness";
import { StochasticProbe } from "./_probe";

file("test_cca_stochastic_probe_dispatch");

const GOLDEN: Record<number, number> = { 13: 11, 61: 7, 60: 32 };

function classify(lines: string[]): number {
  const j = lines.join("\n").toLowerCase();
  if (j.includes("i don't understand that")) return 13;
  if (j.includes("what?")) return 61;
  if (j.includes("i don't know that word")) return 60;
  return -1;
}

const probe = new StochasticProbe(1, 50);
while (!probe.is_done()) {
  const seed = probe.next_seed();
  const d = makeDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().chance.reseed(seed);
  probe.record(classify(d.input("flooble"))); // unknown verb → STMT 3000 mix
}

for (const branch of Object.keys(GOLDEN).map(Number)) {
  ok(`msg #${branch} occurred`, probe.count(branch) > 0);
}
for (const branch of Object.keys(GOLDEN).map(Number)) {
  expect(`count(${branch})`, probe.count(branch), GOLDEN[branch]);
}
expect("distinct outcomes", probe.distinct_outcomes(), Object.keys(GOLDEN).length);
expect("trials done", probe.trials_done(), 50);
