// ============================================================
// journeys.ts — canonical + win journey rails as replayable data
// ============================================================
// Faithful JS port of the Godot CCA journey infrastructure:
//   - scripts/journey.gd                 (the Journey/step-walker base)
//   - scripts/canonical_journey.gd        (the Crowther/Woods linear solve;
//                                           a Frame FSM of 33 milestone states)
//   - scripts/canonical_journey_adapter.gd (the FSM-shortcut dispatcher)
//   - scripts/win_journey.gd              (the deterministic full-ORGANIC win:
//                                           ~228 typed commands, no FSM pokes)
//
// THE STEP MODEL (mirrors journey.gd + the *_journey.gd FSMs)
// -----------------------------------------------------------
// A journey is an ordered list of MILESTONES. Each milestone declares the
// commands needed to ARRIVE at it from the previous milestone, the player
// room you should be in once those commands run, and substrings that must /
// must not appear in the log emitted while arriving. Two canonical
// milestones are reached by FSM-direct manipulation instead of player
// commands (see `shortcut`) — exactly as canonical_journey_adapter.gd does.
//
// Each milestone is itself an ordered list of STEPS. A step is one of:
//   - { cmd }                 a typed player command  → driver.input(cmd)
//   - { reseed }              pin the model RNG        → chance.reseed(reseed)
//   - { forceChannel, value } pin one named roll       → chance.force(name,val)
//   - { clearChannel }        release one pinned roll   → chance.clear_forced(n)
//   - { milestone }           a no-op marker/assert tag (the milestone name)
// The canonical/win data below use only {cmd} steps + the milestone metadata;
// the RNG-pin step kinds exist so the same walker faithfully replays any
// journey that pins rolls inline (the Godot rails pin at the RUNNER level —
// chance.reseed(seed) once before the walk — which runJourney() also does via
// its options; see test_cca_*_journey.cca-test.ts).
//
// THE WALK (mirrors the SceneTree loop in the Godot journey tests)
//   while not done:
//     apply FSM shortcut for this milestone (if any)
//     for each command of this milestone: driver.input(command)
//     record the milestone (room reached + emitted log)
//     advance to the next milestone
// ============================================================

import type { CcaDriver } from "../driver";

// ---- step + milestone shapes ----

/** One replayable step within a milestone. */
export type JourneyStep =
  | { cmd: string }
  | { reseed: number }
  | { forceChannel: string; value: number }
  | { clearChannel: string }
  | { milestone: string };

/** FSM-direct shortcut a milestone takes instead of typed commands. */
export type Shortcut = "fillTreasures" | "tickToRepository";

/** One milestone in a journey rail. */
export interface Milestone {
  /** Milestone state name (e.g. "WellHouseGather"). */
  name: string;
  /** Ordered steps to ARRIVE here from the previous milestone. */
  steps: JourneyStep[];
  /** player_room() expected after this milestone's steps. -1 = don't check. */
  expectedRoom: number;
  /** Substrings that MUST appear in the log emitted reaching this milestone. */
  expectedInLog: string[];
  /** Substrings that MUST NOT appear in that log. */
  expectedNotInLog: string[];
  /** FSM-direct shortcut (canonical_journey_adapter.gd) — no typed commands. */
  shortcut?: Shortcut;
}

/** Convenience: a milestone built from plain commands (the common case). */
function ms(
  name: string,
  commands: string[],
  expectedRoom: number,
  expectedInLog: string[] = [],
  expectedNotInLog: string[] = [],
  shortcut?: Shortcut,
): Milestone {
  return {
    name,
    steps: commands.map((c) => ({ cmd: c })),
    expectedRoom,
    expectedInLog,
    expectedNotInLog,
    shortcut,
  };
}

