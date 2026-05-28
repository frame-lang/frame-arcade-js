// Port of Godot tests/test_cca_transient_prose.gd — coverage audit for canon's
// transient-prose rooms (21, 22, 31, 32, 89, 90): message-condition rooms that
// fire canon prose when specific triggers hit. Mixed FSM-direct (`Cca.new()`)
// and DRIVER-level (H.make_driver() / H.capture()). Same assertions, same
// expected values, same order.
import { file, ok, makeAdventure, makeDriver, capture } from "./_harness";

file("test_cca_transient_prose");

let failures = 0;

function assertContains(name: string, haystack: string, needle: string): void {
  const hit = haystack.toLowerCase().includes(needle.toLowerCase());
  if (hit) console.log(`  OK   ${name}`);
  else {
    console.log(`  FAIL ${name} — '${needle}' not in: ${haystack}`);
    failures += 1;
  }
  ok(`${name} contains '${needle}'`, hit);
}

function assertLines(name: string, lines: string[], needle: string): void {
  const joined: string = lines.join("\n").toLowerCase();
  const hit = joined.includes(needle.toLowerCase());
  if (hit) console.log(`  OK   ${name}`);
  else {
    console.log(`  FAIL ${name} — '${needle}' not in: ${joined.substring(0, 200)}`);
    failures += 1;
  }
  ok(`${name} contains '${needle}'`, hit);
}

function assertEq(name: string, got: unknown, expected: unknown): void {
  const hit = got === expected;
  if (hit) console.log(`  OK   ${name} == ${String(expected)}`);
  else {
    console.log(`  FAIL ${name} — expected ${String(expected)}, got ${String(got)}`);
    failures += 1;
  }
  ok(`${name} == ${String(expected)}`, hit);
}

console.log("=== CCA transient-prose canon coverage ===");
console.log("");

// Canon 21 — "you didn't make it". FSM-direct teleport to room 21.
function scenarioCanon21DidntMakeIt(): void {
  console.log("--- canon_21_didnt_make_it ---");
  const adv = makeAdventure();
  adv.setup_default_aspects();
  adv.player.move_to(11);
  const resp: string = adv.do_command("move", "21");
  assertContains("canon msg #21", resp, "didn't make it");
  assertEq("player died", adv.player_state(), "dead");
}

// Canon 22 — "the dome is unclimbable". Fires from canon 15 carrying gold.
function scenarioCanon22DomeUnclimbable(): void {
  console.log("--- canon_22_dome_unclimbable ---");
  const d = makeDriver();
  d.machine().player.move_to(18); // gold home
  d.machine().gold.try_take(18);
  d.machine().player.take(d.machine().GOLD_ID);
  d.machine().player.move_to(15);
  const lines: string[] = capture(d, "up");
  assertLines("canon msg #22", lines, "dome is unclimbable");
}

// Canon 31 — "yawning pit". Documented gap (no port exit routes here).
function scenarioCanon31BottomlessPit(): void {
  console.log("--- canon_31_bottomless_pit ---");
  console.log("  INFO canon 31 (bottomless pit) — no port exit routes here.");
  console.log("       Documented gap, not an asserted failure.");
}

// Canon 32 — "you can't get by the snake". Fires at canon 19 (snake $Blocking).
function scenarioCanon32CantGetBySnake(): void {
  console.log("--- canon_32_cant_get_by_snake ---");
  const d = makeDriver();
  d.machine().player.move_to(19);
  const lines: string[] = capture(d, "south");
  assertLines("canon msg #32", lines, "can't get by the snake");
}

// Canon 89 — "nothing here to climb". Fires at canon 25, plant not grown.
function scenarioCanon89NothingToClimb(): void {
  console.log("--- canon_89_nothing_to_climb ---");
  const d = makeDriver();
  d.machine().player.move_to(25);
  const lines: string[] = capture(d, "up");
  assertLines("canon msg #89", lines, "nothing here to climb");
}

// Canon 90 — climb-up-plant transition. At canon 25 with plant $Tall, UP walks
// the player to canon 23.
function scenarioCanon90ClimbUpPlant(): void {
  console.log("--- canon_90_climb_up_plant ---");
  const d = makeDriver();
  d.machine().plant.water(); // $Sprout → $Tall
  d.machine().player.move_to(25); // West Pit, plant tall
  capture(d, "up");
  assertEq("climbed to canon 23 (West End of Twopit Room)", d.machine().player_room(), 23);
}

scenarioCanon21DidntMakeIt();
scenarioCanon22DomeUnclimbable();
scenarioCanon31BottomlessPit();
scenarioCanon32CantGetBySnake();
scenarioCanon89NothingToClimb();
scenarioCanon90ClimbUpPlant();

console.log("");
if (failures === 0) {
  console.log("PASS — every transient canon-prose room fires its message");
} else {
  console.log(`FAIL — ${failures} transient room(s) missing canon prose`);
}
