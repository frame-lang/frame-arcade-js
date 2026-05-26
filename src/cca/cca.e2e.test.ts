// CCA end-to-end integration test — the "if this passes, the port is faithful"
// gate. Drives the real CcaDriver (parser + topology + all ~28 Frame machines)
// through canonical play and asserts world outcomes. Run: `npm run test:cca`
// (esbuild-bundles this + the generated machines, then node executes it).
//
// Uses driver.machine() to teleport (player.move_to) for setup and to inspect
// FSM state; the verbs under test go through the real driver.input() path.
import { CcaDriver } from "./driver";

declare const process: { exit(code: number): void };

let fails = 0;
function ok(label: string, cond: boolean): void {
  if (cond) console.log("  ok   " + label);
  else {
    console.log("  FAIL " + label);
    fails += 1;
  }
}
function run(d: CcaDriver, cmd: string): string {
  return d.input(cmd).join(" ");
}

console.log("=== CCA end-to-end integration (driver + topology + all FSMs) ===");

// --- Opening: well house, items, lamp ---
{
  const d = new CcaDriver();
  d.start();
  ok("start at end of road (room 1)", d.room() === 1);
  run(d, "east");
  ok("east -> well house (3)", d.room() === 3);
  run(d, "take keys");
  run(d, "take lamp");
  run(d, "take bottle");
  run(d, "on");
  const a = d.machine();
  ok("lamp lit", a.is_lit() === true);
  const inv = run(d, "inventory");
  ok("inventory lists keys", inv.includes("Set of keys"));
  ok("inventory lists lantern", inv.includes("Brass lantern"));
}

// --- Magic words: xyzzy round trip ---
{
  const d = new CcaDriver();
  d.start();
  run(d, "east");
  run(d, "xyzzy");
  ok("xyzzy 3 -> debris (11)", d.room() === 11);
  run(d, "xyzzy");
  ok("xyzzy 11 -> well house (3)", d.room() === 3);
}

// --- Treasure: take + deposit scores ---
{
  const d = new CcaDriver();
  d.start();
  const a = d.machine();
  a.player.move_to(18); // gold's home room
  run(d, "take gold");
  ok("carrying gold", a.player.carrying(110));
  a.player.move_to(3); // well house = deposit room
  run(d, "drop gold");
  ok("gold deposited", a.gold.is_deposited());
  ok("score increased after deposit", a.score() > 0);
}

// --- Bird + cage + snake (canon: the cage is needed to carry the bird) ---
{
  const d = new CcaDriver();
  d.start();
  const a = d.machine();
  a.player.move_to(10);
  run(d, "take cage"); // cage at the cobble crawl (10)
  a.player.move_to(13);
  run(d, "take bird"); // bird chamber (13)
  ok("bird captured into cage", a.bird_state() === "caged");
  a.player.move_to(19); // Hall of the Mountain King (snake)
  ok("snake blocking before release", a.snake_state() === "blocking");
  run(d, "release bird");
  ok("snake driven off after bird release", a.snake_state() === "gone");
}

// --- Dragon: bare-hands kill (attack -> yes) ---
{
  const d = new CcaDriver();
  d.start();
  const a = d.machine();
  a.player.move_to(119);
  run(d, "attack dragon");
  ok("dragon awaiting confirmation", a.dragon.is_awaiting_confirmation());
  const yesOut = run(d, "yes").toLowerCase();
  ok("dragon vanquished", a.dragon_alive() === false);
  ok("kill prose shown", yesOut.includes("vanquished") || yesOut.includes("congratulations"));
}

// --- Grate: unlock with keys ---
{
  const d = new CcaDriver();
  d.start();
  const a = d.machine();
  run(d, "east");
  run(d, "take keys");
  a.player.move_to(8); // depression / steel grate
  ok("grate locked initially", a.grate_locked());
  run(d, "unlock grate");
  ok("grate unlocked with keys", a.grate_locked() === false);
}

console.log(fails === 0 ? "PASS — CCA e2e complete" : `FAIL — ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
