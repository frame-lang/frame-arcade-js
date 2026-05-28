// Port of Godot tests/test_cca_pdp10_easter_eggs.gd — verifies the canon PDP-10
// timesharing easter-egg verbs: HOURS, WIZARD, MAINT (+ MAGIC / "MAGIC MODE" /
// MAINTENANCE aliases), SUSPEND/PAUSE, and SAVE.
//
// In the original 1977 release these drove the cave's prime-time scheduling and
// the wizard authentication challenge — neither of which has any analog on a
// single-user desktop. The port honors each verb with canon-flavored prose that
// narrates what the original did and why it doesn't apply now, WITHOUT
// fabricating prime-time hours or a fake authentication.
//
// Canon references:
//   advent.for line 8310 → SUBROUTINE HOURS at line 2639
//   advent.for SUBROUTINE WIZARD at line 2578
//   advent.for SUBROUTINE MAINT at line 2521
//   advent.for STMT 8300 → SUSPEND (45-min latency + msg #200 Y/N)
//   ADVENT_DAT_INVENTORY.md section 12: magic msgs #1, #16-#20
//
// Godot→JS mapping: _make_driver() (CapturedDriver + setup_default_aspects, no
// lit lamp) → makeDriver() (lamp lit — irrelevant to these verbs); H.capture →
// capture. Expected substrings copied VERBATIM from the Godot source; any miss
// is a faithful reveal of a JS-port prose gap (the JS driver's HOURS/WIZARD/
// MAINT prose differs and SUSPEND/PAUSE/MAGIC/MAINTENANCE are not all handled).
import { file, expect, ok, makeDriver, capture } from "./_harness";

file("test_cca_pdp10_easter_eggs");

function expectAnyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}
function expectNoMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} no line contained '${needle}'`, !lines.some((l) => l.includes(needle)));
}

console.log("=== CCA PDP-10 timesharing easter-egg verbs ===");

// ----- HOURS -----
console.log("Phase 1: HOURS — canon timesharing schedule, replaced with always-open banner");
const d = makeDriver();
const lines: string[] = capture(d, "hours");
expect("HOURS produced output", lines.length > 0, true);
expectAnyMatch("HOURS names the cave as always open", lines, "open all day, every day");
expectAnyMatch("HOURS cites the 1977 PDP-10 provenance", lines, "1977 PDP-10");
expectAnyMatch("HOURS explains why the schedule is vestigial", lines, "timesharing");
expectNoMatch("HOURS doesn't fabricate a time-of-day", lines, ":00");
expectNoMatch("HOURS doesn't fake a Mon-Fri schedule", lines, "Mon -");

// ----- WIZARD -----
console.log("Phase 2: WIZARD — canon msg #16/#17/#18/#20 dialogue narrated single-shot");
const d2 = makeDriver();
const wLines: string[] = capture(d2, "wizard");
expect("WIZARD produced output", wLines.length > 0, true);
expectAnyMatch("WIZARD opens with canon msg #16", wLines, "Are you a wizard?");
expectAnyMatch("WIZARD echoes canon msg #17 (PROVE IT)", wLines, "Prove it");
expectAnyMatch("WIZARD echoes canon msg #17 (magic word challenge)", wLines, "magic word");
expectAnyMatch("WIZARD ends with canon msg #20 (charlatan)", wLines, "charlatan");

// ----- MAINT (single-word) -----
console.log("Phase 3: MAINT — canon msg #1 wizard-in-grey + msg #20 charlatan");
const d3 = makeDriver();
const mLines: string[] = capture(d3, "maint");
expect("MAINT produced output", mLines.length > 0, true);
expectAnyMatch("MAINT opens with canon green-smoke wizard", mLines, "green smoke");
expectAnyMatch("MAINT names the canon wizard-in-grey", mLines, "wizard, clothed in grey");
expectAnyMatch("MAINT names Don Woods (canon attribution)", mLines, "Don Woods");
expectAnyMatch("MAINT ends with canon msg #20 (charlatan)", mLines, "charlatan");

// ----- MAGIC alias (single word) -----
console.log("Phase 4: MAGIC — same dispatch as MAINT (canon synonym for MAGIC MODE)");
const d4 = makeDriver();
const mgLines: string[] = capture(d4, "magic");
expect("MAGIC produced output", mgLines.length > 0, true);
expectAnyMatch("MAGIC routes to MAINT handler", mgLines, "wizard, clothed in grey");

// ----- MAGIC MODE (two-word phrase, canon trigger) -----
console.log("Phase 5: 'MAGIC MODE' — canon two-word trigger, parser drops MODE noun");
const d5 = makeDriver();
const mmLines: string[] = capture(d5, "magic mode");
expect("MAGIC MODE produced output", mmLines.length > 0, true);
expectAnyMatch("MAGIC MODE routes to MAINT handler", mmLines, "wizard, clothed in grey");

// ----- MAINTENANCE alias -----
console.log("Phase 6: MAINTENANCE — long-form alias for MAINT");
const d6 = makeDriver();
const mtLines: string[] = capture(d6, "maintenance");
expect("MAINTENANCE produced output", mtLines.length > 0, true);
expectAnyMatch("MAINTENANCE routes to MAINT handler", mtLines, "wizard, clothed in grey");

// ----- SUSPEND -----
// Canon SUSPEND (advent.for STMT 8300): print the 45-minute latency warning,
// then prompt msg #200 ("Is this acceptable?") and wait for YES/NO. YES saves
// and exits, NO cancels.
console.log("Phase 7: SUSPEND — canon latency warning + msg #200 Y/N prompt");
const d7 = makeDriver();
const sLines: string[] = capture(d7, "suspend");
expect("SUSPEND produced output", sLines.length > 0, true);
expectAnyMatch("SUSPEND opens with canon LATNCY warning", sLines, "I can suspend your adventure");
expectAnyMatch("SUSPEND cites canon 45-minute latency", sLines, "45 minutes");
expectAnyMatch("SUSPEND emits canon msg #200 prompt", sLines, "Is this acceptable?");
// Confirm with YES — canon msg #54 "OK" + save fires.
const sYes: string[] = capture(d7, "yes");
expectAnyMatch("SUSPEND YES → canon msg #54 OK", sYes, "OK");
expectAnyMatch("SUSPEND YES triggers the save", sYes, "Saved");

// ----- PAUSE alias -----
console.log("Phase 8: PAUSE — alias for SUSPEND");
const d8 = makeDriver();
const pLines: string[] = capture(d8, "pause");
expect("PAUSE produced output", pLines.length > 0, true);
expectAnyMatch("PAUSE routes to SUSPEND handler", pLines, "I can suspend your adventure");
expectAnyMatch("PAUSE also emits the msg #200 prompt", pLines, "Is this acceptable?");

// ----- SAVE stays silent (no canon flavor) -----
console.log("Phase 9: SAVE — silent modern UX, no canon flavor");
const d9 = makeDriver();
const svLines: string[] = capture(d9, "save");
expect("SAVE produced output", svLines.length > 0, true);
expectNoMatch("SAVE doesn't print the canon SUSPEND warning", svLines, "I can suspend your adventure");
expectNoMatch("SAVE doesn't emit the canon msg #200 prompt", svLines, "Is this acceptable?");
expectAnyMatch("SAVE confirms with 'Saved.'", svLines, "Saved");
