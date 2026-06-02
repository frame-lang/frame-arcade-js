import { AsteroidsGame } from "./asteroids.machine.js";
import dot from "./asteroids.dot?raw";
import { AsteroidsScene } from "./AsteroidsScene";
import type { GameDef } from "../types";

export const asteroids: GameDef = {
  id: "asteroids",
  title: "Asteroids",
  teaches: "State-local variables · HSM-inherited pause · push$/pop$ where pop target varies",
  controls: "←/→ turn · ↑ thrust · SPACE fire · H hyperspace · P pause",
  dot,
  createMachine: () => AsteroidsGame._create(),
  Scene: AsteroidsScene,
};
