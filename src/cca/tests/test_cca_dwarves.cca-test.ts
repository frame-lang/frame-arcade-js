// Port of Godot tests/test_cca_dwarves.gd — parameterized 5-dwarf composition,
// FSM-direct (mirrors `Cca.new()` → makeAdventure()). Same assertions, same
// expected values, same order. Verifies all five start $Hidden with their
// assigned seeds, wake_dwarves() activates each at its room, per-seed outcomes
// are deterministic + diverge, attack_dwarf_in_room finds by location, repeated
// attack eventually kills, and @@[persist] round-trips seed + step counters.
//
// RNG NOTE: the JS Dwarf.attack()/try_throw_axe() use a per-instance
// deterministic hash (seed + step counter), reproduced bit-identically from the
// Godot port — NOT a global RNG. So the "eventually dies" loop and step counts
// are deterministic, exactly as the Godot test relies on.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_dwarves");

const adv = makeAdventure();
adv.setup_default_aspects();

// Initial — all five hidden:
expect("dwarf1 state", adv.dwarf1.get_state(), "hidden");
expect("dwarf2 state", adv.dwarf2.get_state(), "hidden");
expect("dwarf3 state", adv.dwarf3.get_state(), "hidden");
expect("dwarf4 state", adv.dwarf4.get_state(), "hidden");
expect("dwarf5 state", adv.dwarf5.get_state(), "hidden");
expect("seeds diverge", adv.dwarf1.get_seed() !== adv.dwarf3.get_seed(), true);
expect("living count", adv.living_dwarves(), 5);

// Wake all five:
adv.wake_dwarves();
expect("dwarf1 stalking", adv.dwarf1.get_state(), "stalking");
expect("dwarf1 room", adv.dwarf1.get_room(), 19);
expect("dwarf3 room", adv.dwarf3.get_room(), 47);
expect("dwarf5 room", adv.dwarf5.get_room(), 118);

// Attack from wrong room — no dwarf:
adv.player.move_to(99);
const r1 = adv.attack_dwarf_in_room();
// Canon msg #76 "PECULIAR. NOTHING UNEXPECTED HAPPENS." for ATTACK with no
// target in the room.
expect("no dwarf here", r1, "Peculiar. Nothing unexpected happens.");

// Attack dwarf3 in its room (deterministic outcome):
adv.player.move_to(47);
const r2 = adv.attack_dwarf_in_room();
// We don't assert the exact outcome (depends on seed) but we DO assert: the
// dwarf's step counter advanced by 1, and the response is one of the two valid
// messages.
expect("dwarf3 step >= 1", adv.dwarf3.get_step() >= 1, true);
// Canon msg #47 (kill) / msg #48 (miss) verbatim.
expect(
  "response valid",
  r2 === "You killed a little dwarf." ||
    r2 === "You attack a little dwarf, but he dodges out of the way.",
  true,
);

// Hammer dwarf1 until dead — eventually it dies:
adv.player.move_to(19);
let attempts = 0;
while (adv.dwarf1.get_state() === "stalking" && attempts < 20) {
  adv.attack_dwarf_in_room();
  attempts += 1;
}
expect("dwarf1 eventually dies", adv.dwarf1.get_state(), "dead");

// Living count went down by one:
expect("living count", adv.living_dwarves(), 3);

// Determinism — fresh adventure, same attack pattern produces same step counts:
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.wake_dwarves();
adv2.player.move_to(47);
adv2.attack_dwarf_in_room();
expect("dwarf3 step matches", adv2.dwarf3.get_step(), 1);

// Save / restore mid-attack-sequence:
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.wake_dwarves();
adv3.player.move_to(47);
adv3.attack_dwarf_in_room();
adv3.attack_dwarf_in_room();
const preState = adv3.dwarf3.get_state();
const preStep = adv3.dwarf3.get_step();
const bytes = adv3.save_state();

// Mutate after save
adv3.attack_dwarf_in_room();
adv3.attack_dwarf_in_room();
adv3.attack_dwarf_in_room();

const adv4 = makeAdventure();
adv4.restore_state(bytes);
expect("restored dwarf3 state", adv4.dwarf3.get_state(), preState);
expect("restored dwarf3 step", adv4.dwarf3.get_step(), preStep);

// Replay-from-save determinism: reset live to a known state for comparison.
adv3.dwarf3.flee();
