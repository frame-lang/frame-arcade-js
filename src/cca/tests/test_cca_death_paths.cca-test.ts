// Port of Godot tests/test_cca_death_paths.gd — Phase C systematic death-path
// coverage, DRIVER-level (mirrors H.make_driver() / d._process_input()). Same
// assertions, same expected values, same order. Each death path is exercised
// through the real Driver parser and asserts:
//   - canon-prose substring appears in the captured output (case-insensitive,
//     matching Godot's lowercased compare)
//   - player.player_state() == "dead"
//
// Canon death paths covered:
//   - JUMP at canon 35 / 88 / 110 → canon 20 (broke every bone)
//   - gold-carry DOWN at canon 14 → canon 20 (broke every bone)
import { file, ok, makeDriver } from "./_harness";

file("test_cca_death_paths");

type Step = { goto?: number; cmd?: string };
interface DeathPath {
  id: string;
  setup: Step[];
  input: string[];
  expect: { player_state: string; prose_includes: string[] };
}

const DEATH_PATHS: DeathPath[] = [
  {
    id: "jump_at_window_on_pit",
    setup: [{ goto: 35 }],
    input: ["jump"],
    expect: { player_state: "dead", prose_includes: ["broke every bone"] },
  },
  {
    id: "jump_at_canon_88",
    setup: [{ goto: 88 }],
    input: ["jump"],
    expect: { player_state: "dead", prose_includes: ["broke every bone"] },
  },
  {
    id: "jump_at_canon_110",
    setup: [{ goto: 110 }],
    input: ["jump"],
    expect: { player_state: "dead", prose_includes: ["broke every bone"] },
  },
  {
    id: "gold_carry_down_at_14_falls_to_pit",
    setup: [{ goto: 18 }, { cmd: "take gold" }, { goto: 14 }],
    input: ["down"],
    expect: { player_state: "dead", prose_includes: ["broke every bone"] },
  },
];

for (const entry of DEATH_PATHS) {
  const d = makeDriver();
  // Reset lamp to off (makeDriver lights it), then light it for cave rooms.
  if (d.machine().lamp.is_lit()) d.machine().lamp.extinguish();
  d.machine().lamp.light();

  // captured accumulates every emitted line across setup + trigger inputs,
  // mirroring Godot's persistent d.captured buffer.
  const captured: string[] = [];

  for (const step of entry.setup) {
    if (step.goto !== undefined) d.machine().player.move_to(step.goto);
    else if (step.cmd !== undefined) captured.push(...d.input(step.cmd));
  }

  for (const cmd of entry.input) captured.push(...d.input(cmd));

  const capturedText: string = captured.map((l) => l.toLowerCase()).join("\n");
  ok(`[${entry.id}] player_state == dead`, d.machine().player_state() === entry.expect.player_state);
  for (const needle of entry.expect.prose_includes) {
    ok(`[${entry.id}] prose_includes "${needle}"`, capturedText.includes(needle.toLowerCase()));
  }
}
