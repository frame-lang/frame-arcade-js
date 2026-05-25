import { Platformer } from "./platformer.machine.js";
import dot from "./platformer.dot?raw";
import { PlatformerScene } from "./PlatformerScene";
import type { GameDef } from "../types";

export const platformer: GameDef = {
  id: "platformer",
  title: "Platformer (Locomotion + PowerUp)",
  teaches:
    "Orthogonal-state composition vs matrix HSM · two independent sub-FSMs (motion + form) under one orchestrator · push$/pop$ pause",
  controls: "Arrows/WASD move · Shift run · Space jump · grab the mushroom/flower · P pause · R reset pickups",
  dot,
  createMachine: () => Platformer._create(),
  Scene: PlatformerScene,
};
