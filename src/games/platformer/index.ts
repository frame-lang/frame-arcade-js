import { PlatformerGame } from "./platformer.machine.js";
import dot from "./platformer.dot?raw";
import { PlatformerScene } from "./PlatformerScene";
import type { GameDef } from "../types";

export const platformer: GameDef = {
  id: "platformer",
  title: "Platformer",
  teaches: "Locomotion as two HSM clusters · $OnGround{Idle,Running} / $InAir{Jumping,Falling}",
  controls: "A/D move · W/↑ jump · grab coins · reach the flag · SPACE start/restart",
  dot,
  createMachine: () => PlatformerGame._create(),
  Scene: PlatformerScene,
};
