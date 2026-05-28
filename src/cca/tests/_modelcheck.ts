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
import { CANONICAL_JOURNEY } from "./journeys";

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
  // Liveness predicate for EF-won.
  is_won(o: CcaDriver): boolean {
    return o.machine().endgame_state() === "won";
  }
}

// StateExplorer (scripts/state_explorer.gd) — explore the reachable state graph
// of any Frame @@[persist] @@system via save/restore teleport (O(states×events),
// independent of graph diameter). Returns {initial, states, transitions,
// dead_ends, unreachable}. `events` is a list of [eventName, args].
export interface ExploreReport {
  initial: string;
  states: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transitions: { from: string; event: string; args: any[]; to: string }[];
  dead_ends: string[];
  unreachable: string[];
}
export function exploreStates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  factory: () => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: [string, any[]][],
  maxStates = 100,
): ExploreReport {
  const initial = factory();
  const initialState: string = initial.get_state();
  const saves = new Map<string, string>();
  saves.set(initialState, initial.save_state());
  const queue: string[] = [initialState];
  const transitions: ExploreReport["transitions"] = [];
  while (queue.length > 0 && saves.size <= maxStates) {
    const current = queue.shift() as string;
    const bytes = saves.get(current) as string;
    for (const [eventName, eventArgs] of events) {
      const inst = factory();
      inst.restore_state(bytes);
      inst[eventName](...eventArgs);
      const newState: string = inst.get_state();
      transitions.push({ from: current, event: eventName, args: eventArgs, to: newState });
      if (!saves.has(newState)) {
        saves.set(newState, inst.save_state());
        queue.push(newState);
      }
    }
  }
  const hasRealOutgoing = new Set<string>();
  const hasBeenFrom = new Set<string>();
  for (const t of transitions) {
    hasBeenFrom.add(t.from);
    if (t.from !== t.to) hasRealOutgoing.add(t.from);
  }
  const dead_ends: string[] = [];
  const unreachable: string[] = [];
  for (const s of saves.keys()) {
    if (!hasRealOutgoing.has(s)) dead_ends.push(s);
    if (!hasBeenFrom.has(s) && s !== initialState) unreachable.push(s);
  }
  return { initial: initialState, states: [...saves.keys()], transitions, dead_ends, unreachable };
}

// MilestoneRegistry (scripts/milestone_registry.gd) — (journey, milestone) → save
// bytes. JourneyTree.walk_to captures a journey's milestones into one.
export class MilestoneRegistry {
  private readonly snaps = new Map<string, string>();
  record(journey: string, milestone: string, bytes: string): void {
    this.snaps.set(`${journey}:${milestone}`, bytes);
  }
  get_snapshot(journey: string, milestone: string): string {
    return this.snaps.get(`${journey}:${milestone}`) ?? "";
  }
  has(journey: string, milestone: string): boolean {
    return this.snaps.has(`${journey}:${milestone}`);
  }
}

