// Port of Godot tests/test_cca_flavor_msgs.gd — a batch of small canon flavor
// mechanics: CALM/TAME (#14), EAT <enemy> (#71 "ridiculous"), FEED bird/dwarf/
// troll/snake variants, and the unknown-verb random mix (canon STMT 3000:
// 64/16/20 over #60/#61/#13). Distribution checks use ±5σ ranges.
import { file, ok, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_flavor_msgs");

function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// Phase 1: CALM / TAME → canon flavor (#14).
const d = makeDriver();
expectContains("CALM emits canon prose", capture(d, "calm"), "Would you care to explain");
expectContains("TAME emits canon prose", capture(d, "tame"), "Would you care to explain");

// Phase 2: EAT <enemy> → canon msg #71.
const d2 = makeDriver();
for (const noun of ["bird", "snake", "clam", "dragon", "troll", "bear"]) {
  expectContains(`EAT ${noun} → 'ridiculous'`, capture(d2, "eat " + noun), "ridiculous");
}

// Phase 3: FEED variants.
const d3 = makeDriver();
expectContains("FEED BIRD → canon 'fjords'", capture(d3, "feed bird"), "fjords");
expectContains("FEED DWARF → 'eat only coal'", capture(d3, "feed dwarf"), "eat only coal");
expectContains("FEED TROLL → 'Gluttony'", capture(d3, "feed troll"), "Gluttony");
expectContains("FEED SNAKE → 'wants to eat'", capture(d3, "feed snake"), "wants to eat");

// Phase 4: unknown-verb randomization (canon STMT 3000, 64/16/20 over 1000 rolls).
const d4 = makeDriver();
let c60 = 0;
let c61 = 0;
let c13 = 0;
let cOther = 0;
for (let i = 0; i < 1000; i++) {
  const j = d4.input("frobnicate").join("\n");
  if (j.includes("I don't know that word")) c60 += 1;
  else if (j.includes("What?")) c61 += 1;
  else if (j.includes("I don't understand that")) c13 += 1;
  else cOther += 1;
}
inRange("msg#60 'I don't know that word' ~640", c60, 564, 716);
inRange("msg#61 'What?' ~160", c61, 102, 218);
inRange("msg#13 'don't understand' ~200", c13, 137, 263);
ok("no 'other' responses leaked through", cOther === 0);
