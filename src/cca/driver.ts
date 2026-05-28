import { Adventure, PromptDispatcher } from "./cca.machine.js";
import { ROOMS, GATES, type GateStep } from "./topology";

// Canon object ids (ported from driver.gd constants), for inventory.
const ID = {
  BIRD: 100, CHAIN: 101,
  GOLD: 110, SILVER: 111, DIAMONDS: 112, JEWELRY: 113, PEARL: 114, VASE: 115,
  EGGS: 116, TRIDENT: 117, EMERALD: 118, SPICES: 119, CHEST: 120, PYRAMID: 121,
  RUG: 122, COINS: 123,
  ROD: 130, KEYS: 131, BOTTLE: 132, CAGE: 133, FOOD: 134, PILLOW: 135, AXE: 136,
  CLAM: 137, OYSTER: 138, BATTERIES: 139, MAGAZINE: 140, MARK_ROD: 141, LAMP: 142,
} as const;

/**
 * CCA driver — parser + dispatch + per-turn engine, ported from the
 * essential control flow of cca/godot/scripts/driver.gd. Pure logic
 * (no DOM) so it is headless-testable; the terminal UI (cca-main.ts)
 * drives it.
 *
 * KEY: the Adventure FSM owns room descriptions + verb results
 * (do_command(verb, noun) returns canon prose). The driver's job is to
 * parse input, resolve movement against the topology (ROOMS/GATES) with
 * the FSM's gate-guard queries, pass everything else to do_command, and
 * run the per-turn chain (tick + lamp warnings + reprint on move).
 *
 * Includes movement, look, take/drop, lamp, magic words, score, help, the
 * special-case verb intercepts, dwarf/pirate stepping, the dark-pit hazard,
 * modal Y/N prompts (quit/revive), brief mode, and SAVE/RESTORE persistence
 * (Adventure.save_state() + the session PromptDispatcher, via a SaveStore).
 */

// Verb synonyms (ported from driver.gd verb_synonyms) — canonical-form lookup.
const VERB_SYNONYMS: Record<string, string> = {
  n: "north", s: "south", e: "east", w: "west", u: "up", d: "down",
  i: "inventory", inv: "inventory",
  l: "look", g: "look", x: "examine",
  get: "take", grab: "take", pick: "take",
  off: "extinguish", on: "light",
  kill: "attack", fight: "attack", hurl: "throw",
  y: "yes",
  score: "score", help: "help", "?": "help", info: "info",
  look: "look", inventory: "inventory",
  save: "save", suspend: "suspend", pause: "suspend",
  magic: "maint", maintenance: "maint",
  load: "load", restore: "load",
  detonate: "blast",
  retreat: "back",
};

const DIRECTIONS = ["north", "south", "east", "west", "up", "down", "in", "out", "enter"];

// Motion-ish verbs that trigger the dark-room pit-fall hazard.
const MOTION_VERBS = [
  "north", "south", "east", "west", "up", "down", "in", "out", "enter", "back", "forward",
  "jump", "climb", "pit", "steps", "dome", "passage", "slit", "stream", "cross", "over",
  "across", "left", "right", "ne", "nw", "se", "sw", "stairs", "crawl", "depression",
  "building", "house", "road", "hill", "valley", "forest", "gully", "outdoors", "surface",
];
// Canon forced-motion rooms (dwarves/pirate never path into these).
const FORCED_ROOMS = [16, 22, 26, 32, 40, 59, 79, 89, 90, 113];
// Canon BITSET(LOC,3) rooms the pirate is barred from.
const FORBIDDEN_PIRATE_ROOMS = [101, 117, 122];
const DARK_PIT_PCT = 35;

function truncate5(s: string): string {
  return s.length > 5 ? s.substring(0, 5) : s;
}

// localStorage key for the single CCA save slot.
const SAVE_KEY = "cca.save";

/**
 * Minimal Web-Storage-shaped sink so the driver stays headless: the browser
 * page passes the real `localStorage`; node tests pass an in-memory stub;
 * omitting it disables persistence (SAVE/RESTORE report "not available").
 */
