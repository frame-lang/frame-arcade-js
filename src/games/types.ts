import type Phaser from "phaser";

/** Minimal surface every Frame-generated machine exposes for the visualizer. */
export interface FrameMachine {
  get_current_state_name(): string;
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
   * scene-side adapter the Frame `$>`/`<$` handlers call into for one-shot
   * effects (e.g. spawn_explosion, warp_out). Games whose FSMs don't push
   * to a host can ignore it. See AsteroidsGame for an example.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createMachine(host?: any): FrameMachine;
  /** Phaser scene constructor; receives the machine (typed per-game internally). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Scene: new (machine: any) => Phaser.Scene;
  width?: number;
  height?: number;
}
