// Port of Godot tests/test_cca_endgame_panic.gd — canon PANIC mechanic
// (advent.for STMT 2), DRIVER-level (mirrors H.make_driver() / H.capture()).
// Same assertions, same expected values, same order.
//
//   During $Closing, attempting to move toward a surface room (canon dest 1..8)
//   emits canon msg #130 ("...This exit is closed."), the move is blocked, and
//   CLOCK2 (closing_timer) is capped at 15 — but only the FIRST attempt re-caps.
//   Subsequent attempts re-emit msg #130 but don't shorten the timer further
//   (PANIC latch). Outside $Closing the panic intercept is a no-op.
import { file, expect, expectContains, makeDriver, capture } from "./_harness";
import type { CcaDriver } from "../driver";

file("test_cca_endgame_panic");

// Force the Endgame into $Closing by depositing canon TREASURES_TO_TRIGGER
// treasures via the aspect's public interface (no direct test hook).
function forceClosing(d: CcaDriver): void {
  for (let i = 0; i < 15; i++) d.machine().endgame.treasure_deposited();
}

// ----- Phase 1: pre-closing — panic intercept is a no-op -----
const d1 = makeDriver();
d1.machine().player.move_to(2); // canon hill
const l1: string[] = capture(d1, "south");
expect("$Active panic flag false", d1.machine().endgame_panicked(), false);
let sawMsg130 = false;
for (const line of l1) {
  if (line.includes("exit is closed")) {
    sawMsg130 = true;
    break;
  }
}
expect("no msg #130 fires pre-closing", sawMsg130, false);

// ----- Phase 2: $Closing — first surface move triggers PANIC -----
const d2 = makeDriver();
forceClosing(d2);
expect("setup: endgame is closing", d2.machine().endgame_closing(), true);
expect("setup: not yet panicked", d2.machine().endgame_panicked(), false);
const timerBefore: number = d2.machine().endgame_timer();
expect("setup: timer at CLOSING_DURATION", timerBefore > 15.0, true);

d2.machine().player.move_to(4); // canon valley
const l2: string[] = capture(d2, "north"); // 4 → 1 (road)
expectContains("first $Closing surface attempt emits canon msg #130", l2, "exit is closed");
expect("PANIC latch armed", d2.machine().endgame_panicked(), true);
expect("player still at canon 4", d2.machine().player_room(), 4);
expect("CLOCK2 capped at 15", d2.machine().endgame_timer(), 15);

// ----- Phase 3: second attempt re-emits msg #130 but doesn't re-cap -----
d2.machine().endgame.tick();
d2.machine().endgame.tick();
const timerAfterTicks: number = d2.machine().endgame_timer();
expect("timer ticked down to 13", timerAfterTicks, 13);
const l3: string[] = capture(d2, "north");
expectContains("second attempt re-emits msg #130", l3, "exit is closed");
expect("timer stays at 13 (no re-cap)", d2.machine().endgame_timer(), 13);

// ----- Phase 4: in $InRepository, panic() is a no-op -----
const d3 = makeDriver();
forceClosing(d3);
while (d3.machine().endgame_state() === "closing") d3.machine().endgame.tick();
expect("setup: in_repository", d3.machine().endgame_state(), "in_repository");
d3.machine().endgame.panic(); // canon: no-op
expect("repository panicked? false", d3.machine().endgame_panicked(), false);
