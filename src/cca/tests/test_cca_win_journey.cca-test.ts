// Port of Godot tests/test_cca_win_journey.gd — proves a fully ORGANIC win:
// walk the WIN_JOURNEY rail through the REAL driver with typed commands only
// (no treasure_deposited()/tick() pokes, no save_state surgery) and assert the
// game reaches $Won via a real BLAST.
//
// This is the rail the canonical journey never was: it collects and deposits
// TEN treasures by playing (rug, gold, silver, jewelry, coins, diamonds, vase,
// pyramid, pearl, and the pirate's chest), lets the 10th deposit arm the
// cave-closing naturally, rides the timer to the Repository (30 LOOK turns),
// and blasts. The emerald is deliberately let go — the pirate (fixed internal
// seed 99) steals it mid-trip, spawning the chest at canon 18.
//
// Determinism mirrors the Godot runner: dwarves dormant (dwarves_auto_woken)
// and the model RNG reseeded to 42 (chance.reseed). The Godot test also pinned
// its driver `rng.seed = 42`, but the JS CcaDriver has no separate RNG — every
// roll routes through the model `chance` we reseed here; the pirate runs on its
// own baked seed-99 LCG either way.
import { file, expect, ok, makeDriver } from "./_harness";
import { WIN_JOURNEY, runJourney } from "./journeys";

file("test_cca_win_journey");

const d = makeDriver();
const results = runJourney(d, WIN_JOURNEY, { reseed: 42 });

// Per-milestone room assertions (the WIN_JOURNEY rail declares expected_room()
// for each state — every banked-treasure milestone returns to the well house, 3).
for (const r of results) {
  if (r.milestone.expectedRoom >= 0) {
    expect(`[${r.name}] player_room`, r.room, r.milestone.expectedRoom);
  }
}

const a = d.machine();
const won: boolean = a.endgame_state() === "won";
const deposited: number = a.treasures_deposited();

// The two headline assertions from the Godot test: organic win + 10 treasures.
ok("organic typed-command playthrough reaches $Won", won);
ok(`ten treasures deposited by real play (got ${deposited})`, deposited >= 10);

// Milestone-shape assertions that localize the organic mechanics:
//   - EmeraldStolen: the pirate (seed 99) took the emerald, so it is NOT
//     deposited and NOT carried — and the chest it spawned is recoverable.
expect("emerald let go (not deposited)", a.emerald.is_deposited(), false);
expect("chest recovered and deposited (10th treasure)", a.chest.is_deposited(), true);
// Reaching the Repository organically before the BLAST.
expect("won via the repository (endgame state)", a.endgame_state(), "won");
