// Port of Godot tests/test_cca_pour_oil_plant.gd — canon msg #112, FSM-direct.
// POUR oil at the West Pit plant (canon 25) emits the canonical rebuff:
//   "The plant indignantly shakes the oil off its leaves and asks, 'Water?'"
// The plant doesn't grow. Same assertions, same expected values.
//
// _expect_contains(label, s, needle) in the .gd checks `needle in s` against the
// do_command() return STRING — mirrored here with expectContains(label,[s],...).
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_pour_oil_plant");

// Fresh Adventure with the bottle carried, emptied, then refilled at the canon
// oil source (24, Bottom of Eastern Pit) — mirrors _make_with_oil.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeWithOil(): any {
  const adv = makeAdventure();
  adv.setup_default_aspects();
  adv.do_command("light", "");
  // Player picks up the bottle from canon 3.
  adv.player.move_to(3);
  adv.bottle_item.try_take(3);
  adv.player.take(adv.BOTTLE_ID);
  // Empty (in case it had water).
  if (adv.bottle.has_water() || adv.bottle.has_oil()) {
    adv.do_command("pour", "");
  }
  // Walk to the canon oil source (24, Bottom of Eastern Pit).
  adv.player.move_to(24);
  adv.do_command("fill", "bottle");
  return adv;
}

// ----- Phase 1: POUR oil @ West Pit (canon 25) → canon msg #112 -----
const adv = makeWithOil();
expect("setup: bottle has oil", adv.bottle.has_oil(), true);
adv.player.move_to(25); // canon West Pit
const msg: string = adv.do_command("pour", "");
expectContains("POUR oil @ 25 emits 'indignantly shakes the oil'", [msg], "indignantly shakes the oil");
expectContains("msg includes 'Water?' rebuff", [msg], "Water?");
// Plant did NOT grow — should still be tiny.
expect("plant state unchanged", adv.plant.get_state(), "tiny");
// Bottle is now empty (the pour fired).
expect("bottle drained", adv.bottle.has_oil(), false);

// ----- Phase 2: POUR oil elsewhere → no plant msg, just spills -----
const adv2 = makeWithOil();
adv2.player.move_to(50); // canon dry maze
const msg2: string = adv2.do_command("pour", "");
const sawPlantMsg: boolean = msg2.includes("indignantly");
expect("no plant msg fires elsewhere", sawPlantMsg, false);

// ----- Phase 3: POUR water @ 25 still grows plant (regression) -----
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.do_command("light", "");
adv3.player.move_to(3);
adv3.bottle_item.try_take(3);
adv3.player.take(adv3.BOTTLE_ID);
adv3.do_command("fill", "bottle"); // water at canon 3 (well-house)
expect("setup: bottle has water", adv3.bottle.has_water(), true);
adv3.player.move_to(25);
const msg3: string = adv3.do_command("pour", "");
// Canon: POUR water at West Pit emits the plant grow message directly
// (canon obj#PLANT prop=1 "THE PLANT SPURTS INTO FURIOUS GROWTH...").
expectContains("POUR water @ 25 emits plant-grow msg", [msg3], "spurts into furious growth");
expect("plant state advanced", adv3.plant.get_state(), "tall");
