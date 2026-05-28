// Port of Godot tests/test_cca_score_system.gd — Phase C score-system canon
// audit, FSM-direct. Same assertions, same expected values.
//
// Two of CCA's five score components are audited here (treasures has its own
// test; endgame needs the $InRepository integration setup and is deferred):
//   visit score — +1 per distinct room first-visited (fires inside tick()).
//   hint costs  — negative; per-hint canon cost (advent.dat section 11).
//
// IMPORTANT: this audit calls adv.score() (= real_score, the full breakdown),
// NOT total_score() (treasures-only).
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_score_system");

// --- Visit score ---
// Each canon room first-visit awards +1 point. Visit bookkeeping fires inside
// the FSM's tick handler — we tick after moving.
{
  const fsm = makeAdventure();
  fsm.setup_default_aspects();
  fsm.tick(); // initial visit to canon-start
  const s0: number = fsm.score();
  fsm.player.move_to(2);
  fsm.tick();
  const s1: number = fsm.score();
  fsm.player.move_to(4);
  fsm.tick();
  const s2: number = fsm.score();
  fsm.player.move_to(2); // re-visit
  fsm.tick();
  const s3: number = fsm.score();
  expect("first move to 2: +1", s1 - s0, 1);
  expect("second move to 4: +1", s2 - s1, 1);
  expect("revisit to 2: 0", s3 - s2, 0);
}

// --- Hint costs (canon advent.dat section 11) ---
// Per-hint penalty when accepted. Force the hint into the eligible state by
// pushing observe() past every canon threshold (max is 75 for maze), then
// request it and assert the score-delta equals the canon cost.
{
  // Preserve GDScript Dictionary key order: cave, bird, snake, maze, plover, witts.
  const expectations: [string, number][] = [
    ["cave", 2],
    ["bird", 2],
    ["snake", 2],
    ["maze", 4],
    ["plover", 5],
    ["witts", 3],
  ];
  for (const [name, cost] of expectations) {
    const fsm = makeAdventure();
    fsm.setup_default_aspects();
    // Force the hint into the eligible state. Canon thresholds: cave=4, bird=5,
    // snake=8, maze=75, plover=25, witts=20. Loop to 80 to cover the max.
    const hint = hintInstance(fsm, name);
    if (hint == null) {
      expect(`${name} hint resolvable`, false, true);
      continue;
    }
    for (let i = 0; i < 80; i++) hint.observe(true);
    const s_before: number = fsm.score();
    fsm.request_hint(name);
    const delta: number = fsm.score() - s_before;
    expect(`${name} hint cost (canon ${cost})`, -delta, cost);
  }
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
