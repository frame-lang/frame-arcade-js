// Port of Godot tests/test_cca_topology.gd — per-room canon-topology conformance
// checker. INFORMATIONAL dashboard (the Godot test always quit(0)); it drives
// toward 100% advent.dat section-2 alignment one room at a time and prints a
// per-room breakdown plus a final aligned-room count. This port reproduces the
// same parse + audit logic against the same advent.dat and the same
// Topology.ROOMS table, prints the same dashboard, and registers a single
// informational PASS (the Godot quit(0)).
//
// Source of truth: cca/canon/advent.dat section 2 (tab-separated rows,
// `from_room dest verb [verb...]`). Verb-code → direction mapping derived from
// advent.dat section 3 (the dictionary). Canon special-handling destinations
// (>= 300) are skipped — they encode conditional teleports the port handles via
// GATES; CANON_GATED whitelists the (room, direction) → dest pairs.
import { readFileSync } from "node:fs";
import { file, expect } from "./_harness";
import { ROOMS } from "../topology";

file("test_cca_topology");

const VERB_TO_DIR: Record<number, string> = {
  29: "up", 30: "down", 43: "east", 44: "west",
  45: "north", 46: "south", 47: "ne", 48: "se",
  49: "sw", 50: "nw",
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
  51: "debris", 52: "hole", 53: "wall", 54: "broken", 56: "climb",
  58: "floor", 59: "room", 60: "slit", 61: "slab",
  63: "depression", 64: "entrance", 67: "cave", 69: "cross",
  70: "bedquilt", 72: "oriental", 73: "cavern", 74: "shell",
  75: "reservoir", 76: "office", 77: "fork",
};

// Canon special-handler rows (dest >= 300) the port implements via GATES.
const CANON_GATED: Record<string, number> = {
  "8:down": 9, "8:in": 9, "8:enter": 9,
  "9:up": 8, "9:out": 8,
  "11:depression": 8, "12:depression": 8, "13:depression": 8, "14:depression": 8,
  "15:y2": 34, "28:y2": 33, "34:y2": 33, "35:y2": 33,
  "61:south": 107,
  "25:up": 23, "25:climb": 23,
  "99:east": 100, "100:west": 99,
  "117:over": 122, "117:across": 122, "117:cross": 122, "117:ne": 122,
  "122:over": 117, "122:across": 117, "122:cross": 117, "122:sw": 117,
  "17:over": 27, "17:across": 27, "17:west": 27, "17:cross": 27,
  "27:over": 17, "27:across": 17, "27:east": 17, "27:cross": 17,
  "19:north": 28, "19:south": 29, "19:sw": 74,
  "94:north": 95, "94:enter": 95, "94:cavern": 95,
  "19:west": 30,
  "16:east": 14, "16:out": 14, "16:back": 14,
  "22:out": 15, "22:back": 15,
  "26:east": 88, "26:out": 88, "26:back": 88,
  "32:out": 19, "32:south": 19, "32:back": 19,
  "40:out": 41, "40:east": 41, "40:west": 41, "40:back": 41,
  "59:out": 27, "59:east": 27, "59:south": 27, "59:back": 27,
  "79:out": 3, "79:up": 3, "79:back": 3,
  "89:out": 25, "89:up": 25, "89:back": 25,
  "90:out": 23, "90:up": 23, "90:back": 23,
  "113:south": 109, "113:out": 109,
  "114:out": 84,
  "115:east": 116, "116:west": 115, "116:nw": 115,
  "122:nw": 123, "124:nw": 125,
};

let passed = 0;
let failed = 0;
let rooms_full_canon = 0;
let rooms_with_drift = 0;

