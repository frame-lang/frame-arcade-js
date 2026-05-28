// Faithful TS port of Godot scripts/monkey.gd — a random-command fuzzer over the
// raw Adventure FSM (do_command + tick; no driver, so dwarves don't wander —
// stepDwarves is driver-side). It hammers random (verb, noun) / directional
// commands, memoizes a coarse world fingerprint, and flags soft-lock candidates
// (a fingerprint that no-ops SOFT_LOCK_THRESHOLD times running).
//
// NOTE on RNG: Godot uses its engine RandomNumberGenerator, which the JS port
// can't reproduce bit-for-bit. We use a deterministic JS PRNG (mulberry32) — the
// walk differs from Godot's, so the test asserts FLOORS (coverage thresholds with
// margin) + soft_lock==0, exactly as the Godot thresholds are framed.
import { Adventure } from "../cca.machine.js";

const SOFT_LOCK_THRESHOLD = 200;

const VERBS_ACTION = [
  "look", "examine", "read", "take", "drop", "attack", "throw",
  "light", "extinguish", "feed", "release", "wave", "unlock", "lock",
  "insert", "fill", "pour", "water", "drink", "xyzzy", "plugh", "plover",
  "fee", "fie", "foe", "foo", "score", "hint",
];
const NOUNS = [
  "", "bird", "snake", "bear", "troll", "dwarf", "dragon", "pirate",
  "gold", "silver", "diamonds", "jewelry", "pearl", "vase",
  "eggs", "trident", "emerald", "spices", "chest", "pyramid",
  "rug", "coins", "statuette", "rod", "keys", "bottle", "lamp", "chain",
  "plant", "water", "axe",
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fingerprint(f: any): string {
  return `r${f.player_room()}|s${f.score()}|t${f.treasures_deposited()}|p${f.player_state()}|l${f.get_lamp_state()}|e${f.endgame_state()}|g${f.grate_locked() ? "L" : "U"}|b${f.bridge_built() ? "B" : "_"}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeFsm(): any {
  const f = Adventure._create();
  f.setup_default_aspects();
  f.wake_dwarves();
  return f;
}

export interface MonkeyReport {
  fingerprints: number;
  rooms_visited: number;
  moves: number;
  bumps: number;
  max_score: number;
  revives: number;
  permadeaths: number;
  soft_lock_count: number;
}

export function runMonkey(
  rooms: Record<number, Record<string, number>>,
  seed = 42,
  maxSteps = 5000,
): MonkeyReport {
  const rand = mulberry32(seed);
  const randi = (n: number): number => Math.floor(rand() * n);
  let f = makeFsm();

  const fingerprints = new Set<string>();
  const roomsSeen = new Set<number>();
  const noopRuns = new Map<string, number>();
  const softLocks = new Set<string>();
  let moves = 0;
  let bumps = 0;
  let maxScore = 0;
  let revives = 0;
  let permadeaths = 0;

  fingerprints.add(fingerprint(f));
  roomsSeen.add(f.player_room());

  for (let step = 0; step < maxSteps; step++) {
    if (f.player_state() === "dead") {
      f.player.revive();
      revives += 1;
    }
    if (f.player_state() === "permadead") {
      permadeaths += 1;
      f = makeFsm();
    }
    const fpBefore = fingerprint(f);

    // _pick_command: 40% directional move (random real exit), else verb×noun.
    let verb: string;
    let noun: string;
    const exits = rooms[f.player_room()] ?? {};
    const exitKeys = Object.keys(exits);
    if (rand() < 0.4 && exitKeys.length > 0) {
      verb = "move";
      noun = String(exits[exitKeys[randi(exitKeys.length)]]);
    } else {
      verb = VERBS_ACTION[randi(VERBS_ACTION.length)];
      noun = NOUNS[randi(NOUNS.length)];
    }
    f.do_command(verb, noun);
    f.tick();

    const fpAfter = fingerprint(f);
    roomsSeen.add(f.player_room());
    if (fpBefore === fpAfter) {
      bumps += 1;
      const n = (noopRuns.get(fpBefore) ?? 0) + 1;
      noopRuns.set(fpBefore, n);
      if (n >= SOFT_LOCK_THRESHOLD) softLocks.add(fpBefore);
    } else {
      moves += 1;
      noopRuns.set(fpAfter, 0);
      fingerprints.add(fpAfter);
    }
    if (f.score() > maxScore) maxScore = f.score();
  }

  return {
    fingerprints: fingerprints.size,
    rooms_visited: roomsSeen.size,
    moves,
    bumps,
    max_score: maxScore,
    revives,
    permadeaths,
    soft_lock_count: softLocks.size,
  };
}
