// Port of Godot tests/test_cca_stochastic_probe_y2.gd — the Y2 "hollow voice"
// whisper, a 25% Chance gate (canon advent.for line 808): each render of canon
// room 33 (Y2) has a 25% chance to print msg #8, "A hollow voice says PLUGH"
// (driver printRoom; suppressed during closing). Per trial: fresh driver with
// the player at Y2, reseed Chance, re-render the room (captureRoomRender), and
// record whether the whisper fired. Over seeds 1..50 the golden tally is
// {whisper(1): 12, silent(0): 38} — Godot's exact counts.
import { file, expect, ok, makeDriver } from "./_harness";
import { StochasticProbe } from "./_probe";

file("test_cca_stochastic_probe_y2");

const GOLDEN: Record<number, number> = { 1: 12, 0: 38 }; // 1 = whisper, 0 = silent

const probe = new StochasticProbe(1, 50);
while (!probe.is_done()) {
  const seed = probe.next_seed();
  const d = makeDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().player.move_to(33); // Y2
  d.machine().chance.reseed(seed);
  const whispered = d.captureRoomRender().join("\n").toLowerCase().includes("hollow voice");
  probe.record(whispered ? 1 : 0);
}

for (const branch of Object.keys(GOLDEN).map(Number)) {
  ok(`outcome ${branch} occurred`, probe.count(branch) > 0);
}
for (const branch of Object.keys(GOLDEN).map(Number)) {
  expect(`count(${branch})`, probe.count(branch), GOLDEN[branch]);
}
expect("distinct outcomes", probe.distinct_outcomes(), Object.keys(GOLDEN).length);
expect("trials done", probe.trials_done(), 50);