// ============================================================
// CANONICAL JOURNEY (canonical_journey.gd)
// ============================================================
// 33 milestones, AtRoad → Victory/Done. The Crowther/Woods linear solve.
// TreasuresFilled + InRepository are FSM-shortcut milestones (no commands):
// the adapter fills the treasure economy and rides the closing timer by
// poking the FSM, exactly as canonical_journey_adapter.gd / the Godot tests do
// (endgame.treasure_deposited() ×13, then tick() ×35).
export const CANONICAL_JOURNEY: Milestone[] = [
  ms("AtRoad", [], 1, ["END OF A ROAD"]),
  ms("WellHouseGather", ["e"], 3, ["WELL HOUSE", "keys", "lamp", "bottle", "food"], ["trying to get into the cave"]),
  ms("WellHouseStocked", ["take keys", "take lamp", "take food", "take bottle"], 3, [], ["I don't know how to apply", "trying to get into the cave"]),
  ms("BackToRoad", ["w"], 1, ["END OF A ROAD"]),
  ms("AtDepression", ["s", "s", "s"], 8, ["DEPRESSION", "GRATE"]),
  ms("BelowGrate", ["unlock grate", "down"], 9, [], ["broke every bone"]),
  ms("LampLit", ["light lamp"], 9, [], ["pitch dark"]),
  ms("CobbleCrawl", ["w"], 10, ["CRAWLING OVER COBBLES", "cage"]),
  ms("DebrisRoom", ["take cage", "w"], 11, ["DEBRIS ROOM", "XYZZY", "rod"]),
  ms("BirdChamber", ["w", "w"], 13, ["bird"]),
  ms("BirdCaptured", ["take bird"], 13),
  ms("SnakeRoom", ["w", "down", "n"], 19, ["snake"]),
  ms("SnakeGone", ["release bird"], 19, ["bird attacks", "drives the snake away"], ["devoured"]),
  ms("DragonCanyon", ["n", "down", "bedquilt", "slab", "up", "s"], 119, ["dragon bars the way"]),
  ms("DragonDead", ["attack dragon", "yes"], 119, ["vanquished a dragon"], ["bounces harmlessly"]),
  ms("RugTaken", ["take rug"], 119, ["OK"]),
  ms("TrollBridge", ["n", "down", "n", "w", "oriental", "w", "sw", "up"], 117, ["troll", "bridge"]),
  ms("TrollPaid", ["throw rug"], 117, ["troll catches", "scurries away"]),
  ms("BearChamber", ["over", "ne", "e", "se", "s", "e"], 130, ["bear"]),
  ms("BearFed", ["feed bear"], 130, [], ["mauled"]),
  ms("ChainTaken", ["take chain"], 130, ["OK"]),
  ms("BearReleased", ["drop chain", "take chain"], 130, ["OK"]),
  ms(
    "WalkBackToWellHouse",
    ["w", "w", "n", "w", "w", "over", "sw", "down", "se", "se", "ne", "e", "up", "e", "up", "s", "e", "up", "depression", "building", "e"],
    3,
    ["WELL HOUSE"],
  ),
  ms("ChainDeposited", ["drop chain"], 3, ["OK"]),
  ms("WalkToGold", ["w", "depression", "down", "w", "w", "up", "w", "w", "down", "s"], 18, ["gold"]),
  ms("GoldTaken", ["take gold"], 18, ["OK"]),
  ms("WalkBackWithGold", ["out", "n", "n", "n", "plugh"], 3, ["WELL HOUSE"]),
  ms("GoldDeposited", ["drop gold"], 3, ["OK"]),
  // FSM-shortcut: fill remaining treasure deposits to the canon-15 threshold.
  ms("TreasuresFilled", [], 3, [], [], "fillTreasures"),
  ms("EndgameClosing", ["look"], 3, ["sepulchral", "Cave closing"]),
  // FSM-shortcut: ride the closing timer to zero → teleport to Repository (116).
  ms("InRepository", [], 116, [], [], "tickToRepository"),
  ms("Victory", ["blast"], -1, ["loud explosion", "elves"]),
  ms("Done", [], -1),
];

