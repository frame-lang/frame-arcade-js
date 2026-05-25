import { GuardAI } from "./stealth.machine.js";
import dot from "./stealth.dot?raw";
import { StealthScene } from "./StealthScene";
import type { GameDef } from "../types";

export const stealth: GameDef = {
  id: "stealth",
  title: "Stealth (Guard AI)",
  teaches: "Agent AI as a flat FSM · Patrol/Suspicious/Alert/Search/Return — Frame vs behavior trees",
  controls: "Arrows move · avoid the guard's vision · P pause · SPACE start/reset",
  dot,
  createMachine: () => GuardAI._create(),
  Scene: StealthScene,
};
