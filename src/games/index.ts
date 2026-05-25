import type { GameDef } from "./types";
import { pong } from "./pong";
import { breakout } from "./breakout";
import { invaders } from "./invaders";

// The cabinet. Games are added here as they're ported from the Godot
// frame-arcade mini-book (ch01 Pong … ch08 Stealth).
export const GAMES: GameDef[] = [pong, breakout, invaders];
