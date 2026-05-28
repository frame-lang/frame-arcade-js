// Faithful TS port of the Godot model-checking core:
//   scripts/frame_state_checker.gd  — a bounded explicit-state model checker
//   scripts/cca_model_adapter.gd    — CCA's thin binding to it
//
// FrameStateChecker computes bounded approximations of reachability (BFS),
// safety (invariants at every reached state), liveness (EF φ goal-reachability),
// and bisimulation (restore_soundness — catches incomplete-state-vector leaks).
// CcaModelAdapter exposes the whole CCA domain to the checker through ~10 thin
// delegates over the driver's parser, save_state/restore_state, and
// listActionsHere. Honest scope: bounded, directed, RNG-sampled checking — strong
// evidence, not exhaustive proof.
import { CcaDriver, type Action } from "../driver";

// Carryable item IDs for the inventory component of the state vector (mirrors
// Godot cca_model_adapter.ITEM_IDS).
const ITEM_IDS = [
  100, 101, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 121, 122, 123, 130, 131, 132, 133, 134, 135, 136, 137,
  138, 139, 140, 141, 142,
];

export class CcaModelAdapter {
  constructor(
    private readonly rngSeed = 42,
    private readonly seedBytes: string | null = null,
  ) {}

  make_root(): CcaDriver {
    const d = new CcaDriver();
    d.machine().dwarves_auto_woken = true;
    d.machine().chance.reseed(this.rngSeed);
    if (this.seedBytes) d.machine().restore_state(this.seedBytes);
    return d;
  }
  save(o: CcaDriver): string {
    return o.machine().save_state();
  }
  restore(o: CcaDriver, bytes: string): void {
    o.machine().restore_state(bytes);
  }
  // THE incomplete-state-vector remedy — the PromptDispatcher lives on the
  // driver, outside fsm.save_state, so re-derive it from world state.
  reset_session(o: CcaDriver): void {
    o.resetSession();
  }
  // Enabled transitions = canon-gated affordances minus the "wild" parser-
  // coverage entries (those self-loop and don't expand the frontier).
  enumerate_actions(o: CcaDriver): Action[] {
    return o.listActionsHere().filter((a) => a.kind !== "wild");
  }
  apply(o: CcaDriver, action: Action): void {
    o.input(action.input);
  }
  // State vector: room + sorted inventory + NPC states + endgame phase. Score /
  // lamp battery / turn count excluded (invariant-checked, not distinguishers).
  state_hash(o: CcaDriver): string {
    const f = o.machine();
    const inv: string[] = [];
    for (const id of ITEM_IDS) if (f.player.carrying(id)) inv.push(String(id));
    return `r=${f.player_room()}|i=${inv.join("/")}|n=${f.bird.get_state()},${f.snake.get_state()},${f.bear.get_state()},${f.troll.get_state()},${f.pirate.get_state()}|e=${f.endgame_state()}`;
  }
  // Safety invariants (Lamport). Returns violation strings.
  invariants(o: CcaDriver): string[] {
    const f = o.machine();
    const out: string[] = [];
    const room: number = f.player_room();
    if (room < 1 || room > 140) out.push(`player_room ${room} out of range [1..140]`);
    if (f.score() < -100) out.push(`score ${f.score()} below sanity floor`);
    const deposits: number = f.treasures_deposited();
    if (deposits < 0 || deposits > 15) out.push(`treasures_deposited ${deposits} out of [0..15]`);
    const es: string = f.endgame_state();
    if (!["active", "closing", "in_repository", "won", "permadead"].includes(es)) out.push(`unknown endgame state '${es}'`);
    return out;
  }
  // Observable signature for bisimulation: the state vector PLUS the host-side
  // prompt state the hash omits (so restore_soundness can SEE a leaked prompt).
  observe(o: CcaDriver): string {
    return `${this.state_hash(o)}|prompt=${o.promptMachine().is_active()}/${o.promptMachine().current_prompt()}|player=${o.machine().player.get_state()}`;
  }
}

interface Violation {
  hash: string;
  path: string[];
  reason: string;
}

function actionLabel(action: Action): string {
  return action.key || action.input;
}

