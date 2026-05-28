// Port of Godot tests/test_cca_affordance_fsm_agree.gd — catches affordance/FSM
// divergence: places where the driver's affordance enumerator (listActionsHere)
// encodes the same fact as an FSM predicate and the two drift apart. The real
// bug it caught: list_actions_here claimed canon 23 was a water source while the
// FSM's _at_water_source() didn't, so BFS wasted turns at 23 and never filled at
// the eight real sources. Here we verify the fill-bottle affordance set equals
// (_at_water_source ∪ _at_oil_source) over every canon room, both directions.
import { file, ok } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_affordance_fsm_agree");

// Driver with the player at `room` carrying an empty bottle (the precondition
// for listActionsHere to emit fill:bottle). Forces the bottle Item FSM to
// $Carried directly (place(0)+try_take(0)) — location doesn't matter once carried.
function emptyBottleDriverAt(room: number): CcaDriver {
  const d = new CcaDriver();
  const a = d.machine();
  a.dwarves_auto_woken = true;
  a.player.take(a.BOTTLE_ID);
  a.bottle_item.place(0);
  a.bottle_item.try_take(0);
  a.player.move_to(room);
  return d;
}

// True iff listActionsHere emits a non-wild action with the given key.
function hasCanonAffordance(d: CcaDriver, key: string): boolean {
  return d.listActionsHere().some((act) => act.kind !== "wild" && act.key === key);
}

const advertised: number[] = [];
const fsmSays: number[] = [];
for (let r = 1; r <= 140; r++) {
  const d = emptyBottleDriverAt(r);
  if (hasCanonAffordance(d, "fill:bottle")) advertised.push(r);
  if (d.machine()._at_water_source() || d.machine()._at_oil_source()) fsmSays.push(r);
}

const advSet = new Set(advertised);
const fsmSet = new Set(fsmSays);
const onlyAdvertised = advertised.filter((r) => !fsmSet.has(r));
const onlyFsm = fsmSays.filter((r) => !advSet.has(r));

ok(`fill-bottle: advertised == FSM (${advertised.length} rooms: ${JSON.stringify(advertised)})`,
  onlyAdvertised.length === 0 && onlyFsm.length === 0);
ok(`no affordance lies (advertised but FSM disagrees): ${JSON.stringify(onlyAdvertised)}`, onlyAdvertised.length === 0);
ok(`no affordance gaps (FSM yes but affordance silent): ${JSON.stringify(onlyFsm)}`, onlyFsm.length === 0);
