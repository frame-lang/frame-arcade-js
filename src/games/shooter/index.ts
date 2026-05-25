import { ShooterGame } from "./shooter.machine.js";
import dot from "./shooter.dot?raw";
import { ShooterScene } from "./ShooterScene";
import type { GameDef } from "../types";

export const shooter: GameDef = {
  id: "shooter",
  title: "Shooter (Boss)",
  teaches: "Multi-phase boss HSM · $Boss parent · $Phase1/2/3 by HP threshold",
  controls: "A/D move · hold SPACE fire · P pause · SPACE start/restart",
  dot,
  createMachine: () => ShooterGame._create(),
  Scene: ShooterScene,
};
