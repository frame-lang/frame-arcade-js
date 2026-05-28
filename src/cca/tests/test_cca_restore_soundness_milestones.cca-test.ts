// Port of Godot tests/test_cca_restore_soundness_milestones.gd — re-arms the
// incomplete-state-vector guard at the DEEP journey-DAG chokepoints. For each
// milestone, restore a FRESH adapter instance and a DIRTIED, reused one (player
// killed + revive prompt opened), and compare observable signatures. A
// divergence means transition-relevant state at that chokepoint lives outside
// fsm.save_state and didn't survive the restore — the leak class that once
// produced the "53/140" lie. Zero divergences == restore is observationally
// sound at every deep chokepoint.
import { file, expect, ok, makeDriver } from "./_harness";
import { walkWinToBridgeBuilt, feedCommands, PLANT_RAIL, TROLL_RAIL, ROOM110_RAIL } from "./journeys";
import { CcaModelAdapter, FrameStateChecker } from "./_modelcheck";
import type { CcaDriver } from "../driver";

file("test_cca_restore_soundness_milestones");

function buildDriver(): CcaDriver {
  const d = makeDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().chance.reseed(42);
  return d;
}

const samples: { name: string; bytes: string }[] = [];

// BridgeBuilt (win rail) — crystal bridge up.
const d = buildDriver();
walkWinToBridgeBuilt(d);
const bridge = d.machine().save_state();
samples.push({ name: "BridgeBuilt", bytes: bridge });

// GiantRoom (plant rail off BridgeBuilt) — beanstalk grown, eggs taken.
const pd = buildDriver();
pd.restoreFsmState(bridge);
feedCommands(pd, PLANT_RAIL);
samples.push({ name: "GiantRoom", bytes: pd.machine().save_state() });

// TrollFarSide (troll rail off GiantRoom) — troll paid, across the bridge.
feedCommands(pd, TROLL_RAIL);
samples.push({ name: "TrollFarSide", bytes: pd.machine().save_state() });

// Room110 (room110 rail off BridgeBuilt) — pinned through the 65:north gate.
const qd = buildDriver();
qd.restoreFsmState(bridge);
feedCommands(qd, ROOM110_RAIL);
samples.push({ name: "Room110", bytes: qd.machine().save_state() });

expect("captured 4 deep milestones", samples.length, 4);

// Bisimulation check via the generic engine.
const adapter = new CcaModelAdapter(42);
const checker = new FrameStateChecker(adapter);
const dirty = (_a: CcaModelAdapter, o: CcaDriver): void => {
  o.machine().player.die();
  o.promptMachine().offer_revive();
};
const divergences = checker.restore_soundness(samples, dirty);

for (const dv of divergences) {
  console.log(`  FAIL ${dv.name} — fresh: ${dv.fresh} | reused: ${dv.reused}`);
}
ok(`restore observationally sound at all ${samples.length} deep chokepoints`, divergences.length === 0);
