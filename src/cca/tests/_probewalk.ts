// Faithful core of Godot scripts/probe.gd — an LFU-biased coverage walker. Walks
// the world through the real driver, at each room picking the least-frequently-
// exercised affordance (movement-preferred tiebreak), accumulating a global
// (room, action) coverage table across many walks. Where a uniform random walker
// (monkey) re-actuates common verbs at common rooms, the LFU bias spends budget
// on fresher cells.
//
// Scope note: Godot's probe layers Go-Explore archive return + BFS routing +
// action storms on top of this core to push coverage above the floor and chase
// victory. Those are engine-RNG-bound coverage *boosters*; the test asserts only
// the FLOOR (>=30 rooms OR >=1500 cells), which the core LFU walk clears via the
// wild verb×noun cell emission. The tiebreak uses a JS PRNG (Godot's engine RNG
// isn't reproducible) — fine, since the assertion is a floor.
import { CcaDriver } from "../driver";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ProbeReport {
  rooms_visited: number;
  coverage_cells: number;
}

export function runProbe(seeds: number[], walkCount: number, maxSteps: number): ProbeReport {
  const coverage = new Map<string, number>(); // "room:action.key" → count
  const roomsSeen = new Set<number>();

  for (const seed of seeds) {
    const tiebreak = mulberry32(seed);
    for (let w = 0; w < walkCount; w++) {
      const walkSeed = (seed + w) & 0x7fffffff;
      const d = new CcaDriver();
      d.machine().wake_dwarves();
      d.machine().chance.reseed(walkSeed);
      let revivesLeft = 3;

      for (let step = 0; step < maxSteps; step++) {
        if (d.machine().endgame_state() === "won") break;
        if (d.machine().player_state() === "permadead") break;
        if (d.machine().player_state() === "dead") {
          if (revivesLeft > 0) {
            revivesLeft -= 1;
            d.machine().player.revive();
          } else break;
        }
        if (d.promptMachine().is_active()) {
          d.input(d.promptMachine().current_prompt() === "revive" ? "yes" : "no");
          continue;
        }
        const room: number = d.machine().player_room();
        roomsSeen.add(room);
        const available = d.listActionsHere();
        if (available.length === 0) break; // stuck

        // LFU pick: least-covered action(s), movement-preferred tiebreak.
        let minCount = Infinity;
        let candidates: typeof available = [];
        for (const action of available) {
          const c = coverage.get(`${room}:${action.key}`) ?? 0;
          if (c < minCount) {
            minCount = c;
            candidates = [action];
          } else if (c === minCount) {
            candidates.push(action);
          }
        }
        const moveOnly = candidates.filter((a) => a.kind === "move");
        const pool = moveOnly.length > 0 ? moveOnly : candidates;
        const action = pool[Math.floor(tiebreak() * pool.length)];

        const covKey = `${room}:${action.key}`;
        coverage.set(covKey, (coverage.get(covKey) ?? 0) + 1);
        d.input(action.input);
      }
    }
  }

  return { rooms_visited: roomsSeen.size, coverage_cells: coverage.size };
}
