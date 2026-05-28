// Port of Godot tests/test_cca_hints.gd — Hint system (parallel parameterized
// x3), FSM-direct. Same assertions, same expected values.
//   - bird/cave/snake start $Pending, streak 0.
//   - Hints advance independently (observing the bird-room condition doesn't
//     touch the cave-entry hint's streak).
//   - Streak resets when condition becomes false.
//   - Threshold crossing transitions $Pending -> $Eligible.
//   - request_hint() in $Eligible returns the hint text -> $Offered (terminal).
//   - request_hint() in $Pending/$Offered returns the canned message.
//   - @@[persist] preserves each hint's state + streak independently.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_hints");

const adv = makeAdventure();
adv.setup_default_aspects();
adv.light_lamp(); // avoid darkness gate side effects on do_command

// Initial state — all three pending:
expect("bird_hint state", adv.hint_state("bird"), "pending");
expect("cave_hint state", adv.hint_state("cave"), "pending");
expect("snake_hint state", adv.hint_state("snake"), "pending");
expect("bird_hint streak", adv.bird_hint.get_streak(), 0);

// Player in bird room (13) for 5 turns — bird_hint becomes eligible.
// Canon advent.dat section-11 threshold for bird = 5 turns.
adv.player.move_to(13);
for (let i = 0; i < 5; i++) {
  adv.do_command("look", ""); // tick fires (driver pattern: do_command then tick)
  adv.tick();
}
expect("bird_hint streak", adv.bird_hint.get_streak(), 5);
expect("bird_hint state", adv.hint_state("bird"), "eligible");
// Other hints unaffected — they observe their own conditions
expect("cave_hint state", adv.hint_state("cave"), "pending");
expect("snake_hint state", adv.hint_state("snake"), "pending");

// Request the bird hint:
const r1 = adv.request_hint("bird");
expect("bird hint message", r1.includes("bird"), true);
expect("bird_hint now offered", adv.hint_state("bird"), "offered");
expect("cave_hint untouched", adv.hint_state("cave"), "pending");

// Re-request bird hint — already given:
const r2 = adv.request_hint("bird");
// Canon: hint already given emits msg #54 "OK".
expect("already given", r2.includes("OK"), true);

// Streak resets when condition becomes false:
adv.player.move_to(1); // leave bird room (end of road)
adv.tick(); // bird condition now false
adv.player.move_to(13); // back to bird room
adv.tick();
// Bird is still free at room 13 because we never took it. cave_hint observes
// player on the surface (rooms 1-9); after move_to(13) it sees the player
// off-surface, so the streak resets to 0.
expect("cave_hint state", adv.hint_state("cave"), "pending");
expect("cave_hint streak (off-surface)", adv.cave_hint.get_streak(), 0);

// Request hint that's not eligible:
const r3 = adv.request_hint("snake");
// Canon: hint not eligible emits msg #54 "OK".
expect("not eligible", r3.includes("OK"), true);

// Save mid-streak, mutate, restore:
// Canon snake threshold = 8. Save at streak 7 (one short), mutate post-save
// tick -> 8 = eligible, restore -> still at 7, replay tick -> eligible.
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.player.move_to(19); // snake room (canon 19 — Hall of Mt King)
// snake_hint observes (room == SNAKE_ROOM and snake.is_blocking())
for (let i = 0; i < 7; i++) adv2.tick();
expect("snake_hint streak", adv2.snake_hint.get_streak(), 7);
expect("snake_hint state", adv2.hint_state("snake"), "pending");

const bytes = adv2.save_state();

// Mutate post-save — push snake_hint to eligible at streak 8
adv2.tick();
expect("post-save eligible", adv2.hint_state("snake"), "eligible");

const adv3 = makeAdventure();
adv3.restore_state(bytes);
expect("restored state", adv3.hint_state("snake"), "pending");
expect("restored streak", adv3.snake_hint.get_streak(), 7);

// Replay the same tick — same outcome
adv3.tick();
expect("replay → eligible", adv3.hint_state("snake"), "eligible");
