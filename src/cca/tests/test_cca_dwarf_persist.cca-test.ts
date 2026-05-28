// Port of Godot tests/test_cca_dwarf_persist.gd — save/restore round-trip for
// canon dwarf-movement state + the DFLAG=20 SAVED latch (advent.for STMT 6010
// line 777). FSM-direct (makeAdventure = Cca.new()). Same assertions, same
// expected values, same order.
//
// Verifies: Dwarf.prev_room/seen round-trip through @@[persist]; Pirate
// room/prev_room/seen round-trip (canon dwarf #6); mark_loaded_from_save()
// latches DFLAG=20 on the next dwarf-attack tick after a restore.
//
// RNG NOTE: Phase 3/4 force a dwarf into the player's room (prev==room) and
// tick; the single dwarf attacks deterministically. The SAVED latch
// (loaded_from_save && dwarf_anger<20 → 20) is set in the same tick regardless
// of the throw roll, so the anger assertions are exact.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_dwarf_persist");

// ---------------------------------------------------------
// Phase 1: dwarf prev_room + seen round-trip
// ---------------------------------------------------------
const adv = makeAdventure();
adv.setup_default_aspects();
adv.wake_dwarves();
// Force dwarf1 into a known walk + sighting state.
adv.dwarf_step_to(1, 50); // cur=50, prev=19
adv.dwarf_snap_to_player(1); // snap to player's room (still surface)
const preRoom: number = adv.dwarf_room_of(1);
const prePrev: number = adv.dwarf_prev_room_of(1);
const preSeen: boolean = adv.dwarf_is_seen(1);
expect("dwarf1 pre-save seen", preSeen, true);

const bytes = adv.save_state();

// Mutate after save — should be reset on restore.
adv.dwarf_step_to(1, 99);
adv.dwarf_unsee(1);
expect("dwarf1 mutated room", adv.dwarf_room_of(1), 99);
expect("dwarf1 mutated seen", adv.dwarf_is_seen(1), false);

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored dwarf1 room", adv2.dwarf_room_of(1), preRoom);
expect("restored dwarf1 prev_room", adv2.dwarf_prev_room_of(1), prePrev);
expect("restored dwarf1 seen", adv2.dwarf_is_seen(1), preSeen);

// ---------------------------------------------------------
// Phase 2: pirate room/prev_room/seen round-trip
// ---------------------------------------------------------
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.wake_dwarves();
// Activate pirate by carry count, then walk + snap.
adv3.pirate.treasures_carried(5);
expect("pirate stalking", adv3.pirate.is_stalking(), true);
adv3.pirate_step_to(70);
adv3.pirate_snap_to_player();
const pRoom: number = adv3.pirate_room();
const pPrev: number = adv3.pirate_prev_room();
const pSeen: boolean = adv3.pirate_is_seen();
expect("pirate pre-save seen", pSeen, true);

const pBytes = adv3.save_state();
const adv4 = makeAdventure();
adv4.restore_state(pBytes);
expect("restored pirate room", adv4.pirate_room(), pRoom);
expect("restored pirate prev_room", adv4.pirate_prev_room(), pPrev);
expect("restored pirate seen", adv4.pirate_is_seen(), pSeen);

// ---------------------------------------------------------
// Phase 3: SAVED latch — DFLAG=20 on next attack after restore
// ---------------------------------------------------------
const adv5 = makeAdventure();
adv5.setup_default_aspects();
adv5.wake_dwarves();
const sBytes = adv5.save_state();

const adv6 = makeAdventure();
adv6.restore_state(sBytes);
expect("post-restore anger still 2 (no attack yet)", adv6.get_dwarf_anger(), 2);
adv6.mark_loaded_from_save();
expect("anger unchanged until attack tick", adv6.get_dwarf_anger(), 2);

// Force a dwarf into the player's room + tick. The single dwarf attacks; the
// latch snaps DFLAG=20 in the same tick.
adv6.player.move_to(19);
adv6.dwarf_step_to(1, 19); // ensure prev==room so attack fires
adv6.dwarf_step_to(1, 19); // second call: prev←19, room←19
adv6.tick();
expect("anger snapped to 20 after SAVED-latch attack", adv6.get_dwarf_anger(), 20);

// ---------------------------------------------------------
// Phase 4: SAVED latch DOESN'T fire when never set
// ---------------------------------------------------------
const adv7 = makeAdventure();
adv7.setup_default_aspects();
adv7.wake_dwarves();
adv7.player.move_to(19);
adv7.dwarf_step_to(1, 19);
adv7.dwarf_step_to(1, 19);
adv7.tick();
expect("fresh-game anger stays 2 (no SAVED latch)", adv7.get_dwarf_anger(), 2);
