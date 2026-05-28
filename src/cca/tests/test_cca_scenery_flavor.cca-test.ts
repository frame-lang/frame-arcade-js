// Port of Godot tests/test_cca_scenery_flavor.gd — canon EXAMINE/READ flavor
// for the in-scene-only objects (advent.dat section 5 objects 13/23/26/27/29/
// 37/40/25):
//
//   READ TABLET    @ canon 101 → msg #196 (long tablet readout)
//   EXAMINE MIRROR @ canon 109 → canon msg #76 (prop=0 → "Peculiar")
//   EXAMINE FIGURE @ canon 35 / 110 → shadowy-figure flavor
//   EXAMINE STALACTITE @ canon 111 → canon msg #76
//   EXAMINE DRAWINGS @ canon 97 → canon msg #76
//   EXAMINE VOLCANO @ canon 126 → canon msg #76
//   EXAMINE CARPET / MOSS @ canon 96 → canon msg #76
//   EXAMINE PLANT @ canon 23 → canon obj#PLANT prop=200 verbatim
//   READ/EXAMINE MESSAGE @ canon 140 → canon msg #191
//
// All expected substrings are copied verbatim from the Godot source.
import { file, expectContains, makeDriver } from "./_harness";
import { CcaDriver } from "../driver";

file("test_cca_scenery_flavor");

// _capture_at(d, room, input): teleport the player to `room`, run `input`,
// return only the lines that command emitted (mirrors the Godot helper, which
// slices d.captured from the pre-input length — exactly what d.input returns).
function captureAt(d: CcaDriver, room: number, input: string): string[] {
  d.machine().player.move_to(room);
  return d.input(input);
}

const d = makeDriver();

// ----- TABLET @ 101 -----
expectContains(
  "READ TABLET @ 101 → canon msg #196",
  captureAt(d, 101, "read tablet"),
  "Congratulations on bringing light into the dark-room",
);
expectContains(
  "EXAMINE TABLET @ 101 → same canon prose",
  captureAt(d, 101, "examine tablet"),
  "Congratulations on bringing light into the dark-room",
);

// ----- Scenery EXAMINE — canon obj prop=0 = ">$<" (no flavor) → msg #76 -----
expectContains("EXAMINE MIRROR @ 109 → canon msg #76", captureAt(d, 109, "examine mirror"), "Peculiar");

// ----- SHADOWY FIGURE @ 35 — has canon prop=0 prose -----
expectContains(
  "EXAMINE FIGURE @ 35 → shadowy-figure flavor",
  captureAt(d, 35, "examine figure"),
  "trying to attract your attention",
);
expectContains(
  "EXAMINE SHADOW @ 110 → shadowy-figure flavor",
  captureAt(d, 110, "examine shadow"),
  "trying to attract your attention",
);

expectContains("EXAMINE STALACTITE @ 111 → canon msg #76", captureAt(d, 111, "examine stalactite"), "Peculiar");
expectContains("EXAMINE DRAWINGS @ 97 → canon msg #76", captureAt(d, 97, "examine drawings"), "Peculiar");
expectContains("EXAMINE VOLCANO @ 126 → canon msg #76", captureAt(d, 126, "examine volcano"), "Peculiar");
expectContains("EXAMINE GEYSER @ 126 → canon msg #76", captureAt(d, 126, "examine geyser"), "Peculiar");
expectContains("EXAMINE CARPET @ 96 → canon msg #76", captureAt(d, 96, "examine carpet"), "Peculiar");
expectContains("EXAMINE MOSS @ 96 → canon msg #76", captureAt(d, 96, "examine moss"), "Peculiar");

// ----- PHONY PLANT @ 23 — canon obj#PLANT prop=200 verbatim -----
expectContains(
  "EXAMINE PLANT @ 23 → canon obj#PLANT prop=200",
  captureAt(d, 23, "examine plant"),
  "huge beanstalk growing out of the west pit",
);

// ----- MESSAGE @ 140 (second-maze stash mirror) -----
expectContains(
  "READ MESSAGE @ 140 → canon msg #191",
  captureAt(d, 140, "read message"),
  "not the maze where the pirate leaves",
);
expectContains(
  "EXAMINE MESSAGE @ 140 → same canon msg",
  captureAt(d, 140, "examine message"),
  "not the maze where the pirate leaves",
);
