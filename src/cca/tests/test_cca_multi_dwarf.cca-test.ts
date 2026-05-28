// Port of Godot tests/test_cca_multi_dwarf.gd — canon multi-dwarf scenes
// (advent.for STMT 6010-6030), DRIVER-level (makeDriver + capture). Same
// assertions, same expected values, same order. Drives the per-turn dwarf
// step+attack chain by capturing a "look" each turn (the JS driver's afterTurn
// runs stepDwarves → tick → checkPirateSteal → checkDwarfAxe, exactly like the
// Godot driver's per-turn upkeep).
//
// RNG NOTE: the JS Dwarf attack/throw/pick use a per-instance deterministic
// hash (seed + step counters), reproduced bit-identically from the Godot port.
// Phase 6 ("dwarf2 moved to a different room after tick") depends on dwarf2's
// seeded pick_destination; ported verbatim. The hit/miss outcomes at anger=2
// (0%) and anger=20 (capped >100%) are deterministic, not sampled.
import { file, expect, ok, expectContains, makeDriver, capture } from "./_harness";
import type { CcaDriver } from "../driver";

file("test_cca_multi_dwarf");

function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} (no "${needle}")`, !lines.join("\n").includes(needle));
}

// Force a dwarf to be co-located with the player (and standing still —
// prev_room == room) so the next tick rolls an attack against it. dwarf_step_to
// is idempotent; calling it twice with `room` lands prev and current both at
// `room`, simulating "dwarf stood still in this room last turn AND is still
// here."
function putDwarfAt(d: CcaDriver, idx: number, room: number): void {
  d.machine().dwarf_step_to(idx, room);
  d.machine().dwarf_step_to(idx, room);
}

// ---------------------------------------------------------
// Phase 1: single-dwarf miss → canon msg #5 + msg #52
// ---------------------------------------------------------
const d1 = makeDriver();
d1.machine().wake_dwarves();
d1.machine().player.move_to(19); // canon dwarf1 wake room (Hall of Mt King)
putDwarfAt(d1, 1, 19);
const l1: string[] = capture(d1, "look");
expectContains("single-dwarf-in-room msg #4", l1, "There is a threatening little dwarf in the room with you");
expectContains("single-attacker throw msg #5", l1, "One sharp nasty knife is thrown at you");
expectContains("single-attacker miss msg #52", l1, "It misses");
expect("player still alive after miss", d1.machine().player_state(), "alive");

// ---------------------------------------------------------
// Phase 2: single-dwarf HIT — high anger forces the roll
// ---------------------------------------------------------
const d2 = makeDriver();
d2.machine().wake_dwarves();
for (let i = 0; i < 18; i++) d2.machine().bump_dwarf_anger(); // 2 → 20 → hit_pct=171 capped >100
d2.machine().player.move_to(19);
putDwarfAt(d2, 1, 19);
const l2: string[] = capture(d2, "look");
expectContains("single-dwarf throw msg #5", l2, "One sharp nasty knife is thrown at you");
expectContains("single-attacker hit msg #53", l2, "It gets you");
expect("player dead after hit", d2.machine().player_state(), "dead");

// ---------------------------------------------------------
// Phase 3: TWO dwarves in player's room, all miss → FORMAT 78 + msg #6
// ---------------------------------------------------------
const d3 = makeDriver();
d3.machine().wake_dwarves();
d3.machine().player.move_to(19);
putDwarfAt(d3, 1, 19);
putDwarfAt(d3, 2, 19);
const l3: string[] = capture(d3, "look");
expectContains("multi-dwarf-in-room FORMAT 67", l3, "2 threatening little dwarves");
expectContains("multi-attacker throw FORMAT 78", l3, "2 of them throw knives at you");
expectContains("multi-attacker all-miss msg #6", l3, "None of them hit you");

// ---------------------------------------------------------
// Phase 4: THREE dwarves, high anger → most hit → FORMAT 78 + FORMAT 68
// ---------------------------------------------------------
const d4 = makeDriver();
d4.machine().wake_dwarves();
for (let i = 0; i < 18; i++) d4.machine().bump_dwarf_anger(); // 2 → 20
d4.machine().player.move_to(19);
putDwarfAt(d4, 1, 19);
putDwarfAt(d4, 2, 19);
putDwarfAt(d4, 3, 19);
const l4: string[] = capture(d4, "look");
expectContains("3-dwarf in-room FORMAT 67", l4, "3 threatening little dwarves");
expectContains("3-attacker throw FORMAT 78", l4, "3 of them throw knives at you");
// At anger=20 hit_pct ramps very high — should produce N-hit message. Either
// msg #7 (one hit) or FORMAT 68 (N hit) — but NOT msg #52/#53 (single-attacker
// phrasing).
expectNoMatch("no single-attacker miss msg #52", l4, "It misses");
expectNoMatch("no single-attacker hit msg #53", l4, "It gets you");

// ---------------------------------------------------------
// Phase 5: silent turn — no dwarves co-located with player
// ---------------------------------------------------------
const d5 = makeDriver();
d5.machine().wake_dwarves();
d5.machine().player.move_to(100); // canon Plover Room — no dwarf wakes here
const l5: string[] = capture(d5, "look");
expectNoMatch("silent: no threatening msg", l5, "threatening little dwarf");
expectNoMatch("silent: no throw msg", l5, "throw");
expectNoMatch("silent: no miss msg", l5, "It misses");

// ---------------------------------------------------------
// Phase 6: dwarf movement — dwarf walks one canon step per turn
// ---------------------------------------------------------
const d6 = makeDriver();
d6.machine().wake_dwarves();
d6.machine().player.move_to(99); // canon Alcove — no dwarf here
const roomBefore: number = d6.machine().dwarf2.get_room();
expect("dwarf2 wakes at canon 33", roomBefore, 33);
// Tick once. The driver's per-turn stepDwarves walks dwarf2; with player at
// canon 99 (not in dwarf path) the dwarf should have moved to a different room.
capture(d6, "look");
const roomAfter: number = d6.machine().dwarf2.get_room();
expect("dwarf2 moved to a different room after tick", roomAfter !== roomBefore, true);
