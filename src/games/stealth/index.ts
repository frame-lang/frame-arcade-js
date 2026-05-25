import { Stealth } from "./stealth.machine.js";
import dot from "./stealth.dot?raw";
import { StealthScene } from "./StealthScene";
import type { GameDef } from "../types";

export const stealth: GameDef = {
  id: "stealth",
  title: "Stealth (Guard AI)",
  teaches:
    "Agent AI in Frame vs behavior trees · $Aware HSM parent shares the spot_player response · push$/pop$ investigate-then-resume · three composed Guard instances",
  controls: "Arrows / WASD move · reach the green exit unseen · P pause · SPACE start · R restart",
  dot,
  createMachine: () => Stealth._create(),
  Scene: StealthScene,
};
