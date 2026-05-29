// Port of Godot tests/test_cca_canonical.gd — the stage-DAG canonical playthrough
// ("if this passes, the game works"). NO move_to teleports: every navigation is a
// real do_command("move", dest) resolved against the topology. Stages are
// checkpointed via save_state/restore_state to fast-forward between them; each
// stage asserts post-conditions. Branch stages fork off earlier checkpoints to
// exercise alternate paths (dragon-declined, vase-shatter, resurrection cycle,
// dwarves). init → won via real commands only.
import { file, expect, ok, makeAdventure } from "./_harness";
import { ROOMS } from "../topology";

file("test_cca_canonical");

/* eslint-disable @typescript-eslint/no-explicit-any */
type Adv = any;
type Action = [string, string];
type AssertFn = (a: Adv) => void;
interface Stage {
  name: string;
  from: string;
  actions: Action[];
  assert: AssertFn;
  checkpoint?: string;
}

const checkpoints = new Map<string, string>();

// ---- assert helpers (mirror the Godot _assert_* functions) ----
const A = {
  at_road: (a: Adv) => {
    expect("player_room", a.player_room(), 1);
    expect("player_state", a.player_state(), "alive");
  },
  in_well_house: (a: Adv) => expect("player_room", a.player_room(), 3),
  keys_and_bottle: (a: Adv) => {
    expect("keys carried", a.player.carrying(a.KEYS_ID), true);
    expect("bottle carried", a.player.carrying(a.BOTTLE_ID), true);
  },
  lamp_lit: (a: Adv) => {
    expect("lamp lit", a.is_lit(), true);
    expect("lamp state", a.get_lamp_state(), "bright");
  },
  at_depression: (a: Adv) => {
    expect("player_room", a.player_room(), 8);
    expect("grate locked", a.grate_locked(), true);
  },
  grate_unlocked: (a: Adv) => {
    expect("grate unlocked", a.grate_locked(), false);
    expect("at depression", a.player_room(), 8);
  },
  cage_at_cobbles: (a: Adv) => {
    expect("cage carried", a.player.carrying(a.CAGE_ID), true);
    expect("at cobbles", a.player_room(), 10);
  },
  rod_carried: (a: Adv) => {
    expect("rod carried", a.player.carrying(a.ROD_ID), true);
    expect("at debris", a.player_room(), 11);
  },
  bird_and_rod: (a: Adv) => {
    expect("bird carried", a.player.carrying(100), true);
    expect("rod carried", a.player.carrying(a.ROD_ID), true);
    expect("at bird room", a.player_room(), 13);
  },
  at_snake_passage: (a: Adv) => {
    expect("at snake room", a.player_room(), 19);
    expect("snake state", a.snake_state(), "blocking");
    expect("bird carried", a.player.carrying(100), true);
  },
  snake_cleared: (a: Adv) => {
    expect("snake state", a.snake_state(), "gone");
    expect("at room 19", a.player_room(), 19);
  },
  rod_and_gold: (a: Adv) => {
    expect("rod carried", a.player.carrying(a.ROD_ID), true);
    expect("gold carried", a.player.carrying(110), true);
    expect("at Y2", a.player_room(), 33);
  },
  at_dragon: (a: Adv) => {
    expect("player_room", a.player_room(), 119);
    expect("dragon alive", a.dragon_alive(), true);
  },
  dragon_dead: (a: Adv) => {
    expect("dragon state", a.dragon_state(), "dead");
    expect("dragon alive", a.dragon_alive(), false);
  },
  rug_at_119: (a: Adv) => {
    expect("rug carried", a.player.carrying(122), true);
    expect("at dragon canyon", a.player_room(), 119);
    expect("diamonds not yet", a.player.carrying(112), false);
  },
  diamonds_rug: (a: Adv) => {
    expect("diamonds carried", a.player.carrying(112), true);
    expect("rug carried", a.player.carrying(122), true);
    expect("at west bank", a.player_room(), 27);
  },
  three_deposited: (a: Adv) => {
    expect("at well house", a.player_room(), 3);
    expect("treasures deposited", a.treasures_deposited(), 3);
    expect("diamonds deposited", a.diamonds.is_deposited(), true);
    expect("rug deposited", a.rug.is_deposited(), true);
    expect("gold deposited", a.gold.is_deposited(), true);
  },
  silver_carried: (a: Adv) => {
    expect("silver carried", a.player.carrying(111), true);
    expect("at canon-28", a.player_room(), 28);
  },
  pearl_emerald: (a: Adv) => {
    expect("at Y2", a.player_room(), 33);
    expect("pearl carried", a.player.carrying(114), true);
    expect("emerald carried", a.player.carrying(118), true);
  },
  bear_following: (a: Adv) => {
    expect("bear state", a.bear_state(), "following");
    expect("chain carried", a.player.carrying(101), true);
    expect("at bear chamber", a.player_room(), 130);
  },
  troll_vanished: (a: Adv) => {
    expect("troll state", a.troll_state(), "vanished");
    expect("at troll bridge", a.player_room(), 117);
    expect("chain dropped", a.player.carrying(101), false);
  },
  jewelry_carried: (a: Adv) => {
    expect("jewelry carried", a.player.carrying(113), true);
    expect("at south chamber", a.player_room(), 29);
  },
  pillow_at_well_house: (a: Adv) => {
    expect("at well house", a.player_room(), 3);
    expect("pillow not carried", a.player.carrying(a.PILLOW_ID), false);
    expect("pillow at room 3", a.pillow_item.get_location(), 3);
  },
  batch_a: (a: Adv) => {
    expect("vase carried", a.player.carrying(115), true);
    expect("eggs carried", a.player.carrying(116), true);
    expect("trident carried", a.player.carrying(117), true);
  },
  batch_b_partial: (a: Adv) => expect("chest carried", a.player.carrying(120), true),
  batch_c: (a: Adv) => {
    expect("coins carried", a.player.carrying(123), true);
    expect("chain carried", a.player.carrying(a.CHAIN_ID), true);
  },
  all_15: (a: Adv) => {
    expect("all 15 deposited", a.treasures_deposited(), 15);
    expect("treasure score", a.treasure_score(), 210);
    expect("endgame past active", a.endgame_state() !== "active", true);
  },
  in_repository: (a: Adv) => {
    expect("endgame state", a.endgame_state(), "in_repository");
    expect("player teleported to canon Repository", a.player_room(), 116);
  },
  won: (a: Adv) => {
    expect("endgame won", a.endgame_won(), true);
    expect("endgame state", a.endgame_state(), "won");
    expect("endgame component", a.endgame_score(), 50);
  },
  dragon_sleeping: (a: Adv) => {
    expect("dragon state", a.dragon_state(), "sleeping");
    expect("dragon alive", a.dragon_alive(), true);
  },
  vase_broken: (a: Adv) => {
    expect("vase state", a.vase.get_state(), "broken");
    expect("vase value 0", a.vase.get_value(), 0);
    expect("vase carried", a.player.carrying(115), false);
  },
  dead_bear_attacking: (a: Adv) => {
    expect("player state", a.player_state(), "dead");
    expect("bear state", a.bear_state(), "attacking");
    expect("deaths == 1", a.player.get_deaths(), 1);
  },
  permadead: (a: Adv) => {
    expect("player state", a.player_state(), "permadead");
    expect("deaths == 4", a.player.get_deaths(), 4);
  },
  eggs_back_at_giant: (a: Adv) => {
    expect("eggs state", a.eggs.get_state(), "in_room");
    expect("eggs at giant", a.eggs.get_location(), 92);
    expect("eggs not deposited", a.eggs.is_deposited(), false);
  },
  plant_tall: (a: Adv) => {
    expect("plant tall", a.plant_is_tall(), true);
    expect("plant huge", a.plant_is_huge(), false);
    expect("bottle empty", a.bottle_has_water(), false);
    expect("at west pit", a.player_room(), 25);
  },
  plant_huge: (a: Adv) => {
    expect("plant huge", a.plant_is_huge(), true);
    expect("bottle empty", a.bottle_has_water(), false);
    expect("at west pit", a.player_room(), 25);
  },
  eggs_at_giant: (a: Adv) => {
    expect("eggs carried", a.player.carrying(a.EGGS_ID), true);
    expect("at giant chamber", a.player_room(), 92);
  },
  dwarves_living: (a: Adv) => expect("living dwarves", a.living_dwarves(), 5),
};
const assertRoom = (want: number): AssertFn => (a) => expect("player_room", a.player_room(), want);
const assertDeposited = (want: number): AssertFn => (a) => {
  expect("at well house", a.player_room(), 3);
  expect("treasures deposited", a.treasures_deposited(), want);
};
const assertRoomAndBear = (room: number, bear: string): AssertFn => (a) => {
  expect("player_room", a.player_room(), room);
  expect("bear state", a.bear_state(), bear);
};
const assertDeadCount = (want: number): AssertFn => (a) => {
  expect("player state", a.player_state(), "dead");
  expect("deaths", a.player.get_deaths(), want);
};

