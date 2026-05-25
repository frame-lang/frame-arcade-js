import { Pong } from "./pong.machine.js";
import dot from "./pong.dot?raw";
import { PongScene } from "./PongScene";
import type { GameDef } from "../types";

export const pong: GameDef = {
  id: "pong",
  title: "Pong",
  teaches: "Core FSM · enter/exit · domain variables · the engine-integration pattern",
  controls: "W/S or ↑/↓ move · SPACE serve/replay · P pause",
  dot,
  createMachine: () => Pong._create(),
  Scene: PongScene,
};
