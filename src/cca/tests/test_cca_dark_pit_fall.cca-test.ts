// Port of Godot tests/test_cca_dark_pit_fall.gd — the canonical dark-room pit-fall
// hazard. Drives checkDarkPitHazard() directly and asserts against the captured
// lines. Canon (Crowther/Woods): in a dark cave room with the lamp unlit, the
// first motion attempt warns ("It is now pitch dark…"), then subsequent attempts
// have a 35% chance to fall into a pit and die. We don't pin which iteration
// kills — only that the kill eventually fires and the canon message appears.
import { file, expect, ok } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_dark_pit_fall");

function anyMatch(label: string, lines: string[], needle: string): void {
  ok(`${label} found '${needle}'`, lines.some((l) => l.includes(needle)));
}

// Raw driver — lamp NOT lit (so cave rooms are dark), mirrors the bespoke
// _make_driver in the Godot test (no do_command("light")).
const d = new CcaDriver();
const a = d.machine();

// Phase 1: lit room (canon 1, end of road) — hazard never fires.
expect("at end of road", a.player_room(), 1);
expect("dark now?", a.room_is_dark_now(), false);
expect("hazard fired in lit room", d.checkDarkPitHazard(), false);
expect("warned-room marker", a.dark_warned_room(), -1);
expect("buffer empty", d.captured.length, 0);

// Phase 2: dark room (debris, 11), lamp off — first attempt warns.
a.player.move_to(11);
expect("at debris", a.player_room(), 11);
expect("dark now?", a.room_is_dark_now(), true);
expect("lamp lit?", a.is_lit(), false);
expect("first attempt fires (warning)", d.checkDarkPitHazard(), true);
expect("warned room marker set", a.dark_warned_room(), 11);
anyMatch("warning message captured", d.captured, "pitch dark");
expect("player still alive", a.player_state(), "alive");

// Phase 3: subsequent attempts — roll the 35% until the player dies.
let attempts = 0;
while (a.player_state() !== "dead" && attempts < 100) {
  d.checkDarkPitHazard();
  attempts += 1;
}
expect("player died within 100 attempts", a.player_state(), "dead");
anyMatch("death message captured", d.captured, "broke every bone");

// Phase 4: revive + light lamp — hazard cleared.
a.player.revive();
expect("alive after revive", a.player_state(), "alive");
a.player.move_to(11);
a.do_command("light", "");
expect("lamp lit?", a.is_lit(), true);
expect("hazard skipped while lit", d.checkDarkPitHazard(), false);
expect("warned-room marker cleared", a.dark_warned_room(), -1);

// Phase 5: per-room marker — fresh warning in a different dark room.
a.extinguish_lamp();
a.player.move_to(13); // bird chamber, dark
const preCount = d.captured.length;
expect("first attempt at new dark room warns", d.checkDarkPitHazard(), true);
expect("warned-room marker = 13", a.dark_warned_room(), 13);
anyMatch("new warning emitted", d.captured.slice(preCount), "pitch dark");