// ============================================================
// WIN JOURNEY (win_journey.gd)
// ============================================================
// 18 milestones, Start → Won/Done. The fully ORGANIC win: collects and
// deposits TEN treasures by playing (rug, gold, silver, jewelry, coins,
// diamonds, vase, pyramid, pearl, and the pirate's chest). The emerald is
// deliberately let go — the pirate (fixed internal seed 99) steals it mid-trip,
// spawning the chest at canon 18; recovering the chest is the tenth treasure.
// The 10th deposit arms the cave-closing naturally; 30 LOOK turns ride the
// timer to the Repository; a real BLAST wins. NO FSM pokes.
export const WIN_JOURNEY: Milestone[] = [
  ms("Start", [], 1),
  ms("WellHouse", ["east", "take keys", "take lamp", "take food", "take bottle", "west"], 1),
  ms("BelowGrate", ["depression", "unlock grate", "down", "light lamp"], 9),
  ms("SnakeCleared", ["w", "take cage", "w", "w", "w", "take bird", "w", "down", "n", "release bird", "drop keys", "drop food", "drop cage"], 19),
  ms("BridgeBuilt", ["east", "up", "debris", "take rod", "pit", "down", "west", "wave rod"], 17),
  ms(
    "RugBanked",
    ["east", "north", "north", "down", "bedquilt", "slab", "up", "south", "attack dragon", "yes", "take rug", "north", "down", "north", "up", "east", "up", "east", "up", "north", "plugh", "drop rug"],
    3,
  ),
  ms("GoldBanked", ["west", "depression", "down", "pit", "down", "south", "take gold", "north", "y2", "down", "plugh", "drop gold"], 3),
  ms("SilverBanked", ["west", "depression", "down", "pit", "down", "north", "north", "take silver", "north", "plugh", "drop silver"], 3),
  ms("JewelryBanked", ["west", "depression", "down", "pit", "down", "north", "south", "take jewelry", "north", "north", "north", "plugh", "drop jewelry"], 3),
  ms("CoinsBanked", ["west", "depression", "down", "pit", "down", "north", "west", "take coins", "east", "north", "north", "plugh", "drop coins"], 3),
  ms("DiamondsBanked", ["west", "depression", "down", "pit", "down", "west", "over", "take diamonds", "over", "east", "y2", "down", "plugh", "drop diamonds"], 3),
  ms(
    "VaseBanked",
    ["west", "depression", "down", "pit", "down", "north", "north", "down", "bedquilt", "west", "oriental", "take vase", "up", "west", "east", "nw", "south", "se", "ne", "up", "east", "up", "north", "plugh", "drop vase"],
    3,
  ),
  // Emerald taken in the Plover Room, but the pirate snatches it on the way
  // out (deterministic, pirate seed 99) — no drop. Spawns the chest at canon 18.
  ms("EmeraldStolen", ["west", "depression", "down", "pit", "down", "y2", "down", "plover", "take emerald", "plover", "plugh"], 3),
  ms("PyramidBanked", ["west", "depression", "down", "pit", "down", "y2", "down", "plover", "ne", "take pyramid", "south", "plover", "plugh", "drop pyramid"], 3),
  ms(
    "PearlBanked",
    ["west", "depression", "down", "pit", "down", "north", "north", "down", "west", "down", "north", "break clam", "take pearl", "south", "up", "east", "up", "north", "plugh", "drop pearl"],
    3,
  ),
  // Tenth treasure — recover the pirate's chest at canon 18. The drop arms the
  // cave-closing (TREASURES_TO_TRIGGER = 10).
  ms("ChestBanked", ["west", "depression", "down", "pit", "down", "south", "take chest", "north", "y2", "down", "plugh", "drop chest"], 3),
  // Ride the closing timer to the Repository (canon 116), then BLAST.
  // 30 LOOK turns drain CLOSING_DURATION; the 31st step blasts.
  ms(
    "Won",
    ["look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "look", "blast"],
    116,
  ),
  ms("Done", [], 116),
];

// ============================================================
// runJourney — the faithful walker (journey.gd apply + adapter shortcuts)
// ============================================================

export interface RunOptions {
  /**
   * Reseed the model RNG before the walk (mirrors the Godot runners'
   * `fsm.chance.reseed(seed)`). The pirate keeps its baked internal seed (99);
   * this pins every other named roll (dispatch prose, dark-pit, travel gates,
   * pirate_rustle) so the run is reproducible.
   */
  reseed?: number;
  /**
   * Keep dwarves dormant for the whole deep-cave walk (mirrors the Godot
   * runners' `fsm.dwarves_auto_woken = true`). The canonical/win rails can't be
   * deterministic with probabilistic dwarf encounters, so this is REQUIRED for
   * a faithful replay. Defaults to true.
   */
  dwarvesDormant?: boolean;
  /**
   * If true, seed the FIRST milestone's recorded log with the initial room
   * render (what the Godot harness primes via _print_welcome/_print_room).
   * Lets the AtRoad/Start "END OF A ROAD" log assertion see room 1 without
   * spending a turn. Defaults to true.
   */
  primeInitialRoom?: boolean;
}

/** What a single milestone produced during the walk (for per-milestone asserts). */
export interface MilestoneResult {
  name: string;
  /** player_room() after this milestone's steps. */
  room: number;
  /** All lines emitted reaching this milestone (joined-able for substring checks). */
  log: string[];
  /** The milestone's declared expectations (passed through for the test to assert). */
  milestone: Milestone;
}

/**
 * Walk a journey rail through the driver, faithfully mirroring the Godot
 * journey tests' SceneTree loop. Applies each milestone's FSM shortcut (if
 * any) before typing its commands, runs the per-milestone steps, and records
 * the room + emitted log so callers can make per-milestone assertions.
 *
 * Driver mapping (confirmed against src/cca/driver.ts + the generated machines):
 *   - {cmd}                 → driver.input(cmd)                       (Godot _process_input)
 *   - {reseed}              → driver.machine().chance.reseed(n)
 *   - {forceChannel,value}  → driver.machine().chance.force(name,val)
 *   - {clearChannel}        → driver.machine().chance.clear_forced(name)
 *   - {milestone}           → no-op marker
 *   - shortcut fillTreasures      → endgame.treasure_deposited() ×13
 *   - shortcut tickToRepository   → machine().tick() ×35
 */
export function runJourney(driver: CcaDriver, rail: Milestone[], opts: RunOptions = {}): MilestoneResult[] {
  const a = driver.machine();

  // Runner-level determinism setup — mirrors _make_driver() in the Godot
  // journey tests (dwarves_auto_woken = true; chance.reseed(seed)).
  if (opts.dwarvesDormant !== false) a.dwarves_auto_woken = true;
  if (opts.reseed !== undefined) a.chance.reseed(opts.reseed);

  const results: MilestoneResult[] = [];

  for (let i = 0; i < rail.length; i++) {
    const m = rail[i];
    const log: string[] = [];

    // Prime the very first milestone's log with the initial room render, the
    // way the Godot harness primes via _print_welcome()/_print_room(). The
    // driver renders the room with do_command("look", "") (no turn spent).
    if (i === 0 && opts.primeInitialRoom !== false) {
      const desc: string = a.do_command("look", "");
      if (desc) log.push(stripBBCode(desc));
    }

    // FSM-direct shortcuts (canonical_journey_adapter.gd). These replace the
    // milestone's typed commands; canonical_journey.gd returns [] for them.
    if (m.shortcut === "fillTreasures") {
      for (let k = 0; k < 13; k++) a.endgame.treasure_deposited();
    } else if (m.shortcut === "tickToRepository") {
      for (let k = 0; k < 35; k++) a.tick();
    }

    // Replay the milestone's steps in order.
    for (const step of m.steps) {
      if ("cmd" in step) {
        // Godot lower-cases input before dispatch; do the same.
        for (const line of driver.input(step.cmd.toLowerCase())) log.push(line);
      } else if ("reseed" in step) {
        a.chance.reseed(step.reseed);
      } else if ("forceChannel" in step) {
        a.chance.force(step.forceChannel, step.value);
      } else if ("clearChannel" in step) {
        a.chance.clear_forced(step.clearChannel);
      }
      // {milestone} steps are no-op markers.
    }

    results.push({ name: m.name, room: a.player_room(), log, milestone: m });
  }

  return results;
}

// The driver strips BBCode from its own output; do the same for the primed
// initial-room render so the primed log matches what driver.input() would emit.
function stripBBCode(s: string): string {
  return s.replace(/\[\/?[a-z][^\]]*\]/gi, "");
}

