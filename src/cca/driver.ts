import { Adventure, PromptDispatcher } from "./cca.machine.js";
import { ROOMS, GATES } from "./topology";

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

export class CcaDriver {
  // The Adventure FSM is untyped (generated .machine.js). `any` is intentional.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private a: any;
  // PromptDispatcher is a session-scoped FSM the driver owns (not composed
  // on Adventure) — it holds "which modal Y/N prompt is open" as state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private prompts: any;
  private out: string[] = [];
  private lastRoom = -1;
  private deadEnd = false;
  private syn5: Record<string, string> = {};

  constructor() {
    this.a = Adventure._create();
    this.a.setup_default_aspects();
    this.a.wake_dwarves(); // canon: dwarves wake at game start, wandering the deep cave
    this.prompts = PromptDispatcher._create();
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
        }
        return;
      } else if (verb === "no") {
        this.prompts.decline();
        if (promptName === "revive") {
          this.println(this.a.player.get_permadeath_msg());
          this.deadEnd = true;
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

    // Driver-side UI verbs (minimal subset).
    if (verb === "inventory") {
      this.println(this.formatInventory());
      return;
    }
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

    // Canon-order verb intercepts (driver-side special cases). enter-stream
    // and bridge-cross must run BEFORE the direction check ("enter"/"over" are
    // motion-ish); the rest run after. Each consumed intercept ends the turn.
    if (this.iBridgeCross(verb)) return this.endTurn();
    if (MOTION_VERBS.includes(verb) && this.checkDarkPitHazard()) return this.endTurn();
    if (this.iEnterStream(verb, noun)) return this.endTurn();

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
    if (this.iThrowAxe(verb, noun)) return this.endTurn();
    this.iPloverEmerald(verb, noun); // side-effect; falls through to FSM PLOVER

    if (this.iCalm(verb)) return this.endTurn();
    if (this.iEat(verb, noun)) return this.endTurn();
    if (this.iFeed(verb, noun)) return this.endTurn();

    // Room-specific motion aliases (e.g. CLIMB/BARREN) the room defines as exits.
    if (verb in exits) {
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
    // Canon per-turn chain: walk dwarves/pirate, then tick (which resolves
    // any dwarf attack at the player's room), then render consequences.
    this.stepDwarves();
    this.a.tick();
    this.checkPirateSteal();
    const warn: string = this.a.lamp_warning_text();
    if (warn && warn !== "") this.println(warn);
    this.checkDwarfAxe();
    this.checkPlayerDeath();
    const st: string = this.a.player_state();
    if (st !== "dead" && st !== "permadead" && (this.a.player_room() !== this.lastRoom || moved)) {
      this.printRoom();
    }
  }

  private printRoom(): void {
    this.lastRoom = this.a.player_room();
    const desc: string = this.a.do_command("look", "");
    this.println(desc);
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

  private checkPirateSteal(): void {
    if (this.a.pirate_state() !== "stalking") return;
    const msg: string = this.a.pirate_attempt_steal();
    if (msg !== "") {
      this.println(msg);
      return;
    }
    this.checkPirateRustle();
  }

  private checkPirateRustle(): void {
    if (this.a.pirate_state() !== "stalking") return;
    if (this.a.player_room() < 15) return;
    if (this.a.chance.decide("pirate_rustle", 20)) {
      this.println("There are faint rustling noises from the darkness behind you.");
    }
  }

  // Canon dark-room pit-fall: one free "pitch dark" warning per room, then a
  // 35% pit-fall roll on subsequent move attempts. Returns true to block.
  private checkDarkPitHazard(): boolean {
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
