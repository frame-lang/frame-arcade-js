// Port of Godot tests/test_cca_verb_effects.gd — Phase C Layer 4, the
// verb-effect canon-fidelity checks.
//
// For each entry in WorldSpec.VERB_EFFECTS, build a fresh driver, apply the
// spec's setup (place player, give items, optionally pre-set lamp/grate state),
// execute the typed input(s) through the real driver pipeline, then verify the
// spec's expected post-state matches what the FSM reports. Each entry is
// independent — a fresh FSM per check so cross-contamination is impossible.
//
// Godot reads this spec from world_spec.gd (VERB_EFFECTS / apply_setup /
// verify_expect). The JS port has NO world_spec module, so the three pieces
// this test consumes are ported here verbatim as test-local helpers: the
// VERB_EFFECTS data table (canon transcription — same ids/setups/inputs/expects)
// plus apply_setup / verify_expect and the accessors they call. This faithfully
// reproduces the Godot test's behavior; the data is unchanged from the source.
import { file, ok, makeDriver } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_verb_effects");

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fsm = any;

// ---- ITEM_SPEC subset used by _force_take (verbatim from world_spec.gd) ----
interface ItemSpec {
  id: number;
  initial_room: number;
  kind: "treasure" | "item";
  dynamic_spawn: boolean;
}
const ITEM_SPEC: Record<string, ItemSpec> = {
  gold: { id: 110, initial_room: 18, kind: "treasure", dynamic_spawn: false },
  silver: { id: 111, initial_room: 28, kind: "treasure", dynamic_spawn: false },
  diamonds: { id: 112, initial_room: 27, kind: "treasure", dynamic_spawn: false },
  jewelry: { id: 113, initial_room: 29, kind: "treasure", dynamic_spawn: false },
  pearl: { id: 114, initial_room: 0, kind: "treasure", dynamic_spawn: true },
  vase: { id: 115, initial_room: 97, kind: "treasure", dynamic_spawn: false },
  eggs: { id: 116, initial_room: 92, kind: "treasure", dynamic_spawn: false },
  trident: { id: 117, initial_room: 95, kind: "treasure", dynamic_spawn: false },
  emerald: { id: 118, initial_room: 100, kind: "treasure", dynamic_spawn: false },
  spices: { id: 119, initial_room: 127, kind: "treasure", dynamic_spawn: false },
  chest: { id: 120, initial_room: 0, kind: "treasure", dynamic_spawn: true },
  pyramid: { id: 121, initial_room: 101, kind: "treasure", dynamic_spawn: false },
  rug: { id: 122, initial_room: 119, kind: "treasure", dynamic_spawn: false },
  coins: { id: 123, initial_room: 30, kind: "treasure", dynamic_spawn: false },
  chain: { id: 101, initial_room: 130, kind: "treasure", dynamic_spawn: false },
  rod: { id: 130, initial_room: 11, kind: "item", dynamic_spawn: false },
  keys: { id: 131, initial_room: 3, kind: "item", dynamic_spawn: false },
  lamp: { id: 142, initial_room: 3, kind: "item", dynamic_spawn: false },
  bottle: { id: 132, initial_room: 3, kind: "item", dynamic_spawn: false },
  cage: { id: 133, initial_room: 10, kind: "item", dynamic_spawn: false },
  food: { id: 134, initial_room: 3, kind: "item", dynamic_spawn: false },
  pillow: { id: 135, initial_room: 96, kind: "item", dynamic_spawn: false },
  clam: { id: 137, initial_room: 103, kind: "item", dynamic_spawn: false },
  magazine: { id: 140, initial_room: 106, kind: "item", dynamic_spawn: false },
  axe: { id: 136, initial_room: 0, kind: "item", dynamic_spawn: true },
  mark_rod: { id: 141, initial_room: 0, kind: "item", dynamic_spawn: true },
  batteries: { id: 139, initial_room: 0, kind: "item", dynamic_spawn: true },
  oyster: { id: 138, initial_room: 0, kind: "item", dynamic_spawn: true },
};

