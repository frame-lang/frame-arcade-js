// Port of Godot tests/test_cca_score.gd — ScoreLedger (observe verdict), FSM-direct.
// Same assertions, same expected values. A "consume" higher up the bus stops
// dispatch BEFORE ScoreLedger runs (score priority is below the consumers), so
// darkness-consumed and backpack-consumed commands DON'T show up in commands_seen.
import { file, expect, makeAdventure } from "./_harness";

file("test_cca_score");

const adv = makeAdventure();
adv.setup_default_aspects();

// Pass-through commands all observed:
adv.do_command("look", ""); // at end-of-road (1), lit, observed
adv.player.move_to(18); // gold-nugget room (canon 18, dark)
adv.do_command("look", ""); // in dark room — consumed by darkness, NOT observed
expect("commands seen", adv.commands_seen(), 1);
expect("darkness consumed", adv.darkness_consumed_count(), 1);

// Take a real treasure — observed and rolls up into the canonical score:
adv.do_command("light", ""); // 1 more observed
const pre_cmds: number = adv.commands_seen();
const r = adv.do_command("take", "gold"); // player at room 11 (debris), gold is here
expect("take observed (no consume)", adv.commands_seen(), pre_cmds + 1);
expect("take returned 'Taken'", r.includes("OK"), true);

// Fill to limit by direct stuffing, then attempt one more take:
for (let i = 101; i < 107; i++) {
  adv.player.take(i); // six dummy IDs — bus not involved
}
expect("inventory at limit", adv.player.inventory_size(), 7);

const pre_cmds_2: number = adv.commands_seen();
adv.player.move_to(28); // silver canon room (28)
adv.do_command("take", "silver"); // consumed by BackpackLimit, ledger not observed
expect("backpack blocked", adv.backpack_blocked_count(), 1);
expect("commands unchanged", adv.commands_seen(), pre_cmds_2);

// Save / restore preserves ledger:
const bytes = adv.save_state();
adv.do_command("look", ""); // mutates after save
adv.do_command("look", "");
const live_cmds: number = adv.commands_seen();

const adv2 = makeAdventure();
adv2.restore_state(bytes);
expect("restored commands", adv2.commands_seen(), live_cmds - 2);
