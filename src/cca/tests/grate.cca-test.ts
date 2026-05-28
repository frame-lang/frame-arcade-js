// Port of Godot tests/test_cca_grate.gd — Grate + keys puzzle, FSM-direct.
// Same assertions, same expected values:
//   - Grate starts $Locked; keys live in the well house (room 3).
//   - UNLOCK without keys deflects ("no keys"); wrong room deflects.
//   - Take keys, return to depression (8), UNLOCK works; OPEN is a synonym.
//   - LOCK re-locks. Drop keys at depression.
//   - Save/restore round-trips both grate state and keys carrying.
import { file, expect, expectContains, makeAdventure } from "./_harness";

file("test_cca_grate");

// --- Initial conditions ---
// Initial — grate locked, keys in well house, not carried:
const adv = makeAdventure();
adv.setup_default_aspects();
expect("grate locked", adv.grate_locked(), true);
expect("grate state", adv.grate.get_state(), "locked");
expect("keys not carried", adv.keys_in_inventory(), false);
expect("keys location", adv.keys_item.get_location(), 3);

// --- Unlock without keys ---
// UNLOCK without keys deflects:
adv.player.move_to(8); // depression
const r1 = adv.do_command("unlock", "grate");
// Canon msg #31 — "You have no keys!"
expectContains("response", [r1], "no keys");
expect("still locked", adv.grate_locked(), true);

// --- UNLOCK from wrong room ---
// UNLOCK at the wrong room deflects:
adv.player.move_to(11); // debris
const r2 = adv.do_command("unlock", "grate");
// Canon msg #28 — "There is nothing here with a lock!"
expectContains("response", [r2], "nothing here with a lock");

// --- Take keys ---
// Take keys from the well house:
adv.player.move_to(3);
const r3 = adv.do_command("take", "keys");
expectContains("take response", [r3], "OK");
expect("keys carried", adv.keys_in_inventory(), true);

// --- Move to grate, UNLOCK ---
// With keys, UNLOCK at the grate works:
adv.player.move_to(8);
const r4 = adv.do_command("unlock", "grate");
expectContains("response", [r4], "now unlocked");
expect("grate unlocked", adv.grate_locked(), false);
expect("grate state", adv.grate.get_state(), "unlocked");

// --- OPEN as synonym ---
// OPEN is a synonym for UNLOCK:
const rA = adv.do_command("lock", "grate");
expectContains("re-locked", [rA], "now locked");
const rB = adv.do_command("open", "grate");
expectContains("open works", [rB], "now unlocked");

// --- LOCK re-locks ---
// LOCK re-locks the grate:
const r5 = adv.do_command("lock", "grate");
expectContains("response", [r5], "now locked");
expect("grate locked again", adv.grate_locked(), true);

// --- Drop keys, leave them at depression ---
// Drop keys at the depression:
const r6 = adv.do_command("drop", "keys");
expectContains("drop response", [r6], "OK");
expect("keys not carried", adv.keys_in_inventory(), false);
expect("keys at depression", adv.keys_item.get_location(), 8);

// --- Save / restore mid-puzzle ---
// Save / restore mid-puzzle preserves state:
adv.do_command("take", "keys");
adv.do_command("unlock", "grate");
expect("pre-save unlocked", adv.grate_locked(), false);
const bytes = adv.save_state();
adv.do_command("lock", "grate");
adv.do_command("drop", "keys");

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored unlocked", adv2.grate_locked(), false);
expect("restored keys carried", adv2.keys_in_inventory(), true);
