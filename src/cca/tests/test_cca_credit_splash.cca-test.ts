// Port of Godot tests/test_cca_credit_splash.gd — verifies the canon msg #1
// welcome (the 1977 Don Woods intro, verbatim from advent.dat). Canon already
// bakes the Willie Crowther + Don Woods (SU-AI) attribution into the prose, so
// the splash uses canon text rather than port-flavored credits.
//
// Godot→JS mapping: the Godot test builds a JoinedDriver, calls
// d._print_welcome(), and scans the joined banner. The JS CcaDriver has no
// public _print_welcome(); its closest public counterpart is start(), which
// renders the opening banner. We capture start() and scan it for the same
// VERBATIM canon msg #1 beats. (If the JS port's start() prints a Frame-port
// banner instead of the canon msg #1 prose, these substring checks FAIL — that
// is a faithful, expected reveal of a JS-port welcome-prose gap, NOT something
// to paper over. Expected values are copied verbatim from the Godot source.)
import { file, ok, makeDriver } from "./_harness";

file("test_cca_credit_splash");

function expectContains(label: string, haystack: string, needle: string): void {
  ok(`${label} contains '${needle}'`, haystack.includes(needle));
}

console.log("=== CCA Crowther/Woods credit splash ===");
const d = makeDriver();
// start() is the public welcome render (the Godot _print_welcome() counterpart).
const t: string = d.start().join("\n");

// Canon msg #1 verbatim beats (advent.dat). The famous Don Woods 1977 intro
// paragraph with the Crowther + Woods byline baked in at the bottom.
expectContains("canon msg #1 opener", t, "Somewhere nearby is Colossal Cave");
expectContains("canon msg #1 magic", t, "Magic is said to work in the cave");
expectContains("canon msg #1 5-letter rule", t, "first five letters");
expectContains("canon msg #1 HELP nudge", t, "HELP");
expectContains("canon byline — Crowther", t, "Willie Crowther");
expectContains("canon byline — Woods", t, "Don Woods");
expectContains("canon byline — SU-AI", t, "SU-AI");
expectContains("canon msg #65 prompt", t, "Welcome to Adventure");
expectContains("HELP hint", t, "HELP");
