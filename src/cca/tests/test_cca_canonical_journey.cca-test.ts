// Port of Godot tests/test_cca_canonical_journey.gd — FSM-driven canonical
// happy-path, asserted per-milestone through the REAL driver (parser →
// dispatch → per-turn tick → log). Catches player-visible bugs the FSM-direct
// tests can't see (an item missing from a room description, a Y/N prompt firing
// early, etc.).
//
// The journey is the data in journeys.ts (CANONICAL_JOURNEY), the faithful port
// of canonical_journey.gd. Each milestone declares commands_from_previous,
// expected_room, expected_in_log, expected_not_in_log; runJourney walks it (with
// the two FSM-shortcut milestones — TreasuresFilled / InRepository) and records
// the per-milestone room + log so we can diff exactly as the Godot harness does.
//
// Setup mirrors the Godot harness: dwarves dormant (dwarves_auto_woken), lamp
// pre-lit via makeDriver(), initial room primed for the AtRoad log assertion.
// Seed 42 baseline (the canonical journey routes around probabilistic hazards).
import { file, expect, ok, makeDriver } from "./_harness";
import { CANONICAL_JOURNEY, runJourney } from "./journeys";

file("test_cca_canonical_journey");

const d = makeDriver();
const results = runJourney(d, CANONICAL_JOURNEY, { reseed: 42 });

// Per-milestone assertions: room, must-appear substrings, must-not-appear.
for (const r of results) {
  const m = r.milestone;
  const joined = r.log.join("\n");

  if (m.expectedRoom >= 0) {
    expect(`[${m.name}] player_room`, r.room, m.expectedRoom);
  }
  for (const needle of m.expectedInLog) {
    ok(`[${m.name}] log contains "${needle}"`, joined.includes(needle));
  }
  for (const needle of m.expectedNotInLog) {
    ok(`[${m.name}] log absent "${needle}"`, !joined.includes(needle));
  }
}

// Endgame outcome: the canonical journey ends in a real BLAST → $Won.
// NOTE: the canonical rail deposits only chain + gold by REAL play (2 in the
// Treasure-FSM count, treasures_deposited()); the cave-closing is armed by the
// TreasuresFilled FSM-shortcut, which bumps the SEPARATE Endgame trigger
// counter (endgame.treasure_deposited() ×13 past TREASURES_TO_TRIGGER=10) — it
// does NOT mark the other 13 Treasure FSMs deposited. So treasures_deposited()
// is 2 here, not 15. We assert the organic 2 + the endgame outcome, matching
// what the Godot canonical test verifies (per-milestone + reaching $Won).
const a = d.machine();
expect("canonical journey reaches endgame won", a.endgame_state(), "won");
expect("chain + gold deposited by real play", a.treasures_deposited(), 2);