// ---- VERB_EFFECTS table (verbatim from world_spec.gd) ----
interface SetupStep {
  goto?: number;
  cmd?: string;
}
interface Setup {
  player_room?: number;
  carrying?: string[];
  lamp?: "lit" | "off";
  grate?: "locked" | "unlocked";
  pre_commands?: string[];
  setup_steps?: SetupStep[];
  then_player_room?: number;
}
interface VerbEffect {
  id: string;
  setup: Setup;
  input: string[];
  expect: Record<string, unknown>;
  notes: string;
}
const VERB_EFFECTS: VerbEffect[] = [
  { id: "xyzzy_house_to_debris", setup: { player_room: 3 }, input: ["xyzzy"], expect: { player_room: 11 }, notes: "canon magic-word teleport well-house -> debris room" },
  { id: "xyzzy_debris_to_house", setup: { player_room: 11 }, input: ["xyzzy"], expect: { player_room: 3 }, notes: "canon magic-word teleport debris -> well-house (palindromic)" },
  { id: "plugh_house_to_y2", setup: { player_room: 3 }, input: ["plugh"], expect: { player_room: 33 }, notes: "canon magic-word teleport well-house -> Y2" },
  { id: "plugh_y2_to_house", setup: { player_room: 33 }, input: ["plugh"], expect: { player_room: 3 }, notes: "canon magic-word teleport Y2 -> well-house (palindromic)" },
  { id: "light_lamp", setup: { player_room: 3, carrying: ["lamp"] }, input: ["light lamp"], expect: { lamp_lit: true }, notes: "canon obj#2 light verb transitions lamp $Off -> $Lit" },
  { id: "extinguish_lit_lamp", setup: { player_room: 3, carrying: ["lamp"], lamp: "lit" }, input: ["extinguish lamp"], expect: { lamp_lit: false }, notes: "canon extinguish reverses light" },
  { id: "unlock_grate_with_keys", setup: { player_room: 8, carrying: ["keys"] }, input: ["unlock grate"], expect: { grate_locked: false }, notes: "canon: keys unlock the grate at the depression (room 8)" },
  { id: "lock_grate_again", setup: { player_room: 8, carrying: ["keys"], grate: "unlocked" }, input: ["lock grate"], expect: { grate_locked: true }, notes: "lock-with-keys reverses unlock; standard canon symmetry" },
  { id: "wave_rod_at_fissure", setup: { player_room: 17, carrying: ["rod"] }, input: ["wave rod"], expect: { bridge_built: true }, notes: "canon: WAVE ROD at room 17 (east fissure) builds the crystal bridge" },
  { id: "feed_bear_tames_it", setup: { player_room: 130, carrying: ["food"] }, input: ["feed bear"], expect: { bear_state: "tame" }, notes: "canon: FEED BEAR with food in inventory transitions $Hungry -> $Tame" },
  {
    id: "release_bird_clears_snake",
    setup: { setup_steps: [{ goto: 10 }, { cmd: "take cage" }, { goto: 13 }, { cmd: "take bird" }, { goto: 19 }] },
    input: ["release bird"],
    expect: { snake_blocking: false },
    notes: "canon: RELEASE BIRD at canon 19 charms snake -> vanishes",
  },
  { id: "attack_dragon_kills_it", setup: { player_room: 119 }, input: ["attack dragon", "yes"], expect: { dragon_alive: false }, notes: "canon: ATTACK DRAGON + Y for 'with bare hands' kills dragon" },
  { id: "fill_empty_bottle_at_pool", setup: { player_room: 3, carrying: ["bottle"] }, input: ["fill bottle"], expect: { bottle_has_water: true }, notes: "canon: FILL BOTTLE at well-house (canon 3) gets water from pool" },
  { id: "break_clam_creates_oyster", setup: { player_room: 103, carrying: ["rod"] }, input: ["break clam"], expect: { clam_consumed: true, oyster_exists: true }, notes: "canon: BREAK CLAM at oyster room (clam in-room, rod carried) consumes clam, spawns oyster + pearl" },
  { id: "pour_water_grows_plant", setup: { player_room: 32, carrying: ["bottle"], setup_steps: [{ cmd: "fill bottle" }] }, input: ["pour water"], expect: {}, notes: "canon msg #112 — plant grows on POUR WATER at canon 32" },
  {
    id: "pour_oil_oils_door",
    setup: { setup_steps: [{ goto: 3 }, { cmd: "take bottle" }, { goto: 79 }, { cmd: "fill bottle" }, { goto: 94 }] },
    input: ["pour oil"],
    expect: {},
    notes: "canon msg #114 — oil dissolves the rust on door at canon 94",
  },
  { id: "eat_food_consumes_it", setup: { player_room: 3, carrying: ["food"] }, input: ["eat food"], expect: {}, notes: "canon msg #72 — eating food consumes the item" },
  { id: "drink_water_empties_bottle", setup: { player_room: 3, setup_steps: [{ cmd: "take bottle" }, { cmd: "fill bottle" }] }, input: ["drink water"], expect: { bottle_has_water: false }, notes: "canon msg #74 — drinking water empties the bottle" },
  { id: "read_magazine_prints_canon", setup: { player_room: 106, setup_steps: [{ cmd: "take magazine" }] }, input: ["read magazine"], expect: {}, notes: "canon msg #190" },
  { id: "light_lamp_in_dark_cave", setup: { player_room: 11, carrying: ["lamp"], lamp: "off" }, input: ["light lamp"], expect: { lamp_lit: true }, notes: "canon: light lamp works in any room, dark or lit" },
];

