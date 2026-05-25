import type { GameDef } from "./types";
import { pong } from "./pong";
import { breakout } from "./breakout";
import { invaders } from "./invaders";
import { asteroids } from "./asteroids";
import { pacman } from "./pacman";
import { platformer } from "./platformer";
import { shooter } from "./shooter";
import { stealth } from "./stealth";

// The cabinet — all 8 chapters of the Godot frame-arcade mini-book.
export const GAMES: GameDef[] = [pong, breakout, invaders, asteroids, pacman, platformer, shooter, stealth];
