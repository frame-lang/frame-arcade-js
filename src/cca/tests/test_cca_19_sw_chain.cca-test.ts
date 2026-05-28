// Port of Godot tests/test_cca_19_sw_chain.gd — the canon SW chain at the Hall
// of the Mountain King (canon 19). Section 3 has two rows walked in order:
//   `19 35074 49`  → 35% probability → walk to canon 74 (dragon-side back-door)
//   `19 211032 49` → if snake here → the "can't get by the snake" bumper
// Net: snake present → 35% to 74, 65% snake bumper; snake gone → 35% to 74, 65%
// no-exit fall-through. GATES "19:sw" is a 2-rule chain. Distribution ±5σ.
import { file, expect, ok, makeDriver } from "./_harness";
import { GATES, ROOMS, type GateStep } from "../topology";

file("test_cca_19_sw_chain");

function anyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}
function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// Phase 1: gate shape — 19:sw is a chain of [probability, snake].
const entry = GATES["19:sw"];
ok("gate exists at 19:sw", entry !== undefined);
ok("gate is an Array (chain)", Array.isArray(entry));
const chain = entry as GateStep[];
expect("chain has 2 rules (probability + snake)", chain.length, 2);
expect("first rule is probability", chain[0].check, "probability");
expect("first rule pct=35", chain[0].pct, 35);
expect("first rule dest=74", chain[0].dest, 74);
expect("second rule is snake", chain[1].check, "snake");
anyMatch("second rule msg names the snake", [chain[1].msg ?? ""], "snake");
expect("19:sw removed from topology", "sw" in ROOMS[19], false);

// Phase 2: snake blocking — 1000 SW attempts. Canon 35% to 74, 65% snake bumper.
const d = makeDriver();
const a = d.machine();
expect("setup: snake is blocking", a.snake.is_blocking(), true);
let to74 = 0;
let bumpers = 0;
let sawSnakeMsg = false;
for (let i = 0; i < 1000; i++) {
  a.player.move_to(19);
  const lines = d.input("sw");
  if (a.player_room() === 74) {
    to74 += 1;
    a.player.move_to(19);
  } else {
    bumpers += 1;
    if (lines.some((l) => l.includes("snake"))) sawSnakeMsg = true;
  }
}
inRange("to_74 in 1000 attempts (canon ~350)", to74, 275, 425);
inRange("bumpers in 1000 attempts (canon ~650)", bumpers, 575, 725);
ok("at least one bumper printed snake msg", sawSnakeMsg);

// Phase 3: snake gone — qualitative chain fall-through (100 iters, below lamp die).
const d2 = makeDriver();
const a2 = d2.machine();
a2.snake.bird_released_here(); // snake → $Gone
expect("snake is gone", a2.snake.is_blocking(), false);
let gTo74 = 0;
let gBumpers = 0;
let sawFallback = false;
let sawSnakeMsg2 = false;
for (let i = 0; i < 100; i++) {
  a2.player.move_to(19);
  const lines = d2.input("sw");
  if (a2.player_room() === 74) {
    gTo74 += 1;
    a2.player.move_to(19);
  } else {
    gBumpers += 1;
    for (const line of lines) {
      const lo = line.toLowerCase();
      if (
        lo.includes("can't go") || lo.includes("no exit") || lo.includes("don't know") ||
        lo.includes("eh?") || lo.includes("beg your pardon") || lo.includes("don't understand") ||
        lo.includes("no way to go")
      ) {
        sawFallback = true;
      }
      if (lo.includes("snake")) sawSnakeMsg2 = true;
    }
  }
}
ok("at least one SW attempt walked to 74", gTo74 > 0);
ok("at least one SW attempt was bumpered", gBumpers > 0);
ok("at least one bumper emitted fallback msg", sawFallback);
expect("snake-block msg never fires when snake gone", sawSnakeMsg2, false);

// Phase 5: probability gate hit rate, isolated (no tick/lamp interference).
const d4 = makeDriver();
const a4 = d4.machine();
const probRule = chain[0];
let hits = 0;
for (let i = 0; i < 1000; i++) {
  a4.player.move_to(19);
  const fired = d4.tryBumperRule(probRule);
  if (fired && a4.player_room() === 74) hits += 1;
}
inRange("hits in [275, 425] (canon 35% ± 5σ)", hits, 275, 425);

// Phase 4: single-Dict gate still works (19:north unchanged).
const d3 = makeDriver();
const a3 = d3.machine();
a3.player.move_to(19);
const lines3 = d3.input("north");
expect("19:north blocked by snake", a3.player_room(), 19);
anyMatch("19:north emits canon snake bumper", lines3, "can't get by the snake");
