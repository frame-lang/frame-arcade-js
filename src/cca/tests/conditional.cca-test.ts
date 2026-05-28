// Faithful port of Godot canon/audit/conditional_audit.py — the authoritative
// conditional-row coverage audit. For every advent.dat section-2 special-handler
// row (dest >= 300), decode its motion verbs to directions and confirm each is
// represented in the port by one of THREE mechanisms (matching the Python audit):
//   1. a GATES entry "<room>:<dir>"
//   2. an unconditional ROOMS exit
//   3. the MagicWordTeleport aspect (xyzzy/plugh/plover)
// Forced-motion rows (verb list exactly [1]) are routing entries, counted covered.
// HEADLINE ASSERTION: every in-scope row is covered (canon 62/62, 0 uncovered).
import { readFileSync } from "node:fs";
import { file, expect } from "./_harness";
import { GATES, ROOMS } from "../topology";

file("test_cca_conditional");

// advent.dat verb code → direction name (matches conditional_audit.py VERB_TO_DIR,
// incl. the 2026-05-18 fix: 62=xyzzy, 65=plugh, 71=plover).
const VERB_TO_DIR: Record<number, string> = {
  29: "up", 30: "down", 43: "east", 44: "west",
  45: "north", 46: "south", 47: "ne", 48: "se", 49: "sw", 50: "nw",
  11: "out", 19: "in",
  2: "hill", 3: "enter", 4: "upstream", 5: "downstream",
  6: "forest", 7: "forward", 8: "back", 9: "valley",
  10: "stairs", 12: "building", 13: "gully", 14: "stream",
  15: "rock", 16: "bed", 17: "crawl", 18: "cobbles",
  20: "surface", 22: "dark", 23: "passage", 24: "low",
  25: "canyon", 26: "awkward", 27: "giant", 28: "view",
  31: "pit", 32: "outdoors", 33: "crack", 34: "steps",
  35: "dome", 36: "left", 37: "right", 38: "hall",
  39: "jump", 40: "barren", 41: "over", 42: "across",
  51: "debris", 52: "hole", 53: "wall", 54: "broken",
  56: "climb", 58: "floor", 59: "room", 60: "slit",
  61: "slab", 63: "depression", 64: "entrance", 67: "cave",
  69: "cross", 70: "bedquilt", 72: "oriental", 73: "cavern",
  74: "shell", 75: "reservoir", 76: "office", 77: "fork",
  62: "xyzzy", 65: "plugh", 71: "plover", 1: "xyzzy", 55: "y2",
};

// Verbs handled by the MagicWordTeleport aspect rather than topology GATES.
const MAGIC_WORD_VERBS = new Set(["xyzzy", "plugh", "plover"]);
// Canon forced-motion sentinel (advent.for line 393): a row whose verb list is
// exactly [1] is a routing entry handled by forced-motion machinery, not a gate.
const FORCED_MOTION_VERB = 1;

function parseCanonSpecials(): [number, number, number[]][] {
  const candidates = [
    "/Users/marktruluck/projects/frame-arcade/cca/canon/advent.dat",
    "../canon/advent.dat",
  ];
  let text = "";
  for (const p of candidates) {
    try { text = readFileSync(p, "utf8"); break; } catch { /* next */ }
  }
  if (text === "") { console.log("could not open advent.dat"); return []; }
  const rows: [number, number, number[]][] = [];
  let sectionCount = 0;
  let inSection2 = false;
  for (const line of text.split("\n")) {
    if (line.trim() === "-1") { sectionCount += 1; inSection2 = sectionCount === 1; continue; }
    if (!inSection2) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const fromRoom = parseInt(parts[0], 10);
    const dest = parseInt(parts[1], 10);
    if (Number.isNaN(fromRoom) || Number.isNaN(dest) || dest < 300) continue;
    const verbs: number[] = [];
    for (let i = 2; i < parts.length; i++) {
      const v = parseInt(parts[i], 10);
      if (!Number.isNaN(v)) verbs.push(v); // keep all int tokens, like the Python audit
    }
    rows.push([fromRoom, dest, verbs]);
  }
  return rows;
}

const rows = parseCanonSpecials();

// (room, dir) set from GATES keys, and per-room ROOMS exit-direction sets.
const gates = new Set<string>(Object.keys(GATES));
const roomDirs: Record<number, Set<string>> = {};
for (const k of Object.keys(ROOMS)) {
  roomDirs[Number(k)] = new Set(Object.keys(ROOMS[Number(k)]));
}

let covered = 0;
let uncovered = 0;
const gapByRoom: Record<number, [number, number[], string[]][]> = {};

for (const [fromRoom, dest, verbs] of rows) {
  if (fromRoom > 140) continue;
  if (verbs.length === 1 && verbs[0] === FORCED_MOTION_VERB) { covered += 1; continue; }
  const dirs: string[] = [];
  for (const v of verbs) if (v in VERB_TO_DIR) dirs.push(VERB_TO_DIR[v]);
  if (dirs.length === 0) continue;
  const missing: string[] = [];
  for (const d of dirs) {
    if (gates.has(`${fromRoom}:${d}`)) continue;
    if (roomDirs[fromRoom]?.has(d)) continue;
    if (MAGIC_WORD_VERBS.has(d)) continue;
    missing.push(d);
  }
  if (missing.length > 0) {
    uncovered += 1;
    (gapByRoom[fromRoom] ??= []).push([dest, verbs, missing]);
  } else {
    covered += 1;
  }
}

const inScope = covered + uncovered;
console.log("=== CCA conditional-row gap audit (port of conditional_audit.py) ===");
console.log(`  canon special-handler rows in scope: ${inScope}`);
console.log(`  covered (GATES / ROOMS / magic-word): ${covered}`);
console.log(`  NOT covered:                          ${uncovered}`);
for (const room of Object.keys(gapByRoom).map(Number).sort((a, b) => a - b)) {
  for (const [dest, verbs, missing] of gapByRoom[room]) {
    console.log(`  ROOM ${room}: canon \`${room} ${dest} ${verbs.join(" ")}\` ungated: ${missing.join(",")}`);
  }
}

// HEADLINE: faithful to conditional_audit.py's 62/62 result.
expect("canon conditional special-handler rows in scope", inScope, 62);
expect("conditional rows uncovered (must be 0 — full canon coverage)", uncovered, 0);
