// Port of Godot tests/test_cca_endgame.gd — Endgame phase machine, FSM-direct
// (mirrors `Cca.new()` + setup_default_aspects()). Same assertions, same
// expected values, same order. Verifies:
//   - Initial $Active; treasure_deposited counts up.
//   - Crossing TREASURES_TO_TRIGGER (10) transitions $Active → $Closing.
//   - $Closing seeds the timer to CLOSING_DURATION (30) on entry; tick()
//     decrements; reaching 0 transitions to $InRepository.
//   - detonate() in $InRepository → $Won; outside the repository is a no-op.
//   - save/restore round-trips the phase + the closing timer.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_endgame");

const adv = makeAdventure();
adv.setup_default_aspects();

// Initial — $Active:
expect("endgame state", adv.endgame_state(), "active");
expect("not closing", adv.endgame_closing(), false);
expect("not won", adv.endgame_won(), false);
expect("treasures", adv.endgame.treasures_count(), 0);

// Detonate during $Active is a no-op:
adv.detonate_marker();
expect("still active", adv.endgame_state(), "active");

// Deposit 9 treasures — still active (threshold is 10):
for (let i = 0; i < 9; i++) adv.deposit_treasure();
expect("treasures", adv.endgame.treasures_count(), 9);
expect("still active", adv.endgame_state(), "active");

// Deposit 10th treasure — crosses threshold to $Closing:
adv.deposit_treasure();
expect("endgame state", adv.endgame_state(), "closing");
expect("closing flag", adv.endgame_closing(), true);
expect("timer seeded", adv.endgame_timer(), 30);
expect("treasures", adv.endgame.treasures_count(), 10);

// Tick 15 times — timer decrements, still closing:
for (let i = 0; i < 15; i++) adv.tick();
expect("endgame state", adv.endgame_state(), "closing");
expect("timer ≈ 15", adv.endgame_timer(), 15);

// Tick 15 more times — closing timer hits 0, transitions to $InRepository:
for (let i = 0; i < 15; i++) adv.tick();
expect("endgame state", adv.endgame_state(), "in_repository");
expect("not closing", adv.endgame_closing(), false);
expect("not won", adv.endgame_won(), false);

// Detonate in repository → $Won:
adv.detonate_marker();
expect("endgame state", adv.endgame_state(), "won");
expect("won flag", adv.endgame_won(), true);

// ---------------------------------------------------------
// Persistence: save mid-$Closing, mutate, restore
// ---------------------------------------------------------
const adv2 = makeAdventure();
adv2.setup_default_aspects();
for (let i = 0; i < 10; i++) adv2.deposit_treasure();
expect("entered closing", adv2.endgame_state(), "closing");
for (let i = 0; i < 23; i++) adv2.tick();
expect("timer ≈ 7", adv2.endgame_timer(), 7);

const bytes = adv2.save_state();

// Mutate after save
for (let i = 0; i < 7; i++) adv2.tick();
expect("post-save state", adv2.endgame_state(), "in_repository");

const adv3 = makeAdventure();
adv3.restore_state(bytes);
expect("restored state", adv3.endgame_state(), "closing");
expect("restored timer", adv3.endgame_timer(), 7);
expect("restored treasures", adv3.endgame.treasures_count(), 10);

// Replay forward from save
for (let i = 0; i < 7; i++) adv3.tick();
expect("replay reaches repo", adv3.endgame_state(), "in_repository");
