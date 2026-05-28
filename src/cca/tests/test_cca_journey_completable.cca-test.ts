// Port of Godot tests/test_cca_journey_completable.gd — a LIVENESS /
// completability check (distinct from reachability/safety): from every milestone
// the canonical journey passes through, restoring that milestone's save-state
// snapshot and replaying the REMAINING journey reaches $Won. This is the "save
// mid-game, reload, and still finish" property — proving no canonical milestone
// is a softlock and that the save/restore boundary preserves completability.
import { file, expect, ok, makeDriver } from "./_harness";
import { CANONICAL_JOURNEY } from "./journeys";

file("test_cca_journey_completable");

// FSM-shortcut milestones (canonical_journey_adapter.gd): TreasuresFilled = 13
// treasure deposits; InRepository = 35 ticks. Mirrors runJourney's shortcuts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyShortcut(a: any, shortcut?: string): void {
  if (shortcut === "fillTreasures") for (let k = 0; k < 13; k++) a.endgame.treasure_deposited();
  else if (shortcut === "tickToRepository") for (let k = 0; k < 35; k++) a.tick();
}

// Capture every milestone's snapshot in one full forward walk.
const cap = makeDriver();
cap.machine().dwarves_auto_woken = true;
const snapshots: { name: string; bytes: string }[] = [];
for (const m of CANONICAL_JOURNEY) {
  applyShortcut(cap.machine(), m.shortcut);
  for (const s of m.steps) if ("cmd" in s) cap.input(s.cmd.toLowerCase());
  snapshots.push({ name: m.name, bytes: cap.machine().save_state() });
}
expect("forward walk reaches won", cap.machine().endgame_state(), "won");

// For each milestone index i: restore snapshot[i], replay milestones i+1..end,
// assert the result is $Won.
for (let i = 0; i < snapshots.length; i++) {
  const d = makeDriver();
  d.machine().dwarves_auto_woken = true;
  d.restoreFsmState(snapshots[i].bytes);
  let idx = 0;
  for (const m of CANONICAL_JOURNEY) {
    if (idx > i) {
      applyShortcut(d.machine(), m.shortcut);
      for (const s of m.steps) if ("cmd" in s) d.input(s.cmd.toLowerCase());
    }
    idx += 1;
  }
  ok(`resume @ [${i}] ${snapshots[i].name} → won`, d.machine().endgame_state() === "won");
}
