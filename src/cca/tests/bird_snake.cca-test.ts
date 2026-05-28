// Port of Godot tests/test_cca_bird_snake.gd — Bird + Snake cross-FSM, FSM-direct.
// Same assertions, same expected values. Five paths:
//   A: bird kills snake (capture cage → bird → release in snake room → snake gone)
//   B: dragon eats bird (release in dragon room → bird dead)
//   C: release in benign room → bird flies free at that room
//   E: bird carried into Plover Room vanishes for good
//   D: save/restore the snake-killed snapshot
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_bird_snake");

// ---------------------------------------------------------
// Path A: bird kills snake
// ---------------------------------------------------------
const adv = makeAdventure();
adv.setup_default_aspects();
adv.light_lamp(); // avoid darkness gate

// Initial NPC state:
expect("bird state", adv.bird_state(), "free");
expect("bird location", adv.bird_location(), 13);
expect("snake state", adv.snake_state(), "blocking");

// Try take bird from wrong room:
const r1 = adv.do_command("take", "bird");
// Canon advent.for STMT 9010 SPK=25 — TAKE X with X not here.
expect("take bird wrong room", r1, "You can't be serious!");
expect("bird still free", adv.bird_state(), "free");

// Take cage at cobbles (canon 10) — required to take bird:
adv.player.move_to(10);
adv.do_command("take", "cage");
expect("cage carried", adv.player.carrying(adv.CAGE_ID), true);

// Move to bird home (13), look, take:
adv.player.move_to(13);
const r2 = adv.do_command("look", "");
expect("room desc mentions bird", r2.includes("bird"), true);
const r3 = adv.do_command("take", "bird");
// Canon: TAKE BIRD with cage emits msg #54 "OK". The caged
// state shows up on the next LOOK via obj#BIRD prop=1.
expect("take response", r3, "OK");
expect("bird state", adv.bird_state(), "caged");
expect("bird location", adv.bird_location(), -1);
expect("player carrying", adv.player.carrying(100), true);

// Move to snake room (canon 19, Hall of Mt King), look:
adv.player.move_to(19);
const r4 = adv.do_command("look", "");
expect("snake mentioned", r4.includes("snake"), true);

// Release bird → snake driven off (cross-FSM):
const r5 = adv.do_command("release", "bird");
expect("release response", r5.includes("attacks"), true);
expect("bird state", adv.bird_state(), "released");
expect("snake state", adv.snake_state(), "gone");
expect("player not carrying", adv.player.carrying(100), false);

// Look in snake room — snake no longer mentioned:
const r6 = adv.do_command("look", "");
expect("no snake in look", r6.includes("snake"), false);

// ---------------------------------------------------------
// Path B: dragon eats bird (separate adventure)
// ---------------------------------------------------------
// Fresh adventure — release bird in dragon room (canon 119):
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.light_lamp();
adv2.player.move_to(10);
adv2.do_command("take", "cage");
adv2.player.move_to(13);
adv2.do_command("take", "bird");
adv2.player.move_to(119);
const r7 = adv2.do_command("release", "bird");
expect("release at dragon", r7.includes("dragon"), true);
expect("bird state", adv2.bird_state(), "dead");

// ---------------------------------------------------------
// Path C: release in benign room — bird flies free
// ---------------------------------------------------------
// Fresh adventure — release bird in Y2 (33):
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.light_lamp();
adv3.player.move_to(10);
adv3.do_command("take", "cage");
adv3.player.move_to(13);
adv3.do_command("take", "bird");
adv3.player.move_to(33);
const r8 = adv3.do_command("release", "bird");
// Canon: RELEASE BIRD in a benign room emits msg #54 "OK".
// The bird's new free-state is observable via bird_state() and
// bird_location() below.
expect("released benign", r8.includes("OK"), true);
expect("bird back to free", adv3.bird_state(), "free");
expect("bird at release room", adv3.bird_location(), 33);

// ---------------------------------------------------------
// Path E: bird vanishes when carried into the Plover Room
// ---------------------------------------------------------
// Bird-into-Plover canon: bird vanishes for good:
const adv_p = makeAdventure();
adv_p.setup_default_aspects();
adv_p.light_lamp();
adv_p.player.move_to(10);
adv_p.do_command("take", "cage");
adv_p.player.move_to(13); // bird chamber
adv_p.do_command("take", "bird");
expect("bird carried pre-plover", adv_p.player.carrying(100), true);
adv_p.player.move_to(33); // Y2
const rp = adv_p.do_command("plover", "");
// Canon: PLOVER chant with carried bird emits msg #54 "OK"; the
// bird's $Dead state is observable via bird_state().
ok('plover bird msg ("OK")', rp.includes("OK"));
expect("at Plover Room", adv_p.player_room(), 100);
expect("bird not carried", adv_p.player.carrying(100), false);
expect("bird state dead", adv_p.bird_state(), "dead");

// ---------------------------------------------------------
// Path D: save / restore the snake-killed snapshot
// ---------------------------------------------------------
// Save state mid-Path-A (snake just killed), restore:
const bytes = adv.save_state();
ok("save_state returns non-empty string", typeof bytes === "string" && bytes.length > 0);

// Mutate post-save: bring player back, move around
adv.player.move_to(1);
adv.do_command("look", "");
adv.do_command("look", "");

const adv4 = makeAdventure();
adv4.restore_state(bytes);
expect("restored bird state", adv4.bird_state(), "released");
expect("restored snake state", adv4.snake_state(), "gone");
expect("restored room", adv4.player_room(), 19);
// Look in the restored snake room — should still NOT mention snake
const r9 = adv4.do_command("look", "");
expect("restored look no snake", r9.includes("snake"), false);
