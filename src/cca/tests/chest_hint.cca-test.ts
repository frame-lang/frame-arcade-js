// Port of Godot tests/test_cca_chest_hint.gd — canon chest-only-outstanding
// hint (advent.for STMT 6020, msg #186): fires once when 14/15 treasures are
// deposited and the chest is still in the world. Same assertions.
import { file, expect, ok, expectContains, makeDriver } from "./_harness";

file("test_cca_chest_hint");

function notContains(label: string, lines: string[], needle: string): void {
  ok(`${label} (no "${needle}")`, !lines.join("\n").includes(needle));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function forceDeposit(t: any): void {
  const depositRoom = 3; // canon WELL_HOUSE_ROOM
  t.reappear(depositRoom);
  t.try_take(depositRoom);
  t.try_drop(depositRoom);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function depositAllButChest(a: any): void {
  for (const t of [a.gold, a.silver, a.diamonds, a.jewelry, a.pearl, a.vase, a.eggs, a.trident, a.emerald, a.spices, a.pyramid, a.rug, a.coins, a.chain]) {
    forceDeposit(t);
  }
}

// Phase 1: <14 deposited — no hint.
const d1 = makeDriver();
const l1 = d1.input("north");
notContains("no msg #186 with 0 treasures deposited", l1, "Shiver me timbers");
expect("hint latch still false", d1.machine().is_chest_hint_done(), false);

// Phase 2: 14 deposited + chest missing → hint fires.
const d2 = makeDriver();
depositAllButChest(d2.machine());
expect("setup: 14 treasures deposited", d2.machine().treasures_deposited(), 14);
expect("setup: chest not deposited", d2.machine().chest.is_deposited(), false);
const l2 = d2.input("north");
expectContains("first turn after threshold fires canon msg #186", l2, "Shiver me timbers");
expectContains("msg #186 mentions the maze", l2, "maze to hide me chest");
expect("hint latch armed", d2.machine().is_chest_hint_done(), true);

// Phase 3: re-fire suppressed by latch.
const l3 = d2.input("north");
notContains("second turn does NOT re-fire msg #186", l3, "Shiver me timbers");

// Phase 4: chest carried (not deposited) — hint suppressed.
const d4 = makeDriver();
depositAllButChest(d4.machine());
const here: number = d4.machine().player_room();
d4.machine().chest.reappear(here);
d4.machine().chest.try_take(here);
d4.machine().player.take(d4.machine().CHEST_ID);
const l4 = d4.input("north");
notContains("hint suppressed when chest is carried", l4, "Shiver me timbers");
