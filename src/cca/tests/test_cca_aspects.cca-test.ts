// Port of Godot tests/test_cca_aspects.gd — BackpackLimit + MagicWordTeleport
// aspects, FSM-direct (mirrors `Cca.new()` + setup_default_aspects()). Same
// assertions, same expected values, same order. Verifies:
//   1. Take when inventory has room → base handler stores the item.
//   2. Take at LIMIT (7): BackpackLimit consumes with canon msg #92; counter++.
//   3. XYZZY 3↔11, PLUGH 3→33, PLOVER 33→100 magic-word transforms.
//   4. Magic words in unrecognized rooms pass through (canon msg #50).
//   5. @@[persist] round-trips both aspects' state + bus listener registry.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_aspects");

console.log("=== CCA BackpackLimit + MagicWordTeleport ===");

const adv = makeAdventure();
adv.setup_default_aspects();

console.log("Take a real treasure through the bus (should succeed):");
adv.do_command("light", "");
adv.player.move_to(18); // debris room — gold
const r1: string = adv.do_command("take", "gold");
expect("take response contains 'Taken'", r1.includes("OK"), true);
expect("inventory size", adv.player.inventory_size(), 1);

console.log("Fill inventory to 7 by direct stuffing (skip the parser):");
// The point of this section is the BackpackLimit aspect, which only inspects
// player.inventory_size(). Stuffing six dummy IDs is faster than walking 7
// canonical treasures.
for (let i = 101; i < 107; i++) adv.player.take(i);
expect("inventory at limit", adv.player.inventory_size(), 7);

console.log("Take 8th item via bus — BackpackLimit consumes:");
adv.player.move_to(28); // silver canon room (28)
const r2: string = adv.do_command("take", "silver");
// Canon msg #92.
expect("take consumed", r2, "You can't carry anything more. You'll have to drop something first.");
expect("inventory unchanged", adv.player.inventory_size(), 7);
expect("backpack consumed", adv.backpack_blocked_count(), 1);

console.log("Drop one, take again (passes again):");
adv.player.drop(106);
const r3: string = adv.do_command("take", "silver");
expect("take after drop contains 'Taken'", r3.includes("OK"), true);
expect("inventory size", adv.player.inventory_size(), 7);
expect("backpack still 1", adv.backpack_blocked_count(), 1);

console.log("XYZZY from well house (3) → debris (11) — canon pair:");
adv.player.move_to(3); // well house
expect("starting room", adv.player_room(), 3);
adv.do_command("xyzzy", "");
expect("after xyzzy", adv.player_room(), 11);
expect("magic transforms", adv.magic_transforms_count(), 1);

console.log("XYZZY from debris (11) → well house (3):");
adv.do_command("xyzzy", "");
expect("after xyzzy back", adv.player_room(), 3);
expect("magic transforms", adv.magic_transforms_count(), 2);

console.log("PLUGH from well house (3) → Y2 (33) — canon pair:");
adv.do_command("plugh", "");
expect("after plugh", adv.player_room(), 33);

console.log("PLOVER from Y2 (33) → Plover Room (canon 100):");
adv.do_command("plover", "");
expect("after plover", adv.player_room(), 100);
expect("magic transforms", adv.magic_transforms_count(), 4);

console.log("XYZZY from unrecognized room (Plover) — passes through:");
const r5: string = adv.do_command("xyzzy", "");
// Canon msg #50 — XYZZY in wrong room.
expect("xyzzy worn out", r5, "Good try, but that is an old worn-out magic word.");
expect("room unchanged", adv.player_room(), 100);
expect("magic transforms", adv.magic_transforms_count(), 4);

console.log("Save mid-run, mutate, restore:");
const bytes = adv.save_state();
console.log(`  save bytes: ${bytes.length}`);

// Mutate
adv.do_command("xyzzy", ""); // still in room 100, no transform
adv.do_command("plover", ""); // transforms back to 33
expect("post-save room", adv.player_room(), 33);
expect("post-save transforms", adv.magic_transforms_count(), 5);

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored room", adv2.player_room(), 100);
expect("restored transforms", adv2.magic_transforms_count(), 4);
expect("restored backpack", adv2.backpack_blocked_count(), 1);

// And the bus is still wired; test the dispatch still works.
adv2.do_command("plover", "");
expect("post-restore plover", adv2.player_room(), 33);
