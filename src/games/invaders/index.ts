import { Invaders } from "./invaders.machine.js";
import dot from "./invaders.dot?raw";
import { InvadersScene } from "./InvadersScene";
import type { GameDef } from "../types";

export const invaders: GameDef = {
  id: "invaders",
  title: "Space Invaders",
  teaches: "Hierarchical state machine · $Wave parent · inherited handlers via => $^",
  controls: "A/D or ←/→ move · SPACE fire/restart · P pause",
  dot,
  createMachine: () => Invaders._create(),
  Scene: InvadersScene,
};
