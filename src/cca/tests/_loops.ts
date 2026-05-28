// Faithful TS ports of the Godot exploration-loop FSMs (frame/retry_gate.fgd,
// frame/maze_sweep.fgd). These are the cyclic counterpart to the acyclic
// success/death rails: a counter-bounded loop that reacts to wherever each
// command lands and drives the next command, with a deterministic success exit.

// RetryGate (frame/retry_gate.fgd) — reach canon 110 through the 65:north
// probability gate ORGANICALLY (no chance.force): react to wherever each move
// lands (bounce→retry, divert-to-72→return via bedquilt, 71→through), exit on
// arrival at the target or the step cap.
export class RetryGate {
  private readonly target = 110;
  private current = 0;
  private steps = 0;
  private readonly cap = 60;
  private reachedTarget = false;

  arrive(room: number): void {
    this.current = room;
    if (room === this.target) this.reachedTarget = true;
  }
  next_cmd(): string {
    if (this.reachedTarget) return "";
    this.steps += 1;
    if (this.current === 72) return "bedquilt";
    if (this.current === 65) return "north";
    if (this.current === 71) return "north";
    return "bedquilt";
  }
  is_done(): boolean {
    return this.reachedTarget || this.steps >= this.cap;
  }
  reached(): boolean {
    return this.current === this.target;
  }
  steps_taken(): number {
    return this.steps;
  }
}

// MazeSweep (frame/maze_sweep.fgd) — counter-driven sweep of the cyclic all-alike
// maze (canon 107/112/131-140). Trail-marks a fixed try-order so the walk
// traverses every edge once; exits SUCCESS when all target rooms are seen.
export class MazeSweep {
  private readonly target = [107, 112, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140];
  private readonly dirOrder = ["north", "south", "east", "west", "ne", "se", "sw", "nw", "up", "down", "out"];
  private readonly visited = new Set<number>();
  private readonly tried = new Map<number, Set<string>>();
  private steps = 0;
  private readonly cap = 400;
  private current = 0;
  private mapped = false;

  arrive(room: number): void {
    this.current = room;
    this.visited.add(room);
    if (this.target.every((r) => this.visited.has(r))) this.mapped = true;
  }
  next_dir(): string {
    if (this.mapped) return "";
    if (!this.tried.has(this.current)) this.tried.set(this.current, new Set());
    const triedSet = this.tried.get(this.current) as Set<string>;
    let chosen = "";
    for (const cand of this.dirOrder) {
      if (!triedSet.has(cand)) {
        chosen = cand;
        break;
      }
    }
    if (chosen === "") chosen = this.dirOrder[this.steps % this.dirOrder.length];
    triedSet.add(chosen);
    this.steps += 1;
    return chosen;
  }
  is_done(): boolean {
    return this.mapped || this.steps >= this.cap;
  }
  covered_count(): number {
    return this.target.filter((r) => this.visited.has(r)).length;
  }
  seen(room: number): boolean {
    return this.visited.has(room);
  }
  steps_taken(): number {
    return this.steps;
  }
  targetCount(): number {
    return this.target.length;
  }
}