function parseCanonSection2(): Record<number, Record<string, number>> {
  // res:// paths never exist under Node; fall through to the absolute canon path.
  const candidates = [
    "res://canon/advent.dat",
    "../canon/advent.dat",
    "/Users/marktruluck/projects/frame-arcade/cca/canon/advent.dat",
  ];
  let text = "";
  for (const p of candidates) {
    try {
      text = readFileSync(p, "utf8");
      break;
    } catch {
      /* try next candidate */
    }
  }
  if (text === "") {
    console.log("could not open advent.dat");
    return {};
  }
  const lines = text.split("\n");
  let section_count = 0;
  let in_section_2 = false;
  const canon: Record<number, Record<string, number>> = {};
  for (const line of lines) {
    if (line.trim() === "-1") {
      section_count += 1;
      in_section_2 = section_count === 1;
      continue;
    }
    if (!in_section_2) continue;
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const from_room = parseInt(parts[0], 10);
    const dest = parseInt(parts[1], 10);
    if (dest >= 300 || from_room === 0 || from_room > 140 || dest > 140) continue;
    const verbs: number[] = [];
    for (let i = 2; i < parts.length; i++) {
      const tok = parts[i];
      if (tok === "") continue;
      const v = parseInt(tok, 10);
      // 100+ are condition modifiers — skip individually but keep the
      // motion verbs that come alongside.
      if (v >= 100) continue;
      verbs.push(v);
    }
    if (!(from_room in canon)) canon[from_room] = {};
    const room_d = canon[from_room];
    for (const v of verbs) {
      if (v in VERB_TO_DIR) {
        const d = VERB_TO_DIR[v];
        if (!(d in room_d)) room_d[d] = dest;
      }
    }
  }
  return canon;
}

function auditRoom(rid: number, canon: Record<string, number>, port: Record<string, number>): void {
  let room_failed = false;
  const room_lines: string[] = [];

  // Canon-side checks: every canon exit must exist in port with matching dest.
  for (const direction of Object.keys(canon)) {
    const canon_dest = canon[direction];
    const key = `${rid}:${direction}`;
    if (!(direction in port)) {
      room_lines.push(`  MISSING canon: ${direction} → ${canon_dest}`);
      failed += 1;
      room_failed = true;
    } else if (port[direction] !== canon_dest) {
      if (key in CANON_GATED && CANON_GATED[key] === port[direction]) {
        passed += 1;
      } else {
        room_lines.push(`  MISMATCH:      ${direction} canon→${canon_dest} port→${port[direction]}`);
        failed += 1;
        room_failed = true;
      }
    } else {
      passed += 1;
    }
  }

  // Port-side check: any compass exit not in canon is drift unless canon-gated.
  const compass_only: Record<string, number> = {
    north: 1, south: 1, east: 1, west: 1, ne: 1, sw: 1, nw: 1, se: 1,
    up: 1, down: 1, in: 1, out: 1, enter: 1, climb: 1, over: 1,
  };
  for (const direction of Object.keys(port)) {
    if (direction in compass_only && !(direction in canon)) {
      const pdest = port[direction];
      const key = `${rid}:${direction}`;
      if (key in CANON_GATED && CANON_GATED[key] === pdest) {
        passed += 1;
        continue;
      }
      room_lines.push(`  EXTRA port:    ${direction} → ${pdest} (canon has no such exit)`);
      failed += 1;
      room_failed = true;
    }
  }

  if (room_failed) {
    console.log("");
    console.log(`ROOM ${rid}:`);
    for (const line of room_lines) console.log(line);
    rooms_with_drift += 1;
  } else {
    rooms_full_canon += 1;
  }
}

console.log("=== CCA per-room canon topology audit ===");
console.log("(advent.dat section 2 vs cca/godot/scripts/topology.gd ROOMS)");

const canon_exits = parseCanonSection2();
const port_exits = ROOMS;

const all_rooms: number[] = [];
for (const r of Object.keys(canon_exits)) all_rooms.push(parseInt(r, 10));
for (const rk of Object.keys(port_exits)) {
  const r = parseInt(rk, 10);
  if (r > 0 && r <= 140 && !all_rooms.includes(r)) all_rooms.push(r);
}
all_rooms.sort((a, b) => a - b);

for (const r of all_rooms) {
  if (r > 140) continue;
  auditRoom(r, canon_exits[r] ?? {}, port_exits[r] ?? {});
}

console.log("");
console.log("=================================================");
console.log(`Rooms fully canon: ${rooms_full_canon} / ${all_rooms.length}`);
console.log(`Rooms with drift:  ${rooms_with_drift}`);
console.log(`Total checks:      ${passed} passing, ${failed} failing`);
console.log("=================================================");
console.log("");
console.log(`per-room canon topology audit — ${rooms_full_canon}/${all_rooms.length} rooms aligned, ${failed} drift check(s)`);

// HEADLINE: every canon room (140) is section-2 aligned with zero drift.
expect("canon rooms in scope", all_rooms.length, 140);
expect("rooms fully canon-aligned (section-2)", rooms_full_canon, 140);
expect("topology drift checks failing (must be 0)", failed, 0);
