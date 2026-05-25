import { Shooter } from "./shooter.machine.js";
import dot from "./shooter.dot?raw";
import { ShooterScene } from "./ShooterScene";
import type { GameDef } from "../types";

export const shooter: GameDef = {
  id: "shooter",
  title: "Shooter (capstone)",
  teaches:
    "Everything composed at scale · parameterized Enemy instances · three-phase Boss HSM (HP-threshold phase changes) · orchestrator with waves + push$/pop$ pause",
  controls: "Arrows/WASD move · hold SPACE fire · P pause · SPACE start · R restart",
  dot,
  createMachine: () => Shooter._create(),
  Scene: ShooterScene,
};