export class FrameStateChecker {
  max_states = 5000;
  visited = new Map<string, boolean>();
  reproducer = new Map<string, string[]>();
  violations: Violation[] = [];
  states_visited = 0;
  actions_tried = 0;
  hit_cap = false;

  constructor(private readonly adapter: CcaModelAdapter) {}

  // BFS frontier expansion from the adapter's root; asserts invariants (safety)
  // at every reached state.
  explore(): void {
    const a = this.adapter;
    const o = a.make_root();
    a.reset_session(o);
    const rootHash = a.state_hash(o);
    this.visited.set(rootHash, true);
    this.reproducer.set(rootHash, []);
    this.states_visited = 1;
    const queue: { state: string; path: string[]; hash: string }[] = [
      { state: a.save(o), path: [], hash: rootHash },
    ];
    while (queue.length > 0) {
      if (this.states_visited >= this.max_states) {
        this.hit_cap = true;
        break;
      }
      const node = queue.shift() as { state: string; path: string[]; hash: string };
      a.restore(o, node.state);
      a.reset_session(o);
      for (const action of a.enumerate_actions(o)) {
        this.actions_tried += 1;
        a.restore(o, node.state);
        a.reset_session(o);
        a.apply(o, action);
        const path = node.path.concat([actionLabel(action)]);
        for (const reason of a.invariants(o)) {
          this.violations.push({ hash: a.state_hash(o), path: path.slice(), reason });
        }
        const h = a.state_hash(o);
        if (!this.visited.has(h)) {
          this.visited.set(h, true);
          this.reproducer.set(h, path);
          queue.push({ state: a.save(o), path, hash: h });
          this.states_visited += 1;
          if (this.states_visited >= this.max_states) {
            this.hit_cap = true;
            break;
          }
        }
      }
      if (this.hit_cap) break;
    }
  }

  // Bounded EF φ — is there a reachable state satisfying `predicate`?
  reachable_satisfying(predicate: (o: CcaDriver) => boolean): { found: boolean; path: string[]; states: number; hit_cap: boolean } {
    const a = this.adapter;
    const o = a.make_root();
    a.reset_session(o);
    const seen = new Map<string, boolean>([[a.state_hash(o), true]]);
    const queue: { state: string; path: string[] }[] = [{ state: a.save(o), path: [] }];
    let explored = 0;
    while (queue.length > 0) {
      if (explored >= this.max_states) return { found: false, path: [], states: explored, hit_cap: true };
      const node = queue.shift() as { state: string; path: string[] };
      a.restore(o, node.state);
      a.reset_session(o);
      if (predicate(o)) return { found: true, path: node.path, states: explored, hit_cap: false };
      explored += 1;
      for (const action of a.enumerate_actions(o)) {
        a.restore(o, node.state);
        a.reset_session(o);
        a.apply(o, action);
        const h = a.state_hash(o);
        if (!seen.has(h)) {
          seen.set(h, true);
          queue.push({ state: a.save(o), path: node.path.concat([actionLabel(action)]) });
        }
      }
    }
    return { found: false, path: [], states: explored, hit_cap: false };
  }

  // Bisimulation: for each sample, confirm restoring to it on a REUSED+dirtied
  // instance produces the same observable signature as a FRESH instance.
  restore_soundness(
    samples: { name: string; bytes: string }[],
    dirty: (adapter: CcaModelAdapter, o: CcaDriver) => void,
  ): { name: string; fresh: string; reused: string }[] {
    const a = this.adapter;
    const divergences: { name: string; fresh: string; reused: string }[] = [];
    for (const sample of samples) {
      const fresh = a.make_root();
      a.restore(fresh, sample.bytes);
      a.reset_session(fresh);
      const sigFresh = a.observe(fresh);

      const reused = a.make_root();
      dirty(a, reused);
      a.restore(reused, sample.bytes);
      a.reset_session(reused);
      const sigReused = a.observe(reused);

      if (sigFresh !== sigReused) divergences.push({ name: sample.name, fresh: sigFresh, reused: sigReused });
    }
    return divergences;
  }

  reached_count(): number {
    return this.visited.size;
  }
}
