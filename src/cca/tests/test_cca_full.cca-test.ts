// Port of Godot tests/test_cca_full.gd — full canonical CCA playthrough with the
// expanded maze, all 15 treasures, the endgame timer, the BLAST/detonate win,
// and a separate hint-penalty check. Direct FSM test (do_command), not driver.
import { file, expect, ok, makeAdventure } from "./_harness";

file("test_cca_full");

function contains(label: string, actual: string, fragment: string): void {
  ok(`${label} (contains "${fragment}")`, actual.includes(fragment));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deposit(adv: any, name: string, returnRoom: number): void {
  adv.player.move_to(3); // well house — DEPOSIT_ROOM
  adv.do_command("drop", name);
  adv.player.move_to(returnRoom);
}

const adv = makeAdventure();
adv.setup_default_aspects();
adv.wake_dwarves();
adv.do_command("light", "");

// EXAMINE / READ / THROW verbs.
adv.player.move_to(33); // Y2 (dwarf2 spawned there)
contains("examine lamp", adv.do_command("examine", "lamp"), "lantern");
contains("examine sign at Y2", adv.do_command("examine", "sign"), "Y2");
contains("read sign at Y2", adv.do_command("read", "sign"), "Y2");
contains("throw axe response", adv.do_command("throw", "axe"), "aren't carrying");

// Loot the surface treasures.
adv.player.move_to(18); // gold
adv.do_command("take", "gold");
deposit(adv, "gold", 11);

adv.player.move_to(28); // silver
adv.do_command("take", "silver");
deposit(adv, "silver", 33);

adv.player.move_to(33);
adv.do_command("plover", "");
expect("at Plover Room", adv.player_room(), 100);
adv.do_command("take", "emerald");
adv.do_command("plover", "");
adv.player.move_to(3);
adv.do_command("drop", "emerald");

// Pearl: take rod (canon 11), then clam at canon 103, break → pearl.
adv.player.move_to(11);
adv.do_command("take", "rod");
adv.player.move_to(103);
adv.do_command("take", "clam");
adv.player.move_to(16);
adv.do_command("drop", "clam");
adv.do_command("break", "clam");
adv.do_command("take", "pearl");
deposit(adv, "pearl", 33);
adv.player.move_to(33);

// Bird → Snake → Dragon → rug + diamonds.
adv.player.move_to(10);
adv.do_command("take", "cage");
adv.player.move_to(13);
adv.do_command("take", "bird");
adv.player.move_to(19);
adv.do_command("release", "bird");
adv.do_command("move", "119");
adv.do_command("attack", "dragon");
adv.do_command("yes", "");
expect("dragon dead", adv.dragon_alive(), false);
adv.do_command("take", "rug");
deposit(adv, "rug", 119);

adv.player.move_to(27); // diamonds @ canon 27
adv.do_command("take", "diamonds");
deposit(adv, "diamonds", 27);

// Bear → Troll bridge unlock.
adv.player.move_to(3);
adv.do_command("take", "food");
adv.player.move_to(130); // Barren — bear chamber
adv.do_command("feed", "bear");
adv.do_command("take", "chain");
adv.do_command("move", "117"); // troll bridge
adv.do_command("drop", "chain");
expect("troll vanished", adv.troll_state(), "vanished");

// Jewelry at south side chamber (canon 29).
adv.player.move_to(29);
adv.do_command("take", "jewelry");
deposit(adv, "jewelry", 117);

// Deep cave (3 batches to stay under 7-item cap).
const batchA: [number, string][] = [
  [97, "vase"], [92, "eggs"], [95, "trident"],
];
for (const [room, name] of batchA) {
  adv.player.move_to(room);
  adv.do_command("take", name);
}
for (const [, name] of batchA) {
  adv.player.move_to(3);
  adv.do_command("drop", name);
}

// Chest is dynamic — spawn it at CHEST_ROOM before batch B.
adv.chest.reappear(adv.CHEST_ROOM);
const batchB: [number, string][] = [
  [127, "spices"], [18, "chest"], [101, "pyramid"],
];
for (const [room, name] of batchB) {
  adv.player.move_to(room);
  adv.do_command("take", name);
}
for (const [, name] of batchB) {
  adv.player.move_to(3);
  adv.do_command("drop", name);
}

// Batch C: coins (30) + chain (15th treasure).
const batchC: [number, string][] = [
  [30, "coins"], [117, "chain"],
];
for (const [room, name] of batchC) {
  adv.player.move_to(room);
  adv.do_command("take", name);
}
for (const [, name] of batchC) {
  adv.player.move_to(3);
  adv.do_command("drop", name);
}

expect("all 15 deposited", adv.treasures_deposited(), 15);
expect("treasure score", adv.treasure_score(), 210);
expect("endgame closing", adv.endgame_closing(), true);

// Drive the endgame timer to 0.
for (let i = 0; i < 30; i++) adv.tick();
expect("endgame in repository", adv.endgame_state(), "in_repository");

// Detonate marker → win + bonus.
const preScore: number = adv.score();
adv.detonate_marker();
expect("won", adv.endgame_won(), true);
expect("score gained 50 bonus", adv.score(), preScore + 50);
expect("endgame component", adv.endgame_score(), 50);

// Hint penalty (separate adventure). Canon bird threshold = 5 turns.
const adv2 = makeAdventure();
adv2.setup_default_aspects();
adv2.player.move_to(13);
for (let i = 0; i < 5; i++) adv2.tick();
expect("bird_hint eligible", adv2.hint_state("bird"), "eligible");
adv2.request_hint("bird");
expect("hint penalty", adv2.hint_penalty(), -2);
