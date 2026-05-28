// Port of Godot tests/test_cca_death_journeys.gd — walks the DeathJourneys
// scenarios with typed commands only (no FSM-direct kill pokes) and asserts the
// player dies with the canon death prose, deterministically. Probabilistic
// deaths are pinned via the Chance steering tokens (force:NAME=VALUE).
//
// Three canon death scenarios:
//   • DarkPit     — fresh start, dark-room pit-fall (probability pinned).
//   • JumpPit     — seeded from Room110, JUMP off the stalactite ledge.
//   • BearLunge   — seeded from TrollFarSide, take-chain while bear is hungry.
import { file, expect, ok } from "./_harness";
import {
  walkWinToBridgeBuilt, feedCommands,
  PLANT_RAIL, TROLL_RAIL, ROOM110_RAIL,
} from "./journeys";
import { CcaDriver } from "../driver";

file("test_cca_death_journeys");

// Mirrors Godot _make_driver in death_journeys: raw CcaDriver (lamp NOT lit, so
// the DarkPit scenario actually sees a dark room), dwarves dormant, chance
// reseeded to 42. The success-rail milestones light the lamp during their walk
// via the canon "light lamp" command in BelowGrate, so JumpPit/BearLunge see a
// lit state from their restored snapshots.
function freshDriver(): CcaDriver {
  const d = new CcaDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().chance.reseed(42);
  return d;
}

// Build the three success-rail milestones (snapshots).
const bridge = (() => {
  const d = freshDriver();
  walkWinToBridgeBuilt(d);
  return d.machine().save_state();
})();
const room110 = (() => {
  const d = freshDriver();
  walkWinToBridgeBuilt(d);
  feedCommands(d, ROOM110_RAIL);
  return d.machine().save_state();
})();
const trollFarSide = (() => {
  const d = freshDriver();
  walkWinToBridgeBuilt(d);
  feedCommands(d, PLANT_RAIL);
  feedCommands(d, TROLL_RAIL);
  return d.machine().save_state();
})();

const milestones: Record<string, string> = {
  BridgeBuilt: bridge,
  Room110: room110,
  TrollFarSide: trollFarSide,
};

interface Scenario {
  name: string;
  seed: string; // "" = fresh start
  cmds: string[];
  expectDead: boolean;
  expectMsg: string;
}
const scenarios: Scenario[] = [
  { name: "DarkPit", seed: "", cmds: ["east", "xyzzy", "force:dark_pit_fall=1", "west", "west"], expectDead: true, expectMsg: "fell into a pit" },
  { name: "JumpPit", seed: "Room110", cmds: ["jump"], expectDead: true, expectMsg: "broke every bone" },
  { name: "BearLunge", seed: "TrollFarSide", cmds: ["barren", "barren", "take chain"], expectDead: true, expectMsg: "the bear lunges at you" },
];

for (const s of scenarios) {
  const d = freshDriver();
  if (s.seed !== "") d.restoreFsmState(milestones[s.seed]);
  const pre = d.captured.length;
  feedCommands(d, s.cmds);
  const dead = d.machine().player_state() === "dead";
  const lines = d.captured.slice(pre).join("\n").toLowerCase();
  const msgSeen = lines.includes(s.expectMsg.toLowerCase());
  expect(`[${s.name}] dead`, dead, s.expectDead);
  ok(`[${s.name}] saw canon prose "${s.expectMsg}"`, msgSeen);
}
