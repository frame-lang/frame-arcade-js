// Faithful TS port of Godot scripts/stochastic_probe.gd (frame/stochastic_probe.fgd).
//
// A domain-agnostic seed dispenser + outcome tally. The success/death rails
// SUPPRESS randomness (chance.force pins a gate to one outcome); this does the
// opposite — it EXERCISES a probabilistic gate across a fixed, contiguous seed
// set [seedBase, seedBase+seedCount) and tallies which canonical branch each
// trial took. The runner restores the gate's start state, reseeds Chance to the
// dispensed seed, fires the gated command, and feeds the outcome back via
// record(). Deterministic because Chance is a pure function of (seed, step),
// so reseeding per trial samples the distribution without wall-clock entropy.
export class StochasticProbe {
  private trial = 0;
  private recorded = 0;
  private tally = new Map<number, number>();

  constructor(
    private readonly seedBase = 1,
    private readonly seedCount = 50,
  ) {}

  /** Dispense the next trial's seed (advances the counter). */
  next_seed(): number {
    const s = this.seedBase + this.trial;
    this.trial += 1;
    return s;
  }

  /** Record the outcome the runner observed for the dispensed seed. */
  record(outcome: number): void {
    this.tally.set(outcome, (this.tally.get(outcome) ?? 0) + 1);
    this.recorded += 1;
  }

  /** Deterministic exit: every seed in the set has been dispensed. */
  is_done(): boolean {
    return this.trial >= this.seedCount;
  }

  /** Tally queries — the verdict the test asserts against. */
  count(outcome: number): number {
    return this.tally.get(outcome) ?? 0;
  }
  distinct_outcomes(): number {
    return this.tally.size;
  }
  trials_done(): number {
    return this.recorded;
  }
}
