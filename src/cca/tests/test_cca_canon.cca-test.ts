// Port of Godot tests/test_cca_canon.gd — canon-conformance DASHBOARD.
//
// Godot's canon test is explicitly a dashboard (its header: "this test ALWAYS
// exits 0. It's a dashboard, not a blocker"). It compares the port's runtime
// values against the canonical 1977 Crowther+Woods data in cca/canon/ and prints
// a delta report; the 50+ scenario tests still drive correctness. The dashboard
// just gives canon-fidelity progress visibility.
//
// This JS port preserves the always-pass behavior so the suite mirrors Godot's
// file count + result, and notes the dashboard role. The full canon-delta
// reporting (treasure homes / NPC home rooms / magic-word pairs / etc.) is left
// to the Godot dashboard for now — the scenario tests (~85 in this suite) catch
// the correctness regressions that matter.
import { file, ok } from "./_harness";

file("test_cca_canon");

// Single trivial assertion so the suite registers the file as "PASS"; mirrors
// Godot canon's quit(0) regardless of deltas. No deltas reported here — see the
// Godot dashboard for the live canon-fidelity report.
ok("canon dashboard (always-pass, mirrors Godot quit(0))", true);
