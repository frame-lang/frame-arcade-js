// Port of Godot tests/test_cca_cave_y2_back.gd — three small canon mechanics:
//
//   CAVE outdoors (rooms 1-8) → canon msg #57
//   CAVE indoors  (rooms 9+)  → canon msg #58
//   Y2 (canon room 33) PLUGH-whisper rolls msg #8 at ~25%
//   BACK with no remembered prior room → canon msg #91
//
// Phase 4 verifies the Y2 whisper at a much higher iteration count (1000) than
// would normally happen in play, asserting the rate is within ±5σ of canon's
// 25%. σ = sqrt(1000*0.25*0.75) ≈ 13.7 → ±5σ = ±69 → window [181, 319] around
// the 250 expected mean. The Godot source pins the engine RNG via seed(...);
// here we OMIT it — the model `chance` LCG (bit-faithful) is what drives the
// y2_whisper gate, and the ±5σ window holds for any starting chance state.
//
// The whisper is sampled by re-rendering the room directly (captureRoomRender,
// the JS counterpart to Godot's _print_room()) so no per-turn tick/lamp drain
// interferes — exactly the Godot pattern.
import { file, expect, ok, expectContains, capture, makeDriver } from "./_harness";

file("test_cca_cave_y2_back");

function inRange(label: string, actual: number, lo: number, hi: number): void {
  ok(`${label} = ${actual} (in [${lo}, ${hi}])`, actual >= lo && actual <= hi);
}

// ----- Phase 1: CAVE outdoors → msg #57 -----
const d1 = makeDriver();
d1.machine().player.move_to(3);
const l1 = capture(d1, "cave");
expectContains("CAVE outdoors emits 'I don't know where the cave is'", l1, "I don't know where the cave is");

// ----- Phase 2: CAVE indoors → msg #58 -----
const d2 = makeDriver();
d2.machine().player.move_to(9);
const l2 = capture(d2, "cave");
expectContains("CAVE indoors emits 'I need more detailed instructions'", l2, "I need more detailed instructions");

// ----- Phase 3: BACK with no prior location → msg #91 -----
const d3 = makeDriver();
const l3 = capture(d3, "back");
expectContains("BACK with no prior loc emits 'no longer seem to remember'", l3, "no longer seem to remember");

// ----- Phase 4: Y2 whisper at canon 33 fires ~25% per visit -----
const d4 = makeDriver();
d4.machine().player.move_to(33);
let whispers = 0;
for (let i = 0; i < 1000; i++) {
  const lines = d4.captureRoomRender();
  if (lines.some((line) => line.toLowerCase().includes("hollow voice"))) whispers += 1;
}
console.log(`  observed: ${whispers} whispers in 1000 Y2 visits (canon ~250)`);
inRange("whispers in [181, 319] (canon 25% ± 5σ)", whispers, 181, 319);

// ----- Phase 5: Y2 whisper does NOT fire elsewhere -----
const d5 = makeDriver();
d5.machine().player.move_to(3);
let noise = 0;
for (let i = 0; i < 200; i++) {
  const lines = d5.captureRoomRender();
  if (lines.some((line) => line.toLowerCase().includes("hollow voice"))) noise += 1;
}
expect("0 whispers at canon room 3 (200 visits)", noise, 0);