// ============================================================
// Branch sub-rails (maze/plant/troll/rusty/room110 journeys)
// ============================================================
// Each is the ORGANIC command sequence from the matching Godot
// scripts/*_journey.gd rail. They CONTINUE from the win rail's
// BridgeBuilt waypoint (some chain through PlantJourney first),
// so the test walks win→BridgeBuilt (walkWinToBridgeBuilt), then
// the sub-rail(s) via feedCommands. The "force:CH=V"/"clear:CH"
// tokens are the Chance-steering seam (room110_journey pins the
// Bedquilt travel gates to MISS so 65:north falls through to its
// topology exit); feedCommands honours them exactly like the
// Godot _feed helper.

/** maze_journey.gd — BridgeBuilt → all-alike maze (canon 131). */
export const MAZE_RAIL: string[] = ["over", "west", "west", "west", "south", "south"];

/** plant_journey.gd — BridgeBuilt → water plant ×2, climb, Giant Room (92), take eggs. */
export const PLANT_RAIL: string[] = [
  "over", "west", "south", "east", "south", "south", "south", "north", "east", "east",
  "fill bottle", "north", "down", "west", "down", "north", "north", "down", "bedquilt",
  "slab", "south", "down", "pour", "up", "west", "north", "north", "up", "east", "up", "east",
  "up", "south", "east", "west", "over", "west", "south", "east", "south", "south", "south",
  "north", "east", "east", "fill bottle", "north", "down", "west", "down", "north", "north",
  "down", "bedquilt", "slab", "south", "down", "pour", "climb", "east", "west", "take eggs",
];

