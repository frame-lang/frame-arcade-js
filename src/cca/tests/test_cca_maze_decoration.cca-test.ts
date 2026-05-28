// Port of Godot tests/test_cca_maze_decoration.gd — the canon "twisty maze"
// probabilistic-walk decoration at canon rooms 5 (forest), 65 (Bedquilt), 66
// (Swiss Cheese), and 111 (top of stalactite). Each verb at each room is a
// chain of probability rolls walked in canonical section-3 order; first hit
// wins, misses fall through to topology or no-exit.
//
// Behavior tests use isolated tryBumperRule() calls (rather than full turns) to
// avoid lamp/dwarf-tick interference over large N — the pattern established in
// test_cca_19_sw_chain Phase 5. Distribution checks use ±5σ-ish ranges, copied
// verbatim from the Godot source. The Godot source pins the engine RNG via
// seed(0xCABBA9E); here we OMIT it — the model `chance` LCG (bit-faithful) is
// what drives the probability gates, and the windows hold for any chance state.
//
// Canon rows tested:
//   5   50005 6 7 45    forest/forward/north 50% self-loop
//   65  80556 46        south 80% bumper
//   65  80556 29        up   80% bumper
//   65  50070 29        up   50% to 70 (after 80% miss)
//   65  60556 45        north 60% bumper
//   65  75072 45        north 75% to 72 (after 60% miss)
//   65  80556 30        down 80% bumper
//   66  80556 46        south 80% bumper
//   66  50556 50        nw   50% bumper
//   111 40050 30 39 56  down/jump/climb 40% to 50
//   111 50053 30        down 50% to 53 (after 40% miss)
import { file, ok, makeDriver } from "./_harness";
import { GATES, type Gate, type GateStep } from "../topology";
import { CcaDriver } from "../driver";

file("test_cca_maze_decoration");

function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// Roll the gate chain at (room, verb) N times, counting hits per "fired-with-
// which-rule" outcome. Returns {"rule<i>_dest_<X>": n, ..., "rule<i>_msg": n,
// "fall_through": n}. Resets the player to `room` before each roll so the chain
// always evaluates from the same start; tryBumperRule bypasses tick/lamp upkeep.
// Faithful port of the Godot _roll_chain helper.
function rollChain(d: CcaDriver, room: number, verb: string, n: number): Record<string, number> {
  const key = `${room}:${verb}`;
  const entry: Gate | undefined = GATES[key];
  if (entry === undefined) return { error: 1 };
  const rules: GateStep[] = Array.isArray(entry) ? entry : [entry];
  const counts: Record<string, number> = { fall_through: 0 };
  for (let i = 0; i < n; i++) {
    d.machine().player.move_to(room);
    let firedIdx = -1;
    for (let ri = 0; ri < rules.length; ri++) {
      if (d.tryBumperRule(rules[ri])) {
        firedIdx = ri;
        break;
      }
    }
    let bucket: string;
    if (firedIdx === -1) {
      bucket = "fall_through";
    } else {
      const rule = rules[firedIdx];
      if (rule.dest !== undefined) bucket = `rule${firedIdx}_dest_${Math.trunc(rule.dest)}`;
      else bucket = `rule${firedIdx}_msg`;
    }
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return counts;
}

// ----- Phase 1: room 5 forest random walk (canon `5 50005`) — 50% self-loop -----
const d = makeDriver();
for (const verb of ["forest", "forward", "north"]) {
  const counts = rollChain(d, 5, verb, 1000);
  const loop = counts["rule0_dest_5"] ?? 0;
  const fall = counts["fall_through"] ?? 0;
  console.log(`  5:${verb} ${JSON.stringify(counts)}`);
  inRange(`5:${verb} self-loop hits ~500`, loop, 425, 575);
  inRange(`5:${verb} fall-through ~500`, fall, 425, 575);
}

// ----- Phase 2: room 65 Bedquilt — four directional chains -----
const d2 = makeDriver();

const south = rollChain(d2, 65, "south", 1000);
console.log(`  65:south  ${JSON.stringify(south)}`);
inRange("65:south msg ~800", south["rule0_msg"] ?? 0, 750, 850);
inRange("65:south fall-through ~200", south["fall_through"] ?? 0, 150, 250);

const up = rollChain(d2, 65, "up", 1000);
console.log(`  65:up     ${JSON.stringify(up)}`);
inRange("65:up msg ~800", up["rule0_msg"] ?? 0, 750, 850);
inRange("65:up to-70 ~100 (50% of remaining 200)", up["rule1_dest_70"] ?? 0, 60, 140);
inRange("65:up fall-through ~100", up["fall_through"] ?? 0, 60, 140);

const north = rollChain(d2, 65, "north", 1000);
console.log(`  65:north  ${JSON.stringify(north)}`);
inRange("65:north msg ~600", north["rule0_msg"] ?? 0, 550, 650);
inRange("65:north to-72 ~300 (75% of remaining 400)", north["rule1_dest_72"] ?? 0, 250, 350);
inRange("65:north fall-through ~100", north["fall_through"] ?? 0, 60, 140);

const down = rollChain(d2, 65, "down", 1000);
console.log(`  65:down   ${JSON.stringify(down)}`);
inRange("65:down msg ~800", down["rule0_msg"] ?? 0, 750, 850);
inRange("65:down fall-through ~200", down["fall_through"] ?? 0, 150, 250);

// ----- Phase 3: room 66 Swiss Cheese -----
const d3 = makeDriver();

const s66 = rollChain(d3, 66, "south", 1000);
console.log(`  66:south  ${JSON.stringify(s66)}`);
inRange("66:south msg ~800", s66["rule0_msg"] ?? 0, 750, 850);

const nw66 = rollChain(d3, 66, "nw", 1000);
console.log(`  66:nw     ${JSON.stringify(nw66)}`);
inRange("66:nw msg ~500", nw66["rule0_msg"] ?? 0, 450, 550);
inRange("66:nw fall-through ~500", nw66["fall_through"] ?? 0, 450, 550);

// ----- Phase 4: room 111 stalactite -----
const d4 = makeDriver();

const d111 = rollChain(d4, 111, "down", 1000);
console.log(`  111:down  ${JSON.stringify(d111)}`);
inRange("111:down to-50 ~400", d111["rule0_dest_50"] ?? 0, 350, 450);
inRange("111:down to-53 ~300 (50% of remaining 600)", d111["rule1_dest_53"] ?? 0, 250, 350);
inRange("111:down fall-through ~300", d111["fall_through"] ?? 0, 250, 350);

const j111 = rollChain(d4, 111, "jump", 1000);
console.log(`  111:jump  ${JSON.stringify(j111)}`);
inRange("111:jump to-50 ~400", j111["rule0_dest_50"] ?? 0, 350, 450);
inRange("111:jump fall-through ~600", j111["fall_through"] ?? 0, 550, 650);

const c111 = rollChain(d4, 111, "climb", 1000);
console.log(`  111:climb ${JSON.stringify(c111)}`);
inRange("111:climb to-50 ~400", c111["rule0_dest_50"] ?? 0, 350, 450);
