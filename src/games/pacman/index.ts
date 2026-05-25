import { PacmanGame } from "./pacman.machine.js";
import dot from "./pacman.dot?raw";
import { PacmanScene } from "./PacmanScene";
import type { GameDef } from "../types";

export const pacman: GameDef = {
  id: "pacman",
  title: "Pac-Man (Ghost AI)",
  teaches: "HSM ghost modes · $Hunting parent · Scatter/Chase/Frightened/Eaten",
  controls: "Arrows move · grab the pellet to frighten the ghost · P pause · SPACE start/restart",
  dot,
  createMachine: () => PacmanGame._create(),
  Scene: PacmanScene,
};
