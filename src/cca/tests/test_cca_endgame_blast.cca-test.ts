// Port of Godot tests/test_cca_endgame_blast.gd — canon endgame win path: BLAST
// (advent.for STMT 9230), plus WAKE-DWARVES (STMT 9290) and BREAK MIRROR (STMT
// 9280) closed-only deaths. DRIVER-level (mirrors H.make_driver() / H.capture()).
// Same assertions, same expected values, same order.
//
// Canon BLAST outcomes:
//   pre-CLOSED                        → msg #67 ("Blasting requires dynamite.")
//   CLOSED + rod2 here                → blast_klutz, msg #135, +25
//   CLOSED + LOC=115 + rod2 elsewhere → blast_wrong_way, msg #134, +30
//   CLOSED + otherwise                → blast_mastery, msg #133, +45
//
// NOTE: Phase 9 (DETONATE alias → BLAST) depends on the driver verb-synonym
// `detonate` → `blast`, which is present in the Godot driver but ABSENT from the
// JS CcaDriver's VERB_SYNONYMS. Against the JS port `detonate` falls through to
// the FSM ("I don't know how to 'detonate'."), so Phase 9 will FAIL. It is
// ported verbatim to surface that divergence (see the suite report).
import { file, expect, ok, makeDriver, capture } from "./_harness";
import type { CcaDriver } from "../driver";

file("test_cca_endgame_blast");

// Godot _expect_any_match: case-sensitive substring across the captured lines.
function expectAnyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} ("${needle}")`, lines.join("\n").includes(needle));
}

// Drive the FSM into $InRepository: deposit 10 treasures, tick 30 turns until
// the closing timer fires.
function forceInRepository(d: CcaDriver): void {
  for (let i = 0; i < 10; i++) d.machine().deposit_treasure();
  for (let i = 0; i < 30; i++) d.machine().tick();
}

// ----- Phase 1: pre-closed BLAST → 'requires dynamite' -----
const d = makeDriver();
const lines: string[] = capture(d, "blast");
expect("pre-closed BLAST stays alive", d.machine().player_state(), "alive");
expect("pre-closed BLAST: endgame still active", d.machine().endgame_state(), "active");
expectAnyMatch("pre-closed BLAST emits 'requires dynamite'", lines, "requires dynamite");

// ----- Phase 2: BLAST mastery (closed, rod2 not here, LOC != 115) -----
const d2 = makeDriver();
forceInRepository(d2);
expect("setup: in repository", d2.machine().endgame_state(), "in_repository");
d2.machine().player.move_to(116);
expect("setup: at 116 (NOT 115, the wrong-way room)", d2.machine().player_room(), 116);
expect("setup: rod2 not here", d2.machine().mark_rod_here(), false);
const preScore: number = d2.machine().endgame_score();
const l2: string[] = capture(d2, "blast");
expectAnyMatch("BLAST mastery emits canon-#133 elves narration", l2, "cheering band of");
expect("BLAST mastery: endgame transitions to $Won", d2.machine().endgame_state(), "won");
expect("BLAST mastery: +45 endgame score", d2.machine().endgame_score() - preScore, 45);

// ----- Phase 3: BLAST wrong-way (closed, LOC=115, rod2 elsewhere) -----
const d3 = makeDriver();
forceInRepository(d3);
d3.machine().player.move_to(115); // canon's wrong-way trigger room
expect("setup: at canon 115", d3.machine().player_room(), 115);
expect("setup: rod2 not here", d3.machine().mark_rod_here(), false);
const pre3: number = d3.machine().endgame_score();
const l3: string[] = capture(d3, "blast");
expectAnyMatch("BLAST wrong-way emits canon-#134 lava narration", l3, "molten lava");
expectAnyMatch("BLAST wrong-way ends with 'including you'", l3, "including you");
expect("BLAST wrong-way: endgame transitions to $Won", d3.machine().endgame_state(), "won");
expect("BLAST wrong-way: +30 endgame score", d3.machine().endgame_score() - pre3, 30);

// ----- Phase 4: BLAST klutz (closed, rod2 in player's hand) -----
const d4 = makeDriver();
forceInRepository(d4);
d4.machine().mark_rod_item.place(d4.machine().player_room());
expect("setup: rod2 here", d4.machine().mark_rod_here(), true);
const pre4: number = d4.machine().endgame_score();
const l4: string[] = capture(d4, "blast");
expectAnyMatch("BLAST klutz emits canon-#135 splash narration", l4, "splashed across");
expect("BLAST klutz: endgame transitions to $Won", d4.machine().endgame_state(), "won");
expect("BLAST klutz: +25 endgame score", d4.machine().endgame_score() - pre4, 25);

// ----- Phase 5: WAKE pre-closed → 'I don't understand' -----
const d5 = makeDriver();
const l5: string[] = capture(d5, "wake");
expect("pre-closed WAKE: player alive", d5.machine().player_state(), "alive");
expectAnyMatch("pre-closed WAKE emits 'don't understand'", l5, "don't understand");

// ----- Phase 6: WAKE in repository → death (msg #199 + #136) -----
const d6 = makeDriver();
forceInRepository(d6);
const l6: string[] = capture(d6, "wake");
expectAnyMatch("WAKE emits canon-#199 'prod the nearest dwarf'", l6, "prod the nearest dwarf");
expectAnyMatch("WAKE emits canon-#136 'awakened the dwarves'", l6, "awakened the dwarves");
expect("WAKE: player is dead", d6.machine().player_state(), "dead");

// ----- Phase 7: BREAK MIRROR pre-closed -----
const d7 = makeDriver();
const l7: string[] = capture(d7, "break mirror");
expect("pre-closed BREAK MIRROR: player alive", d7.machine().player_state(), "alive");
expectAnyMatch("pre-closed BREAK MIRROR: canon msg #146", l7, "beyond your power");

// ----- Phase 8: BREAK MIRROR in repository → death -----
const d8 = makeDriver();
forceInRepository(d8);
const l8: string[] = capture(d8, "break mirror");
expectAnyMatch("BREAK MIRROR emits canon-#197 'shatters into a myriad'", l8, "shatters into a");
expectAnyMatch("BREAK MIRROR emits canon-#136 'awakened the dwarves'", l8, "awakened the dwarves");
expect("BREAK MIRROR: player is dead", d8.machine().player_state(), "dead");

// ----- Phase 9: DETONATE alias (backward-compat) -----
// Depends on the `detonate` → `blast` driver synonym (absent in the JS port).
const d9 = makeDriver();
forceInRepository(d9);
d9.machine().player.move_to(116); // mastery setup
const l9: string[] = capture(d9, "detonate");
expectAnyMatch("DETONATE alias hits BLAST mastery prose", l9, "cheering band of");
expect("DETONATE alias: $Won", d9.machine().endgame_state(), "won");
