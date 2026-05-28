// Port of Godot tests/test_cca_world_spec.gd — Phase C Layer 2 canon-fidelity
// check for ITEM PLACEMENTS. Builds a fresh Cca FSM (makeAdventure +
// setup_default_aspects, dwarves deliberately NOT woken) and asserts every
// spec'd item is at its canon-declared room. The probe and unit tests can pass
// while the FSM's item-init code drifts away from canon; this test catches that
// drift at the smallest scope — a fresh world before any commands.
//
// NOTE ON THE SPEC TABLE: the Godot test reads cca/scripts/world_spec.gd's
// ITEM_SPEC and calls WorldSpec.check_initial_placements(fsm). There is no
// world_spec module in the JS port, so we inline the canon ITEM_SPEC rows
// (noun → id/initial_room/kind) VERBATIM from world_spec.gd and reimplement
// observed_location() / check_initial_placements() against the JS FSM
// accessors (treasure.get_location(), item.is_in_room(r), player.carrying(id)).
// Same data, same logic, same expected result: zero violations.
//
// The Godot test prints a report and quit(violations.size()); it PASSES when a
// fresh world matches canon (which it should). We assert violations === 0 and
// print the same-shaped report; any divergence is a genuine JS-init bug.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_world_spec");

type Kind = "treasure" | "item";
interface ItemRow {
  id: number;
  initial_room: number;
  kind: Kind;
}

// Inlined VERBATIM from world_spec.gd ITEM_SPEC, in GDScript Dictionary order.
// 0 means "in limbo (no room)" — the canon-correct initial state for
// dynamic-spawn items (pearl, chest, axe, mark_rod, batteries, oyster).
const ITEM_SPEC: Record<string, ItemRow> = {
  // The 15 canon treasures
  gold: { id: 110, initial_room: 18, kind: "treasure" },
  silver: { id: 111, initial_room: 28, kind: "treasure" },
  diamonds: { id: 112, initial_room: 27, kind: "treasure" },
  jewelry: { id: 113, initial_room: 29, kind: "treasure" },
  pearl: { id: 114, initial_room: 0, kind: "treasure" },
  vase: { id: 115, initial_room: 97, kind: "treasure" },
  eggs: { id: 116, initial_room: 92, kind: "treasure" },
  trident: { id: 117, initial_room: 95, kind: "treasure" },
  emerald: { id: 118, initial_room: 100, kind: "treasure" },
  spices: { id: 119, initial_room: 127, kind: "treasure" },
  chest: { id: 120, initial_room: 0, kind: "treasure" },
  pyramid: { id: 121, initial_room: 101, kind: "treasure" },
  rug: { id: 122, initial_room: 119, kind: "treasure" },
  coins: { id: 123, initial_room: 30, kind: "treasure" },
  chain: { id: 101, initial_room: 130, kind: "treasure" },
  // Non-treasure carriables
  rod: { id: 130, initial_room: 11, kind: "item" },
  keys: { id: 131, initial_room: 3, kind: "item" },
  lamp: { id: 142, initial_room: 3, kind: "item" },
  bottle: { id: 132, initial_room: 3, kind: "item" },
  cage: { id: 133, initial_room: 10, kind: "item" },
  food: { id: 134, initial_room: 3, kind: "item" },
  pillow: { id: 135, initial_room: 96, kind: "item" },
  clam: { id: 137, initial_room: 103, kind: "item" },
  magazine: { id: 140, initial_room: 106, kind: "item" },
  // Dynamic-spawn items (start in limbo, room 0)
  axe: { id: 136, initial_room: 0, kind: "item" },
  mark_rod: { id: 141, initial_room: 0, kind: "item" },
  batteries: { id: 139, initial_room: 0, kind: "item" },
  oyster: { id: 138, initial_room: 0, kind: "item" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fsm = any;

function treasureInstance(fsm: Fsm, noun: string): Fsm {
  switch (noun) {
    case "gold": return fsm.gold;
    case "silver": return fsm.silver;
    case "diamonds": return fsm.diamonds;
    case "jewelry": return fsm.jewelry;
    case "pearl": return fsm.pearl;
    case "vase": return fsm.vase;
    case "eggs": return fsm.eggs;
    case "trident": return fsm.trident;
    case "emerald": return fsm.emerald;
    case "spices": return fsm.spices;
    case "chest": return fsm.chest;
    case "pyramid": return fsm.pyramid;
    case "rug": return fsm.rug;
    case "coins": return fsm.coins;
    case "chain": return fsm.chain;
  }
  return null;
}

function itemInstance(fsm: Fsm, noun: string): Fsm {
  switch (noun) {
    case "rod": return fsm.rod_item;
    case "keys": return fsm.keys_item;
    case "lamp": return fsm.lamp_item;
    case "bottle": return fsm.bottle_item;
    case "cage": return fsm.cage_item;
    case "food": return fsm.food_item;
    case "pillow": return fsm.pillow_item;
    case "clam": return fsm.clam_item;
    case "magazine": return fsm.magazine_item;
    case "axe": return fsm.axe_item;
    case "mark_rod": return fsm.mark_rod_item;
    case "batteries": return fsm.batteries_item;
    case "oyster": return fsm.oyster_item;
  }
  return null;
}

// Reimplements world_spec.gd observed_location(): -1 carried, else room number;
// 0 = in limbo. Treasures expose get_location() directly; items have only
// is_in_room(r), so we scan canon rooms 1..140 (0 = limbo if no room matches).
function observedLocation(fsm: Fsm, noun: string): number {
  const spec = ITEM_SPEC[noun];
  if (fsm.player.carrying(spec.id)) return -1;
  if (spec.kind === "treasure") {
    const t = treasureInstance(fsm, noun);
    return t == null ? -2 : t.get_location();
  }
  const inst = itemInstance(fsm, noun);
  if (inst == null) return -2;
  for (let r = 1; r <= 140; r++) {
    if (inst.is_in_room(r)) return r;
  }
  return 0; // in limbo
}

console.log("=== CCA world-spec init check (Phase C Layer 2) ===");
console.log("");

const fsm = makeAdventure();
fsm.setup_default_aspects();
// Deliberately do NOT wake_dwarves() — dwarves don't affect item placement.

interface Violation {
  noun: string;
  kind: Kind;
  expected: number;
  observed: number;
}
const violations: Violation[] = [];
for (const noun of Object.keys(ITEM_SPEC)) {
  const spec = ITEM_SPEC[noun];
  const observed = observedLocation(fsm, noun);
  if (observed !== spec.initial_room) {
    violations.push({ noun, kind: spec.kind, expected: spec.initial_room, observed });
  }
}

console.log(`Items checked:    ${Object.keys(ITEM_SPEC).length}`);
console.log(`Init violations:  ${violations.length}`);
console.log("");
for (const v of violations) {
  console.log(`  ${v.noun} (${v.kind}): expected room ${v.expected}, observed ${v.observed}`);
}
if (violations.length === 0) {
  console.log("PASS — every spec'd item is at its canon-declared room");
}

expect("init violations (fresh world matches canon)", violations.length, 0);
