import { Adventure } from "./cca.machine.js";
import { ROOMS, GATES, type Gate } from "./topology";

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
 * MINIMAL CUT (Phase 5a): movement, look, take/drop, lamp, magic words,
 * score, help. Deferred to Phase 6: the 17 special-case intercepts,
 * dwarf/pirate stepping, dark-pit hazard, modal prompts (quit/suspend/
 * oyster/revive/hint), save/load, brief mode, bumper-chain gates.
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
};

const DIRECTIONS = ["north", "south", "east", "west", "up", "down", "in", "out", "enter"];

function truncate5(s: string): string {
  return s.length > 5 ? s.substring(0, 5) : s;
}

export class CcaDriver {
  // The Adventure FSM is untyped (generated .machine.js). `any` is intentional.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private a: any;
  private out: string[] = [];
  private lastRoom = -1;
  private syn5: Record<string, string> = {};

  constructor() {
    this.a = Adventure._create();
    this.a.setup_default_aspects();
    this.buildSyn5();
  }

  /** Initial render — call once after construction. */
  start(): string[] {
    this.out = [];
    this.println("Welcome to Adventure!  (Crowther & Woods, 1977 — Frame port)");
    this.println("");
    this.printRoom();
    return this.drain();
  }

  /** Process one line of player input; returns the lines to display. */
  input(text: string): string[] {
    this.out = [];
    this.processInput(text);
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

  // ---- internals ----

  private drain(): string[] {
    const o = this.out;
    this.out = [];
    return o;
  }
  private println(s: string): void {
    this.out.push(this.stripBBCode(s));
  }
  private stripBBCode(s: string): string {
    return s.replace(/\[\/?[a-z][^\]]*\]/gi, "");
  }

  private buildSyn5(): void {
    for (const key of Object.keys(VERB_SYNONYMS)) {
      this.syn5[truncate5(key)] = VERB_SYNONYMS[key];
    }
    // Identity mappings for canonical verbs > 5 chars whose truncated form
    // must restore (so gate keys / FSM checks match the full word).
    const canon = [
      "extinguish", "release", "attack", "examine", "unlock", "insert", "plover",
      "inventory", "passage", "forward", "stream", "across", "stairs", "building",
      "valley", "cavern", "barren", "secret", "cobbles", "upstream", "downstream",
      "entrance", "surface", "forest", "broken", "canyon", "debris",
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
    const { verb, noun } = this.parse(text);
    if (verb === "") {
      this.println("I'm afraid I don't understand.");
      return;
    }

    // Driver-side UI verbs (minimal subset).
    if (verb === "score") {
      this.println(`Your score is ${this.a.score()}.`);
      return;
    }
    if (verb === "help") {
      this.println("Type commands like: LOOK, NORTH/N, TAKE KEYS, DROP LAMP, ON/OFF (lamp),");
      this.println("XYZZY, PLUGH, INVENTORY, SCORE. Compass: N S E W U D; also IN/OUT/ENTER.");
      return;
    }
    if (verb === "light") {
      this.a.light_lamp();
      this.println(this.a.is_lit() ? "Your lamp is now on." : "You have no source of light.");
      this.afterTurn();
      return;
    }
    if (verb === "extinguish") {
      this.a.extinguish_lamp();
      this.println("Your lamp is now off.");
      this.afterTurn();
      return;
    }

    // Movement: a compass direction, or any verb the current room maps as an exit.
    const room = this.a.player_room();
    const exits = ROOMS[room] ?? {};
    if (DIRECTIONS.includes(verb) || verb in exits) {
      this.handleMovement(verb);
      return;
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
      default: return false; // carrying / pct chains deferred
    }
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
    this.a.tick();
    const warn: string = this.a.lamp_warning_text();
    if (warn && warn !== "") this.println(warn);
    if (this.a.player_room() !== this.lastRoom || moved) {
      this.printRoom();
    }
  }

  private printRoom(): void {
    this.lastRoom = this.a.player_room();
    const desc: string = this.a.do_command("look", "");
    this.println(desc);
  }
}