// ---- apply_setup (verbatim from world_spec.gd) ----
function resolveTreasure(fsm: Fsm, noun: string): Fsm {
  const map: Record<string, Fsm> = {
    gold: fsm.gold, silver: fsm.silver, diamonds: fsm.diamonds, jewelry: fsm.jewelry,
    pearl: fsm.pearl, vase: fsm.vase, eggs: fsm.eggs, trident: fsm.trident,
    emerald: fsm.emerald, spices: fsm.spices, chest: fsm.chest, pyramid: fsm.pyramid,
    rug: fsm.rug, coins: fsm.coins, chain: fsm.chain,
  };
  return map[noun] ?? null;
}
function itemInstance(fsm: Fsm, noun: string): Fsm {
  const map: Record<string, Fsm> = {
    rod: fsm.rod_item, keys: fsm.keys_item, lamp: fsm.lamp_item, bottle: fsm.bottle_item,
    cage: fsm.cage_item, food: fsm.food_item, pillow: fsm.pillow_item, clam: fsm.clam_item,
    magazine: fsm.magazine_item, axe: fsm.axe_item, mark_rod: fsm.mark_rod_item,
    batteries: fsm.batteries_item, oyster: fsm.oyster_item,
  };
  return map[noun] ?? null;
}

// Force a single noun into the player's inventory regardless of where the item
// currently is. Mirrors world_spec._force_take exactly.
function forceTake(fsm: Fsm, noun: string): void {
  const spec = ITEM_SPEC[noun];
  if (!spec) return;
  const playerRoom: number = fsm.player.get_room();
  if (spec.kind === "treasure") {
    const t = resolveTreasure(fsm, noun);
    if (t == null) return;
    t.reappear(playerRoom);
    t.try_take(playerRoom);
  } else {
    const it = itemInstance(fsm, noun);
    if (it == null) return;
    if (spec.dynamic_spawn) {
      it.try_drop(playerRoom);
      it.try_take(playerRoom);
    } else {
      const itemRoom = spec.initial_room;
      fsm.player.move_to(itemRoom);
      it.try_take(itemRoom);
      fsm.player.move_to(playerRoom);
    }
  }
  fsm.player.take(spec.id);
}

