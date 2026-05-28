// Port of Godot tests/test_cca_treasure_values.gd — Phase C treasure-value
// cross-check, FSM-direct. Same assertions, same expected values.
//
// For each spec'd treasure: build a fresh FSM, measure total_score(),
// force-deposit just that one treasure (reappear dynamic-spawns first), measure
// total_score() again, assert the delta equals the spec's declared value.
//
// NOTE ON THE SPEC TABLE: the Godot test reads cca/scripts/world_spec.gd's
// ITEM_SPEC. There is no world_spec in the JS port — the per-treasure value
// (14) and initial_room are baked into cca.fjs's `xxx = @@Treasure(room, 14)`
// declarations. To keep the test faithful we inline the canon treasure rows
// from world_spec.gd (value/initial_room/dynamic_spawn) and iterate them in the
// same order the GDScript Dictionary yields.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_treasure_values");

// Canon well-house room — must match Adventure.DEPOSIT_ROOM.
const DEPOSIT_ROOM = 3;

// A "safe" room to reappear dynamic-spawn treasures at before the test takes
// them. Room 11 (debris room) is in the cave with no extra mechanics.
const SAFE_REAPPEAR_ROOM = 11;

interface TreasureSpec {
  value: number;
  initial_room: number;
  dynamic_spawn: boolean;
}

// The 15 canon treasures, inlined from world_spec.gd ITEM_SPEC (kind=="treasure"),
// in declaration order.
const TREASURE_SPEC: [string, TreasureSpec][] = [
  ["gold", { value: 14, initial_room: 18, dynamic_spawn: false }],
  ["silver", { value: 14, initial_room: 28, dynamic_spawn: false }],
  ["diamonds", { value: 14, initial_room: 27, dynamic_spawn: false }],
  ["jewelry", { value: 14, initial_room: 29, dynamic_spawn: false }],
  ["pearl", { value: 14, initial_room: 0, dynamic_spawn: true }],
  ["vase", { value: 14, initial_room: 97, dynamic_spawn: false }],
  ["eggs", { value: 14, initial_room: 92, dynamic_spawn: false }],
  ["trident", { value: 14, initial_room: 95, dynamic_spawn: false }],
  ["emerald", { value: 14, initial_room: 100, dynamic_spawn: false }],
  ["spices", { value: 14, initial_room: 127, dynamic_spawn: false }],
  ["chest", { value: 14, initial_room: 0, dynamic_spawn: true }],
  ["pyramid", { value: 14, initial_room: 101, dynamic_spawn: false }],
  ["rug", { value: 14, initial_room: 119, dynamic_spawn: false }],
  ["coins", { value: 14, initial_room: 30, dynamic_spawn: false }],
  ["chain", { value: 14, initial_room: 130, dynamic_spawn: false }],
];

for (const [noun, spec] of TREASURE_SPEC) {
  const expected: number = spec.value;
  const observed: number = measureDepositDelta(noun, spec);
  expect(`${noun} deposit value (canon +${expected})`, observed, expected);
}

// Build a fresh FSM, deposit exactly one treasure, return the score delta.
// Handles dynamic-spawn treasures by reappear()-ing them at a known room first.
function measureDepositDelta(noun: string, spec: TreasureSpec): number {
  const fsm = makeAdventure();
  fsm.setup_default_aspects();
  const baseline: number = fsm.total_score();
  const t = treasureInstance(fsm, noun);
  if (t == null) {
    return -999;
  }

  let pickup_room: number = spec.initial_room;
  if (spec.dynamic_spawn) {
    // Manually spawn so we can take + deposit. reappear() drops it at the named
    // room; that's enough to exercise the take->deposit pair.
    t.reappear(SAFE_REAPPEAR_ROOM);
    pickup_room = SAFE_REAPPEAR_ROOM;
  }

  let took: boolean = t.try_take(pickup_room);
  if (!took) {
    // Take failed (maybe at wrong room, or in wrong state). Fall back: reappear
    // at safe room and retry.
    t.reappear(SAFE_REAPPEAR_ROOM);
    took = t.try_take(SAFE_REAPPEAR_ROOM);
    if (!took) {
      return -998;
    }
  }

  t.try_drop(DEPOSIT_ROOM);
  const delta: number = fsm.total_score() - baseline;
  return delta;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function treasureInstance(fsm: any, noun: string): any {
  switch (noun) {
    case "gold":
      return fsm.gold;
    case "silver":
      return fsm.silver;
    case "diamonds":
      return fsm.diamonds;
    case "jewelry":
      return fsm.jewelry;
    case "pearl":
      return fsm.pearl;
    case "vase":
      return fsm.vase;
    case "eggs":
      return fsm.eggs;
    case "trident":
      return fsm.trident;
    case "emerald":
      return fsm.emerald;
    case "spices":
      return fsm.spices;
    case "chest":
      return fsm.chest;
    case "pyramid":
      return fsm.pyramid;
    case "rug":
      return fsm.rug;
    case "coins":
      return fsm.coins;
    case "chain":
      return fsm.chain;
  }
  return null;
}
