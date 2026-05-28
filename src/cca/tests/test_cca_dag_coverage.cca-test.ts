// Port of Godot tests/test_cca_dag_coverage.gd — room coverage via the journey-DAG.
// Walk the success/branch rails, snapshot at EVERY distinct room (each a waypoint),
// and bloom a small seeded StateSpace BFS (cap 80) from each waypoint × seed [42,7]
// (reseeding Chance per seed to sample the area's branches). The one cyclic area —
// the all-alike maze — is covered by the deterministic MazeSweep loop, not a bloom.
// Union all rooms; assert all 134 walkable rooms reached. The 6 transient-prose
// rooms (21/22/31/32/89/90 — FSM-direct teleports) are covered by
// transient_prose → 140 canon. SLOW bucket.
import { file, ok, makeDriver } from "./_harness";
import {
  WIN_JOURNEY, PLANT_RAIL, TROLL_RAIL, MAZE_RAIL, RUSTY_RAIL, ROOM110_RAIL,
} from "./journeys";
import { StateSpace } from "./_modelcheck";
import { MazeSweep } from "./_loops";
import type { CcaDriver } from "../driver";

file("test_cca_dag_coverage");

const SEEDS = [42, 7];
const BLOOM_CAP = 80;

interface Waypoint {
  bytes: string;
  room: number;
}
const waypoints: Waypoint[] = [];
const captured = new Set<number>();

function snap(d: CcaDriver): void {
  const r = d.machine().player_room();
  if (!captured.has(r)) {
    captured.add(r);
    waypoints.push({ bytes: d.machine().save_state(), room: r });
  }
}
// Feed rail commands honouring the force:/clear: Chance-steering tokens, snapping
// the room after each plain command (mirrors the Godot _feed + _snap).
function feedWithSnap(d: CcaDriver, cmds: string[]): void {
  const a = d.machine();
  for (const raw of cmds) {
    if (raw.startsWith("force:")) {
      const [ch, v] = raw.slice(6).split("=");
      a.chance.force(ch, parseInt(v, 10));
      continue;
    }
    if (raw.startsWith("clear:")) {
      a.chance.clear_forced(raw.slice(6));
      continue;
    }
    d.input(raw.toLowerCase());
    snap(d);
  }
}
function mkDriver(): CcaDriver {
  const d = makeDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().chance.reseed(42);
  return d;
}

// Win rail (full organic win path) — snapshot every room, capture BridgeBuilt.
const d = mkDriver();
let bridge = "";
for (const m of WIN_JOURNEY) {
  for (const s of m.steps) {
    if ("cmd" in s) {
      d.input(s.cmd.toLowerCase());
      snap(d);
    }
  }
  if (m.name === "BridgeBuilt") bridge = d.machine().save_state();
}

// Plant rail (off BridgeBuilt) → upper complex; capture Giant Room for rusty.
const pd = mkDriver();
pd.restoreFsmState(bridge);
feedWithSnap(pd, PLANT_RAIL);
const giant = pd.machine().save_state();

// Troll rail (chains off the plant rail's Giant Room) → far side.
feedWithSnap(pd, TROLL_RAIL);

// Maze rail (off BridgeBuilt) → maze edge, then the deterministic MazeSweep loop
// maps the whole cyclic cluster (107/112/131-140).
const md = mkDriver();
md.restoreFsmState(bridge);
feedWithSnap(md, MAZE_RAIL);
const mazeRooms = new Set<number>();
const sweep = new MazeSweep();
sweep.arrive(md.machine().player_room());
mazeRooms.add(md.machine().player_room());
while (!sweep.is_done()) {
  md.input(sweep.next_dir());
  sweep.arrive(md.machine().player_room());
  mazeRooms.add(md.machine().player_room());
}

// Rusty-door rail (off the Giant Room) → oil the door, reach 95 / 91.
const rd = mkDriver();
rd.restoreFsmState(giant);
feedWithSnap(rd, RUSTY_RAIL);

// Room-110 rail (off BridgeBuilt) → crawls Bedquilt (65) → 110 (pinned gate).
const qd = mkDriver();
qd.restoreFsmState(bridge);
feedWithSnap(qd, ROOM110_RAIL);

// Small seeded BFS bloom from each waypoint; union the rooms.
const union = new Set<number>();
for (const wp of waypoints) {
  for (const seed of SEEDS) {
    const s = new StateSpace();
    s.seed = seed;
    s.max_states = BLOOM_CAP;
    s.seedBytes = wp.bytes;
    s.reseedChanceAfterRestore = true;
    s.run();
    for (const r of s.coveredRooms()) union.add(r);
  }
}
// Fold in the deterministically-mapped all-alike maze.
for (const r of mazeRooms) union.add(r);

// The only acceptable misses are the 6 transient-prose rooms (FSM-direct
// teleports, covered by transient_prose). Anything else is a coverage regression.
const PROSE = new Set([21, 22, 31, 32, 89, 90]);
const missing: number[] = [];
for (let r = 1; r <= 140; r++) if (!union.has(r)) missing.push(r);
const regressions = missing.filter((r) => !PROSE.has(r));

ok(
  `134 graph rooms + 6 transient-prose = 140/140 canon (union ${union.size} from ${waypoints.length} waypoints; unexpected misses ${JSON.stringify(regressions)})`,
  regressions.length === 0 && union.size >= 134,
);