/** troll_journey.gd — Giant Room → throw eggs at troll → cross to far side (122). */
export const TROLL_RAIL: string[] = [
  "north", "north", "enter", "cavern", "south", "south", "down", "up", "east", "east",
  "oriental", "west", "sw", "up", "throw eggs", "over",
];

/** rusty_journey.gd — Giant Room → climb down for oil, pour on door 94 → 95 → 91. */
export const RUSTY_RAIL: string[] = [
  "south", "down", "up", "east", "down", "fill bottle", "up", "west", "down",
  "climb", "east", "west", "north", "pour", "north", "west",
];

/** room110_journey.gd — BridgeBuilt → Bedquilt (65) → pin gates MISS → canon 110. */
export const ROOM110_RAIL: string[] = [
  "east", "north", "north", "down", "bedquilt",
  "force:travel_gate=0", "north", "north", "clear:travel_gate",
];

/**
 * Walk the win rail from the start through the END of the BridgeBuilt
 * milestone (inclusive), applying each milestone's typed commands. Mirrors the
 * Godot sub-rail tests' `while not j.is_done(): ...; if name == "BridgeBuilt": break`.
 */
export function walkWinToBridgeBuilt(driver: CcaDriver): void {
  for (const m of WIN_JOURNEY) {
    for (const s of m.steps) if ("cmd" in s) driver.input(s.cmd.toLowerCase());
    if (m.name === "BridgeBuilt") return;
  }
}

/**
 * Feed a sub-rail's commands to the driver, honouring the Chance-steering
 * tokens (mirrors the Godot room110_journey _feed helper):
 *   "force:CH=V" → chance.force(CH, V)   "clear:CH" → chance.clear_forced(CH)
 *   anything else → driver.input(lowercased)
 */
export function feedCommands(driver: CcaDriver, cmds: string[]): void {
  const a = driver.machine();
  for (const raw of cmds) {
    if (raw.startsWith("force:")) {
      const [ch, v] = raw.slice(6).split("=");
      a.chance.force(ch, parseInt(v, 10));
    } else if (raw.startsWith("clear:")) {
      a.chance.clear_forced(raw.slice(6));
    } else {
      driver.input(raw.toLowerCase());
    }
  }
}
