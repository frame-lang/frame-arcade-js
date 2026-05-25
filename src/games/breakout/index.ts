import { Breakout } from "./breakout.machine.js";
import dot from "./breakout.dot?raw";
import { BreakoutScene } from "./BreakoutScene";
import type { GameDef } from "../types";

export const breakout: GameDef = {
  id: "breakout",
  title: "Breakout",
  teaches: "Orchestrator flow · lives & levels · clear/lose branching",
  controls: "A/D or ←/→ move · SPACE launch/next/replay · P pause",
  dot,
  createMachine: () => Breakout._create(),
  Scene: BreakoutScene,
};
