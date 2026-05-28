// Port of Godot tests/test_cca_verb_defaults.gd — canon verb-default messages:
//
//   FIND default (no carrying, no endgame) → canon msg #59
//        ("I can only tell you what you see...")
//   EAT non-food, non-NPC                   → canon msg #71
//        ("I think I just lost my appetite.")
//   EAT NPC noun                            → "Don't be ridiculous!"
//   RUB lamp                                → canon msg #75
//        ("Rubbing the electric lamp...")
//   RUB other                               → canon msg #76
//        ("Peculiar. Nothing unexpected happens.")
//
// Each phase builds a fresh driver, types one command, and asserts the canon
// substring is present (or absent, for the no-match guards). Expected
// substrings are copied verbatim from the Godot source.
import { file, ok, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_verb_defaults");

// _expect_no_match(label, lines, needle): asserts the needle does NOT appear.
function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} (banned "${needle}")`, !lines.join("\n").includes(needle));
}

// ----- Phase 1: FIND default → canon msg #59 -----
const d1 = makeDriver();
const l1 = capture(d1, "find diamond");
expectContains("FIND emits 'I can only tell you what you see'", l1, "I can only tell you what you see");
expectNoMatch("FIND no longer emits cave-finding (msg #57)", l1, "no stream can run on the surface");

// ----- Phase 2: EAT non-food, non-NPC → canon msg #71 -----
const d2 = makeDriver();
const l2 = capture(d2, "eat axe");
expectContains("EAT axe emits 'just lost my appetite'", l2, "just lost my appetite");

// ----- Phase 3: EAT NPC noun → 'ridiculous' rebuff -----
const d3 = makeDriver();
const l3 = capture(d3, "eat snake");
expectContains("EAT snake emits 'Don't be ridiculous!'", l3, "ridiculous");

// ----- Phase 4: RUB lamp → canon msg #75 -----
const d4 = makeDriver();
const l4 = capture(d4, "rub lamp");
expectContains("RUB lamp emits 'Rubbing the electric lamp'", l4, "Rubbing the electric lamp");

// ----- Phase 5: RUB non-lamp → canon msg #76 -----
const d5 = makeDriver();
const l5 = capture(d5, "rub rod");
expectContains("RUB rod emits 'Peculiar.'", l5, "Peculiar.");
expectNoMatch("RUB rod does NOT emit lamp prose", l5, "Rubbing the electric lamp");
