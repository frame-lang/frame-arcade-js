// Port of Godot tests/test_cca_troll.gd — bear→troll cross-FSM narrative, FSM-direct.
// Same assertions, same expected values. Paths:
//   A: feed bear → take chain → drop chain at troll → bear scares troll → bridge open
//   B: hazard — take chain without feeding → bear attacking
//   C: direct pay_toll → toll_paid, bridge open
//   E: canon throw-treasure (THROW gold at troll) → vanished; non-treasure bounces
//   D: save/restore mid-$Following at the troll's room
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_troll");

// ---------------------------------------------------------
// Path A: full happy path through the verb dispatcher
// ---------------------------------------------------------
const adv = makeAdventure();
adv.setup_default_aspects();
adv.light_lamp(); // avoid darkness gate

// Initial troll/bear:
expect("troll state", adv.troll_state(), "demanding");
expect("bridge blocked", adv.troll_blocking(), true);
expect("bear state", adv.bear_state(), "hungry");

// Pick up food at well house (canon 3) — required to feed bear:
adv.player.move_to(3);
adv.do_command("take", "food");
expect("food carried", adv.player.carrying(adv.FOOD_ID), true);

// Move to bear room (canon 130 — Barren Room), look:
adv.player.move_to(130);
const r1 = adv.do_command("look", "");
expect("look mentions bear", r1.includes("bear"), true);

// Feed bear → tame:
const r2 = adv.do_command("feed", "bear");
expect("feed response", r2.includes("wolfs down"), true);
expect("bear state", adv.bear_state(), "tame");

// Take chain → following:
const r3 = adv.do_command("take", "chain");
// Canon: TAKE CHAIN with tame bear is silent ("OK"); the
// follow-state is observable via bear_state() below.
expect("take chain response", r3.includes("OK"), true);
expect("bear state", adv.bear_state(), "following");
expect("carrying chain", adv.player.carrying(101), true);

// Move to troll room (117), look:
adv.player.move_to(117);
const r4 = adv.do_command("look", "");
expect("look mentions troll", r4.includes("troll"), true);

// Drop chain → bear scares troll (cross-FSM):
const r5 = adv.do_command("drop", "chain");
expect("drop response", r5.includes("scurries away"), true);
expect("bear state", adv.bear_state(), "released");
expect("troll state", adv.troll_state(), "vanished");
expect("bridge open", adv.troll_blocking(), false);
expect("not carrying chain", adv.player.carrying(101), false);

// ---------------------------------------------------------
// Path B: hazard — take chain without feeding
// ---------------------------------------------------------
// Fresh adventure — take chain from hungry bear:
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.light_lamp();
adv2.player.move_to(130);
const r6 = adv2.do_command("take", "chain");
expect("hostile response", r6.includes("lunges"), true);
expect("bear attacking", adv2.bear_state(), "attacking");
expect("not carrying chain", adv2.player.carrying(101), false);

// ---------------------------------------------------------
// Path C: pay-toll alternative (bear avoids the bridge)
// ---------------------------------------------------------
// Direct pay_toll path:
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.troll.pay_toll();
expect("troll paid", adv3.troll_state(), "toll_paid");
expect("bridge open", adv3.troll_blocking(), false);

// ---------------------------------------------------------
// Path E: canon throw-treasure-at-troll (bridge toll via THROW verb)
// ---------------------------------------------------------
// Canon throw-treasure path:
const adv6 = makeAdventure();
adv6.setup_default_aspects();
adv6.light_lamp();
// Pick up gold and walk to the troll bridge.
adv6.player.move_to(18); // canon stash room
adv6.do_command("take", "gold");
adv6.player.move_to(117);
expect("troll blocking", adv6.troll_blocking(), true);
expect("carrying gold", adv6.player.carrying(110), true);
const rt = adv6.do_command("throw", "gold");
expect("throw response", rt.includes("scurries away"), true);
expect("troll vanished", adv6.troll_blocking(), false);
expect("gold consumed", adv6.player.carrying(110), false);
expect("gold vanished state", adv6.gold.is_vanished(), true);
expect("gold worth zero", adv6.gold.get_value(), 0);
// Throwing a non-treasure should bounce.
adv6.player.move_to(11);
const rb = adv6.do_command("throw", "rock");
expect("rock bounces", rb.includes("don't know how"), true);

// ---------------------------------------------------------
// Path D: full save/restore mid-Following with bear at troll
// ---------------------------------------------------------
// Save mid-Following at troll's room, restore:
const adv4 = makeAdventure();
adv4.setup_default_aspects();
adv4.light_lamp();
adv4.player.move_to(3);
adv4.do_command("take", "food");
adv4.player.move_to(130);
adv4.do_command("feed", "bear");
adv4.do_command("take", "chain");
adv4.player.move_to(117);
const bytes = adv4.save_state();

// Mutate post-save: drop chain to scare troll
adv4.do_command("drop", "chain");

const adv5 = makeAdventure();
adv5.restore_state(bytes);
expect("restored bear", adv5.bear_state(), "following");
expect("restored troll", adv5.troll_state(), "demanding");
expect("restored room", adv5.player_room(), 117);
expect("restored carrying", adv5.player.carrying(101), true);

// And the FSM still works post-restore
const r7 = adv5.do_command("drop", "chain");
expect("post-restore drop", r7.includes("scurries away"), true);
expect("post-restore troll", adv5.troll_state(), "vanished");