// Walk CANONICAL_JOURNEY through a driver, recording each milestone's save_state
// into a fresh MilestoneRegistry under "canonical_journey:<name>" — the JS
// counterpart to JourneyTree.register_default() + walk_to("…:InRepository").
// Applies the canonical FSM shortcuts (fillTreasures ×13 / tickToRepository ×35).
export function captureCanonicalMilestones(): MilestoneRegistry {
  const reg = new MilestoneRegistry();
  const d = new CcaDriver();
  d.machine().dwarves_auto_woken = true;
  d.machine().chance.reseed(42);
  for (const m of CANONICAL_JOURNEY) {
    if (m.shortcut === "fillTreasures") for (let k = 0; k < 13; k++) d.machine().endgame.treasure_deposited();
    else if (m.shortcut === "tickToRepository") for (let k = 0; k < 35; k++) d.machine().tick();
    for (const s of m.steps) if ("cmd" in s) d.input(s.cmd.toLowerCase());
    reg.record("canonical_journey", m.name, d.machine().save_state());
    if (m.name === "InRepository") break;
  }
  return reg;
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

// All carryable item IDs the bespoke search considers (mirrors Godot
// state_space.ITEM_IDS — includes 141 = mark_rod).
const SS_ITEM_IDS = [
  100, 101, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142,
];

// Faithful TS port of Godot scripts/state_space.gd — the bespoke deterministic
// BFS over CCA's reachable state graph (RFC-0001). Independent of FrameStateChecker
// (frame_checker_demo cross-validates the two reach the same distinct-room count).
// Hash = room + sorted inventory + NPC states (no endgame — reachability, not
// liveness). Invariants are thorough: room range, score floor, lamp battery,
// endgame phase, deposit count + deposit/FSM consistency, inventory consistency.
export class StateSpace {
  seed = 0;
  max_states = 1000;
  seedBytes: string | null = null;
  reseedChanceAfterRestore = false;
  areaRooms: Set<number> | null = null;
  // Round-trip save/restore at each state and flag a hash divergence (the
  // canonical-start BFS opts in — it exercises persistence soundness too).
  checkSaveRestore = false;
  visited = new Map<string, boolean>();
  reproducer = new Map<string, string[]>();
  violations: Violation[] = [];
  states_visited = 0;
  actions_tried = 0;
  hit_cap = false;

  prepareDriver(): CcaDriver {
    const d = new CcaDriver();
    d.machine().dwarves_auto_woken = true;
    d.machine().chance.reseed(this.seed);
    return d;
  }

  run(): void {
    const driver = this.prepareDriver();
    if (this.seedBytes) {
      driver.machine().restore_state(this.seedBytes);
      driver.resetSession();
      if (this.reseedChanceAfterRestore) driver.machine().chance.reseed(this.seed);
    }
    this.run_from(driver);
  }

  run_from(driver: CcaDriver): void {
    const rootState = driver.machine().save_state();
    const rootHash = this.hashState(driver);
    this.visited.set(rootHash, true);
    this.reproducer.set(rootHash, []);
    this.states_visited = 1;
    const queue: { state: string; path: string[]; hash: string }[] = [{ state: rootState, path: [], hash: rootHash }];
    while (queue.length > 0) {
      if (this.states_visited >= this.max_states) {
        this.hit_cap = true;
        break;
      }
      const node = queue.shift() as { state: string; path: string[]; hash: string };
      driver.machine().restore_state(node.state);
      driver.resetSession();
      if (this.checkSaveRestore) {
        const reState = driver.machine().save_state();
        driver.machine().restore_state(reState);
        const reHash = this.hashState(driver);
        if (reHash !== node.hash) {
          this.violations.push({ hash: node.hash, path: node.path.slice(), reason: `save/restore round-trip diverged: ${node.hash} → ${reHash}` });
        }
      }
      for (const action of driver.listActionsHere()) {
        if (action.kind === "wild") continue;
        this.actions_tried += 1;
        driver.machine().restore_state(node.state);
        driver.resetSession();
        driver.input(action.input);
        for (const f of this.checkInvariants(driver, node.path.concat([action.key]))) this.violations.push(f);
        const newHash = this.hashState(driver);
        if (!this.visited.has(newHash)) {
          this.visited.set(newHash, true);
          const newPath = node.path.concat([action.key]);
          this.reproducer.set(newHash, newPath);
          const newRoom = parseInt(newHash.slice(2).split("|")[0], 10);
          if (this.areaRooms === null || this.areaRooms.has(newRoom)) {
            queue.push({ state: driver.machine().save_state(), path: newPath, hash: newHash });
            this.states_visited += 1;
          }
          if (this.states_visited >= this.max_states) {
            this.hit_cap = true;
            break;
          }
        }
      }
      if (this.hit_cap) break;
    }
  }

  hashState(driver: CcaDriver): string {
    const f = driver.machine();
    const inv: string[] = [];
    for (const id of SS_ITEM_IDS) if (f.player.carrying(id)) inv.push(String(id));
    const npc = `${f.bird.get_state()},${f.snake.get_state()},${f.bear.get_state()},${f.troll.get_state()},${f.pirate.get_state()}`;
    return `r=${f.player_room()}|i=${inv.join("/")}|n=${npc}`;
  }

  distinctRooms(): number {
    const rooms = new Set<number>();
    for (const h of this.visited.keys()) rooms.add(parseInt(h.slice(2).split("|")[0], 10));
    return rooms.size;
  }

  private checkInvariants(driver: CcaDriver, path: string[]): Violation[] {
    const f = driver.machine();
    const failures: Violation[] = [];
    const hash = this.hashState(driver);
    const add = (reason: string): void => {
      failures.push({ hash, path: path.slice(), reason });
    };
    const room: number = f.player_room();
    if (room < 1 || room > 140) add(`player_room ${room} out of range [1..140]`);
    if (f.score() < -100) add(`score ${f.score()} below sanity floor`);
    const battery: number = f.lamp.battery_left();
    if (battery < 0 || battery > f.lamp.MAX_BATTERY) add(`lamp battery ${battery} out of [0..${f.lamp.MAX_BATTERY}]`);
    const es: string = f.endgame_state();
    if (!["active", "closing", "in_repository", "won", "permadead"].includes(es)) add(`unknown endgame state '${es}'`);
    const deposits: number = f.treasures_deposited();
    if (deposits < 0 || deposits > 15) add(`treasures_deposited ${deposits} out of [0..15]`);
    let actualDeposited = 0;
    for (const t of [f.gold, f.silver, f.diamonds, f.jewelry, f.pearl, f.vase, f.eggs, f.trident, f.emerald, f.spices, f.chest, f.pyramid, f.rug, f.coins, f.chain]) {
      if (t.get_state() === "deposited") actualDeposited += 1;
    }
    if (actualDeposited !== deposits) add(`deposit-count mismatch: counter=${deposits}, treasure FSMs=${actualDeposited}`);
    const itemChecks: [number, unknown][] = [
      [f.ROD_ID, f.rod_item], [f.KEYS_ID, f.keys_item], [f.BOTTLE_ID, f.bottle_item],
      [f.CAGE_ID, f.cage_item], [f.FOOD_ID, f.food_item], [f.PILLOW_ID, f.pillow_item],
      [f.AXE_ID, f.axe_item], [f.CLAM_ID, f.clam_item], [f.MAGAZINE_ID, f.magazine_item], [f.LAMP_ID, f.lamp_item],
    ];
    for (const [id, item] of itemChecks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (f.player.carrying(id) !== (item as any).is_carried()) add(`inventory inconsistency for id ${id}`);
    }
    return failures;
  }
}
