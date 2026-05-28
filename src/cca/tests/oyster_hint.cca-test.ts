// Port of Godot tests/test_cca_oyster_hint.gd — canon OYSTER hint chain
// (advent.dat msgs #192/193/194): READ OYSTER → Y/N prompt (10-pt cost); YES →
// reveal + 10-pt deduction; NO → cancel (no penalty); re-read after reveal →
// "same thing". Same assertions and expected values.
import { file, expect, expectContains, makeDriver } from "./_harness";
import type { CcaDriver } from "../driver";

file("test_cca_oyster_hint");

// Break the clam to spawn the oyster scenery in the player's room (mirrors the
// Godot test's _make_driver_with_oyster: place+take clam & rod, drop clam, break).
function makeDriverWithOyster(): CcaDriver {
  const d = makeDriver();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a: any = d.machine();
  const here: number = a.player_room();
  a.clam_item.place(here);
  a.clam_item.try_take(here);
  a.player.take(a.CLAM_ID);
  a.rod_item.place(here);
  a.rod_item.try_take(here);
  a.player.take(a.ROD_ID);
  a.do_command("drop", "clam");
  a.do_command("break", "clam");
  return d;
}

// Phase 1: first READ OYSTER → prompt.
const d = makeDriverWithOyster();
const l1 = d.input("read oyster");
expectContains("READ OYSTER emits canon prompt msg #192", l1, "10 points");
expect("prompt active", d.promptMachine().current_prompt(), "oyster");
expect("not yet revealed", d.machine().is_oyster_revealed(), false);

// Phase 2: YES → msg #193 reveal + 10-pt deduction.
const scoreBefore: number = d.machine().score();
const hintsBefore: number = d.machine().hint_penalty();
const l2 = d.input("yes");
expectContains("YES emits canon msg #193 reveal", l2, "something strange about this place");
expectContains("YES emits 'words I've always known' hint", l2, "words I've always known");
expect("revealed flag set", d.machine().is_oyster_revealed(), true);
expect("prompt cleared", d.promptMachine().is_active(), false);
expect("score dropped by 10", d.machine().score(), scoreBefore - 10);
expect("hint penalty dropped by 10", d.machine().hint_penalty(), hintsBefore - 10);

// Phase 3: re-read after reveal → msg #194.
const l3 = d.input("read oyster");
expectContains("re-read emits canon msg #194", l3, "same thing it did before");

// Phase 4: NO branch — cancel without penalty.
const d2 = makeDriverWithOyster();
d2.input("read oyster");
expect("prompt armed", d2.promptMachine().current_prompt(), "oyster");
const scoreB4: number = d2.machine().score();
const l4 = d2.input("no");
expectContains("NO emits 'OK.'", l4, "OK.");
expect("prompt cleared", d2.promptMachine().is_active(), false);
expect("not revealed", d2.machine().is_oyster_revealed(), false);
expect("score unchanged", d2.machine().score(), scoreB4);
const l4b = d2.input("read oyster");
expectContains("post-NO re-read re-prompts canon msg #192", l4b, "10 points");

// Phase 5: EXAMINE OYSTER (synonym) also enters the chain.
const d3 = makeDriverWithOyster();
const l5 = d3.input("examine oyster");
expectContains("EXAMINE OYSTER prompts canon msg #192", l5, "10 points");
