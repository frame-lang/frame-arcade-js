// Port of Godot tests/test_cca_retry_gate.gd — reach canon 110 through the
// 65:north probability gate ORGANICALLY (no chance.force): keep playing the odds
// until a roll falls through 71→110. Contrast with room110_journey, which pins
// the gate for a one-shot hop. Under the game seed (42) it succeeds in ~8 steps.
import { file, expect, ok, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands } from "./journeys";
import { RetryGate } from "./_loops";

file("test_cca_retry_gate");

const d = makeDriver();
d.machine().dwarves_auto_woken = true;
d.machine().chance.reseed(42);
walkWinToBridgeBuilt(d);
feedCommands(d, ["east", "north", "north", "down", "bedquilt"]);
expect("setup reached Bedquilt (canon 65)", d.machine().player_room(), 65);

// Drive the retry loop — react to where each command lands; no force.
const loop = new RetryGate();
loop.arrive(d.machine().player_room());
while (!loop.is_done()) {
  const cmd = loop.next_cmd();
  d.input(cmd);
  loop.arrive(d.machine().player_room());
}

expect("pushed through 65:north to canon 110", d.machine().player_room(), 110);
ok("reached the target organically", loop.reached());
ok(`did it in under 60 steps (got ${loop.steps_taken()})`, loop.steps_taken() < 60);
