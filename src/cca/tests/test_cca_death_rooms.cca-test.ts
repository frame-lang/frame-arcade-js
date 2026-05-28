// Port of Godot tests/test_cca_death_rooms.gd — canon death-message room
// handling, FSM-direct (mirrors `Cca.new()` + setup_default_aspects()). Anything
// that routes the player to canon 20 ("bottom of the pit with a broken neck")
// or canon 21 ("you didn't make it") fires player.die() with the matching canon
// prose. Driven via the real do_command("move", "20"/"21") so the FSM's
// _verb_move post-move check is the thing under test. Same assertions, same
// expected values, same order.
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_death_rooms");

function expectContains(label: string, haystack: string, needle: string): void {
  ok(`${label} contains '${needle}'`, haystack.includes(needle));
}

// All three port routes that canonically land on room 20 → JUMP → canon 20.
function routeJumpTo20(_label: string, fromRoom: number): void {
  const adv = makeAdventure();
  adv.setup_default_aspects();
  adv.player.move_to(fromRoom);
  expect("at start room", adv.player_room(), fromRoom);
  expect("alive at start", adv.player_state(), "alive");
  const resp: string = adv.do_command("move", "20");
  expect("player died", adv.player_state(), "dead");
  expectContains("response is broken-bones msg", resp, "broke every bone");
}

// Defensive — no port exit currently goes to 21, but the handler is symmetric.
function routeTo21(): void {
  const adv = makeAdventure();
  adv.setup_default_aspects();
  adv.player.move_to(11);
  expect("alive before route", adv.player_state(), "alive");
  const resp: string = adv.do_command("move", "21");
  expect("player died", adv.player_state(), "dead");
  expectContains("response is didn't-make-it msg", resp, "didn't make it");
}

routeJumpTo20("35:jump", 35);
routeJumpTo20("88:jump", 88);
routeJumpTo20("110:jump", 110);

routeTo21();
