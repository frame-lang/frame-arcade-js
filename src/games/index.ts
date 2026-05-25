import type { GameDef } from "./types";
import { pong } from "./pong";

// The cabinet. Games are added here as they're ported from the Godot
// frame-arcade mini-book (ch01 Pong … ch08 Stealth).
export const GAMES: GameDef[] = [pong];
