import type { GameDef } from "./types";
import { pong } from "./pong";
import { breakout } from "./breakout";
import { invaders } from "./invaders";
import { pacman } from "./pacman";
import { platformer } from "./platformer";
import { shooter } from "./shooter";
import { stealth } from "./stealth";

// The cabinet. Ported from the Godot frame-arcade mini-book (ch01–ch08).
// Asteroids (ch04, state-stack) is parked — see FRAMEC_BUGS.md (BUG-1).
export const GAMES: GameDef[] = [pong, breakout, invaders, pacman, platformer, shooter, stealth];