function applySetup(d: CcaDriver, setup: Setup): void {
  const fsm = d.machine();
  if (setup.player_room !== undefined) fsm.player.move_to(setup.player_room);
  if (setup.carrying !== undefined) {
    for (const noun of setup.carrying) forceTake(fsm, noun);
  }
  if (setup.lamp !== undefined) {
    if (setup.lamp === "lit" && !fsm.lamp.is_lit()) fsm.lamp.light();
    else if (setup.lamp === "off" && fsm.lamp.is_lit()) fsm.lamp.extinguish();
  }
  if (setup.grate !== undefined) {
    if (setup.grate === "unlocked" && fsm.grate_locked()) fsm.grate.unlock(true);
    else if (setup.grate === "locked" && !fsm.grate_locked()) fsm.grate.lock();
  }
  if (setup.pre_commands !== undefined) {
    for (const cmd of setup.pre_commands) d.input(cmd);
  }
  if (setup.setup_steps !== undefined) {
    for (const step of setup.setup_steps) {
      if (step.goto !== undefined) fsm.player.move_to(step.goto);
      else if (step.cmd !== undefined) d.input(step.cmd);
    }
  }
  if (setup.then_player_room !== undefined) fsm.player.move_to(setup.then_player_room);
}

// ---- verify_expect (verbatim from world_spec.gd) ----
function query(fsm: Fsm, key: string): unknown {
  switch (key) {
    case "player_room": return fsm.player_room();
    case "player_state": return fsm.player_state();
    case "lamp_lit": return fsm.lamp.is_lit();
    case "grate_locked": return fsm.grate_locked();
    case "bridge_built": return fsm.bridge_built();
    case "dragon_alive": return fsm.dragon_alive();
    case "bear_state": return fsm.bear.get_state();
    case "snake_blocking": return fsm.snake.is_blocking();
    case "bottle_has_water": return fsm.bottle.has_water();
    case "clam_consumed": return fsm.clam_item.get_state() !== "in_room" && !fsm.player.carrying(137);
    case "oyster_exists": return fsm.oyster_item.is_in_room(103) || fsm.player.carrying(138);
    case "score": return fsm.total_score();
    case "treasures_deposited": return fsm.treasures_deposited();
    case "endgame_state": return fsm.endgame_state();
    default: return null;
  }
}
function verifyExpect(fsm: Fsm, expected: Record<string, unknown>): string[] {
  const fails: string[] = [];
  for (const key of Object.keys(expected)) {
    const want = expected[key];
    const got = query(fsm, key);
    if (got !== want) fails.push(`${key}: expected ${String(want)}, observed ${String(got)}`);
  }
  return fails;
}

// ---- main loop (faithful port of _init) ----
console.log(`Verb-effects checked: ${VERB_EFFECTS.length}`);

let failures = 0;
for (const entry of VERB_EFFECTS) {
  const d = makeDriver();
  // make_driver lights the lamp by default; reset to canon off-state so spec's
  // `lamp` setup field is authoritative.
  if (d.machine().lamp.is_lit()) d.machine().lamp.extinguish();

  applySetup(d, entry.setup);

  for (const cmd of entry.input) d.input(cmd);

  const fails = verifyExpect(d.machine(), entry.expect);
  if (fails.length > 0) {
    console.log(`  [FAIL] ${entry.id}`);
    for (const f of fails) console.log(`        ${f}`);
    failures += 1;
  } else {
    console.log(`  [OK] ${entry.id}`);
  }
  // One assertion per entry: the spec's expected post-state matches the FSM.
  ok(`verb-effect ${entry.id} matches canon spec`, fails.length === 0);
}

ok(`every canon verb-effect matches spec (${failures} diverged)`, failures === 0);
