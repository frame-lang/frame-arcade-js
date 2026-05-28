// Port of Godot tests/test_cca_lamp_quit_etc.gd — ENTER STREAM (#70), the LOOK
// detail counter (#15, first 3 of 5), and lamp-out-aboveground (#185). The Godot
// test pokes the private `_check_lamp_warnings()`; the faithful driver-level
// equivalent is to drive a real turn (`d.input("look")`), which runs the per-turn
// chain that now contains the #185 check.
import { file, expect, ok, expectContains, makeDriver } from "./_harness";

file("test_cca_lamp_quit_etc");

function notContains(label: string, lines: string[], needle: string): void {
  ok(`${label} (no "${needle}")`, !lines.join("\n").includes(needle));
}

// Phase 1: ENTER STREAM / ENTER WATER → canon msg #70 (feet wet).
const d = makeDriver();
expectContains("ENTER STREAM emits 'feet are now wet'", d.input("enter stream"), "feet are now wet");
expectContains("ENTER WATER emits 'feet are now wet'", d.input("enter water"), "feet are now wet");

// Phase 2: LOOK detail counter — msg #15 fires exactly 3 times in 5 LOOKs.
const d2 = makeDriver();
d2.machine().player.move_to(3);
let msg15Seen = 0;
for (let i = 0; i < 5; i++) {
  if (d2.input("look").join("\n").includes("not allowed to give more detail")) msg15Seen += 1;
}
expect("msg #15 fired exactly 3 times in 5 LOOKs", msg15Seen, 3);

// Phase 3: lamp out + above-ground (room 3) → canon msg #185.
const d3 = makeDriver();
for (let i = 0; i < 1100; i++) { if (d3.machine().lamp.get_state() === "out") break; d3.machine().lamp.tick(); }
expect("setup: lamp is out", d3.machine().lamp.get_state(), "out");
d3.machine().player.move_to(3);
expectContains("lamp-out at room 3 fires canon msg #185", d3.input("look"), "call it a day");

// Phase 4: lamp out + below-ground (room 15 > 8) does NOT force quit.
const d4 = makeDriver();
for (let i = 0; i < 1100; i++) { if (d4.machine().lamp.get_state() === "out") break; d4.machine().lamp.tick(); }
expect("setup: lamp is out", d4.machine().lamp.get_state(), "out");
d4.machine().player.move_to(15);
notContains("below-ground lamp-out does NOT fire #185", d4.input("look"), "call it a day");
