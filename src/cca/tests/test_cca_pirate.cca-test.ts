// Port of Godot tests/test_cca_pirate.gd — pirate stash + retrieval cycle,
// FSM-direct (makeAdventure = Cca.new()). Same assertions, same expected
// values, same order. Verifies: pirate starts $Dormant, activates after carry
// threshold, steals → treasure relocates to chest room 18 + leaves inventory,
// player retrieves it, deterministic pick order (gold first), empty-hands
// rustle flavor, and save/restore round-trips a stashed treasure.
//
// RNG NOTE: the JS Pirate.try_steal() uses a per-instance deterministic hash
// (seed=99 + step counter), reproduced bit-identically from the Godot port —
// NOT a global RNG. So _driveToSteal terminates deterministically and the
// "gold picked first" outcome is fixed, exactly as the Godot test relies on.
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_pirate");

// Single-string "contains" assertion (Godot _expect_contains).
function expectContainsStr(label: string, actual: string, fragment: string): void {
  ok(`${label} (contains ${fragment})`, actual.includes(fragment));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function driveToSteal(adv: any): string {
  // Hammer try_steal until it triggers. Seeded PRNG → bounded.
  let attempts = 0;
  while (attempts < 50) {
    const msg: string = adv.pirate_attempt_steal();
    if (msg !== "") return msg;
    attempts += 1;
  }
  return "";
}

// --- Initial state ---
const adv = makeAdventure();
adv.setup_default_aspects();
expect("pirate state", adv.pirate_state(), "dormant");

// --- Activate by carrying threshold ---
adv.player.take(adv.GOLD_ID);
adv.player.take(adv.SILVER_ID);
adv.player.take(adv.DIAMONDS_ID);
// tick so treasures_carried gets observed by the FSM
adv.tick();
expect("pirate stalking", adv.pirate_state(), "stalking");

// --- Force a steal ---
const msg: string = driveToSteal(adv);
// Canon msg #128 — generic "He snatches your treasure". Specific treasure
// verified below via state.
expectContainsStr("steal message", msg, "snatches your treasure");
expect("gold was stolen", adv.gold.get_location(), 18);
expect("pirate vanished", adv.pirate_state(), "vanished");

// --- Verify the gold is now in the chest room ---
expect("gold not carried", adv.player.carrying(adv.GOLD_ID), false);
expect("gold state", adv.gold.get_state(), "in_room");
expect("gold location", adv.gold.get_location(), 18);

// --- Player retrieves the gold from the chest room ---
adv.do_command("light", "");
adv.player.move_to(18);
const r = adv.do_command("take", "gold");
expectContainsStr("take response", r, "OK");
expect("gold carried again", adv.player.carrying(adv.GOLD_ID), true);
expect("gold state again", adv.gold.get_state(), "carried");

// --- Determinism: same setup, same first-stolen treasure ---
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.player.take(adv2.GOLD_ID);
adv2.player.take(adv2.SILVER_ID);
adv2.player.take(adv2.DIAMONDS_ID);
adv2.tick();
const msg2: string = driveToSteal(adv2);
expectContainsStr("repeat steal", msg2, "snatches your treasure");
expect("gold still picked first", adv2.gold.get_location(), 18);

// --- Pick-order: pirate picks gold first (lowest ID first) ---
const adv3 = makeAdventure();
adv3.setup_default_aspects();
adv3.player.take(adv3.SILVER_ID);
adv3.player.take(adv3.DIAMONDS_ID);
adv3.player.take(adv3.JEWELRY_ID);
adv3.tick();
const msg3: string = driveToSteal(adv3);
expectContainsStr("silver stolen", msg3, "snatches your treasure");
expect("silver in chest room", adv3.silver.get_location(), 18);

// --- Pirate sees empty hands ---
const adv4 = makeAdventure();
adv4.setup_default_aspects();
// Force activation manually since no treasures = no normal trigger
adv4.pirate.treasures_carried(5);
expect("forced stalking", adv4.pirate_state(), "stalking");
const msg4: string = driveToSteal(adv4);
// Canon: pirate-empty-hands emits msg #127 (faint rustling lead-in). Canon has
// no "slinks off in disgust" follow-up.
expectContainsStr("empty-hands flavor", msg4, "faint rustling");

// --- Save / restore mid-stash ---
const adv5 = makeAdventure();
adv5.setup_default_aspects();
adv5.player.take(adv5.GOLD_ID);
adv5.player.take(adv5.SILVER_ID);
adv5.player.take(adv5.DIAMONDS_ID);
adv5.tick();
driveToSteal(adv5);
expect("gold in chest pre-save", adv5.gold.get_location(), 18);
const bytes = adv5.save_state();

// Mutate after save: take the gold back
adv5.player.move_to(18);
adv5.do_command("light", "");
adv5.do_command("take", "gold");
expect("gold carried post-mutate", adv5.gold.get_state(), "carried");

const adv6 = makeAdventure();
adv6.restore_state(bytes);
expect("restored gold in chest", adv6.gold.get_location(), 18);
expect("restored gold state", adv6.gold.get_state(), "in_room");
expect("restored pirate vanished", adv6.pirate_state(), "vanished");
