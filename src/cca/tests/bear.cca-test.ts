// Port of Godot tests/test_cca_bear.gd — Bear FSM, FSM-direct (events on adv.bear).
// Same assertions, same expected values. Three paths:
//   A: feed → tame → take_chain → following → drop_chain → released
//   B: hazard — take_chain from $Hungry → $Attacking
//   C: @@[persist] round-trip mid-$Following
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_bear");

// ---------------------------------------------------------
// Path A: feed → tame → follow → release
// ---------------------------------------------------------
const adv = makeAdventure();
adv.setup_default_aspects();

// Initial:
expect("bear state", adv.bear_state(), "hungry");
expect("dangerous", adv.bear_dangerous(), true);

// Feed:
adv.bear.feed();
expect("after feed", adv.bear_state(), "tame");
expect("not dangerous", adv.bear_dangerous(), false);
expect("friendly", adv.bear.is_friendly(), true);

// Take chain (safely from tame):
adv.bear.take_chain();
expect("after take_chain", adv.bear_state(), "following");
expect("still friendly", adv.bear.is_friendly(), true);

// Drop chain → released:
adv.bear.drop_chain();
expect("after drop_chain", adv.bear_state(), "released");
expect("still friendly", adv.bear.is_friendly(), true);
expect("not dangerous", adv.bear_dangerous(), false);

// ---------------------------------------------------------
// Path B: hazard — take_chain from $Hungry
// ---------------------------------------------------------
// Fresh adventure, take chain from hungry bear:
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.bear.take_chain();
expect("after hostile chain", adv2.bear_state(), "attacking");
expect("dangerous", adv2.bear_dangerous(), true);
expect("not friendly", adv2.bear.is_friendly(), false);

// ---------------------------------------------------------
// Path C: persistence round-trip mid-Following
// ---------------------------------------------------------
// Persistence round-trip mid-Following:
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.bear.feed();
adv3.bear.take_chain();
const bytes = adv3.save_state();

// Mutate post-save
adv3.bear.drop_chain();
expect("post-save released", adv3.bear_state(), "released");

const adv4 = makeAdventure();
adv4.restore_state(bytes);
expect("restored state", adv4.bear_state(), "following");
expect("restored friendly", adv4.bear.is_friendly(), true);

// And the FSM still works post-restore
adv4.bear.drop_chain();
expect("after post-restore drop", adv4.bear_state(), "released");
