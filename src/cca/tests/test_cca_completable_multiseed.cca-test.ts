// Port of Godot tests/test_cca_completable_multiseed.gd — completability under
// an RNG seed sweep. The canonical winning command sequence must reach $Won
// under EVERY seed, not just the lucky ones. Each seed gives a different
// probabilistic realization (dispatch prose mix, dark-pit rolls, travel gates,
// pirate_rustle); the pirate keeps its baked internal seed (99), so its
// stalk/steal walk is identical across seeds (stronger determinism than Godot,
// where the driver RNG also drove pirate movement — in JS the pirate has its
// own seeded LCG, distinct from the model `chance` we reseed here).
//
// Setup mirrors Godot _make_driver(seed): fresh driver, dwarves dormant
// (dwarves_auto_woken), chance.reseed(seed). Then walk the canonical journey
// (with its FSM-shortcut milestones) and assert endgame_state() == "won".
import { file, expect, makeDriver } from "./_harness";
import { CANONICAL_JOURNEY, runJourney } from "./journeys";

file("test_cca_completable_multiseed");

// 42 is the known-good baseline; the rest sample distinct probabilistic
// realizations (same set as the Godot test).
const SEEDS = [42, 99, 1234, 7777, 31415, 27182, 8675309];

for (const seed of SEEDS) {
  // makeDriver() = lamp pre-lit, dwarves dormant (start() NOT called). runJourney
  // additionally sets dwarves_auto_woken = true and chance.reseed(seed).
  const d = makeDriver();
  const results = runJourney(d, CANONICAL_JOURNEY, { reseed: seed });

  const a = d.machine();
  const es: string = a.endgame_state();
  // Primary assertion: the canonical journey reaches $Won under this seed.
  expect(`seed ${seed} -> endgame won`, es, "won");

  // Diagnostics on failure — localize the derail the way the Godot test prints
  // player/pirate/room (plain log, not an assertion, mirroring its print()).
  if (es !== "won") {
    const last = results[results.length - 1];
    console.log(
      `        seed ${seed} derail: last=${last?.name ?? "(none)"} player @ ${a.player_room()} ` +
        `pirate=${a.pirate_state()} deposited=${a.treasures_deposited()} endgame=${es}`,
    );
  }
}