export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class CcaDriver {
  // The Adventure FSM is untyped (generated .machine.js). `any` is intentional.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private a: any;
  // PromptDispatcher is a session-scoped FSM the driver owns (not composed
  // on Adventure) — it holds "which modal Y/N prompt is open" as state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prompts: any;
  private out: string[] = [];
  // Persistent capture accumulator — the JS counterpart to Godot's
  // _test_helpers.CapturedDriver.captured. Every println appends here (in
  // addition to the per-turn `out`), so harness tests that drive internal
  // per-turn checks (checkPirateRustle/checkDarkPitHazard) directly can read the
  // accumulated lines and slice by offset, exactly as the Godot tests do.
  readonly captured: string[] = [];
  private lastRoom = -1;
  // Rooms already rendered in full — for BRIEF mode, which suppresses the long
  // description on a revisit (canon STMT 8260). Mirrors Godot driver._visited_rooms.
  private visitedRooms = new Set<number>();
  private deadEnd = false;
  private syn5: Record<string, string> = {};
  // Persistence sink (browser: localStorage; tests: in-memory; null: disabled).
  private store: SaveStore | null;
  // Last-seen endgame phase, so each transition emits its canon prose once.
  private lastEndgameState = "";
  // Live interactive session (the browser game) vs a headless harness. The JS
  // counterpart to Godot's is_inside_tree(): canon end-of-run points (lamp dead
  // aboveground, etc.) still PRINT their prose either way, but only an
  // interactive session latches deadEnd to stop accepting input — exactly as the
  // Godot driver only calls get_tree().quit() when in the scene tree, so its
  // headless tests print the message and keep playing.
  private interactive: boolean;

  constructor(store?: SaveStore, interactive = false) {
    this.store = store ?? null;
    this.interactive = interactive;
    this.a = Adventure._create();
    this.a.setup_default_aspects();
    // Dwarves wake at game start — deferred to start() (the game-init path) so
    // FSM/driver tests can construct a dormant world, mirroring the Godot test
    // helper's raw `Cca.new()` (which never runs the wake path).
    this.prompts = PromptDispatcher._create();
    this.buildSyn5();
  }

  /** Initial render — call once after construction. */
  start(): string[] {
    this.out = [];
    // Load-on-boot: resume an autosaved game (but not a finished one — a reload
    // after death/victory starts fresh rather than restoring "the game is over").
    const saved = this.store ? this.store.getItem(SAVE_KEY) : null;
    if (saved && this.restoreSnapshot(saved, true)) {
      this.println("Welcome back to Adventure!  (your saved game was restored — SAVE/RESTORE anytime)");
      this.println("");
      this.printRoom();
      return this.drain();
    }
    this.a.wake_dwarves(); // canon: dwarves wake at game start, wandering the deep cave
    // Canon msg #1 (advent.dat, the 1977 Don Woods intro) — verbatim, with the
    // Crowther/Woods byline and msg #65 prompt baked in, as Godot _print_welcome.
    this.println(
      'Somewhere nearby is Colossal Cave, where others have found fortunes in treasure and gold, though it is rumored that some who enter are never seen again. Magic is said to work in the cave. I will be your eyes and hands. Direct me with commands of 1 or 2 words. I should warn you that I look at only the first five letters of each word, so you\'ll have to enter "NORTHEAST" as "NE" to distinguish it from "NORTH". (Should you get stuck, type "HELP" for some general hints. For information on how to end your adventure, etc., type "INFO".)',
    );
    this.println("                      - - -");
    this.println(
      "This program was originally developed by Willie Crowther. Most of the features of the current program were added by Don Woods (DON @ SU-AI). Contact Don if you have any questions, comments, etc.",
    );
    this.println("Welcome to Adventure!! Would you like instructions? (Type HELP for hints.)");
    this.println("");
    this.printRoom();
    return this.drain();
  }

  /** Process one line of player input; returns the lines to display. */
  input(text: string): string[] {
    this.out = [];
    // Canon WEST counter (advent.for line 901): the literal word "west" (not "w")
    // bumps a counter; the 10th fires canon msg #17 once. Counted on raw input
    // before synonym normalization, as Godot does.
    const rawFirst = text.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    if (rawFirst === "west") {
      this.a.bump_iwest();
      if (this.a.get_iwest_count() === 10) this.println("If you prefer, simply type W rather than WEST.");
    }
    this.processInput(text);
    this.autosave();
    return this.drain();
  }

  /** Raw Frame state name of the Adventure machine (for the chart highlight). */
  currentState(): string {
    return this.a.current_state();
  }

  score(): number {
    return this.a.score();
  }

  /** Current room id (used by the UI/tests). */
  room(): number {
    return this.a.player_room();
  }

  /** Debug/test hook: the underlying Adventure machine (for inspection/setup). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  machine(): any {
    return this.a;
  }

  /** Debug/test hook: the session PromptDispatcher (modal Y/N prompt state). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptMachine(): any {
    return this.prompts;
  }

  /**
   * Test hook: render the current room and return the lines it emitted. Mirrors
   * the Godot CapDriver pattern (clear log → _print_room() → read log) used by
   * the Y2-whisper stochastic probe. Calls the same printRoom() that carries the
   * room-33 y2_whisper roll, so the probe samples that gate exactly as Godot.
   */
  captureRoomRender(): string[] {
    this.out = [];
    this.maybePrintRoom();
    return this.drain();
  }

  /**
   * Test/harness hook: restore the Adventure world from save_state() bytes and
   * reset the driver's per-session state, mirroring the Godot harness pattern
   * (`d.fsm.restore_state(bytes); d.prompts = PromptDispatcher.new()`). Used by
   * the completability / death / restore-soundness rails that branch off saved
   * milestone snapshots. Re-offers the revive prompt if the restored player is
   * dead (the modal-prompt state doesn't survive the save boundary; the driver
   * re-derives it from world state, exactly as the Godot tests do).
   */
  restoreFsmState(blob: string): void {
    this.a.restore_state(blob);
    this.prompts = PromptDispatcher._create();
    this.lastRoom = -1; // force the next printRoom to render
    this.deadEnd = false; // the restored world is the source of truth
    if (this.a.player_state() === "dead") this.prompts.offer_revive();
  }

  // ---- save / load (localStorage-backed; headless via SaveStore) ----

  // Full session snapshot: the Adventure world (recurses over every composed
  // @@system) + the driver-owned PromptDispatcher + the two driver scalars.
  // save_state() is safe here — the FSMs are quiescent between turns.
  private snapshot(): string {
    return JSON.stringify({
      v: 1,
      a: this.a.save_state(),
      p: this.prompts.save_state(),
      lastRoom: this.lastRoom,
      deadEnd: this.deadEnd,
    });
  }

  // Restore from a snapshot string. onBoot refuses a finished game so a reload
  // after death/victory starts fresh. Returns false on a corrupt/old blob.
  private restoreSnapshot(blob: string, onBoot: boolean): boolean {
    let env: { v?: number; a?: string; p?: string; lastRoom?: number; deadEnd?: boolean };
    try {
      env = JSON.parse(blob);
    } catch {
      return false;
    }
    if (!env || env.v !== 1 || typeof env.a !== "string" || typeof env.p !== "string") return false;
    if (onBoot && env.deadEnd) return false;
    this.a.restore_state(env.a);
    this.prompts.restore_state(env.p);
    this.lastRoom = -1; // force the next printRoom to render
    this.deadEnd = !!env.deadEnd;
    return true;
  }

  // Canon SAVE confirmation (matches Godot _save_game which prints "Saved.").
  // Persists to the store if one is attached; the per-turn autosave covers the
  // ongoing case, so SAVE is just the explicit checkpoint + canon ack.
  private saveGame(): void {
    if (this.store) {
      try {
        this.store.setItem(SAVE_KEY, this.snapshot());
      } catch {
        /* storage full or blocked — still print the canon ack */
      }
    }
    this.println("Saved.");
  }

  // Autosave after every turn. A finished game clears the slot instead (so a
  // reload starts fresh). Storage errors (quota/blocked) are non-fatal.
  private autosave(): void {
    if (!this.store) return;
    try {
      if (this.deadEnd) this.store.removeItem(SAVE_KEY);
      else this.store.setItem(SAVE_KEY, this.snapshot());
    } catch {
      /* storage full or blocked — keep playing without persistence */
    }
  }

  // ---- internals ----

  private drain(): string[] {
    const o = this.out;
    this.out = [];
    return o;
  }
  private println(s: string): void {
    const stripped = this.stripBBCode(s);
    this.out.push(stripped);
    this.captured.push(stripped);
  }
  private stripBBCode(s: string): string {
    return s.replace(/\[\/?[a-z][^\]]*\]/gi, "");
  }

  private buildSyn5(): void {
    // Base layer: every ROOMS exit + GATES verb must restore from its 5-char
    // truncation to the full key those tables use. Canon truncates player input
    // to 5 letters, but the topology tables are keyed by the full motion word
    // (e.g. "depression", "bedquilt", "oriental"). Without this, a typed
    // "depression" truncates to "depre" and never matches ROOMS["depression"].
    for (const room of Object.values(ROOMS)) {
      for (const dir of Object.keys(room)) this.syn5[truncate5(dir)] = dir;
    }
    for (const gateKey of Object.keys(GATES)) {
      const dir = gateKey.split(":")[1];
      if (dir) this.syn5[truncate5(dir)] = dir;
    }
    // Curated synonyms (override the base on any 5-char collision).
    for (const key of Object.keys(VERB_SYNONYMS)) {
      this.syn5[truncate5(key)] = VERB_SYNONYMS[key];
    }
    // Identity mappings for canonical non-motion verbs > 5 chars whose truncated
    // form must restore (so FSM verb checks match the full word).
    const canon = [
      "extinguish", "release", "attack", "examine", "unlock", "insert", "plover",
      "inventory", "passage", "forward", "stream", "across", "stairs", "building",
      "valley", "cavern", "barren", "secret", "cobbles", "upstream", "downstream",
      "entrance", "surface", "forest", "broken", "canyon", "debris", "wizard",
    ];
    for (const c of canon) this.syn5[truncate5(c)] = c;
  }

  private parse(text: string): { verb: string; noun: string } {
    const parts = text.trim().split(/\s+/).filter((p) => p.length > 0);
    if (parts.length === 0) return { verb: "", noun: "" };
    const rawVerb = truncate5(parts[0].toLowerCase());
    const verb = this.syn5[rawVerb] ?? rawVerb;
    let noun = "";
    if (parts.length > 1) {
      noun = parts
        .slice(1)
        .map((w) => w.toLowerCase())
        .filter((w) => w !== "the" && w !== "a" && w !== "an")
        .join(" ");
    }
    return { verb, noun };
  }

  private processInput(text: string): void {
    if (this.deadEnd) {
      this.println("The game is over. Reload the page to play again.");
      return;
    }
    const { verb, noun } = this.parse(text);
    if (verb === "") {
      this.println("I'm afraid I don't understand.");
      return;
    }

    // Modal Y/N prompt (currently: death/revive). Capture the prompt name
    // BEFORE confirm/decline transitions the dispatcher back to $Idle.
    if (this.prompts.is_active()) {
      const promptName: string = this.prompts.current_prompt();
      if (verb === "yes") {
        this.prompts.confirm();
        if (promptName === "revive") {
          const prose: string = this.a.player.get_revive_response();
          this.a.player.revive();
          this.println(prose);
          this.lastRoom = -1;
          this.printRoom();
        } else if (promptName === "quit") {
          this.println("Goodbye.");
          this.deadEnd = true;
        } else if (promptName === "oyster") {
          // Canon msg #193 — read it, pay the 10-point hint cost (advent.for SPK 192/193).
          this.a.mark_oyster_revealed();
          this.println(`It says, "There is something strange about this place, such that one`);
          this.println(`of the words I've always known now has a new effect."`);
          this.a.score_hints -= 10;
          this.a.real_score -= 10;
        } else if (promptName === "suspend") {
          // Canon SUSPEND YES (advent.for STMT 8300) — msg #54 "OK" + save.
          this.println("OK");
          this.saveGame();
        }
        return;
      } else if (verb === "no") {
        this.prompts.decline();
        if (promptName === "revive") {
          this.println(this.a.player.get_permadeath_msg());
          this.deadEnd = true;
        } else if (promptName === "quit") {
          this.println("OK.");
        } else if (promptName === "oyster") {
          this.println("OK."); // canon msg #194 (declined) — no penalty
        } else if (promptName === "suspend") {
          this.println("OK"); // canon SUSPEND NO — cancel + msg #54
        }
        return;
      } else if (this.prompts.accepts_only_yes_no()) {
        this.println("Please answer the question.");
        return;
      } else {
        this.prompts.cancel();
        // not a yes/no prompt — fall through to normal processing
      }
    }

    // UI verbs (driver-handled; each case manages its own turn).
    if (this.handleUiVerb(verb, noun)) return;

    // Canon-order verb intercepts (driver-side special cases). enter-stream
    // and bridge-cross must run BEFORE the direction check ("enter"/"over" are
    // motion-ish); the rest run after. Each consumed intercept ends the turn.
    if (this.iBridgeCross(verb)) return this.endTurn();
    if (MOTION_VERBS.includes(verb) && this.checkDarkPitHazard()) return this.endTurn();
    if (this.iEnterStream(verb, noun)) return this.endTurn();

    // Canon bumper / chain gates (probability, bridge/dragon/chasm dest-walks,
    // always-msgs) keyed on room:verb, for any verb — mirrors Godot's
    // _dispatch_bumper running before movement/FSM dispatch. A dest-walk runs its
    // own per-turn upkeep; a msg-only block stays put (no turn), as a gate block does.
    if (this.dispatchBumper(verb)) return;

    const room = this.a.player_room();
    const exits = ROOMS[room] ?? {};
    if (DIRECTIONS.includes(verb)) {
      this.handleMovement(verb);
      return;
    }

    if (this.iBreakMirror(verb, noun)) return this.endTurn();
    if (this.iDropBird(verb, noun)) return this.endTurn();
    if (this.iAttackBird(verb, noun)) return this.endTurn();
    if (this.iAttackBear(verb, noun)) return this.endTurn();
    if (this.iTakeKnife(verb, noun)) return this.endTurn();
    if (this.iTakeBear(verb, noun)) return this.endTurn();
    if (this.iUnlockChain(verb, noun)) return this.endTurn();
    if (this.iTakeScenery(verb, noun)) return this.endTurn();
    if (this.iReadOyster(verb, noun)) return; // arms a Y/N prompt; no turn
    if (this.iThrowAxe(verb, noun)) return this.endTurn();
    this.iPloverEmerald(verb, noun); // side-effect; falls through to FSM PLOVER

    if (this.iCalm(verb)) return this.endTurn();
    if (this.iEat(verb, noun)) return this.endTurn();
    if (this.iFeed(verb, noun)) return this.endTurn();
    if (this.iSceneryRead(verb, noun)) return this.endTurn();

    // Room-specific motion aliases (e.g. CLIMB/BARREN) the room defines as exits.
    if (verb in exits) {
      this.handleMovement(verb);
      return;
    }

    // Canon LOOK (advent.for STMT 30): msg #15 the first 3 times, before the FSM
    // re-displays the room (the FSM look still respects DarknessGate / brief mode,
    // and the per-turn chain below still runs — e.g. dwarf-in-room messages).
    if (verb === "look" && this.a.get_look_detail_count() < 3) {
      this.println("Sorry, but I am not allowed to give more detail. I will repeat the long description of your location.");
      this.a.bump_look_detail();
    }
    // Everything else → the FSM verb dispatcher (handles look/take/drop/etc.,
    // and the magic-word aspect transforms xyzzy/plugh/plover into moves).
    this.dispatchToFsm(verb, noun);
    this.afterTurn();
  }

  private handleMovement(dir: string): void {
    const current = this.a.player_room();
    const exits = ROOMS[current] ?? {};
    if (!(dir in exits)) {
      if (dir === "in" || dir === "out") {
        this.println("I don't know in from out here. Use compass points or name something");
        this.println("in the general direction you want to go.");
      } else if (dir === "left" || dir === "right" || dir === "forward") {
        this.println("I am unsure how you are facing. Use compass points or nearby objects.");
      } else {
        this.println("There is no way to go that direction.");
      }
      return;
    }

    const dest = exits[dir];

    // Single-rule gate guards (chains are deferred to Phase 6).
    const gate = GATES[`${current}:${dir}`];
    if (gate && !Array.isArray(gate)) {
      if (this.gateBlocks(gate)) {
        if (gate.msg) this.println(gate.msg);
        return;
      }
    }

    // Canon panic: trying to surface (dest 1..8) during the closing sequence.
    if (this.a.endgame_closing() && dest >= 1 && dest <= 8) {
      this.println("A mysterious recorded voice groans into life and announces:");
      this.println('    "This exit is closed. Please leave via main office."');
      this.a.endgame_panic();
      return;
    }

    // Canon msg #2: a stalking dwarf at the destination blocks the way.
    if (this.dwarfAtRoom(dest)) {
      this.println("A little dwarf with a big knife blocks your way.");
      return;
    }

    this.a.set_old_loc2(this.a.get_old_loc());
    this.a.set_old_loc(current);
    const response = this.a.do_command("move", String(dest));
    if (response !== "" && dest !== current && (this.a.player_room() === current || this.a.player_state() === "dead")) {
      this.println(response);
    }
    this.afterTurn(true);
  }

  /** Returns true if the gate's guard condition currently blocks the exit. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gateBlocks(gate: any): boolean {
    switch (gate.check) {
      case "snake": return this.a.snake_state() === "blocking";
      case "troll": return this.a.troll_blocking();
      case "bridge": return !this.a.bridge_built();
      case "grate": return this.a.grate_locked();
      case "plant_tall": return !this.a.plant_is_tall();
      case "plant_huge": return !this.a.plant_is_huge();
      case "plover_squeeze": return this.a.plover_squeeze_blocked();
      case "rusty": return !this.a.rusty_door_oiled();
      case "always": return true;
      default: return false; // probability/carrying/dragon_killed/chasm handled by dispatchBumper
    }
  }

  // ---- canon bumper / chain gate dispatch (mirrors Godot driver
  //      _dispatch_bumper / _try_bumper_rule / _walk_to_dest) ----

  // GATES[room:verb] may be a single rule or an ordered chain; walk in canon
  // order, the first rule that fires wins. Returns true if a rule fired.
  private dispatchBumper(verb: string): boolean {
    const entry = GATES[`${this.a.player_room()}:${verb}`];
    if (entry === undefined) return false;
    const rules: GateStep[] = Array.isArray(entry) ? entry : [entry];
    for (const rule of rules) {
      if (this.tryBumperRule(rule)) return true;
    }
    return false;
  }

  // Evaluate one chain rule. `dest` → walk there (the destination room's entry
  // handler fires, e.g. canon 21 death); `msg` → print and stay put. Checks not
  // handled here (troll/grate/plant_*/plover_squeeze) fall through to
  // handleMovement's topology-stage gate. Public for the 19:sw-chain harness
  // test, which drives a single probability rule directly (mirrors Godot
  // driver._try_bumper_rule).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tryBumperRule(bg: GateStep): boolean {
    const resolve = (): boolean => {
      if (bg.dest !== undefined) this.walkToDest(bg.dest);
      else if (bg.msg) this.println(bg.msg);
      return true;
    };
    switch (bg.check) {
      case "always":
        this.println(bg.msg ?? "");
        return true;
      case "rusty": return this.a.rusty_door_oiled() ? false : resolve();
      case "snake": return this.a.snake_state() === "blocking" ? resolve() : false;
      case "probability": return this.a.chance.decide("travel_gate", bg.pct ?? 0) ? resolve() : false;
      case "carrying": {
        const oid = bg.obj && bg.obj in this.a ? Number(this.a[bg.obj]) : -1;
        return oid > 0 && this.a.player.carrying(oid) ? resolve() : false;
      }
      case "bridge": return this.a.bridge_built() ? false : resolve();
      case "dragon_killed": return this.a.dragon_alive() ? false : resolve();
      case "chasm_collapsed": return this.a.troll_bridge_collapsed() ? resolve() : false;
      default: return false;
    }
  }

  // Walk the player to dest via the FSM move so the destination room's entry
  // handler fires (e.g. canon 21 death), then run per-turn upkeep.
  private walkToDest(dest: number): void {
    this.a.set_old_loc2(this.a.get_old_loc());
    this.a.set_old_loc(this.a.player_room());
    const response: string = this.a.do_command("move", String(dest));
    if (response !== "") this.println(response);
    this.afterTurn(true);
  }

  private dispatchToFsm(verb: string, noun: string): void {
    let response: string = this.a.do_command(verb, noun);
    if (response.startsWith("I don't know how to '")) {
      if (this.a.chance.decide("dispatch_13", 20)) response = "I don't understand that!";
      else if (this.a.chance.decide("dispatch_61", 20)) response = "What?";
      else response = "I don't know that word.";
    }
    this.println(response);
  }

  /** Per-turn chain (minimal): tick, lamp warning, reprint room if moved. */
  private afterTurn(moved = false): void {
    // Canon per-turn chain: walk dwarves/pirate, then tick (which resolves
    // any dwarf attack at the player's room), then render consequences.
    this.stepDwarves();
    this.a.tick();
    this.checkPirateSteal();
    const warn: string = this.a.lamp_warning_text();
    if (warn && warn !== "") this.println(warn);
    // Canon msg #185 (advent.for STMT 12600): lamp dead + aboveground → end the run.
    if (this.a.lamp_out_aboveground()) {
      this.println("There's not much point in wandering around out here, and you can't explore the cave without a lamp. So let's just call it a day.");
      if (this.interactive) this.deadEnd = true; // is_inside_tree() gate — headless harness keeps playing
    }
    this.checkEndgamePhaseChange();
    this.checkDwarfAxe();
    this.checkChestHint();
    this.checkPlayerDeath();
    const st: string = this.a.player_state();
    if (st !== "dead" && st !== "permadead" && (this.a.player_room() !== this.lastRoom || moved)) {
      this.maybePrintRoom();
    }
  }

  // Render the room unless BRIEF mode suppresses a revisit (mirrors Godot
  // driver._maybe_print_room_after_move): in brief mode, an already-visited room
  // shows nothing on re-entry; LOOK forces a full re-display via printRoom.
  private maybePrintRoom(): void {
    const current: number = this.a.player_room();
    if (this.a.is_brief_mode() && this.visitedRooms.has(current)) return;
    this.visitedRooms.add(current);
    this.printRoom();
  }

  private printRoom(): void {
    this.lastRoom = this.a.player_room();
    const desc: string = this.a.do_command("look", "");
    this.println(desc);
    // Canon Y2 whisper (advent.for line 808): at canon room 33, 25% chance per
    // room render to print msg #8. Doesn't fire during the cave-closing phase.
    // Rolled here (last in the turn) so the shared chance stream advances in the
    // same order as Godot's _print_room (travel_gate → pirate_rustle → y2_whisper).
    if (this.lastRoom === 33 && !this.a.endgame_closing() && this.a.chance.decide("y2_whisper", 25)) {
      this.println('A hollow voice says "PLUGH".');
    }
    // Canon msg #3 first-dwarf-encounter (advent.for STMT 6000): fires once when
    // the player renders a room holding a stalking dwarf (mirrors Godot
    // _print_room). In a full turn checkDwarfAxe marks the flag first, so this is
    // the render-path narration the dwarf-canon harness exercises directly.
    if (!this.a.is_dwarf_first_encounter_done() && this.dwarfAtRoom(this.lastRoom)) {
      this.a.mark_dwarf_first_encounter_done();
      this.println("A little dwarf just walked around a corner, saw you, threw a little");
      this.println("axe at you which missed, cursed, and ran away.");
    }
  }

  // True if a stalking dwarf is at `room` (mirrors Godot driver._dwarf_at_room;
  // dwarf_room_of returns -1 for hidden/dead dwarves, so a valid room match
  // implies a stalking dwarf there).
  private dwarfAtRoom(room: number): boolean {
    for (let i = 1; i <= 5; i++) if (this.a.dwarf_room_of(i) === room) return true;
    return false;
  }

  // FIND support — mirrors Godot driver._object_in_room. Treasures answer via
  // get_location(); plain items via is_in_room(room).
  private objectInRoom(objId: number, room: number): boolean {
    const a = this.a;
    switch (objId) {
      case a.BIRD_ID: return a.bird.get_location() === room;
      case a.GOLD_ID: return a.gold.get_location() === room;
      case a.SILVER_ID: return a.silver.get_location() === room;
      case a.DIAMONDS_ID: return a.diamonds.get_location() === room;
      case a.JEWELRY_ID: return a.jewelry.get_location() === room;
      case a.PEARL_ID: return a.pearl.get_location() === room;
      case a.VASE_ID: return a.vase.get_location() === room;
      case a.EGGS_ID: return a.eggs.get_location() === room;
      case a.TRIDENT_ID: return a.trident.get_location() === room;
      case a.EMERALD_ID: return a.emerald.get_location() === room;
      case a.SPICES_ID: return a.spices.get_location() === room;
      case a.CHEST_ID: return a.chest.get_location() === room;
      case a.PYRAMID_ID: return a.pyramid.get_location() === room;
      case a.RUG_ID: return a.rug.get_location() === room;
      case a.COINS_ID: return a.coins.get_location() === room;
      case a.CHAIN_ID: return a.chain.get_location() === room;
      case a.ROD_ID: return a.rod_item.is_in_room(room);
      case a.MARK_ROD_ID: return a.mark_rod_item.is_in_room(room);
      case a.KEYS_ID: return a.keys_item.is_in_room(room);
      case a.LAMP_ID: return a.lamp_item.is_in_room(room);
      case a.BOTTLE_ID: return a.bottle_item.is_in_room(room);
      case a.CAGE_ID: return a.cage_item.is_in_room(room);
      case a.FOOD_ID: return a.food_item.is_in_room(room);
      case a.PILLOW_ID: return a.pillow_item.is_in_room(room);
      case a.AXE_ID: return a.axe_item.is_in_room(room);
      case a.CLAM_ID: return a.clam_item.is_in_room(room);
      case a.OYSTER_ID: return a.oyster_item.is_in_room(room);
      case a.BATTERIES_ID: return a.batteries_item.is_in_room(room);
      case a.MAGAZINE_ID: return a.magazine_item.is_in_room(room);
      default: return false;
    }
  }

  // Resolve a noun token to a port object ID, or 0 if no match (FIND vocabulary;
  // mirrors Godot driver._resolve_object_id — canon words only, not a synonym
  // engine). Multi-word names ("gold nugget") are accepted.
  private resolveObjectId(noun: string): number {
    const a = this.a;
    const n = noun.trim().toLowerCase();
    if (n === "") return 0;
    const map: Record<string, number> = {
      bird: a.BIRD_ID, chain: a.CHAIN_ID,
      gold: a.GOLD_ID, nugget: a.GOLD_ID, "gold nugget": a.GOLD_ID,
      silver: a.SILVER_ID, bars: a.SILVER_ID, "silver bars": a.SILVER_ID,
      diamonds: a.DIAMONDS_ID, jewelry: a.JEWELRY_ID, pearl: a.PEARL_ID,
      vase: a.VASE_ID, eggs: a.EGGS_ID, trident: a.TRIDENT_ID,
      emerald: a.EMERALD_ID, spices: a.SPICES_ID, chest: a.CHEST_ID,
      pyramid: a.PYRAMID_ID, rug: a.RUG_ID, coins: a.COINS_ID,
      rod: a.ROD_ID, keys: a.KEYS_ID, lamp: a.LAMP_ID, lantern: a.LAMP_ID,
      bottle: a.BOTTLE_ID, cage: a.CAGE_ID, food: a.FOOD_ID, pillow: a.PILLOW_ID,
      axe: a.AXE_ID, clam: a.CLAM_ID, oyster: a.OYSTER_ID,
      magazine: a.MAGAZINE_ID, batteries: a.BATTERIES_ID,
    };
    return map[n] ?? 0;
  }

  private checkPlayerDeath(): void {
    if (this.prompts.is_active()) return;
    const s: string = this.a.player_state();
    if (s === "dead" || s === "permadead") this.dropInventoryAtDeathRoom();
    if (s === "dead") {
      if (this.a.endgame_closing()) {
        this.println(
          "It looks as though you're dead. Well, seeing as how it's so close to closing time anyway, I think we'll just call it a day.",
        );
        this.deadEnd = true;
        return;
      }
      this.prompts.offer_revive();
      this.println(this.a.player.get_revive_prompt());
    } else if (s === "permadead") {
      this.println(this.a.player.get_permadeath_msg());
      this.deadEnd = true;
    }
  }

  // Canon: dying drops every carried item/treasure at the death room. The
  // Player FSM's die() only moves the Player; the item/treasure FSMs need an
  // explicit try_drop or they'd stay $Carried (idempotent — safe to repeat).
  private dropInventoryAtDeathRoom(): void {
    const here: number = this.a.player.get_room();
    const items = [
      this.a.rod_item, this.a.keys_item, this.a.bottle_item, this.a.cage_item,
      this.a.food_item, this.a.pillow_item, this.a.axe_item, this.a.clam_item,
      this.a.oyster_item, this.a.batteries_item, this.a.magazine_item,
      this.a.mark_rod_item, this.a.lamp_item,
    ];
    for (const it of items) if (it.is_carried()) it.try_drop(here);
    const treasures = [
      this.a.gold, this.a.silver, this.a.diamonds, this.a.jewelry, this.a.pearl,
      this.a.vase, this.a.eggs, this.a.trident, this.a.emerald, this.a.spices,
      this.a.chest, this.a.pyramid, this.a.rug, this.a.coins, this.a.chain,
    ];
    for (const t of treasures) if (t.get_state() === "carried") t.try_drop(here);
  }

  private formatInventory(): string {
    const p = this.a.player;
    const items: string[] = [];
    const hasBird = p.carrying(ID.BIRD);
    const hasCage = p.carrying(ID.CAGE);
    if (hasBird && hasCage) items.push("  Little bird in cage");
    else if (hasBird) items.push("  Little bird");
    else if (hasCage) items.push("  Wicker cage");
    if (p.carrying(ID.ROD)) items.push("  Black rod with a rusty star on the end");
    if (p.carrying(ID.MARK_ROD)) items.push("  Black rod with a rusty mark on the end");
    if (p.carrying(ID.KEYS)) items.push("  Set of keys");
    if (p.carrying(ID.LAMP)) items.push("  Brass lantern");
    if (p.carrying(ID.BOTTLE)) {
      if (this.a.bottle.has_water()) items.push("  Water in the bottle");
      else if (this.a.bottle.has_oil()) items.push("  Oil in the bottle");
      else items.push("  Small bottle");
    }
    if (p.carrying(ID.FOOD)) items.push("  Tasty food");
    if (p.carrying(ID.PILLOW)) items.push("  Velvet pillow");
    if (p.carrying(ID.AXE)) items.push("  Dwarf's axe");
    if (p.carrying(ID.CLAM)) items.push("  Giant clam");
    if (p.carrying(ID.MAGAZINE)) items.push('  "Spelunker Today" magazine');
    if (p.carrying(ID.BATTERIES)) items.push("  Fresh batteries");
    if (p.carrying(ID.GOLD)) items.push("  Large gold nugget");
    if (p.carrying(ID.SILVER)) items.push("  Bars of silver");
    if (p.carrying(ID.DIAMONDS)) items.push("  Several diamonds");
    if (p.carrying(ID.JEWELRY)) items.push("  Precious jewelry");
    if (p.carrying(ID.PEARL)) items.push("  Glistening pearl");
    if (p.carrying(ID.VASE)) items.push(this.a.vase.is_broken() ? "  Worthless shards of pottery" : "  Ming vase");
    if (p.carrying(ID.EGGS)) items.push("  Nest of golden eggs");
    if (p.carrying(ID.TRIDENT)) items.push("  Jeweled trident");
    if (p.carrying(ID.EMERALD)) items.push("  Egg-sized emerald");
    if (p.carrying(ID.SPICES)) items.push("  Rare spices");
    if (p.carrying(ID.CHEST)) items.push("  Treasure chest");
    if (p.carrying(ID.PYRAMID)) items.push("  Platinum pyramid");
    if (p.carrying(ID.RUG)) items.push("  Persian rug");
    if (p.carrying(ID.COINS)) items.push("  Rare coins");
    if (p.carrying(ID.CHAIN)) items.push("  Golden chain");
    if (items.length === 0) return "You're not carrying anything.";
    return "You are currently holding the following:\n" + items.join("\n");
  }

  // ---- UI verbs (ported from driver.gd _handle_ui_verb subset) ----
  private handleUiVerb(verb: string, noun: string): boolean {
    switch (verb) {
      case "help":
        this.println("Commands: LOOK · compass N/S/E/W/U/D (also IN/OUT/ENTER) · TAKE/DROP <obj> ·");
        this.println("ON/OFF (lamp) · INVENTORY (I) · SCORE · XYZZY/PLUGH/PLOVER · HINT · BACK ·");
        this.println("BRIEF · SAVE/RESTORE · QUIT. Many canon verbs work too (ATTACK, FEED, THROW …).");
        return true;
      case "info":
        this.println("A faithful Frame-state-machine port of Colossal Cave Adventure (Crowther & Woods, 1977).");
        return true;
      case "score":
        this.println(
          `Score: ${this.a.score()} — treasures ${this.a.treasure_score()} (${this.a.treasures_deposited()}/15 deposited), visits ${this.a.visit_score()}, hints ${this.a.hint_penalty()}, endgame ${this.a.endgame_score()}`,
        );
        return true;
      case "inventory":
        this.println(this.formatInventory());
        return true;
      case "light":
        this.a.light_lamp();
        this.println(this.a.is_lit() ? "Your lamp is now on." : "You have no source of light.");
        this.afterTurn();
        return true;
      case "extinguish":
        this.a.extinguish_lamp();
        this.println("Your lamp is now off.");
        this.afterTurn();
        return true;
      case "quit":
        this.prompts.offer_quit();
        this.println("Do you really want to quit now?");
        return true;
      case "hint":
        this.println(this.a.request_hint(noun !== "" ? noun : "bird"));
        this.afterTurn();
        return true;
      case "find": {
        // Canon FIND (advent.for STMT 9190) priority ladder: carrying → #24,
        // here → #94, closed → #138, else → #59.
        const findObjId: number = this.resolveObjectId(noun);
        if (findObjId > 0 && this.a.player.carrying(findObjId)) {
          this.println("You are already carrying it!");
          return true;
        }
        if (findObjId > 0 && this.objectInRoom(findObjId, this.a.player_room())) {
          this.println("I believe what you want is right here with you.");
          return true;
        }
        if (this.a.endgame_state() === "in_repository") {
          this.println("I daresay whatever you want is around here somewhere.");
          return true;
        }
        this.println(
          "I can only tell you what you see as you move about and manipulate things. I cannot tell you where remote things are.",
        );
        return true;
      }
      case "save":
        this.saveGame();
        return true;
      case "load": {
        if (!this.store) {
          this.println("Restoring isn't available in this session.");
          return true;
        }
        const blob = this.store.getItem(SAVE_KEY);
        if (!blob) {
          this.println("There is no saved game to restore.");
          return true;
        }
        if (this.restoreSnapshot(blob, false)) {
          this.println("Your saved game has been restored.");
          this.printRoom();
        } else {
          this.println("Your saved game appears to be corrupted; it could not be restored.");
        }
        return true;
      }
      case "hours":
        // Canon HOURS (advent.for line 8310) — 1977 printed the PDP-10
        // timesharing schedule; a desktop port has no off-hours.
        this.println("Colossal Cave is open all day, every day.");
        this.println("(In the original 1977 PDP-10 release this verb");
        this.println("printed the timesharing schedule during which");
        this.println("non-wizards could play. On a desktop port the");
        this.println("cave has no off-hours.)");
        return true;
      case "wizard":
        // Canon WIZARD (advent.for SUBROUTINE WIZARD) — msgs #16/#17/#20.
        this.println('"Are you a wizard?"');
        this.println('"Prove it!  Say the magic word!"');
        this.println('"That is not what I thought it was.  Do you know what I thought it was?"');
        this.println('"Foo, you are nothing but a charlatan!"');
        return true;
      case "maint":
        // Canon MAINT (advent.for SUBROUTINE MAINT) — canon msg #1 (tall wizard
        // in grey) gently rewritten + msg #20. MAGIC / MAGIC MODE / MAINTENANCE
        // all route here via synonyms.
        this.println("A large cloud of green smoke appears in front of you. It clears");
        this.println("away to reveal a tall wizard, clothed in grey. He fixes you with");
        this.println('a steely glare and declares, "Maintenance mode requires a real');
        this.println('PDP-10 and a sysadmin who knew Don Woods. This is neither."');
        this.println("With that he makes a single pass over you with his hands, and");
        this.println("you find yourself right back where you started.");
        this.println("");
        this.println('"Foo, you are nothing but a charlatan!"');
        return true;
      case "suspend":
        // Canon SUSPEND (advent.for STMT 8300) — 45-minute latency warning, then
        // msg #200 confirmation. The PromptDispatcher's $AwaitingSuspendConfirm
        // handles YES (save + OK) / NO (cancel + OK).
        this.println("I can suspend your adventure for you so that you can resume later, but");
        this.println("you will have to wait at least 45 minutes before continuing.");
        this.println("Is this acceptable?");
        this.prompts.offer_suspend();
        return true;
      case "rub":
        this.println(
          noun === "lamp"
            ? "Rubbing the electric lamp is not particularly rewarding. Anyway, nothing exciting happens."
            : "Peculiar. Nothing unexpected happens.",
        );
        return true;
      case "say":
        if (noun === "") {
          this.println("Say what?");
          return true;
        }
        if (["xyzzy", "plugh", "plover", "fee", "fie", "foe", "foo"].includes(noun)) {
          this.processInput(noun);
          return true;
        }
        this.println(`Okay, "${noun}".`);
        return true;
      case "cave":
        this.println(
          this.a.player_room() <= 8
            ? "I don't know where the cave is, but hereabouts no stream can run on the surface for long. I would try the stream."
            : "I need more detailed instructions to do that.",
        );
        return true;
      case "map":
        if (this.a.player_room() !== 3 && this.a.player_room() < 15) {
          this.println("I don't know that word.");
          return true;
        }
        this.println("[A hand-drawn sketch of Crowther's Bedquilt cave map flickers before you.]");
        return true;
      case "brief":
        this.a.enable_brief_mode();
        this.println("Okay, from now on I'll only describe a place in full the first time you");
        this.println("come to it. To get the full description, say LOOK.");
        return true;
      case "blast":
        return this.doBlast();
      case "wake":
        return this.doWake();
      case "back":
        return this.doBack();
      default:
        return false;
    }
  }

  private doBlast(): boolean {
    if (this.a.endgame_state() !== "in_repository") {
      this.println("Blasting requires dynamite.");
      return true;
    }
    if (this.a.mark_rod_here()) {
      this.println("There is a loud explosion, and you are suddenly splashed across the walls of the room.");
      this.a.blast_klutz();
    } else if (this.a.player_room() === 115) {
      this.println("There is a loud explosion, and a twenty-foot hole appears in the far wall,");
      this.println("burying the snakes in the rubble. A river of molten lava pours in, destroying everything — including you!");
      this.a.blast_wrong_way();
    } else {
      this.println("There is a loud explosion, and a twenty-foot hole appears in the far wall,");
      this.println("burying the dwarves in the rubble. You march through the hole and find");
      this.println("yourself in the main office, where a cheering band of friendly elves carry");
      this.println("the conquering adventurer off into the sunset.");
      this.a.blast_mastery();
    }
    if (this.a.endgame_state() === "won") {
      this.println("");
      this.println("*** You have won Adventure! ***");
    }
    this.deadEnd = true; // all three in-repository blasts end the game
    return true;
  }

  private doWake(): boolean {
    if (this.a.endgame_state() !== "in_repository") {
      this.println("I don't understand that.");
      return true;
    }
    this.println("You prod the nearest dwarf, who wakes up grumpily, takes one look at you,");
    this.println("curses, and grabs for his axe. The resulting ruckus has awakened the dwarves.");
    this.println("Most of them throw knives at you! All of them get you!");
    this.a.player.die();
    this.checkPlayerDeath();
    return true;
  }

  private doBack(): boolean {
    const current: number = this.a.player_room();
    const exits = ROOMS[current] ?? {};
    if ("back" in exits) {
      this.handleMovement("back");
      return true;
    }
    let k: number = this.a.get_old_loc();
    if (FORCED_ROOMS.includes(k)) k = this.a.get_old_loc2();
    if (k < 0 || k === current) {
      this.println("Sorry, but I no longer seem to remember how it was you got here.");
      return true;
    }
    for (const dir of Object.keys(exits)) {
      if (exits[dir] === k) {
        this.handleMovement(dir);
        return true;
      }
    }
    this.println("You can't get there from here.");
    return true;
  }

  private endTurn(): void {
    this.afterTurn();
  }

  // ---- per-turn dwarf / pirate / dark-pit (ported from driver.gd) ----

  private candidateExits(cur: number): number[] {
    const out: number[] = [];
    for (const dest of Object.values(ROOMS[cur] ?? {})) {
      if (!out.includes(dest)) out.push(dest);
    }
    return out;
  }

  private dwarfAtRoom(room: number): boolean {
    for (let i = 1; i <= 5; i++) if (this.a.dwarf_room_of(i) === room) return true;
    return false;
  }

  // Canon STMT 6010: each stalking dwarf (and the pirate) walks one step
  // along the section-3 graph; the driver supplies candidate exits, the FSM
  // does the seeded filter+pick. Snap to the player when seen in the deep cave.
  private stepDwarves(): void {
    const playerRoom: number = this.a.player_room();
    for (let i = 1; i <= 5; i++) {
      const cur: number = this.a.dwarf_room_of(i);
      if (cur <= 0) continue; // hidden/dead → not stalking
      const wasSeen: boolean = this.a.dwarf_is_seen(i);
      const newRoom: number = this.a.dwarf_pick_destination(i, this.candidateExits(cur), FORCED_ROOMS);
      this.a.dwarf_step_to(i, newRoom);
      const nowAt: number = this.a.dwarf_room_of(i);
      const nowPrev: number = this.a.dwarf_prev_room_of(i);
      const sawPlayer: boolean = nowAt === playerRoom || nowPrev === playerRoom;
      if (sawPlayer || (wasSeen && playerRoom >= 15)) this.a.dwarf_snap_to_player(i);
      else if (playerRoom < 15) this.a.dwarf_unsee(i);
    }
    if (this.a.pirate_state() === "stalking") {
      const pCur: number = this.a.pirate_room();
      const pWasSeen: boolean = this.a.pirate_is_seen();
      const pNew: number = this.a.pirate_pick_destination(this.candidateExits(pCur), FORCED_ROOMS.concat(FORBIDDEN_PIRATE_ROOMS));
      this.a.pirate_step_to(pNew);
      const pAt: number = this.a.pirate_room();
      const pPrev: number = this.a.pirate_prev_room();
      const pSaw: boolean = pAt === playerRoom || pPrev === playerRoom;
      if (pSaw || (pWasSeen && playerRoom >= 15)) this.a.pirate_snap_to_player();
      else if (playerRoom < 15) this.a.pirate_unsee();
    }
  }

  // Canon dwarf-attack prose ladder. Counts populated by the FSM tick's
  // _maybe_dwarf_attack; drain the legacy single-dwarf flags either way.
  private checkDwarfAxe(): void {
    const dtotal: number = this.a.dwarf_count_in_room();
    const attack: number = this.a.dwarf_attack_count();
    const stick: number = this.a.dwarf_hit_count();
    this.a.dwarf_threw_axe();
    this.a.dwarf_threw_and_missed();
    if (dtotal === 0) return;
    if (!this.a.is_dwarf_first_encounter_done()) this.a.mark_dwarf_first_encounter_done();
    if (dtotal === 1) this.println("There is a threatening little dwarf in the room with you!");
    else this.println(`There are ${dtotal} threatening little dwarves in the room with you.`);
    if (attack === 0) return;
    if (attack === 1) {
      this.println("One sharp nasty knife is thrown at you!");
      this.println(stick === 0 ? "It misses!" : "It gets you!");
      return;
    }
    this.println(`${attack} of them throw knives at you!`);
    if (stick === 0) this.println("None of them hit you!");
    else if (stick === 1) this.println("One of them gets you!");
    else this.println(`${stick} of them get you!`);
  }

  // Canon endgame phase-change prose (advent.for): the sepulchral closing
  // announcement (msg #129), the closing crescendo at timer 25/15/5, the
  // cave-closed/repository prose (msg #132), and the victory line. Per-turn,
  // mirrors Godot driver _check_endgame_phase_change.
  private checkEndgamePhaseChange(): void {
    const s: string = this.a.endgame_state();
    if (s !== this.lastEndgameState) {
      this.lastEndgameState = s;
      if (s === "closing") {
        this.println('A sepulchral voice reverberating through the cave, says, "Cave closing soon. All adventurers exit immediately through main office."');
      } else if (s === "in_repository") {
        this.println('The sepulchral voice entones, "The cave is now closed." As the echoes fade, there is a blinding flash of light (and a small puff of orange smoke). . . . As your eyes refocus, you look around and find...');
        this.println("(Try DETONATE.)");
      } else if (s === "won") {
        this.println(`There is a loud explosion, and a twenty-foot hole appears in the far wall, burying the dwarves in the rubble. You march through the hole and find yourself in the main office, where a cheering band of friendly elves carry the conquering adventurer off into the sunset. (Final score: ${this.a.score()})`);
      }
    }
    const w: number = this.a.pending_warning_threshold();
    if (w === 25 || w === 15) {
      this.println('A sepulchral voice reverberating through the cave, says, "Cave closing soon. All adventurers exit immediately through main office."');
      this.a.clear_pending_warning();
    } else if (w === 5) {
      this.println('A mysterious recorded voice groans into life and announces: "This exit is closed. Please leave via main office."');
      this.a.clear_pending_warning();
    }
  }

  // Canon msg #186 — fires once when 14/15 treasures are deposited and the chest
  // is still out in the world (points the player to the pirate's maze). Per-turn.
  private checkChestHint(): void {
    if (this.a.is_chest_hint_done()) return;
    if (this.a.chest.is_deposited()) return;
    if (this.a.player.carrying(this.a.CHEST_ID)) return;
    if (this.a.treasures_deposited() < 14) return;
    this.a.mark_chest_hint_done();
    this.println("There are faint rustling noises from the darkness behind you. As you");
    this.println("turn toward them, the beam of your lamp falls across a bearded pirate.");
    this.println(`He is carrying a large chest. "Shiver me timbers!" he cries, "I've`);
    this.println(`been spotted! I'd best hie meself off to the maze to hide me chest!"`);
    this.println("With that, he vanishes into the gloom.");
  }

  private checkPirateSteal(): void {
    if (this.a.pirate_state() !== "stalking") return;
    const msg: string = this.a.pirate_attempt_steal();
    if (msg !== "") {
      this.println(msg);
      return;
    }
    this.checkPirateRustle();
  }

  // Public for the pirate-rustling harness test, which drives it directly in a
  // loop (mirrors Godot driver._check_pirate_rustle).
  checkPirateRustle(): void {
    if (this.a.pirate_state() !== "stalking") return;
    if (this.a.player_room() < 15) return;
    if (this.a.chance.decide("pirate_rustle", 20)) {
      this.println("There are faint rustling noises from the darkness behind you.");
    }
  }

  // Canon dark-room pit-fall: one free "pitch dark" warning per room, then a
  // 35% pit-fall roll on subsequent move attempts. Returns true to block.
  // Public for the dark-pit-fall harness test, which drives it directly
  // (mirrors Godot driver._check_dark_pit_hazard).
  checkDarkPitHazard(): boolean {
    if (!this.a.room_is_dark_now()) {
      if (this.a.dark_warned_room() !== -1) this.a.clear_dark_warning();
      return false;
    }
    const current: number = this.a.player_room();
    if (current !== this.a.dark_warned_room()) {
      this.println("It is now pitch dark. If you proceed you will likely fall into a pit.");
      this.a.set_dark_warned_room(current);
      return true;
    }
    if (this.a.chance.decide("dark_pit_fall", DARK_PIT_PCT)) {
      this.println("You fell into a pit and broke every bone in your body!");
      this.a.player.die();
      return true;
    }
    return false;
  }

  // ---- canon verb intercepts (ported from driver.gd _intercept_*) ----

  private iBreakMirror(verb: string, noun: string): boolean {
    if (verb !== "break" || noun !== "mirror") return false;
    if (this.a.endgame_state() === "in_repository") {
      this.println("You strike the mirror a resounding blow, whereupon it shatters into a");
      this.println("myriad tiny fragments.");
      this.println("");
      this.println("The resulting ruckus has awakened the dwarves. There are now several");
      this.println("threatening little dwarves in the room with you! Most of them throw");
      this.println("knives at you! All of them get you!");
      this.a.player.die();
      this.checkPlayerDeath();
      return true;
    }
    this.println("It is beyond your power to do that.");
    return true;
  }

  private iDropBird(verb: string, noun: string): boolean {
    if (verb !== "drop" || noun !== "bird") return false;
    if (!this.a.player.carrying(ID.BIRD)) {
      this.println(this.a.do_command("release", "bird"));
      return true;
    }
    if (this.a.player_room() === 19 && this.a.snake_state() === "blocking") {
      this.a.bird.vanish();
      this.a.player.drop(ID.BIRD);
      this.println("The snake has now devoured your bird.");
      return true;
    }
    this.println(this.a.do_command("release", "bird"));
    return true;
  }

  private iAttackBird(verb: string, noun: string): boolean {
    if (verb !== "attack" || noun !== "bird") return false;
    this.println("Oh, leave the poor unhappy bird alone.");
    return true;
  }

  private iAttackBear(verb: string, noun: string): boolean {
    if (verb !== "attack" || noun !== "bear") return false;
    const bs: string = this.a.bear_state();
    if (bs === "hungry") this.println("With what? Your bare hands? Against *his* bear hands??");
    else if (bs === "tame" || bs === "following") this.println("The bear is confused; he only wants to be your friend.");
    else if (bs === "released") this.println("For crying out loud, the poor thing is already dead!");
    else this.println("You can't be serious!");
    return true;
  }

  private iTakeKnife(verb: string, noun: string): boolean {
    if (verb !== "take" || noun !== "knife") return false;
    this.println("The dwarves' knives vanish as they strike the walls of the cave.");
    return true;
  }

  private iTakeBear(verb: string, noun: string): boolean {
    if (verb !== "take" || noun !== "bear") return false;
    const bs: string = this.a.bear_state();
    if (bs === "hungry" || bs === "tame") this.println("The bear is still chained to the wall.");
    else if (bs === "following") this.println("OK");
    else this.println("You can't be serious!");
    return true;
  }

  private iUnlockChain(verb: string, noun: string): boolean {
    if (verb !== "unlock" || noun !== "chain") return false;
    if (!this.a.player.carrying(ID.KEYS)) {
      this.println("The chain is still locked.");
      return true;
    }
    return false; // keys carried → fall through to the FSM
  }

  private iBridgeCross(verb: string): boolean {
    if (!["over", "across", "cross", "ne", "sw"].includes(verb)) return false;
    const here: number = this.a.player_room();
    if (here !== 117 && here !== 122) return false;
    if (this.a.troll_bridge_collapsed()) return false;
    if (this.a.bear_state() !== "following") return false;
    this.println(
      "Just as you reach the other side, the bridge buckles beneath the weight of the bear, which was still following you around. You scrabble desperately for support, but as the bridge collapses you stumble back and fall into the chasm.",
    );
    this.a.collapse_troll_bridge();
    this.a.player.die();
    this.checkPlayerDeath();
    return true;
  }

  private iEnterStream(verb: string, noun: string): boolean {
    if (verb !== "enter") return false;
    if (noun !== "stream" && noun !== "water") return false;
    this.println("Your feet are now wet.");
    return true;
  }

  private iTakeScenery(verb: string, noun: string): boolean {
    if (verb !== "take") return false;
    if (noun === "stalactite") {
      this.println("It is too far up for you to reach.");
      return true;
    }
    const scenery = ["tablet", "mirror", "figure", "shadow", "drawings", "drawing", "volcano", "geyser", "carpet", "moss", "message"];
    if (scenery.includes(noun)) {
      this.println("You can't be serious!");
      return true;
    }
    return false;
  }

  // Canon OYSTER hint chain (advent.dat msgs #192/193/194): READ/EXAMINE the
  // in-room oyster arms a Y/N prompt; YES reveals it for a 10-point cost (handled
  // in the prompt block at the top of processInput); re-reading after reveal
  // repeats msg #194.
  // Canon scenery EXAMINE/READ prose (mirrors Godot driver._intercept_scenery_read,
  // minus the oyster hint chain — iReadOyster handles that). Room-gated feature
  // inspection; unmatched nouns fall through to the FSM examine ("Peculiar").
  private iSceneryRead(verb: string, noun: string): boolean {
    if (verb !== "read" && verb !== "examine") return false;
    const er: number = this.a.player_room();
    // ROD2 (object 6) — pre-CLOSED rod / post-CLOSED "Peculiar".
    if (noun === "rod" && this.a.mark_rod_here()) {
      if (this.a.endgame_state() === "in_repository") this.println("Peculiar. Nothing unexpected happens.");
      else this.println("A small black rod with a rusty mark on the end.");
      return true;
    }
    // STONE TABLET (object 13) at canon 101 → msg #196.
    if (noun === "tablet" && er === 101) {
      this.println("A massive stone tablet imbedded in the wall reads:");
      this.println('"Congratulations on bringing light into the dark-room!"');
      return true;
    }
    // MESSAGE in second maze (object 36) at canon 140 → msg #191.
    if (noun === "message" && er === 140) {
      this.println("There is a message scrawled in the dust in a flowery script, reading:");
      this.println('"This is not the maze where the pirate leaves his treasure chest."');
      return true;
    }
    // MIRROR (object 23) at canon 109.
    if (noun === "mirror" && er === 109) {
      this.println("Peculiar. Nothing unexpected happens.");
      return true;
    }
    // SHADOWY FIGURE (object 27) at canon 35 / 110.
    if ((noun === "figure" || noun === "shadow") && (er === 35 || er === 110)) {
      this.println("The shadowy figure seems to be trying to attract your attention.");
      return true;
    }
    // STALACTITE (object 26) at canon 111.
    if (noun === "stalactite" && er === 111) {
      this.println("Peculiar. Nothing unexpected happens.");
      return true;
    }
    // CAVE DRAWINGS (object 29) at canon 97.
    if ((noun === "drawings" || noun === "drawing") && er === 97) {
      this.println("Peculiar. Nothing unexpected happens.");
      return true;
    }
    // VOLCANO/GEYSER (object 37) at canon 126.
    if ((noun === "volcano" || noun === "geyser") && er === 126) {
      this.println("Peculiar. Nothing unexpected happens.");
      return true;
    }
    // CARPET/MOSS (object 40) at canon 96.
    if ((noun === "carpet" || noun === "moss") && er === 96) {
      this.println("Peculiar. Nothing unexpected happens.");
      return true;
    }
    // PHONY PLANT (object 25) at canon 23 / 35.
    if ((noun === "plant" || noun === "plant2") && (er === 23 || er === 35)) {
      this.println("There is a huge beanstalk growing out of the west pit up to the hole.");
      return true;
    }
    // Canon msg #63 — EXAMINE GRATE at the depression (canon 8 / 9).
    if (noun === "grate" && (er === 8 || er === 9)) {
      this.println("The grate is very solid and has a hardened steel lock. You cannot");
      this.println("enter without a key, and there are no keys nearby. I would recommend");
      this.println("looking elsewhere for the keys.");
      return true;
    }
    // Canon msg #64 — EXAMINE TREES/FOREST in the forest rooms (canon 4 / 5 / 6).
    if ((noun === "trees" || noun === "forest" || noun === "tree") && (er === 4 || er === 5 || er === 6)) {
      this.println("The trees of the forest are large hardwood oak and maple, with an");
      this.println("occasional grove of pine or spruce. There is quite a bit of under-");
      this.println("growth, largely birch and ash saplings plus nondescript bushes of");
      this.println("various sorts. This time of year visibility is quite restricted by");
      this.println("all the leaves, but travel is quite easy if you detour around the");
      this.println("spruce and berry bushes.");
      return true;
    }
    // Canon msg #69 — EXAMINE MIST.
    if (noun === "mist") {
      this.println("Mist is a white vapor, usually water, seen from time to time in");
      this.println("caverns. It can be found anywhere but is frequently a sign of a deep");
      this.println("pit leading down to water.");
      return true;
    }
    return false;
  }

  private iReadOyster(verb: string, noun: string): boolean {
    if (verb !== "read" && verb !== "examine") return false;
    if (noun !== "oyster") return false;
    if (!this.a.oyster_item.is_in_room(this.a.player_room())) return false;
    if (this.a.is_oyster_revealed()) {
      this.println("It says the same thing it did before.");
      return true;
    }
    this.prompts.offer_oyster();
    this.println("Hmmm, this looks like a clue, which means it'll cost you 10 points to");
    this.println("read it. Should I go ahead and read it anyway?");
    return true;
  }

  private iThrowAxe(verb: string, noun: string): boolean {
    if (verb !== "throw" || noun !== "axe") return false;
    const here: number = this.a.player_room();
    if (here === 119 && this.a.dragon_alive()) {
      this.println("The axe bounces harmlessly off the dragon's thick scales.");
      return true;
    }
    if (here === 117 && this.a.troll_blocking()) {
      this.println("The troll deftly catches the axe, examines it carefully, and tosses");
      this.println('it back, declaring, "Good workmanship, but it\'s not valuable enough."');
      return true;
    }
    if (here === 130 && this.a.bear_state() === "hungry") {
      this.println("The axe misses and lands near the bear where you can't get at it.");
      return true;
    }
    return false; // dwarf-attack path → FSM
  }

  private iPloverEmerald(verb: string, noun: string): void {
    if (verb !== "plover") return;
    const here: number = this.a.player_room();
    if ((here === 33 || here === 100) && this.a.player.carrying(ID.EMERALD)) {
      this.a.emerald.try_drop(here);
      this.a.player.drop(ID.EMERALD);
      this.println("OK");
    }
  }

  private iCalm(verb: string): boolean {
    if (verb !== "calm" && verb !== "tame") return false;
    this.println("I'm game. Would you care to explain how?");
    return true;
  }

  private iEat(verb: string, noun: string): boolean {
    if (verb !== "eat") return false;
    const npcs = ["bird", "snake", "clam", "oyster", "dwarf", "dragon", "troll", "bear"];
    if (npcs.includes(noun)) {
      this.println("Don't be ridiculous!");
      return true;
    }
    if (noun !== "" && noun !== "food") {
      this.println("I think I just lost my appetite.");
      return true;
    }
    return false;
  }

  private iFeed(verb: string, noun: string): boolean {
    if (verb !== "feed") return false;
    if (noun === "bird") {
      this.println("It's not hungry (it's merely pinin' for the fjords). Besides, you have no bird seed.");
      return true;
    }
    if (noun === "dwarf") {
      this.a.bump_dwarf_anger();
      this.println("You fool, dwarves eat only coal! Now you've made him *really* mad!!");
      return true;
    }
    if (noun === "troll") {
      this.println("Gluttony is not one of the troll's vices. Avarice, however, is.");
      return true;
    }
    if (noun === "snake" || noun === "dragon") {
      if (noun === "dragon" && !this.a.dragon_alive()) this.println("Don't be ridiculous!");
      else this.println("There's nothing here it wants to eat (except perhaps you).");
      return true;
    }
    return false;
  }
}
