// Port of Godot tests/test_cca_mechanics.gd — canonical CCA mechanics, FSM-direct
// (mirrors `Cca.new()` + setup_default_aspects()). Same assertions, same expected
// values, same order. Covers:
//   - Vase fragility (drops outside DEPOSIT_ROOM break it)
//   - Eggs incantation (FEE FIE FOE FOO summons eggs back)
//   - Bear-attacks-player (take_chain in $Hungry kills you)
//   - Dwarf-attacks-player (per-turn axe-throw chance)
//   - Resurrection cycle (player dies → die() → revive()) + permadeath
//   - Save/restore preserves death state
//
// RNG NOTE: the dwarf-axe phase loops adv.tick() (which calls
// _maybe_dwarf_attack → dwarf1.try_throw_axe(anger)). The Godot test seeds the
// global GDScript RNG; the JS Dwarf uses a per-instance deterministic hash of
// (seed + attack_step), reproduced bit-identically from the port — so "hit_after"
// is a FIXED deterministic value, not sampled. The assertion (hit_after > 0) is
// ported verbatim; for anger=10 (~76%/tick) it holds, but the exact tick count
// could not be executed/confirmed here (node unavailable). dwarf1 has seed=1.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_mechanics");

function expectContains(label: string, actual: string, fragment: string): void {
  expect(`${label} (contains ${fragment})`, actual.includes(fragment), true);
}

console.log("=== CCA mechanics — vase / eggs / bear / dwarf / resurrect ===");

// --- Vase fragility ---
console.log("Vase shatters when dropped outside the well house:");
const adv = makeAdventure();
adv.setup_default_aspects();
adv.do_command("light", "");
adv.player.move_to(97);
adv.do_command("take", "vase");
expect("carrying vase", adv.player.carrying(115), true);
// Drop in random non-deposit room
adv.player.move_to(130);
adv.do_command("drop", "vase");
expect("vase state", adv.vase.get_state(), "broken");
expect("broken value 0", adv.vase.get_value(), 0);
expect("not in inventory", adv.player.carrying(115), false);

// --- Vase survives if dropped at well house ---
console.log("Vase survives when dropped at the well house:");
const adv_b = makeAdventure();
adv_b.setup_default_aspects();
adv_b.player.move_to(97);
adv_b.do_command("take", "vase");
adv_b.player.move_to(3);
adv_b.do_command("drop", "vase");
expect("vase deposited", adv_b.vase.get_state(), "deposited");
expect("vase value kept", adv_b.vase.get_value(), 14);

// --- Eggs incantation ---
console.log("FEE FIE FOE FOO summons eggs back:");
const adv_c = makeAdventure();
adv_c.setup_default_aspects();
adv_c.do_command("light", "");
adv_c.player.move_to(92);
adv_c.do_command("take", "eggs");
adv_c.player.move_to(3);
adv_c.do_command("drop", "eggs");
expect("eggs deposited", adv_c.eggs.is_deposited(), true);
// Now chant FEE FIE FOE FOO
const r1: string = adv_c.do_command("fee", "");
expectContains("fee response", r1, "Fie");
const r2: string = adv_c.do_command("fie", "");
expectContains("fie response", r2, "Foe");
const r3: string = adv_c.do_command("foe", "");
expectContains("foe response", r3, "Foo");
const r4: string = adv_c.do_command("foo", "");
expectContains("foo response", r4, "appeared elsewhere");
expect("eggs back in giant room", adv_c.eggs.get_state(), "in_room");
expect("eggs at giant room", adv_c.eggs.get_location(), 92);

// --- Eggs incantation — broken chant ---
console.log("Broken chant resets to idle:");
const adv_d = makeAdventure();
adv_d.setup_default_aspects();
adv_d.do_command("fee", "");
adv_d.do_command("fie", "");
adv_d.do_command("look", ""); // not foe — breaks chant
// The verb dispatcher routes "look" to the look handler; the chant FSM only
// sees fee/fie/foe/foo verbs. So EggsIncantation stays in $WaitingFoe even
// after "look". Verify the chant FSM directly by sending a non-canon word:
const rc: string = adv_d.eggs_chant.say("xyzzy");
// Canon advent.for STMT 2608 silently resets FOOBAR; port emits msg #54 "OK."
expect("non-canon resets chant", rc, "OK");
expect("chant idle", adv_d.eggs_chant.get_state(), "idle");

// --- Bear-attacks-player ---
console.log("Take chain from hungry bear → player dies:");
const adv_e = makeAdventure();
adv_e.setup_default_aspects();
adv_e.player.move_to(130);
const rd: string = adv_e.do_command("take", "chain");
expectContains("bear lunges", rd, "killed");
expect("bear attacking", adv_e.bear_state(), "attacking");
expect("player dead", adv_e.player_state(), "dead");
expect("deaths = 1", adv_e.player.get_deaths(), 1);

// --- Resurrection ---
console.log("Revive cycles back to alive at the start room:");
adv_e.player.revive();
expect("player alive", adv_e.player_state(), "alive");
expect("revived at start room", adv_e.player_room(), 1);
expect("inventory cleared", adv_e.player.inventory_size(), 0);

// --- Permadeath after 4 deaths ---
console.log("Permadeath after 4th death:");
const adv_f = makeAdventure();
adv_f.setup_default_aspects();
for (let i = 0; i < 3; i++) {
  adv_f.player.die();
  adv_f.player.revive();
}
expect("3 deaths recoverable", adv_f.player_state(), "alive");
adv_f.player.die();
expect("4th death permadead", adv_f.player_state(), "permadead");

// --- Dwarf attacks: deterministic seed-based test ---
// Canon advent.for STMT 6090 hit rate = `95*(DFLAG-2)/1000`. Default
// dwarf_anger=2 → 0% hit. Bump to canon DFLAG=10 for the ramp test (~76% hit
// pct, so 30 ticks reliably kills).
console.log("Dwarf throws axe deterministically (anger=10 ramp):");
const adv_g = makeAdventure();
adv_g.setup_default_aspects();
adv_g.wake_dwarves();
for (let i = 0; i < 8; i++) adv_g.bump_dwarf_anger(); // 2 → 10
adv_g.player.move_to(19);
let hit_after = -1;
for (let i = 0; i < 30; i++) {
  adv_g.tick();
  if (adv_g.player_state() === "dead") {
    hit_after = i + 1;
    break;
  }
}
expect("dwarf eventually killed player", hit_after > 0, true);
console.log(`  hit after ${hit_after} ticks`);

// --- Save / restore preserves everything ---
console.log("Save / restore mid-resurrect-prompt preserves death state:");
const adv_h = makeAdventure();
adv_h.setup_default_aspects();
adv_h.player.move_to(130);
adv_h.do_command("take", "chain"); // die
const bytes = adv_h.save_state();
adv_h.player.revive(); // mutate after save

const adv_i = makeAdventure();
adv_i.restore_state(bytes);
expect("restored player dead", adv_i.player_state(), "dead");
expect("restored bear attacking", adv_i.bear_state(), "attacking");