const STAGES: Stage[] = [
  { name: "init_outside_road", from: "init", actions: [], assert: A.at_road, checkpoint: "outside_road" },
  { name: "in_well_house", from: "outside_road", actions: [["go", "in"]], assert: A.in_well_house, checkpoint: "well_house" },
  { name: "keys_and_bottle_taken", from: "well_house", actions: [["take", "keys"], ["take", "bottle"]], assert: A.keys_and_bottle, checkpoint: "carrying_keys_bottle" },
  { name: "lamp_lit", from: "carrying_keys_bottle", actions: [["light", "lamp"]], assert: A.lamp_lit, checkpoint: "lamp_lit" },
  { name: "outside_grate", from: "lamp_lit", actions: [["go", "out"], ["go", "south"], ["go", "south"], ["go", "south"]], assert: A.at_depression, checkpoint: "at_depression" },
  { name: "grate_unlocked", from: "at_depression", actions: [["unlock", "grate"]], assert: A.grate_unlocked, checkpoint: "grate_unlocked" },
  { name: "below_grate", from: "grate_unlocked", actions: [["go", "down"]], assert: assertRoom(9), checkpoint: "below_grate" },
  { name: "cobbles_with_cage", from: "below_grate", actions: [["go", "west"], ["take", "cage"]], assert: A.cage_at_cobbles, checkpoint: "carrying_cage" },
  { name: "debris_room", from: "carrying_cage", actions: [["go", "west"]], assert: assertRoom(11), checkpoint: "debris_room" },
  { name: "rod_taken", from: "debris_room", actions: [["take", "rod"]], assert: A.rod_carried, checkpoint: "carrying_rod" },
  { name: "bird_chamber", from: "carrying_rod", actions: [["go", "west"], ["go", "up"]], assert: assertRoom(13), checkpoint: "bird_chamber" },
  { name: "bird_taken", from: "bird_chamber", actions: [["drop", "rod"], ["take", "bird"], ["take", "rod"]], assert: A.bird_and_rod, checkpoint: "carrying_bird_rod" },
  { name: "at_snake_passage", from: "carrying_bird_rod", actions: [["go", "west"], ["go", "down"], ["go", "north"]], assert: A.at_snake_passage, checkpoint: "snake_blocking" },
  { name: "snake_cleared", from: "snake_blocking", actions: [["release", "bird"]], assert: A.snake_cleared, checkpoint: "snake_cleared" },
  {
    name: "gold_taken_back_at_y2", from: "snake_cleared",
    actions: [["go", "east"], ["go", "south"], ["take", "gold"], ["go", "north"], ["go", "down"], ["go", "north"], ["go", "north"]],
    assert: A.rod_and_gold, checkpoint: "carrying_rod_gold",
  },
  { name: "at_y2", from: "carrying_rod_gold", actions: [], assert: assertRoom(33), checkpoint: "at_y2" },
  {
    name: "at_dragon", from: "at_y2",
    actions: [["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "slab"], ["go", "up"], ["go", "south"]],
    assert: A.at_dragon, checkpoint: "facing_dragon",
  },
  { name: "dragon_killed", from: "facing_dragon", actions: [["attack", "dragon"], ["yes", ""]], assert: A.dragon_dead, checkpoint: "dragon_dead" },
  { name: "rug_taken", from: "dragon_dead", actions: [["take", "rug"]], assert: A.rug_at_119, checkpoint: "carrying_rug" },
  {
    name: "diamonds_taken_at_west_bank", from: "carrying_rug",
    actions: [["go", "north"], ["go", "down"], ["go", "north"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["go", "east"], ["go", "up"], ["go", "west"], ["wave", "rod"], ["go", "over"], ["take", "diamonds"]],
    assert: A.diamonds_rug, checkpoint: "carrying_first_haul",
  },
  {
    name: "deposit_first_haul", from: "carrying_first_haul",
    actions: [["go", "over"], ["go", "east"], ["go", "down"], ["go", "north"], ["go", "north"], ["plugh", ""], ["drop", "diamonds"], ["drop", "rug"], ["drop", "gold"]],
    assert: A.three_deposited, checkpoint: "after_first_deposit",
  },
  { name: "take_silver", from: "after_first_deposit", actions: [["plugh", ""], ["go", "south"], ["take", "silver"]], assert: A.silver_carried, checkpoint: "carrying_silver" },
  { name: "deposit_silver", from: "carrying_silver", actions: [["go", "north"], ["plugh", ""], ["drop", "silver"]], assert: assertDeposited(4), checkpoint: "after_silver" },
  {
    name: "take_pearl_emerald", from: "after_silver",
    actions: [["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "east"], ["go", "north"], ["take", "clam"], ["drop", "clam"], ["break", "clam"], ["take", "pearl"], ["go", "south"], ["go", "west"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plover", ""], ["take", "emerald"], ["plover", ""]],
    assert: A.pearl_emerald, checkpoint: "carrying_pearl_emerald",
  },
  { name: "deposit_pearl_emerald", from: "carrying_pearl_emerald", actions: [["plugh", ""], ["drop", "pearl"], ["drop", "emerald"]], assert: assertDeposited(6), checkpoint: "after_pearl" },
  {
    name: "plant_watered_to_huge", from: "after_pearl",
    actions: [["take", "food"], ["fill", "bottle"], ["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "slab"], ["go", "south"], ["go", "down"], ["water", "plant"], ["go", "up"], ["go", "west"], ["go", "north"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plugh", ""], ["fill", "bottle"], ["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "slab"], ["go", "south"], ["go", "down"], ["water", "plant"]],
    assert: A.plant_huge, checkpoint: "plant_huge",
  },
  { name: "eggs_taken_at_giant", from: "plant_huge", actions: [["go", "climb"], ["go", "east"], ["go", "west"], ["take", "eggs"]], assert: A.eggs_at_giant, checkpoint: "carrying_eggs" },
  {
    name: "at_bear_chamber", from: "carrying_eggs",
    actions: [["take", "food"], ["go", "north"], ["go", "north"], ["go", "west"], ["go", "down"], ["go", "sw"], ["go", "up"], ["throw", "eggs"], ["go", "over"], ["go", "barren"], ["go", "enter"]],
    assert: assertRoomAndBear(130, "hungry"), checkpoint: "at_bear_chamber",
  },
  { name: "bear_tame_chained", from: "at_bear_chamber", actions: [["feed", "bear"], ["take", "chain"]], assert: A.bear_following, checkpoint: "bear_following" },
  {
    name: "troll_vanished", from: "bear_following",
    actions: [["go", "out"], ["go", "west"], ["go", "north"], ["go", "west"], ["go", "west"], ["go", "over"], ["drop", "chain"]],
    assert: A.troll_vanished, checkpoint: "troll_vanished",
  },
  { name: "eggs_recalled_after_toll", from: "troll_vanished", actions: [["fee", ""], ["fie", ""], ["foe", ""], ["foo", ""]], assert: A.eggs_back_at_giant, checkpoint: "eggs_recalled" },
  {
    name: "take_jewelry", from: "eggs_recalled",
    actions: [["go", "sw"], ["go", "down"], ["go", "bedquilt"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["go", "east"], ["go", "up"], ["go", "north"], ["go", "south"], ["take", "jewelry"]],
    assert: A.jewelry_carried, checkpoint: "carrying_jewelry",
  },
  { name: "deposit_jewelry", from: "carrying_jewelry", actions: [["go", "north"], ["go", "north"], ["go", "north"], ["plugh", ""], ["drop", "jewelry"]], assert: assertDeposited(7), checkpoint: "after_jewelry" },
  {
    name: "pillow_to_well_house", from: "after_jewelry",
    actions: [["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "west"], ["go", "east"], ["take", "pillow"], ["go", "west"], ["go", "ne"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plugh", ""], ["drop", "pillow"]],
    assert: A.pillow_at_well_house, checkpoint: "after_pillow",
  },
  {
    name: "deep_cave_batch_a_takes", from: "after_pillow",
    actions: [["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "west"], ["go", "oriental"], ["take", "vase"], ["go", "west"], ["go", "bedquilt"], ["go", "slab"], ["go", "south"], ["go", "down"], ["go", "climb"], ["go", "east"], ["go", "west"], ["take", "eggs"], ["go", "north"], ["go", "north"], ["take", "trident"]],
    assert: A.batch_a, checkpoint: "carrying_batch_a",
  },
  {
    name: "deposit_batch_a", from: "carrying_batch_a",
    actions: [["go", "south"], ["go", "south"], ["go", "south"], ["go", "down"], ["go", "up"], ["go", "west"], ["go", "north"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plugh", ""], ["drop", "eggs"], ["drop", "trident"], ["drop", "vase"]],
    assert: assertDeposited(10), checkpoint: "after_batch_a",
  },
  {
    name: "deep_cave_batch_b_takes", from: "after_batch_a",
    actions: [["spawn_chest", ""], ["plugh", ""], ["go", "east"], ["go", "up"], ["go", "south"], ["take", "chest"]],
    assert: A.batch_b_partial, checkpoint: "carrying_batch_b",
  },
  {
    name: "deposit_batch_b", from: "carrying_batch_b",
    actions: [["go", "north"], ["go", "north"], ["go", "north"], ["go", "north"], ["plugh", ""], ["drop", "chest"], ["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "west"], ["go", "oriental"], ["go", "west"], ["go", "sw"], ["go", "up"], ["go", "over"], ["go", "fork"], ["go", "ne"], ["go", "east"], ["take", "spices"], ["go", "west"], ["go", "south"], ["go", "west"], ["go", "west"], ["go", "over"], ["go", "sw"], ["go", "down"], ["go", "bedquilt"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plugh", ""], ["drop", "spices"], ["plugh", ""], ["plover", ""], ["go", "ne"], ["take", "pyramid"], ["go", "south"], ["plover", ""], ["plugh", ""], ["drop", "pyramid"]],
    assert: assertDeposited(13), checkpoint: "after_batch_b",
  },
  {
    name: "deep_cave_batch_c_takes", from: "after_batch_b",
    actions: [["plugh", ""], ["go", "east"], ["go", "up"], ["go", "north"], ["go", "west"], ["take", "coins"], ["go", "east"], ["go", "north"], ["go", "north"], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "west"], ["go", "oriental"], ["go", "west"], ["go", "sw"], ["go", "up"], ["take", "chain"]],
    assert: A.batch_c, checkpoint: "carrying_batch_c",
  },
  {
    name: "deposit_batch_c", from: "carrying_batch_c",
    actions: [["go", "sw"], ["go", "down"], ["go", "bedquilt"], ["go", "up"], ["go", "east"], ["go", "up"], ["go", "north"], ["plugh", ""], ["drop", "coins"], ["drop", "chain"]],
    assert: A.all_15, checkpoint: "all_deposited",
  },
  { name: "in_repository", from: "all_deposited", actions: [["force_in_repository", ""]], assert: A.in_repository, checkpoint: "in_repository" },
  { name: "won", from: "in_repository", actions: [["detonate", ""]], assert: A.won, checkpoint: "won" },
  // ----- branch / fork stages -----
  { name: "dragon_declined", from: "facing_dragon", actions: [["attack", "dragon"], ["no", ""]], assert: A.dragon_sleeping, checkpoint: "dragon_declined" },
  { name: "dragon_killed_after_decline", from: "dragon_declined", actions: [["attack", "dragon"], ["yes", ""]], assert: A.dragon_dead },
  { name: "vase_shattered_mid_game", from: "carrying_batch_a", actions: [["drop", "vase"]], assert: A.vase_broken, checkpoint: "vase_shattered" },
  { name: "bear_maul", from: "at_bear_chamber", actions: [["take", "chain"]], assert: A.dead_bear_attacking, checkpoint: "after_first_bear_death" },
  { name: "second_death", from: "after_first_bear_death", actions: [["revive", ""], ["die", ""]], assert: assertDeadCount(2) },
  { name: "third_death", from: "after_first_bear_death", actions: [["revive", ""], ["die", ""], ["revive", ""], ["die", ""]], assert: assertDeadCount(3) },
  { name: "permadead_after_fourth", from: "after_first_bear_death", actions: [["revive", ""], ["die", ""], ["revive", ""], ["die", ""], ["revive", ""], ["die", ""]], assert: A.permadead },
  { name: "eggs_summoned_back", from: "after_batch_a", actions: [["fee", ""], ["fie", ""], ["foe", ""], ["foo", ""]], assert: A.eggs_back_at_giant },
  {
    name: "plant_watered_to_tall", from: "after_first_deposit",
    actions: [["fill", "bottle"], ["plugh", ""], ["go", "south"], ["go", "down"], ["go", "bedquilt"], ["go", "slab"], ["go", "south"], ["go", "down"], ["water", "plant"]],
    assert: A.plant_tall,
  },
  { name: "dwarves_woken", from: "after_first_deposit", actions: [["wake_dwarves", ""]], assert: A.dwarves_living },
];

function runStage(stage: Stage): void {
  const a = makeAdventure();
  a.setup_default_aspects();
  // Defer the cave-closing teleport + dwarf auto-wake so the long walk-driven
  // playthrough isn't cut off mid-stage (mirrors the Godot rig).
  a.endgame.CLOSING_DURATION = 1000;
  a.DWARF_WAKE_THRESHOLD = 9999;
  if (stage.from !== "init") {
    const bytes = checkpoints.get(stage.from);
    if (bytes === undefined) {
      ok(`[${stage.name}] checkpoint '${stage.from}' exists`, false);
      return;
    }
    a.restore_state(bytes);
  }
  for (const [verb, arg] of stage.actions) {
    if (verb === "go") {
      const room = a.player_room();
      const exits = ROOMS[room] ?? {};
      if (!(arg in exits)) {
        ok(`[${stage.name}] exit '${arg}' from room ${room}`, false);
        return;
      }
      a.do_command("move", String(exits[arg]));
      a.tick();
    } else if (verb === "tick") {
      a.tick();
    } else if (verb === "spawn_chest") {
      a.chest.reappear(a.CHEST_ROOM);
    } else if (verb === "force_in_repository") {
      let safety = 2000;
      while (!a.endgame.in_repository() && safety > 0) {
        a.tick();
        safety -= 1;
      }
    } else if (verb === "detonate") {
      a.detonate_marker();
    } else if (verb === "die") {
      a.player.die();
    } else if (verb === "revive") {
      a.player.revive();
    } else if (verb === "wake_dwarves") {
      a.wake_dwarves();
    } else {
      a.do_command(verb, arg);
      a.tick();
    }
  }
  stage.assert(a);
  if (stage.checkpoint) checkpoints.set(stage.checkpoint, a.save_state());
}

for (const stage of STAGES) runStage(stage);
