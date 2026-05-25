import { AsteroidsGame } from "./asteroids.machine.js";
import dot from "./asteroids.dot?raw";
import { AsteroidsScene } from "./AsteroidsScene";
import type { GameDef } from "../types";

export const asteroids: GameDef = {
  id: "asteroids",
  title: "Asteroids",
  teaches: "State stack (push$ / pop$) — hyperspace pushes the compartment and pops back to it",
  controls: "←/→ turn · ↑ thrust · SPACE fire · H hyperspace · P pause",
  dot,
  createMachine: () => AsteroidsGame._create(),
  Scene: AsteroidsScene,
};
