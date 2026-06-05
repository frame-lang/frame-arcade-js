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
  // The host is the Phaser scene (wired late in frame-games/src/game.ts) —
  // Ship's $> / <$ handlers call into it for one-shot moments
  // (spawn_explosion, reset_ship, warp_out, warp_in). Default difficulty.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMachine: (host?: any) => AsteroidsGame._create(undefined, host),
  Scene: AsteroidsScene,
};
