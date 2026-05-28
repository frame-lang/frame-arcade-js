// Port of Godot tests/test_cca_hint_thresholds.gd — hint-eligibility threshold
// canon-fidelity check, FSM-direct. Same assertions, same expected values.
//
// Locks the hint-eligibility thresholds at canon advent.dat section-11 values.
// Each hint becomes eligible after N consecutive observe(true) calls, where N
// is the Hint's _create(N) threshold (cave=4, bird=5, snake=8, maze=75,
// plover=25, witts=20 — verifiable in cca/canon/advent.dat:1758-1768).
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_hint_thresholds");

// Canon advent.dat section 11 thresholds (column 2 = "turns to trigger").
// Preserve GDScript Dictionary key order: cave, bird, snake, maze, plover, witts.
const CANON_THRESHOLDS: [string, number][] = [
  ["cave", 4],
  ["bird", 5],
  ["snake", 8],
  ["maze", 75],
  ["plover", 25],
  ["witts", 20],
];

for (const [name, threshold] of CANON_THRESHOLDS) {
  testHintThreshold(name, threshold);
}

function testHintThreshold(name: string, threshold: number): void {
  const fsm = makeAdventure();
  fsm.setup_default_aspects();
  const hint = hintInstance(fsm, name);
  if (hint == null) {
    expect(`${name} hint resolvable`, false, true);
    return;
  }
  // Initially not eligible.
  expect(`${name}: pre-observe not eligible`, hint.is_eligible(), false);
  // threshold-1 observations: still not eligible.
  for (let i = 0; i < threshold - 1; i++) hint.observe(true);
  expect(`${name}: after ${threshold - 1} observes still not eligible`, hint.is_eligible(), false);
  // One more: now eligible.
  hint.observe(true);
  expect(`${name}: after ${threshold} observes eligible`, hint.is_eligible(), true);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hintInstance(fsm: any, name: string): any {
  switch (name) {
    case "cave":
      return fsm.cave_hint;
    case "bird":
      return fsm.bird_hint;
    case "snake":
      return fsm.snake_hint;
    case "maze":
      return fsm.maze_hint;
    case "plover":
      return fsm.plover_hint;
    case "witts":
      return fsm.witts_hint;
  }
  return null;
}
