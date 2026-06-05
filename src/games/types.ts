import type Phaser from "phaser";

/** Minimal surface every Frame-generated machine exposes for the visualizer. */
export interface FrameMachine {
  current_state(): string;
}

/** A pluggable arcade entry: one Frame `.fjs` + one Phaser scene. */
export interface GameDef {
  id: string;
  title: string;
  /** Which Frame feature this game showcases (shown in the UI). */
  teaches: string;
  /** Human-readable controls line. */
  controls: string;
  /** Graphviz DOT from `framec -l graphviz` (imported `?raw`). */
  dot: string;
  /**
   * Instantiate the Frame machine (its factory). The optional `host` is a
   * scene-side adapter the FSM's $> / <$ handlers may call back into for
   * one-shot effects (e.g. Ship.$Exploding calls host.spawn_explosion()).
   * Games whose FSMs don't push to a host can ignore the argument.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMachine(host?: any): FrameMachine;
  /** Phaser scene constructor; receives the machine (typed per-game internally). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Scene: new (machine: any) => Phaser.Scene;
  width?: number;
  height?: number;
}
