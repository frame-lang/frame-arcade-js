// Port of Godot tests/test_cca_liquid_sources.gd — canon-aligned liquid source
// rooms (advent.for LIQLOC), FSM-direct. Same assertions, same expected values:
//   Water sources: canon 1, 3, 4, 7, 38, 95, 113 (port also keeps 83/84).
//   Oil source:    canon 24 (Bottom of Eastern Pit).
//   FILL bottle at any of these transitions the Bottle FSM $Empty → $Water/$Oil.
//
// The Godot file builds its FSM with Cca.new() + setup_default_aspects() +
// do_command("light",""); the JS counterpart is makeAdventure() +
// setup_default_aspects() + do_command("light",""). The bottle is force-taken
// from its home room (canon 3) exactly as the .gd does, and emptied before each
// FILL so every source test starts clean.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_liquid_sources");

// Build a fresh Adventure with the bottle carried and emptied (mirror _make_with_bottle).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeWithBottle(): any {
  const adv = makeAdventure();
  adv.setup_default_aspects();
  adv.do_command("light", "");
  // The bottle's home room is canon 3 (well-house). Force-take by setting the
  // player there momentarily, then try_take the item and update inventory.
  adv.player.move_to(3);
  adv.bottle_item.try_take(3);
  adv.player.take(adv.BOTTLE_ID);
  // Empty the bottle so each FILL test starts clean.
  if (adv.bottle.has_water() || adv.bottle.has_oil()) {
    adv.do_command("pour", "");
  }
  return adv;
}

function testFillWaterAt(room: number): void {
  const adv = makeWithBottle();
  adv.player.move_to(room);
  adv.do_command("fill", "bottle");
  expect(`FILL water @ canon ${room}`, adv.bottle.has_water(), true);
}

function testFillOilAt(room: number): void {
  const adv = makeWithBottle();
  adv.player.move_to(room);
  adv.do_command("fill", "bottle");
  expect(`FILL oil @ canon ${room}`, adv.bottle.has_oil(), true);
}

// Canon water sources — canon LIQLOC rooms:
testFillWaterAt(1); // canon road outside
testFillWaterAt(3); // canon inside building
testFillWaterAt(4); // canon valley stream
testFillWaterAt(7); // canon slit in streambed
testFillWaterAt(38); // canon bottom of pit with stream
testFillWaterAt(95); // canon magnificent cavern
testFillWaterAt(113); // canon edge of reservoir

// Port-pragmatic alternates (kept for back-compat):
testFillWaterAt(83);
testFillWaterAt(84);

// Canon oil source — canon Bottom of Eastern Pit (room 24):
testFillOilAt(24);

// Negative case — non-source room should not yield liquid.
const adv = makeWithBottle();
adv.player.move_to(50); // canon first-maze, dry room
adv.do_command("fill", "bottle");
expect("FILL @ canon 50 (dry maze) — no water", adv.bottle.has_water(), false);
expect("FILL @ canon 50 (dry maze) — no oil", adv.bottle.has_oil(), false);
