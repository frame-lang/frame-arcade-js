@@[target("javascript")]

// CCA core + Adventure orchestrator. CANONICAL: mirrors
// frame-arcade/cca/frame/cca.fgd exactly. Only action bodies differ (JS).

import { Bird, Snake, Bear, Troll, Dwarf, Dragon, Pirate, Chance } from "./npcs.machine.js"
import { Lamp, Treasure, Item, EggsIncantation, CrystalBridge, Grate, RustyDoor, VendingMachine, Bottle, Plant } from "./puzzles.machine.js"
import { AspectBus } from "./aspects.machine.js"

@@system Player {

    interface:
        move_to(room_id: int)
        die()
        revive()

        take(item_id: int)
        drop(item_id: int)
        carrying(item_id: int): bool
        inventory_size(): int

        get_state(): string
        get_room(): int
        get_deaths(): int

        get_revive_prompt(): string

        get_revive_response(): string

        get_permadeath_msg(): string

    machine:

        $Alive {
            move_to(room_id: int) {
                this.room = room_id
            }

            take(item_id: int) {
                if (!this.inventory.includes(item_id)) {
                    this.inventory.push(item_id)
                }
            }

            drop(item_id: int) {
                let __i = this.inventory.indexOf(item_id)
                if (__i >= 0) {
                    this.inventory.splice(__i, 1)
                }
            }

            die() {
                this.deaths = this.deaths + 1
                if (this.deaths > this.MAX_RESURRECTIONS) {
                    -> $Permadead
                } else {
                    -> $Dead
                }
            }

            carrying(item_id: int): bool { @@:(this.inventory.includes(item_id)) }
            inventory_size(): int        { @@:(this.inventory.length) }
            get_state(): string          { @@:("alive") }
            get_room(): int              { @@:(this.room) }
            get_deaths(): int            { @@:(this.deaths) }
            get_revive_prompt(): string    { @@:("") }
            get_revive_response(): string  { @@:("") }
            get_permadeath_msg(): string   { @@:("") }
        }

        $Dead {
            revive() {
                this.room = this.START_ROOM
                this.inventory = []
                -> $Alive
            }

            carrying(item_id: int): bool { @@:(false) }
            inventory_size(): int        { @@:(0) }
            get_state(): string          { @@:("dead") }
            get_room(): int              { @@:(this.room) }
            get_deaths(): int            { @@:(this.deaths) }

            get_revive_prompt(): string {
                if (this.deaths == 1) {
                    @@:return("Oh dear, you seem to have gotten yourself killed. I might be able to\nhelp you out, but I've never really done this before. Do you want me\nto try to reincarnate you?")
                }
                if (this.deaths == 2) {
                    @@:return("You clumsy oaf, you've done it again! I don't know how long I can\nkeep this up. Do you want me to try reincarnating you again?")
                }
                @@:("Now you've really done it! I'm out of orange smoke! You don't expect\nme to do a decent reincarnation without any orange smoke, do you?")
            }

            get_revive_response(): string {
                if (this.deaths == 1) {
                    @@:return("All right. But don't blame me if something goes wr......\n                --- POOF!! ---\nYou are engulfed in a cloud of orange smoke. Coughing and gasping,\nyou emerge from the smoke and find....")
                }
                if (this.deaths == 2) {
                    @@:return("Okay, now where did I put my orange smoke?....   >POOF!<\nEverything disappears in a dense cloud of orange smoke.")
                }
                @@:("OK")
            }

            get_permadeath_msg(): string {
                @@:("Okay, if you're so smart, do it yourself! I'm leaving!")
            }
        }

        $Permadead {
            carrying(item_id: int): bool { @@:(false) }
            inventory_size(): int        { @@:(0) }
            get_state(): string          { @@:("permadead") }
            get_room(): int              { @@:(this.room) }
            get_deaths(): int            { @@:(this.deaths) }
            get_revive_prompt(): string    { @@:("") }
            get_revive_response(): string  { @@:("") }
            get_permadeath_msg(): string   {
                @@:("Okay, if you're so smart, do it yourself! I'm leaving!")
            }
        }

    domain:
        room: int = 1
        inventory: list = []
        deaths: int = 0
        START_ROOM: int = 1
        MAX_RESURRECTIONS: int = 3
}


@@system DarknessGate {

    interface:
        try_handle(event: Dictionary): Dictionary

        warned_room(): int
        set_warned_room(room: int)
        clear_warning()

    machine:

        $Active {
            try_handle(event: Dictionary): Dictionary {
                let dark = (("is_dark" in event) ? event["is_dark"] : false)
                let verb = (("verb" in event) ? event["verb"] : "")
                if (dark && verb == "read") {
                    this.consumed_count = this.consumed_count + 1
                    @@:return({
                        "verdict": "consume",
                        "event": event,
                        "message": "What's the matter, can't you read? Now you'd best start over.",
                    })
                }
                if (dark && (verb == "look" || verb == "examine")) {
                    this.consumed_count = this.consumed_count + 1
                    @@:return({
                        "verdict": "consume",
                        "event": event,
                        "message": "It is now pitch dark. If you proceed you will likely fall into a pit.",
                    })
                }
                @@:({"verdict": "pass", "event": event})
            }

            warned_room(): int             { @@:(this.warned_room_id) }
            set_warned_room(room: int)     { this.warned_room_id = room }
            clear_warning()                { this.warned_room_id = -1 }
        }

    domain:
        consumed_count: int = 0

        warned_room_id: int = -1
}


@@system BackpackLimit {

    interface:
        try_handle(event: Dictionary): Dictionary

    machine:

        $Active {
            try_handle(event: Dictionary): Dictionary {
                let verb = (("verb" in event) ? event["verb"] : "")
                let carrying = (("carrying_count" in event) ? event["carrying_count"] : 0)
                if (verb == "take" && carrying >= this.LIMIT) {
                    this.consumed_count = this.consumed_count + 1
                    @@:return({
                        "verdict": "consume",
                        "event": event,
                        "message": "You can't carry anything more. You'll have to drop something first.",
                    })
                }
                @@:({"verdict": "pass", "event": event})
            }
        }

    domain:
        LIMIT: int = 7
        consumed_count: int = 0
}


@@system MagicWordTeleport {

    interface:
        try_handle(event: Dictionary): Dictionary

    machine:

        $Active {
            try_handle(event: Dictionary): Dictionary {
                let verb = (("verb" in event) ? event["verb"] : "")
                let room = (("room" in event) ? event["room"] : -1)

                if (verb == "xyzzy") {
                    if (room == 3) {
                        @@:return(this._teleport(event, 11))
                    } else if (room == 11) {
                        @@:return(this._teleport(event, 3))
                    }
                }

                if (verb == "plugh") {
                    if (room == 3) {
                        @@:return(this._teleport(event, 33))
                    } else if (room == 33) {
                        @@:return(this._teleport(event, 3))
                    }
                }

                if (verb == "plover") {
                    if (room == 33) {
                        @@:return(this._teleport(event, 100))
                    } else if (room == 100) {
                        @@:return(this._teleport(event, 33))
                    }
                }

                @@:({"verdict": "pass", "event": event})
            }
        }

    actions:

        _teleport(event: Dictionary, dest_room: int): Dictionary {
            this.transforms_count = this.transforms_count + 1
            let transformed = Object.assign({}, event)
            transformed["verb"] = "move"
            transformed["noun"] = String(dest_room)
            transformed["magic_dest"] = dest_room
            return {
                "verdict": "transform",
                "event": transformed,
            }
        }

    domain:
        transforms_count: int = 0
}


@@system Endgame {

    interface:
        treasure_deposited()

        tick()

        detonate()

        panic()

        get_state(): string
        is_closing(): bool
        in_repository(): bool
        is_won(): bool
        is_panicked(): bool
        treasures_count(): int
        closing_timer(): float

        pending_warning_threshold(): int
        clear_pending_warning()

    machine:

        $Active {
            treasure_deposited() {
                this.treasures = this.treasures + 1
                if (this.treasures >= this.TREASURES_TO_TRIGGER) {
                    -> $Closing
                }
            }
            tick()              { }
            detonate()          { }
            panic()             { }
            clear_pending_warning() { }
            get_state(): string         { @@:("active") }
            is_closing(): bool          { @@:(false) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(false) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(0.0) }
            pending_warning_threshold(): int { @@:(0) }
        }

        $Closing {
            $>() {
                this.timer = this.CLOSING_DURATION
            }
            treasure_deposited() {
                this.treasures = this.treasures + 1
            }
            tick() {
                this.timer = this.timer - 1.0
                if (this.timer <= 25.0) {
                    -> $ClosingT25
                }
            }
            detonate() { }
            panic() {
                if (!this.panicked) {
                    this.panicked = true
                    if (this.timer > 15.0) {
                        this.timer = 15.0
                    }
                }
            }
            clear_pending_warning() {
                this.pending_warning = 0
            }
            get_state(): string         { @@:("closing") }
            is_closing(): bool          { @@:(true) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(this.panicked) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(this.timer) }
            pending_warning_threshold(): int { @@:(this.pending_warning) }
        }

        $ClosingT25 {
            $>() {
                this.pending_warning = 25
            }
            treasure_deposited() {
                this.treasures = this.treasures + 1
            }
            tick() {
                this.timer = this.timer - 1.0
                if (this.timer <= 15.0) {
                    -> $ClosingT15
                }
            }
            detonate() { }
            panic() {
                if (!this.panicked) {
                    this.panicked = true
                    if (this.timer > 15.0) {
                        this.timer = 15.0
                    }
                }
            }
            clear_pending_warning() {
                this.pending_warning = 0
            }
            get_state(): string         { @@:("closing") }
            is_closing(): bool          { @@:(true) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(this.panicked) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(this.timer) }
            pending_warning_threshold(): int { @@:(this.pending_warning) }
        }

        $ClosingT15 {
            $>() {
                this.pending_warning = 15
            }
            treasure_deposited() {
                this.treasures = this.treasures + 1
            }
            tick() {
                this.timer = this.timer - 1.0
                if (this.timer <= 5.0) {
                    -> $ClosingT5
                }
            }
            detonate() { }
            panic() {
                if (!this.panicked) {
                    this.panicked = true
                }
            }
            clear_pending_warning() {
                this.pending_warning = 0
            }
            get_state(): string         { @@:("closing") }
            is_closing(): bool          { @@:(true) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(this.panicked) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(this.timer) }
            pending_warning_threshold(): int { @@:(this.pending_warning) }
        }

        $ClosingT5 {
            $>() {
                this.pending_warning = 5
            }
            treasure_deposited() {
                this.treasures = this.treasures + 1
            }
            tick() {
                this.timer = this.timer - 1.0
                if (this.timer <= 0.0) {
                    -> $InRepository
                }
            }
            detonate() { }
            panic() {
                if (!this.panicked) {
                    this.panicked = true
                }
            }
            clear_pending_warning() {
                this.pending_warning = 0
            }
            get_state(): string         { @@:("closing") }
            is_closing(): bool          { @@:(true) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(this.panicked) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(this.timer) }
            pending_warning_threshold(): int { @@:(this.pending_warning) }
        }

        $InRepository {
            detonate() {
                -> $Won
            }
            tick()                  { }
            treasure_deposited()    { }
            panic()                 { }
            clear_pending_warning() { }
            get_state(): string         { @@:("in_repository") }
            is_closing(): bool          { @@:(false) }
            in_repository(): bool       { @@:(true) }
            is_won(): bool              { @@:(false) }
            is_panicked(): bool         { @@:(false) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(0.0) }
            pending_warning_threshold(): int { @@:(0) }
        }

        $Won {
            tick()                  { }
            treasure_deposited()    { }
            detonate()              { }
            panic()                 { }
            clear_pending_warning() { }
            get_state(): string         { @@:("won") }
            is_closing(): bool          { @@:(false) }
            in_repository(): bool       { @@:(false) }
            is_won(): bool              { @@:(true) }
            is_panicked(): bool         { @@:(false) }
            treasures_count(): int      { @@:(this.treasures) }
            closing_timer(): float      { @@:(0.0) }
            pending_warning_threshold(): int { @@:(0) }
        }

    domain:
        TREASURES_TO_TRIGGER: int = 10
        CLOSING_DURATION: float = 30.0

        treasures: int = 0
        timer: float = 0.0
        panicked: bool = false
        pending_warning: int = 0
}


@@system Hint(threshold: int = 5) {

    interface:
        observe(condition_true: bool)

        request_hint(text_if_eligible: string): string

        get_state(): string
        is_eligible(): bool
        is_offered(): bool
        get_streak(): int

        mark_offered()
        has_been_offered(): bool

    machine:

        $Pending {
            observe(condition_true: bool) {
                if (condition_true) {
                    this.streak = this.streak + 1
                    if (this.streak >= this.threshold) {
                        -> $Eligible
                    }
                } else {
                    this.streak = 0
                }
            }
            request_hint(text_if_eligible: string): string {
                @@:("OK")
            }
            mark_offered()                  { this.offered = true }
            get_state(): string     { @@:("pending") }
            is_eligible(): bool     { @@:(false) }
            is_offered(): bool      { @@:(false) }
            get_streak(): int       { @@:(this.streak) }
            has_been_offered(): bool { @@:(this.offered) }
        }

        $Eligible {
            observe(condition_true: bool) {
            }
            request_hint(text_if_eligible: string): string {
                -> $Offered
                @@:(text_if_eligible)
            }
            mark_offered()                  { this.offered = true }
            get_state(): string     { @@:("eligible") }
            is_eligible(): bool     { @@:(true) }
            is_offered(): bool      { @@:(false) }
            get_streak(): int       { @@:(this.streak) }
            has_been_offered(): bool { @@:(this.offered) }
        }

        $Offered {
            observe(condition_true: bool) {}
            request_hint(text_if_eligible: string): string {
                @@:("OK")
            }
            mark_offered()                  { this.offered = true }
            get_state(): string     { @@:("offered") }
            is_eligible(): bool     { @@:(false) }
            is_offered(): bool      { @@:(true) }
            get_streak(): int       { @@:(this.streak) }
            has_been_offered(): bool { @@:(this.offered) }
        }

    domain:
        threshold: int = threshold
        streak: int = 0
        offered: bool = false
}


@@system ScoreLedger {

    interface:
        try_handle(event: Dictionary): Dictionary
        get_score(): int
        commands_seen(): int
        takes_seen(): int

    machine:

        $Active {
            try_handle(event: Dictionary): Dictionary {
                this.commands = this.commands + 1
                let verb = (("verb" in event) ? event["verb"] : "")
                if (verb == "take") {
                    this.takes = this.takes + 1
                    this.score = this.score + 1
                }
                @@:({"verdict": "observe", "event": event})
            }

            get_score(): int      { @@:(this.score) }
            commands_seen(): int  { @@:(this.commands) }
            takes_seen(): int     { @@:(this.takes) }
        }

    domain:
        score: int = 0
        commands: int = 0
        takes: int = 0
}


@@system PromptDispatcher {

    interface:
        offer_quit()
        offer_suspend()
        offer_oyster()
        offer_revive()
        offer_hint(name: string)

        confirm()
        decline()
        cancel()

        is_active(): bool
        current_prompt(): string
        current_hint_name(): string
        accepts_only_yes_no(): bool

    machine:

        $Idle {
            offer_quit()              { -> $AwaitingQuitConfirm }
            offer_suspend()           { -> $AwaitingSuspendConfirm }
            offer_oyster()            { -> $AwaitingOyster }
            offer_revive()            { -> $AwaitingRevive }
            offer_hint(name: string)  {
                this._hint_name = name
                -> $AwaitingHint
            }
            confirm() { }
            decline() { }
            cancel()  { }
            is_active(): bool             { @@:(false) }
            current_prompt(): string      { @@:("") }
            current_hint_name(): string   { @@:("") }
            accepts_only_yes_no(): bool   { @@:(false) }
        }

        $AwaitingQuitConfirm {
            confirm() { -> $Idle }
            decline() { -> $Idle }
            cancel()  { -> $Idle }
            is_active(): bool             { @@:(true) }
            current_prompt(): string      { @@:("quit") }
            current_hint_name(): string   { @@:("") }
            accepts_only_yes_no(): bool   { @@:(false) }
        }

        $AwaitingSuspendConfirm {
            confirm() { -> $Idle }
            decline() { -> $Idle }
            cancel()  { -> $Idle }
            is_active(): bool             { @@:(true) }
            current_prompt(): string      { @@:("suspend") }
            current_hint_name(): string   { @@:("") }
            accepts_only_yes_no(): bool   { @@:(false) }
        }

        $AwaitingOyster {
            confirm() { -> $Idle }
            decline() { -> $Idle }
            cancel()  { -> $Idle }
            is_active(): bool             { @@:(true) }
            current_prompt(): string      { @@:("oyster") }
            current_hint_name(): string   { @@:("") }
            accepts_only_yes_no(): bool   { @@:(false) }
        }

        $AwaitingHint {
            confirm() {
                this._hint_name = ""
                -> $Idle
            }
            decline() {
                this._hint_name = ""
                -> $Idle
            }
            cancel() {
                this._hint_name = ""
                -> $Idle
            }
            is_active(): bool             { @@:(true) }
            current_prompt(): string      { @@:("hint") }
            current_hint_name(): string   { @@:(this._hint_name) }
            accepts_only_yes_no(): bool   { @@:(false) }
        }

        $AwaitingRevive {
            confirm() { -> $Idle }
            decline() { -> $Idle }
            cancel()  { }
            is_active(): bool             { @@:(true) }
            current_prompt(): string      { @@:("revive") }
            current_hint_name(): string   { @@:("") }
            accepts_only_yes_no(): bool   { @@:(true) }
        }

    domain:
        _hint_name: string = ""
}


@@[main]
@@system Adventure {

    operations:
        current_state(): string { @@:(@@:system.state) }

    interface:
        setup_default_aspects()

        do_command(verb: string, noun: string): string

        tick()

        light_lamp()
        extinguish_lamp()
        refresh_lamp()

        get_lamp_state(): string
        get_lamp_message(): string
        is_lit(): bool
        battery_left(): int
        turn_count(): int
        player_room(): int
        player_state(): string
        room_is_dark_now(): bool
        darkness_consumed_count(): int
        dark_warned_room(): int
        set_dark_warned_room(room: int)
        clear_dark_warning()

        lamp_warning_text(): string

        lamp_out_aboveground(): bool

        backpack_blocked_count(): int
        magic_transforms_count(): int
        score(): int
        commands_seen(): int

        get_old_loc(): int
        get_old_loc2(): int
        set_old_loc(loc: int)
        set_old_loc2(loc: int)

        is_brief_mode(): bool
        enable_brief_mode()

        get_look_detail_count(): int
        bump_look_detail()
        reset_look_detail()

        get_iwest_count(): int
        bump_iwest()

        bird_state(): string
        bird_location(): int
        snake_state(): string
        bear_state(): string
        bear_dangerous(): bool
        troll_state(): string
        troll_blocking(): bool
        troll_bridge_collapsed(): bool
        collapse_troll_bridge()

        treasure_score(): int
        visit_score(): int
        hint_penalty(): int
        endgame_score(): int

        wake_dwarves()
        attack_dwarf_in_room(): string
        living_dwarves(): int
        dwarf_threw_axe(): bool
        dwarf_threw_and_missed(): bool
        resolve_dwarf_attack()
        dwarf_count_in_room(): int
        dwarf_attack_count(): int
        dwarf_hit_count(): int
        bump_dwarf_anger()
        get_dwarf_anger(): int
        mark_loaded_from_save()
        is_loaded_from_save(): bool
        dwarf_step_to(idx: int, new_room: int)
        dwarf_room_of(idx: int): int
        dwarf_prev_room_of(idx: int): int
        dwarf_is_seen(idx: int): bool
        dwarf_snap_to_player(idx: int)
        dwarf_unsee(idx: int)
        dwarf_pick_destination(idx: int, candidates: list, forbidden: list): int
        pirate_step_to(new_room: int)
        pirate_room(): int
        pirate_prev_room(): int
        pirate_is_seen(): bool
        pirate_snap_to_player()
        pirate_unsee()
        pirate_pick_destination(candidates: list, forbidden: list): int

        deposit_treasure()
        detonate_marker()
        blast_mastery()
        blast_wrong_way()
        blast_klutz()
        endgame_state(): string
        endgame_closing(): bool
        endgame_won(): bool
        endgame_timer(): float
        endgame_panic()
        endgame_panicked(): bool

        pending_warning_threshold(): int
        clear_pending_warning()

        request_hint(name: string): string
        hint_state(name: string): string
        mark_hint_offered(name: string)
        hint_has_been_offered(name: string): bool

        is_chest_hint_done(): bool
        mark_chest_hint_done()

        is_dwarf_first_encounter_done(): bool
        mark_dwarf_first_encounter_done()

        is_oyster_revealed(): bool
        mark_oyster_revealed()

        dragon_state(): string
        dragon_alive(): bool

        pirate_state(): string
        pirate_try_steal(): bool
        pirate_attempt_steal(): string

        treasures_deposited(): int
        total_score(): int

        bridge_built(): bool
        rod_in_inventory(): bool
        mark_rod_here(): bool
        grate_locked(): bool
        rusty_door_oiled(): bool
        keys_in_inventory(): bool
        vending_loaded(): bool
        plant_is_tall(): bool
        plant_is_huge(): bool
        bottle_in_inventory(): bool
        bottle_has_water(): bool
        plover_squeeze_blocked(): bool

    machine:

        $Playing {

            setup_default_aspects() {
                this.bus.register("darkness", 700)
                this.bus.register("magic",    500)
                this.bus.register("backpack", 400)
                this.bus.register("score",    100)
            }

            do_command(verb: string, noun: string): string {
                let event = {
                    "verb": verb,
                    "noun": noun,
                    "room": this.player.get_room(),
                    "is_dark": this._room_is_dark(this.player.get_room()),
                    "lamp_lit": this.lamp.is_lit(),
                    "carrying_count": this.player.inventory_size(),
                }

                this.bus.begin_dispatch()
                let names = this.bus.ordered_names()
                let i = 0
                let consume_message = ""
                while (i < names.length) {
                    let aname = names[i]
                    let result = this._dispatch_to(aname, event)
                    let verdict = result.verdict
                    if (verdict == "consume") {
                        consume_message = (("message" in result) ? result["message"] : "")
                        i = names.length
                    } else if (verdict == "transform") {
                        event = result.event
                    }
                    i = i + 1
                }
                this.bus.end_dispatch()

                if (consume_message != "") {
                    @@:return(consume_message)
                }

                @@:(this._base_handle(event))
            }

            tick() {
                this._maybe_dwarf_attack(this.player.get_room())
                this.lamp.tick()
                this.endgame.tick()
                if (this.endgame.in_repository() && !this.repository_teleport_done) {
                    this.player.move_to(this.REPOSITORY_ROOM)
                    this.repository_teleport_done = true
                }
                let r = this.player.get_room()
                this.bird_hint.observe(
                    r == this.BIRD_HOME_ROOM && this.bird.get_state() == "free")
                this.snake_hint.observe(
                    r == this.SNAKE_ROOM && this.snake.is_blocking())
                this.cave_hint.observe((r >= 1 && r <= 7) && r != 3)
                this.maze_hint.observe(
                    (r >= 50 && r <= 57) || (r >= 131 && r <= 139))
                this.plover_hint.observe(r == this.PLOVER_ROOM)
                this.witts_hint.observe(r == this.WITTS_END_ROOM)
                if (r >= 14 && r <= 130 && !this.dwarves_auto_woken) {
                    this.deep_cave_turns = this.deep_cave_turns + 1
                    if (this.deep_cave_turns >= this.DWARF_WAKE_THRESHOLD) {
                        this.dwarves_auto_woken = true
                        this.wake_dwarves()
                    }
                }
                this.pirate.treasures_carried(this.player.inventory_size())
                if (!this.rooms_visited.includes(r)) {
                    this.rooms_visited.push(r)
                    this.score_visits = this.score_visits + 1
                    this.real_score = this.real_score + 1
                }
                this.turns = this.turns + 1
            }

            light_lamp()      { this.lamp.light() }
            extinguish_lamp() { this.lamp.extinguish() }
            refresh_lamp()    { this.lamp.refresh() }

            get_lamp_state(): string          { @@:(this.lamp.get_state()) }
            get_lamp_message(): string        { @@:(this.lamp.last_message()) }
            is_lit(): bool                    { @@:(this.lamp.is_lit()) }
            battery_left(): int               { @@:(this.lamp.battery_left()) }
            turn_count(): int                 { @@:(this.turns) }
            player_room(): int                { @@:(this.player.get_room()) }
            player_state(): string            { @@:(this.player.get_state()) }
            room_is_dark_now(): bool          { @@:(this._room_is_dark(this.player.get_room())) }
            darkness_consumed_count(): int    { @@:(this.darkness.consumed_count) }
            dark_warned_room(): int           { @@:(this.darkness.warned_room()) }
            set_dark_warned_room(room: int)   { this.darkness.set_warned_room(room) }
            clear_dark_warning()              { this.darkness.clear_warning() }

            lamp_warning_text(): string {
                let base = this.lamp.last_message()
                if (base == "") {
                    @@:return("")
                }
                if (this.player.carrying(this.BATTERIES_ID)) {
                    this.lamp.refresh()
                    this.batteries_item.consume()
                    this.player.drop(this.BATTERIES_ID)
                    @@:return("Your lamp is getting dim. I'm taking the liberty of replacing the batteries.")
                }
                if (this.batteries_item.get_state() == "consumed") {
                    @@:return("Your lamp is getting dim, and you're out of spare batteries. You'd best start wrapping this up.")
                }
                if (this.vending.is_loaded()) {
                    @@:return(base)
                }
                @@:("Your lamp is getting dim. You'd best go back for those batteries.")
            }

            lamp_out_aboveground(): bool {
                @@:(this.lamp.get_state() == "out" && this.player.get_room() <= 8)
            }
            backpack_blocked_count(): int     { @@:(this.backpack.consumed_count) }
            magic_transforms_count(): int     { @@:(this.magic.transforms_count) }
            score(): int                      { @@:(this.real_score) }
            treasure_score(): int             { @@:(this.score_treasures) }
            visit_score(): int                { @@:(this.score_visits) }
            hint_penalty(): int               { @@:(this.score_hints) }
            endgame_score(): int              { @@:(this.score_endgame) }
            commands_seen(): int              { @@:(this.score_ledger.commands_seen()) }

            get_old_loc(): int                { @@:(this.old_loc) }
            get_old_loc2(): int               { @@:(this.old_loc2) }
            set_old_loc(loc: int)             { this.old_loc = loc }
            set_old_loc2(loc: int)            { this.old_loc2 = loc }

            is_brief_mode(): bool             { @@:(this.brief_mode) }
            enable_brief_mode()               { this.brief_mode = true }

            get_look_detail_count(): int      { @@:(this.look_detail_count) }
            bump_look_detail()                { this.look_detail_count = this.look_detail_count + 1 }
            reset_look_detail()               { this.look_detail_count = 0 }

            get_iwest_count(): int            { @@:(this.iwest_count) }
            bump_iwest()                      { this.iwest_count = this.iwest_count + 1 }

            bird_state(): string              { @@:(this.bird.get_state()) }
            bird_location(): int              { @@:(this.bird.get_location()) }
            snake_state(): string             { @@:(this.snake.get_state()) }
            bear_state(): string              { @@:(this.bear.get_state()) }
            bear_dangerous(): bool            { @@:(this.bear.is_dangerous()) }
            troll_state(): string             { @@:(this.troll.get_state()) }
            troll_blocking(): bool            { @@:(this.troll.is_blocking_bridge()) }

            troll_bridge_collapsed(): bool    { @@:(this.troll_bridge_down) }
            collapse_troll_bridge() {
                this.troll_bridge_down = true
            }

            wake_dwarves() {
                this.dwarf1.wake_up(19)
                this.dwarf2.wake_up(33)
                this.dwarf3.wake_up(47)
                this.dwarf4.wake_up(65)
                this.dwarf5.wake_up(118)
                this.pirate.step_to(this.CHEST_ROOM)
            }

            mark_loaded_from_save() {
                this.loaded_from_save = true
            }
            is_loaded_from_save(): bool { @@:(this.loaded_from_save) }

            bump_dwarf_anger() {
                this.dwarf_anger = this.dwarf_anger + 1
            }
            get_dwarf_anger(): int { @@:(this.dwarf_anger) }

            attack_dwarf_in_room(): string {
                let r = this.player.get_room()
                if (this.dwarf1.get_state() == "stalking" && this.dwarf1.get_room() == r) {
                    this.dwarf1.attack()
                    if (this.dwarf1.get_state() == "dead") {
                        this.mark_rod_item.place(r)
                        @@:return("You killed a little dwarf.")
                    }
                    @@:return("You attack a little dwarf, but he dodges out of the way.")
                } else if (this.dwarf2.get_state() == "stalking" && this.dwarf2.get_room() == r) {
                    this.dwarf2.attack()
                    if (this.dwarf2.get_state() == "dead") {
                        this.mark_rod_item.place(r)
                        @@:return("You killed a little dwarf.")
                    }
                    @@:return("You attack a little dwarf, but he dodges out of the way.")
                } else if (this.dwarf3.get_state() == "stalking" && this.dwarf3.get_room() == r) {
                    this.dwarf3.attack()
                    if (this.dwarf3.get_state() == "dead") {
                        this.mark_rod_item.place(r)
                        @@:return("You killed a little dwarf.")
                    }
                    @@:return("You attack a little dwarf, but he dodges out of the way.")
                } else if (this.dwarf4.get_state() == "stalking" && this.dwarf4.get_room() == r) {
                    this.dwarf4.attack()
                    if (this.dwarf4.get_state() == "dead") {
                        this.mark_rod_item.place(r)
                        @@:return("You killed a little dwarf.")
                    }
                    @@:return("You attack a little dwarf, but he dodges out of the way.")
                } else if (this.dwarf5.get_state() == "stalking" && this.dwarf5.get_room() == r) {
                    this.dwarf5.attack()
                    if (this.dwarf5.get_state() == "dead") {
                        this.mark_rod_item.place(r)
                        @@:return("You killed a little dwarf.")
                    }
                    @@:return("You attack a little dwarf, but he dodges out of the way.")
                }
                @@:("Peculiar. Nothing unexpected happens.")
            }

            living_dwarves(): int {
                let n = 0
                if (this.dwarf1.get_state() != "dead") {
                    n = n + 1
                }
                if (this.dwarf2.get_state() != "dead") {
                    n = n + 1
                }
                if (this.dwarf3.get_state() != "dead") {
                    n = n + 1
                }
                if (this.dwarf4.get_state() != "dead") {
                    n = n + 1
                }
                if (this.dwarf5.get_state() != "dead") {
                    n = n + 1
                }
                @@:(n)
            }

            dwarf_threw_axe(): bool {
                let v = this.dwarf_axe_flag
                this.dwarf_axe_flag = false
                @@:(v)
            }
            dwarf_threw_and_missed(): bool {
                let v = this.dwarf_axe_miss_flag
                this.dwarf_axe_miss_flag = false
                @@:(v)
            }
            resolve_dwarf_attack() {
                this._maybe_dwarf_attack(this.player.get_room())
            }
            dwarf_count_in_room(): int {
                let v = this.dwarf_total_in_room
                this.dwarf_total_in_room = 0
                @@:(v)
            }
            dwarf_attack_count(): int {
                let v = this.dwarf_attack_total
                this.dwarf_attack_total = 0
                @@:(v)
            }
            dwarf_hit_count(): int {
                let v = this.dwarf_hit_total
                this.dwarf_hit_total = 0
                @@:(v)
            }
            dwarf_step_to(idx: int, new_room: int) {
                if (idx == 1) { this.dwarf1.step_to(new_room) }
                else if (idx == 2) { this.dwarf2.step_to(new_room) }
                else if (idx == 3) { this.dwarf3.step_to(new_room) }
                else if (idx == 4) { this.dwarf4.step_to(new_room) }
                else if (idx == 5) { this.dwarf5.step_to(new_room) }
            }
            dwarf_snap_to_player(idx: int) {
                let r = this.player.get_room()
                if (idx == 1) { this.dwarf1.snap_to_player(r) }
                else if (idx == 2) { this.dwarf2.snap_to_player(r) }
                else if (idx == 3) { this.dwarf3.snap_to_player(r) }
                else if (idx == 4) { this.dwarf4.snap_to_player(r) }
                else if (idx == 5) { this.dwarf5.snap_to_player(r) }
            }
            dwarf_unsee(idx: int) {
                if (idx == 1) { this.dwarf1.mark_unseen() }
                else if (idx == 2) { this.dwarf2.mark_unseen() }
                else if (idx == 3) { this.dwarf3.mark_unseen() }
                else if (idx == 4) { this.dwarf4.mark_unseen() }
                else if (idx == 5) { this.dwarf5.mark_unseen() }
            }
            dwarf_room_of(idx: int): int {
                if (idx == 1) { @@:return(this.dwarf1.get_room()) }
                else if (idx == 2) { @@:return(this.dwarf2.get_room()) }
                else if (idx == 3) { @@:return(this.dwarf3.get_room()) }
                else if (idx == 4) { @@:return(this.dwarf4.get_room()) }
                else if (idx == 5) { @@:return(this.dwarf5.get_room()) }
                @@:(-1)
            }
            dwarf_prev_room_of(idx: int): int {
                if (idx == 1) { @@:return(this.dwarf1.get_prev_room()) }
                else if (idx == 2) { @@:return(this.dwarf2.get_prev_room()) }
                else if (idx == 3) { @@:return(this.dwarf3.get_prev_room()) }
                else if (idx == 4) { @@:return(this.dwarf4.get_prev_room()) }
                else if (idx == 5) { @@:return(this.dwarf5.get_prev_room()) }
                @@:(-1)
            }
            dwarf_is_seen(idx: int): bool {
                if (idx == 1) { @@:return(this.dwarf1.is_seen()) }
                else if (idx == 2) { @@:return(this.dwarf2.is_seen()) }
                else if (idx == 3) { @@:return(this.dwarf3.is_seen()) }
                else if (idx == 4) { @@:return(this.dwarf4.is_seen()) }
                else if (idx == 5) { @@:return(this.dwarf5.is_seen()) }
                @@:(false)
            }
            dwarf_pick_destination(idx: int, candidates: list, forbidden: list): int {
                if (idx == 1) { @@:return(this.dwarf1.pick_destination(candidates, forbidden)) }
                else if (idx == 2) { @@:return(this.dwarf2.pick_destination(candidates, forbidden)) }
                else if (idx == 3) { @@:return(this.dwarf3.pick_destination(candidates, forbidden)) }
                else if (idx == 4) { @@:return(this.dwarf4.pick_destination(candidates, forbidden)) }
                else if (idx == 5) { @@:return(this.dwarf5.pick_destination(candidates, forbidden)) }
                @@:(-1)
            }
            pirate_step_to(new_room: int) {
                this.pirate.step_to(new_room)
            }
            pirate_snap_to_player() {
                this.pirate.snap_to_player(this.player.get_room())
            }
            pirate_unsee() {
                this.pirate.mark_unseen()
            }
            pirate_room(): int      { @@:(this.pirate.get_room()) }
            pirate_prev_room(): int { @@:(this.pirate.get_prev_room()) }
            pirate_is_seen(): bool  { @@:(this.pirate.is_seen()) }
            pirate_pick_destination(candidates: list, forbidden: list): int {
                @@:(this.pirate.pick_destination(candidates, forbidden))
            }

            deposit_treasure() {
                this.endgame.treasure_deposited()
            }
            detonate_marker() {
                if (this.endgame.in_repository() && !this.endgame.is_won()) {
                    this.score_endgame = this.score_endgame + 50
                    this.real_score = this.real_score + 50
                }
                this.endgame.detonate()
            }
            blast_mastery() {
                if (this.endgame.in_repository() && !this.endgame.is_won()) {
                    this.score_endgame = this.score_endgame + 45
                    this.real_score = this.real_score + 45
                    this.endgame.detonate()
                }
            }
            blast_wrong_way() {
                if (this.endgame.in_repository() && !this.endgame.is_won()) {
                    this.score_endgame = this.score_endgame + 30
                    this.real_score = this.real_score + 30
                    this.endgame.detonate()
                }
            }
            blast_klutz() {
                if (this.endgame.in_repository() && !this.endgame.is_won()) {
                    this.score_endgame = this.score_endgame + 25
                    this.real_score = this.real_score + 25
                    this.endgame.detonate()
                }
            }
            endgame_state(): string   { @@:(this.endgame.get_state()) }
            endgame_closing(): bool   { @@:(this.endgame.is_closing()) }
            endgame_won(): bool       { @@:(this.endgame.is_won()) }
            endgame_timer(): float    { @@:(this.endgame.closing_timer()) }
            endgame_panic()           { this.endgame.panic() }
            endgame_panicked(): bool  { @@:(this.endgame.is_panicked()) }
            pending_warning_threshold(): int { @@:(this.endgame.pending_warning_threshold()) }
            clear_pending_warning()   { this.endgame.clear_pending_warning() }

            request_hint(name: string): string {
                let was_eligible = false
                let cost = 0
                if (name == "bird") {
                    was_eligible = this.bird_hint.is_eligible()
                    cost = 2
                } else if (name == "cave") {
                    was_eligible = this.cave_hint.is_eligible()
                    cost = 2
                } else if (name == "snake") {
                    was_eligible = this.snake_hint.is_eligible()
                    cost = 2
                } else if (name == "maze") {
                    was_eligible = this.maze_hint.is_eligible()
                    cost = 4
                } else if (name == "plover") {
                    was_eligible = this.plover_hint.is_eligible()
                    cost = 5
                } else if (name == "witts") {
                    was_eligible = this.witts_hint.is_eligible()
                    cost = 3
                }
                let response = "No hint by that name."
                if (name == "bird") {
                    response = this.bird_hint.request_hint(
                        "The bird is frightened right now and you cannot catch it no matter what you try. Perhaps you might try later.")
                } else if (name == "cave") {
                    response = this.cave_hint.request_hint(
                        "The grate is very solid and has a hardened steel lock. You cannot enter without a key, and there are no keys nearby. I would recommend looking elsewhere for the keys.")
                } else if (name == "snake") {
                    response = this.snake_hint.request_hint(
                        "You can't kill the snake, or drive it away, or avoid it, or anything like that. There is a way to get by, but you don't have the necessary resources right now.")
                } else if (name == "maze") {
                    response = this.maze_hint.request_hint(
                        "You can make the passages look less alike by dropping things.")
                } else if (name == "plover") {
                    response = this.plover_hint.request_hint(
                        "There is a way to explore that region without having to worry about falling into a pit. None of the objects available is immediately useful in discovering the secret.")
                } else if (name == "witts") {
                    response = this.witts_hint.request_hint(
                        "Don't go west.")
                }
                if (was_eligible) {
                    this.score_hints = this.score_hints - cost
                    this.real_score = this.real_score - cost
                }
                @@:(response)
            }

            hint_state(name: string): string {
                if (name == "bird") {
                    @@:return(this.bird_hint.get_state())
                } else if (name == "cave") {
                    @@:return(this.cave_hint.get_state())
                } else if (name == "snake") {
                    @@:return(this.snake_hint.get_state())
                } else if (name == "maze") {
                    @@:return(this.maze_hint.get_state())
                } else if (name == "plover") {
                    @@:return(this.plover_hint.get_state())
                } else if (name == "witts") {
                    @@:return(this.witts_hint.get_state())
                }
                @@:("unknown")
            }

            mark_hint_offered(name: string) {
                if (name == "bird") {
                    this.bird_hint.mark_offered()
                } else if (name == "cave") {
                    this.cave_hint.mark_offered()
                } else if (name == "snake") {
                    this.snake_hint.mark_offered()
                } else if (name == "maze") {
                    this.maze_hint.mark_offered()
                } else if (name == "plover") {
                    this.plover_hint.mark_offered()
                } else if (name == "witts") {
                    this.witts_hint.mark_offered()
                }
            }

            hint_has_been_offered(name: string): bool {
                if (name == "bird") {
                    @@:return(this.bird_hint.has_been_offered())
                } else if (name == "cave") {
                    @@:return(this.cave_hint.has_been_offered())
                } else if (name == "snake") {
                    @@:return(this.snake_hint.has_been_offered())
                } else if (name == "maze") {
                    @@:return(this.maze_hint.has_been_offered())
                } else if (name == "plover") {
                    @@:return(this.plover_hint.has_been_offered())
                } else if (name == "witts") {
                    @@:return(this.witts_hint.has_been_offered())
                }
                @@:(false)
            }

            is_chest_hint_done(): bool { @@:(this.chest_hint_done) }
            mark_chest_hint_done()     { this.chest_hint_done = true }

            is_dwarf_first_encounter_done(): bool { @@:(this.dwarf_first_encounter_done) }
            mark_dwarf_first_encounter_done()     { this.dwarf_first_encounter_done = true }

            is_oyster_revealed(): bool { @@:(this.oyster_revealed) }
            mark_oyster_revealed()     { this.oyster_revealed = true }

            dragon_state(): string  { @@:(this.dragon.get_state()) }
            dragon_alive(): bool    { @@:(this.dragon.is_alive()) }
            pirate_state(): string  { @@:(this.pirate.get_state()) }
            pirate_try_steal(): bool { @@:(this.pirate.try_steal()) }

            pirate_attempt_steal(): string {
                if (!this.pirate.try_steal()) {
                    @@:return("")
                }
                this.chest.reappear(this.CHEST_ROOM)
                if (this.player.carrying(this.GOLD_ID)) {
                    this.player.drop(this.GOLD_ID)
                    this.gold.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.SILVER_ID)) {
                    this.player.drop(this.SILVER_ID)
                    this.silver.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.DIAMONDS_ID)) {
                    this.player.drop(this.DIAMONDS_ID)
                    this.diamonds.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.JEWELRY_ID)) {
                    this.player.drop(this.JEWELRY_ID)
                    this.jewelry.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.PEARL_ID)) {
                    this.player.drop(this.PEARL_ID)
                    this.pearl.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.VASE_ID)) {
                    this.player.drop(this.VASE_ID)
                    this.vase.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.EGGS_ID)) {
                    this.player.drop(this.EGGS_ID)
                    this.eggs.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.TRIDENT_ID)) {
                    this.player.drop(this.TRIDENT_ID)
                    this.trident.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.EMERALD_ID)) {
                    this.player.drop(this.EMERALD_ID)
                    this.emerald.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.SPICES_ID)) {
                    this.player.drop(this.SPICES_ID)
                    this.spices.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.PYRAMID_ID)) {
                    this.player.drop(this.PYRAMID_ID)
                    this.pyramid.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.RUG_ID)) {
                    this.player.drop(this.RUG_ID)
                    this.rug.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                if (this.player.carrying(this.COINS_ID)) {
                    this.player.drop(this.COINS_ID)
                    this.coins.reappear(this.CHEST_ROOM)
                    @@:return("Out from the shadows behind you pounces a bearded pirate! \"Har, har,\" he chortles, \"I'll just take all this booty and hide it away with me chest deep in the maze!\" He snatches your treasure and vanishes into the gloom.")
                }
                @@:("There are faint rustling noises from the darkness behind you.")
            }

            bridge_built(): bool       { @@:(this.crystal_bridge.is_built()) }
            rod_in_inventory(): bool   { @@:(this.rod_item.is_carried()) }
            mark_rod_here(): bool      { @@:(this.mark_rod_item.is_carried() || this.mark_rod_item.is_in_room(this.player.get_room())) }
            grate_locked(): bool       { @@:(this.grate.is_locked()) }
            rusty_door_oiled(): bool   { @@:(!this.rusty_door.is_rusty()) }
            keys_in_inventory(): bool  { @@:(this.keys_item.is_carried()) }
            vending_loaded(): bool     { @@:(this.vending.is_loaded()) }
            plant_is_tall(): bool      { @@:(this.plant.is_tall()) }
            plant_is_huge(): bool      { @@:(this.plant.is_huge()) }
            bottle_in_inventory(): bool { @@:(this.bottle_item.is_carried()) }
            bottle_has_water(): bool   { @@:(this.bottle.has_water()) }

            plover_squeeze_blocked(): bool {
                let size = this.player.inventory_size()
                if (size == 0) {
                    @@:return(false)
                }
                if (size == 1 && this.player.carrying(this.EMERALD_ID)) {
                    @@:return(false)
                }
                @@:(true)
            }

            treasures_deposited(): int {
                let n = 0
                if (this.gold.is_deposited()) {      n = n + 1 }
                if (this.silver.is_deposited()) {    n = n + 1 }
                if (this.diamonds.is_deposited()) {  n = n + 1 }
                if (this.jewelry.is_deposited()) {   n = n + 1 }
                if (this.pearl.is_deposited()) {     n = n + 1 }
                if (this.vase.is_deposited()) {      n = n + 1 }
                if (this.eggs.is_deposited()) {      n = n + 1 }
                if (this.trident.is_deposited()) {   n = n + 1 }
                if (this.emerald.is_deposited()) {   n = n + 1 }
                if (this.spices.is_deposited()) {    n = n + 1 }
                if (this.chest.is_deposited()) {     n = n + 1 }
                if (this.pyramid.is_deposited()) {   n = n + 1 }
                if (this.rug.is_deposited()) {       n = n + 1 }
                if (this.coins.is_deposited()) {     n = n + 1 }
                if (this.chain.is_deposited()) {     n = n + 1 }
                @@:(n)
            }

            total_score(): int {
                let s = 0
                if (this.gold.is_deposited()) {      s = s + this.gold.get_value() }
                if (this.silver.is_deposited()) {    s = s + this.silver.get_value() }
                if (this.diamonds.is_deposited()) {  s = s + this.diamonds.get_value() }
                if (this.jewelry.is_deposited()) {   s = s + this.jewelry.get_value() }
                if (this.pearl.is_deposited()) {     s = s + this.pearl.get_value() }
                if (this.vase.is_deposited()) {      s = s + this.vase.get_value() }
                if (this.eggs.is_deposited()) {      s = s + this.eggs.get_value() }
                if (this.trident.is_deposited()) {   s = s + this.trident.get_value() }
                if (this.emerald.is_deposited()) {   s = s + this.emerald.get_value() }
                if (this.spices.is_deposited()) {    s = s + this.spices.get_value() }
                if (this.chest.is_deposited()) {     s = s + this.chest.get_value() }
                if (this.pyramid.is_deposited()) {   s = s + this.pyramid.get_value() }
                if (this.rug.is_deposited()) {       s = s + this.rug.get_value() }
                if (this.coins.is_deposited()) {     s = s + this.coins.get_value() }
                if (this.chain.is_deposited()) {     s = s + this.chain.get_value() }
                @@:(s)
            }
        }

    actions:

        _maybe_dwarf_attack(room: int) {
            let dtotal = 0
            let attack = 0
            let stick = 0
            if (this.dwarf1.get_state() == "stalking" && this.dwarf1.get_room() == room) {
                dtotal = dtotal + 1
                if (this.dwarf1.get_prev_room() == room) {
                    attack = attack + 1
                    if (!this.player.carrying(this.AXE_ID)) {
                        this.axe_item.place(room)
                    }
                    if (this.dwarf1.try_throw_axe(this.dwarf_anger)) {
                        stick = stick + 1
                    }
                }
            }
            if (this.dwarf2.get_state() == "stalking" && this.dwarf2.get_room() == room) {
                dtotal = dtotal + 1
                if (this.dwarf2.get_prev_room() == room) {
                    attack = attack + 1
                    if (!this.player.carrying(this.AXE_ID)) {
                        this.axe_item.place(room)
                    }
                    if (this.dwarf2.try_throw_axe(this.dwarf_anger)) {
                        stick = stick + 1
                    }
                }
            }
            if (this.dwarf3.get_state() == "stalking" && this.dwarf3.get_room() == room) {
                dtotal = dtotal + 1
                if (this.dwarf3.get_prev_room() == room) {
                    attack = attack + 1
                    if (!this.player.carrying(this.AXE_ID)) {
                        this.axe_item.place(room)
                    }
                    if (this.dwarf3.try_throw_axe(this.dwarf_anger)) {
                        stick = stick + 1
                    }
                }
            }
            if (this.dwarf4.get_state() == "stalking" && this.dwarf4.get_room() == room) {
                dtotal = dtotal + 1
                if (this.dwarf4.get_prev_room() == room) {
                    attack = attack + 1
                    if (!this.player.carrying(this.AXE_ID)) {
                        this.axe_item.place(room)
                    }
                    if (this.dwarf4.try_throw_axe(this.dwarf_anger)) {
                        stick = stick + 1
                    }
                }
            }
            if (this.dwarf5.get_state() == "stalking" && this.dwarf5.get_room() == room) {
                dtotal = dtotal + 1
                if (this.dwarf5.get_prev_room() == room) {
                    attack = attack + 1
                    if (!this.player.carrying(this.AXE_ID)) {
                        this.axe_item.place(room)
                    }
                    if (this.dwarf5.try_throw_axe(this.dwarf_anger)) {
                        stick = stick + 1
                    }
                }
            }
            this.dwarf_total_in_room = dtotal
            this.dwarf_attack_total = attack
            this.dwarf_hit_total = stick
            if (attack > 0 && this.loaded_from_save && this.dwarf_anger < 20) {
                this.dwarf_anger = 20
            }
            if (stick > 0) {
                this.dwarf_axe_flag = true
                this.player.die()
            } else if (attack > 0) {
                this.dwarf_axe_miss_flag = true
            }
        }

        _dispatch_to(name: string, event: Dictionary): Dictionary {
            if (name == "darkness") {
                return this.darkness.try_handle(event)
            } else if (name == "backpack") {
                return this.backpack.try_handle(event)
            } else if (name == "magic") {
                return this.magic.try_handle(event)
            } else if (name == "score") {
                return this.score_ledger.try_handle(event)
            }
            return {"verdict": "pass", "event": event}
        }

        _base_handle(event: Dictionary): string {
            let verb = event.verb
            let noun = event.noun
            if (verb == "look") {
                return this._verb_look()
            } else if (verb == "light") {
                if (noun != "" && noun != "lamp" && noun != "lantern") {
                    return "You have no source of light."
                }
                this.lamp.light()
                if (this.lamp.get_state() == "out") {
                    return "Your lamp has run out of power."
                }
                return "Your lamp is now on."
            } else if (verb == "extinguish") {
                this.lamp.extinguish()
                return "Your lamp is now off."
            } else if (verb == "move") {
                return this._verb_move(noun)
            } else if (verb == "take") {
                return this._verb_take(noun)
            } else if (verb == "drop") {
                return this._verb_drop(noun)
            } else if (verb == "release") {
                return this._verb_release(noun)
            } else if (verb == "feed") {
                return this._verb_feed(noun)
            } else if (verb == "attack") {
                return this._verb_attack(noun)
            } else if (verb == "yes") {
                return this._verb_yes()
            } else if (verb == "no") {
                return this._verb_no()
            } else if (verb == "examine") {
                return this._verb_examine(noun)
            } else if (verb == "read") {
                return this._verb_read(noun)
            } else if (verb == "throw") {
                return this._verb_throw(noun)
            } else if (verb == "wave") {
                return this._verb_wave(noun)
            } else if (verb == "unlock" || verb == "open") {
                if (noun == "clam" || noun == "oyster") {
                    return this._verb_break(noun)
                }
                return this._verb_unlock(noun)
            } else if (verb == "break") {
                return this._verb_break(noun)
            } else if (verb == "lock") {
                return this._verb_lock(noun)
            } else if (verb == "insert" || verb == "use") {
                return this._verb_insert(noun)
            } else if (verb == "fill") {
                return this._verb_fill(noun)
            } else if (verb == "pour") {
                return this._verb_pour(noun)
            } else if (verb == "water") {
                return this._verb_water(noun)
            } else if (verb == "drink") {
                return this._verb_drink(noun)
            } else if (verb == "eat") {
                return this._verb_eat(noun)
            } else if (verb == "fee" || verb == "fie" || verb == "foe" || verb == "foo") {
                return this._verb_chant(verb)
            } else if (verb == "xyzzy" || verb == "plugh" || verb == "plover") {
                return "Good try, but that is an old worn-out magic word."
            } else if (verb == "stop") {
                return "I don't know the word \"stop\". Use \"quit\" if you want to give up."
            } else if (verb == "dig") {
                return "Digging without a shovel is quite impractical. Even with a shovel progress is unlikely."
            } else if (verb == "noop") {
                return ""
            }
            return "I don't know how to '" + verb + "'."
        }

        _verb_look(): string {
            let r = this.player.get_room()
            let base = "I daresay whatever you want is around here somewhere."
            if (r == 1) {
                base = "YOU ARE STANDING AT THE END OF A ROAD BEFORE A SMALL BRICK BUILDING. AROUND YOU IS A FOREST.  A SMALL STREAM FLOWS OUT OF THE BUILDING AND DOWN A GULLY."
            } else if (r == 2) {
                base = "YOU HAVE WALKED UP A HILL, STILL IN THE FOREST.  THE ROAD SLOPES BACK DOWN THE OTHER SIDE OF THE HILL.  THERE IS A BUILDING IN THE DISTANCE."
            } else if (r == 3) {
                base = "YOU ARE INSIDE A BUILDING, A WELL HOUSE FOR A LARGE SPRING."
            } else if (r == 4) {
                base = "YOU ARE IN A VALLEY IN THE FOREST BESIDE A STREAM TUMBLING ALONG A ROCKY BED."
            } else if (r == 5) {
                base = "YOU ARE IN OPEN FOREST, WITH A DEEP VALLEY TO ONE SIDE."
            } else if (r == 6) {
                base = "YOU ARE IN OPEN FOREST NEAR BOTH A VALLEY AND A ROAD."
            } else if (r == 7) {
                base = "AT YOUR FEET ALL THE WATER OF THE STREAM SPLASHES INTO A 2-INCH SLIT IN THE ROCK.  DOWNSTREAM THE STREAMBED IS BARE ROCK."
            } else if (r == 8) {
                base = "YOU ARE IN A 20-FOOT DEPRESSION FLOORED WITH BARE DIRT.  SET INTO THE DIRT IS A STRONG STEEL GRATE MOUNTED IN CONCRETE.  A DRY STREAMBED LEADS INTO THE DEPRESSION."
            } else if (r == 9) {
                base = "YOU ARE IN A SMALL CHAMBER BENEATH A 3X3 STEEL GRATE TO THE SURFACE. A LOW CRAWL OVER COBBLES LEADS INWARD TO THE WEST."
            } else if (r == 11) {
                base = "YOU ARE IN A DEBRIS ROOM FILLED WITH STUFF WASHED IN FROM THE SURFACE. A LOW WIDE PASSAGE WITH COBBLES BECOMES PLUGGED WITH MUD AND DEBRIS HERE, BUT AN AWKWARD CANYON LEADS UPWARD AND WEST.  A NOTE ON THE WALL SAYS \"MAGIC WORD XYZZY\"."
            } else if (r == 12) {
                base = "YOU ARE IN AN AWKWARD SLOPING EAST/WEST CANYON."
            } else if (r == 33) {
                base = "YOU ARE IN A LARGE ROOM, WITH A PASSAGE TO THE SOUTH, A PASSAGE TO THE WEST, AND A WALL OF BROKEN ROCK TO THE EAST.  THERE IS A LARGE \"Y2\" ON A ROCK IN THE ROOM'S CENTER."
            } else if (r == 13) {
                base = "YOU ARE IN A SPLENDID CHAMBER THIRTY FEET HIGH.  THE WALLS ARE FROZEN RIVERS OF ORANGE STONE.  AN AWKWARD CANYON AND A GOOD PASSAGE EXIT FROM EAST AND WEST SIDES OF THE CHAMBER."
            } else if (r == 100) {
                base = "YOU'RE IN A SMALL CHAMBER LIT BY AN EERIE GREEN LIGHT.  AN EXTREMELY NARROW TUNNEL EXITS TO THE WEST.  A DARK CORRIDOR LEADS NE."
            } else if (r == 47) {
                base = "DEAD END"
            } else if (r == 71) {
                base = "YOU ARE IN A SECRET CANYON AT A JUNCTION OF THREE CANYONS, BEARING NORTH, SOUTH, AND SE.  THE NORTH ONE IS AS TALL AS THE OTHER TWO COMBINED."
            } else if (r == 65) {
                base = "YOU ARE IN BEDQUILT, A LONG EAST/WEST PASSAGE WITH HOLES EVERYWHERE. TO EXPLORE AT RANDOM SELECT NORTH, SOUTH, UP, OR DOWN."
            } else if (r == 130) {
                base = "YOU ARE INSIDE A BARREN ROOM.  THE CENTER OF THE ROOM IS COMPLETELY EMPTY EXCEPT FOR SOME DUST.  MARKS IN THE DUST LEAD AWAY TOWARD THE FAR END OF THE ROOM.  THE ONLY EXIT IS THE WAY YOU CAME IN."
            } else if (r == 103) {
                base = "YOU'RE IN A LARGE ROOM CARVED OUT OF SEDIMENTARY ROCK.  THE FLOOR AND WALLS ARE LITTERED WITH BITS OF SHELLS IMBEDDED IN THE STONE.  A SHALLOW PASSAGE PROCEEDS DOWNWARD, AND A SOMEWHAT STEEPER ONE LEADS UP.  A LOW HANDS AND KNEES PASSAGE ENTERS FROM THE SOUTH."
            } else if (r == 117) {
                base = "YOU ARE ON ONE SIDE OF A LARGE, DEEP CHASM.  A HEAVY WHITE MIST RISING UP FROM BELOW OBSCURES ALL VIEW OF THE FAR SIDE.  A SW PATH LEADS AWAY FROM THE CHASM INTO A WINDING CORRIDOR."
            } else if (r == 118) {
                base = "YOU ARE IN A LONG WINDING CORRIDOR SLOPING OUT OF SIGHT IN BOTH DIRECTIONS."
            } else if (r == 10) {
                base = "YOU ARE CRAWLING OVER COBBLES IN A LOW PASSAGE.  THERE IS A DIM LIGHT AT THE EAST END OF THE PASSAGE."
            } else if (r == 120) {
                base = "YOU ARE IN A SECRET CANYON WHICH EXITS TO THE NORTH AND EAST."
            } else if (r == 97) {
                base = "THIS IS THE ORIENTAL ROOM.  ANCIENT ORIENTAL CAVE DRAWINGS COVER THE WALLS.  A GENTLY SLOPING PASSAGE LEADS UPWARD TO THE NORTH, ANOTHER PASSAGE LEADS SE, AND A HANDS AND KNEES CRAWL LEADS WEST."
            } else if (r == 28) {
                base = "YOU ARE IN A LOW N/S PASSAGE AT A HOLE IN THE FLOOR.  THE HOLE GOES DOWN TO AN E/W PASSAGE."
            } else if (r == 92) {
                base = "YOU ARE IN THE GIANT ROOM.  THE CEILING HERE IS TOO HIGH UP FOR YOUR LAMP TO SHOW IT.  CAVERNOUS PASSAGES LEAD EAST, NORTH, AND SOUTH.  ON THE WEST WALL IS SCRAWLED THE INSCRIPTION, \"FEE FIE FOE FOO\" [SIC]."
            } else if (r == 95) {
                base = "YOU ARE IN A MAGNIFICENT CAVERN WITH A RUSHING STREAM, WHICH CASCADES OVER A SPARKLING WATERFALL INTO A ROARING WHIRLPOOL WHICH DISAPPEARS THROUGH A HOLE IN THE FLOOR.  PASSAGES EXIT TO THE SOUTH AND WEST."
            } else if (r == 131) {
                base = "YOU ARE IN A MAZE OF TWISTING LITTLE PASSAGES, ALL DIFFERENT."
            } else if (r == 40) {
                base = "YOU HAVE CRAWLED THROUGH A VERY LOW WIDE PASSAGE PARALLEL TO AND NORTH OF THE HALL OF MISTS."
            } else if (r == 132) {
                base = "YOU ARE IN A LITTLE MAZE OF TWISTY PASSAGES, ALL DIFFERENT."
            } else if (r == 133) {
                base = "YOU ARE IN A TWISTING MAZE OF LITTLE PASSAGES, ALL DIFFERENT."
            } else if (r == 134) {
                base = "YOU ARE IN A TWISTING LITTLE MAZE OF PASSAGES, ALL DIFFERENT."
            } else if (r == 135) {
                base = "YOU ARE IN A TWISTY LITTLE MAZE OF PASSAGES, ALL DIFFERENT."
            } else if (r == 136) {
                base = "YOU ARE IN A TWISTY MAZE OF LITTLE PASSAGES, ALL DIFFERENT."
            } else if (r == 137) {
                base = "YOU ARE IN A LITTLE TWISTY MAZE OF PASSAGES, ALL DIFFERENT."
            } else if (r == 138) {
                base = "YOU ARE IN A MAZE OF LITTLE TWISTING PASSAGES, ALL DIFFERENT."
            } else if (r == 139) {
                base = "YOU ARE IN A MAZE OF LITTLE TWISTY PASSAGES, ALL DIFFERENT."
            } else if (r == 14) {
                base = "AT YOUR FEET IS A SMALL PIT BREATHING TRACES OF WHITE MIST.  AN EAST PASSAGE ENDS HERE EXCEPT FOR A SMALL CRACK LEADING ON."
            } else if (r == 15) {
                base = "YOU ARE AT ONE END OF A VAST HALL STRETCHING FORWARD OUT OF SIGHT TO THE WEST.  THERE ARE OPENINGS TO EITHER SIDE.  NEARBY, A WIDE STONE STAIRCASE LEADS DOWNWARD.  THE HALL IS FILLED WITH WISPS OF WHITE MIST SWAYING TO AND FRO ALMOST AS IF ALIVE.  A COLD WIND BLOWS UP THE STAIRCASE.  THERE IS A PASSAGE AT THE TOP OF A DOME BEHIND YOU."
            } else if (r == 16) {
                base = "THE CRACK IS FAR TOO SMALL FOR YOU TO FOLLOW."
            } else if (r == 18) {
                base = "THIS IS A LOW ROOM WITH A CRUDE NOTE ON THE WALL.  THE NOTE SAYS, \"YOU WON'T GET IT UP THE STEPS\"."
            } else if (r == 27) {
                base = "YOU ARE ON THE WEST SIDE OF THE FISSURE IN THE HALL OF MISTS."
            } else if (r == 19) {
                base = "YOU ARE IN THE HALL OF THE MOUNTAIN KING, WITH PASSAGES OFF IN ALL DIRECTIONS."
            } else if (r == 20) {
                base = "YOU ARE AT THE BOTTOM OF THE PIT WITH A BROKEN NECK."
            } else if (r == 21) {
                base = "YOU DIDN'T MAKE IT."
            } else if (r == 22) {
                base = "THE DOME IS UNCLIMBABLE."
            } else if (r == 25) {
                base = "YOU ARE AT THE BOTTOM OF THE WESTERN PIT IN THE TWOPIT ROOM.  THERE IS A LARGE HOLE IN THE WALL ABOUT 25 FEET ABOVE YOU."
                let ps = this.plant.get_state()
                if (ps == "tiny") {
                    base = base + "  THERE IS A TINY LITTLE PLANT IN THE PIT, MURMURING \"WATER, WATER, ...\""
                } else if (ps == "tall") {
                    base = base + "  THERE IS A 12-FOOT-TALL BEANSTALK STRETCHING UP OUT OF THE PIT, BELLOWING \"WATER!!  WATER!!\""
                } else {
                    base = base + "  THERE IS A GIGANTIC BEANSTALK STRETCHING ALL THE WAY UP TO THE HOLE."
                }
            } else if (r == 24) {
                base = "YOU ARE AT THE BOTTOM OF THE EASTERN PIT IN THE TWOPIT ROOM.  THERE IS A SMALL POOL OF OIL IN ONE CORNER OF THE PIT."
            } else if (r == 23) {
                base = "YOU ARE AT THE WEST END OF THE TWOPIT ROOM.  THERE IS A LARGE HOLE IN THE WALL ABOVE THE PIT AT THIS END OF THE ROOM."
            } else if (r == 26) {
                base = "YOU CLAMBER UP THE PLANT AND SCURRY THROUGH THE HOLE AT THE TOP."
            } else if (r == 29) {
                base = "YOU ARE IN THE SOUTH SIDE CHAMBER."
            } else if (r == 30) {
                base = "YOU ARE IN THE WEST SIDE CHAMBER OF THE HALL OF THE MOUNTAIN KING. A PASSAGE CONTINUES WEST AND UP HERE."
            } else if (r == 31) {
                base = "PIT"
            } else if (r == 32) {
                base = "YOU CAN'T GET BY THE SNAKE."
            } else if (r == 34) {
                base = "YOU ARE IN A JUMBLE OF ROCK, WITH CRACKS EVERYWHERE."
            } else if (r == 35) {
                base = "YOU'RE AT A LOW WINDOW OVERLOOKING A HUGE PIT, WHICH EXTENDS UP OUT OF SIGHT.  A FLOOR IS INDISTINCTLY VISIBLE OVER 50 FEET BELOW.  TRACES OF WHITE MIST COVER THE FLOOR OF THE PIT, BECOMING THICKER TO THE RIGHT. MARKS IN THE DUST AROUND THE WINDOW WOULD SEEM TO INDICATE THAT SOMEONE HAS BEEN HERE RECENTLY.  DIRECTLY ACROSS THE PIT FROM YOU AND 25 FEET AWAY THERE IS A SIMILAR WINDOW LOOKING INTO A LIGHTED ROOM.  A SHADOWY FIGURE CAN BE SEEN THERE PEERING BACK AT YOU."
            } else if (r == 36) {
                base = "YOU ARE IN A DIRTY BROKEN PASSAGE.  TO THE EAST IS A CRAWL.  TO THE WEST IS A LARGE PASSAGE.  ABOVE YOU IS A HOLE TO ANOTHER PASSAGE."
            } else if (r == 37) {
                base = "YOU ARE ON THE BRINK OF A SMALL CLEAN CLIMBABLE PIT.  A CRAWL LEADS WEST."
            } else if (r == 38) {
                base = "YOU ARE IN THE BOTTOM OF A SMALL PIT WITH A LITTLE STREAM, WHICH ENTERS AND EXITS THROUGH TINY SLITS."
            } else if (r == 41) {
                base = "YOU ARE AT THE WEST END OF HALL OF MISTS.  A LOW WIDE CRAWL CONTINUES WEST AND ANOTHER GOES NORTH.  TO THE SOUTH IS A LITTLE PASSAGE 6 FEET OFF THE FLOOR."
            } else if (r == 70) {
                base = "YOU ARE IN A SECRET N/S CANYON ABOVE A SIZABLE PASSAGE."
            } else if (r == 39) {
                base = "YOU ARE IN A LARGE ROOM FULL OF DUSTY ROCKS.  THERE IS A BIG HOLE IN THE FLOOR.  THERE ARE CRACKS EVERYWHERE, AND A PASSAGE LEADING EAST."
            } else if (r == 101) {
                base = "YOU'RE IN THE DARK-ROOM.  A CORRIDOR LEADING SOUTH IS THE ONLY EXIT."
            } else if (r == 43) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 44) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 45) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 46) {
                base = "DEAD END"
            } else if (r == 48) {
                base = "DEAD END"
            } else if (r == 49) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 50) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 51) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 52) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 53) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 54) {
                base = "DEAD END"
            } else if (r == 55) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 56) {
                base = "DEAD END"
            } else if (r == 57) {
                base = "YOU ARE ON THE BRINK OF A THIRTY FOOT PIT WITH A MASSIVE ORANGE COLUMN DOWN ONE WALL.  YOU COULD CLIMB DOWN HERE BUT YOU COULD NOT GET BACK UP.  THE MAZE CONTINUES AT THIS LEVEL."
            } else if (r == 58) {
                base = "DEAD END"
            } else if (r == 59) {
                base = "YOU HAVE CRAWLED THROUGH A VERY LOW WIDE PASSAGE PARALLEL TO AND NORTH OF THE HALL OF MISTS."
            } else if (r == 60) {
                base = "YOU ARE AT THE EAST END OF A VERY LONG HALL APPARENTLY WITHOUT SIDE CHAMBERS.  TO THE EAST A LOW WIDE CRAWL SLANTS UP.  TO THE NORTH A ROUND TWO FOOT HOLE SLANTS DOWN."
            } else if (r == 61) {
                base = "YOU ARE AT THE WEST END OF A VERY LONG FEATURELESS HALL.  THE HALL JOINS UP WITH A NARROW NORTH/SOUTH PASSAGE."
            } else if (r == 62) {
                base = "YOU ARE AT A CROSSOVER OF A HIGH N/S PASSAGE AND A LOW E/W ONE."
            } else if (r == 63) {
                base = "DEAD END"
            } else if (r == 64) {
                base = "YOU ARE AT A COMPLEX JUNCTION.  A LOW HANDS AND KNEES PASSAGE FROM THE NORTH JOINS A HIGHER CRAWL FROM THE EAST TO MAKE A WALKING PASSAGE GOING WEST.  THERE IS ALSO A LARGE ROOM ABOVE.  THE AIR IS DAMP HERE."
            } else if (r == 66) {
                base = "YOU ARE IN A ROOM WHOSE WALLS RESEMBLE SWISS CHEESE.  OBVIOUS PASSAGES GO WEST, EAST, NE, AND NW.  PART OF THE ROOM IS OCCUPIED BY A LARGE BEDROCK BLOCK."
            } else if (r == 67) {
                base = "YOU ARE AT THE EAST END OF THE TWOPIT ROOM.  THE FLOOR HERE IS LITTERED WITH THIN ROCK SLABS, WHICH MAKE IT EASY TO DESCEND THE PITS. THERE IS A PATH HERE BYPASSING THE PITS TO CONNECT PASSAGES FROM EAST AND WEST.  THERE ARE HOLES ALL OVER, BUT THE ONLY BIG ONE IS ON THE WALL DIRECTLY OVER THE WEST PIT WHERE YOU CAN'T GET TO IT."
            } else if (r == 68) {
                base = "YOU ARE IN A LARGE LOW CIRCULAR CHAMBER WHOSE FLOOR IS AN IMMENSE SLAB FALLEN FROM THE CEILING (SLAB ROOM).  EAST AND WEST THERE ONCE WERE LARGE PASSAGES, BUT THEY ARE NOW FILLED WITH BOULDERS.  LOW SMALL PASSAGES GO NORTH AND SOUTH, AND THE SOUTH ONE QUICKLY BENDS WEST AROUND THE BOULDERS."
            } else if (r == 72) {
                base = "YOU ARE IN A LARGE LOW ROOM.  CRAWLS LEAD NORTH, SE, AND SW."
            } else if (r == 73) {
                base = "DEAD END CRAWL."
            } else if (r == 74) {
                base = "YOU ARE IN A SECRET CANYON WHICH HERE RUNS E/W.  IT CROSSES OVER A VERY TIGHT CANYON 15 FEET BELOW.  IF YOU GO DOWN YOU MAY NOT BE ABLE TO GET BACK UP."
            } else if (r == 75) {
                base = "YOU ARE AT A WIDE PLACE IN A VERY TIGHT N/S CANYON."
            } else if (r == 76) {
                base = "THE CANYON HERE BECOMES TOO TIGHT TO GO FURTHER SOUTH."
            } else if (r == 77) {
                base = "YOU ARE IN A TALL E/W CANYON.  A LOW TIGHT CRAWL GOES 3 FEET NORTH AND SEEMS TO OPEN UP."
            } else if (r == 78) {
                base = "THE CANYON RUNS INTO A MASS OF BOULDERS -- DEAD END."
            } else if (r == 79) {
                base = "THE STREAM FLOWS OUT THROUGH A PAIR OF 1 FOOT DIAMETER SEWER PIPES. IT WOULD BE ADVISABLE TO USE THE EXIT."
            } else if (r == 80) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 81) {
                base = "DEAD END"
            } else if (r == 82) {
                base = "DEAD END"
            } else if (r == 83) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 84) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 85) {
                base = "DEAD END"
            } else if (r == 86) {
                base = "DEAD END"
            } else if (r == 87) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL ALIKE."
            } else if (r == 89) {
                base = "THERE IS NOTHING HERE TO CLIMB.  USE \"UP\" OR \"OUT\" TO LEAVE THE PIT."
            } else if (r == 90) {
                base = "YOU HAVE CLIMBED UP THE PLANT AND OUT OF THE PIT."
            } else if (r == 91) {
                base = "YOU ARE AT THE TOP OF A STEEP INCLINE ABOVE A LARGE ROOM.  YOU COULD CLIMB DOWN HERE, BUT YOU WOULD NOT BE ABLE TO CLIMB UP.  THERE IS A PASSAGE LEADING BACK TO THE NORTH."
            } else if (r == 93) {
                base = "THE PASSAGE HERE IS BLOCKED BY A RECENT CAVE-IN."
            } else if (r == 94) {
                base = "YOU ARE AT ONE END OF AN IMMENSE NORTH/SOUTH PASSAGE."
            } else if (r == 96) {
                base = "YOU ARE IN THE SOFT ROOM.  THE WALLS ARE COVERED WITH HEAVY CURTAINS, THE FLOOR WITH A THICK PILE CARPET.  MOSS COVERS THE CEILING."
            } else if (r == 98) {
                base = "YOU ARE FOLLOWING A WIDE PATH AROUND THE OUTER EDGE OF A LARGE CAVERN. FAR BELOW, THROUGH A HEAVY WHITE MIST, STRANGE SPLASHING NOISES CAN BE HEARD.  THE MIST RISES UP THROUGH A FISSURE IN THE CEILING.  THE PATH EXITS TO THE SOUTH AND WEST."
            } else if (r == 99) {
                base = "YOU ARE IN AN ALCOVE.  A SMALL NW PATH SEEMS TO WIDEN AFTER A SHORT DISTANCE.  AN EXTREMELY TIGHT TUNNEL LEADS EAST.  IT LOOKS LIKE A VERY TIGHT SQUEEZE.  AN EERIE LIGHT CAN BE SEEN AT THE OTHER END."
            } else if (r == 100) {
                base = "YOU'RE IN A SMALL CHAMBER LIT BY AN EERIE GREEN LIGHT.  AN EXTREMELY NARROW TUNNEL EXITS TO THE WEST.  A DARK CORRIDOR LEADS NE."
            } else if (r == 108) {
                base = "YOU ARE AT WITT'S END.  PASSAGES LEAD OFF IN *ALL* DIRECTIONS."
            } else if (r == 115) {
                base = "YOU ARE AT THE NORTHEAST END OF AN IMMENSE ROOM, EVEN LARGER THAN THE GIANT ROOM.  IT APPEARS TO BE A REPOSITORY FOR THE \"ADVENTURE\" PROGRAM.  MASSIVE TORCHES FAR OVERHEAD BATHE THE ROOM WITH SMOKY YELLOW LIGHT.  SCATTERED ABOUT YOU CAN BE SEEN A PILE OF BOTTLES (ALL OF THEM EMPTY), A NURSERY OF YOUNG BEANSTALKS MURMURING QUIETLY, A BED OF OYSTERS, A BUNDLE OF BLACK RODS WITH RUSTY STARS ON THEIR ENDS, AND A COLLECTION OF BRASS LANTERNS.  OFF TO ONE SIDE A GREAT MANY DWARVES ARE SLEEPING ON THE FLOOR, SNORING LOUDLY.  A SIGN NEARBY READS: \"DO NOT DISTURB THE DWARVES!\"  AN IMMENSE MIRROR IS HANGING AGAINST ONE WALL, AND STRETCHES TO THE OTHER END OF THE ROOM, WHERE VARIOUS OTHER SUNDRY OBJECTS CAN BE GLIMPSED DIMLY IN THE DISTANCE."
            } else if (r == 116) {
                base = "YOU ARE AT THE SOUTHWEST END OF THE REPOSITORY.  TO ONE SIDE IS A PIT FULL OF FIERCE GREEN SNAKES.  ON THE OTHER SIDE IS A ROW OF SMALL WICKER CAGES, EACH OF WHICH CONTAINS A LITTLE SULKING BIRD.  IN ONE CORNER IS A BUNDLE OF BLACK RODS WITH RUSTY MARKS ON THEIR ENDS.  A LARGE NUMBER OF VELVET PILLOWS ARE SCATTERED ABOUT ON THE FLOOR.  A VAST MIRROR STRETCHES OFF TO THE NORTHEAST.  AT YOUR FEET IS A LARGE STEEL GRATE, NEXT TO WHICH IS A SIGN WHICH READS, \"TREASURE VAULT. KEYS IN MAIN OFFICE.\""
            } else if (r == 119) {
                base = "YOU ARE IN A SECRET CANYON WHICH EXITS TO THE NORTH AND EAST."
            } else if (r == 121) {
                base = "YOU ARE IN A SECRET CANYON WHICH EXITS TO THE NORTH AND EAST."
            } else if (r == 123) {
                base = "YOU'RE IN A LONG EAST/WEST CORRIDOR.  A FAINT RUMBLING NOISE CAN BE HEARD IN THE DISTANCE."
            } else if (r == 125) {
                base = "THE WALLS ARE QUITE WARM HERE.  FROM THE NORTH CAN BE HEARD A STEADY ROAR, SO LOUD THAT THE ENTIRE CAVE SEEMS TO BE TREMBLING.  ANOTHER PASSAGE LEADS SOUTH, AND A LOW CRAWL GOES EAST."
            } else if (r == 88) {
                base = "YOU ARE IN A LONG, NARROW CORRIDOR STRETCHING OUT OF SIGHT TO THE WEST.  AT THE EASTERN END IS A HOLE THROUGH WHICH YOU CAN SEE A PROFUSION OF LEAVES."
            } else if (r == 140) {
                base = "You are in a small chamber containing a battered vending machine with a hand-lettered sign: 'BATTERIES — 25 CENTS — IT WORKS NO REFUNDS'."
                if (this.vending.is_loaded()) {
                    base = base + " A coin slot gleams faintly. (Try INSERT COINS.)"
                } else {
                    base = base + " A second hand-lettered sign over the slot now reads: 'OUT OF BATTERIES'."
                }
            } else if (r == 101) {
                base = "YOU'RE IN THE DARK-ROOM.  A CORRIDOR LEADING SOUTH IS THE ONLY EXIT."
            } else if (r == 102) {
                base = "YOU ARE IN AN ARCHED HALL.  A CORAL PASSAGE ONCE CONTINUED UP AND EAST FROM HERE, BUT IS NOW BLOCKED BY DEBRIS.  THE AIR SMELLS OF SEA WATER."
            } else if (r == 103) {
                base = "YOU'RE IN A LARGE ROOM CARVED OUT OF SEDIMENTARY ROCK.  THE FLOOR AND WALLS ARE LITTERED WITH BITS OF SHELLS IMBEDDED IN THE STONE.  A SHALLOW PASSAGE PROCEEDS DOWNWARD, AND A SOMEWHAT STEEPER ONE LEADS UP.  A LOW HANDS AND KNEES PASSAGE ENTERS FROM THE SOUTH."
            } else if (r == 109) {
                base = "YOU ARE IN A NORTH/SOUTH CANYON ABOUT 25 FEET ACROSS.  THE FLOOR IS COVERED BY WHITE MIST SEEPING IN FROM THE NORTH.  THE WALLS EXTEND UPWARD FOR WELL OVER 100 FEET.  SUSPENDED FROM SOME UNSEEN POINT FAR ABOVE YOU, AN ENORMOUS TWO-SIDED MIRROR IS HANGING PARALLEL TO AND MIDWAY BETWEEN THE CANYON WALLS.  (THE MIRROR IS OBVIOUSLY PROVIDED FOR THE USE OF THE DWARVES, WHO AS YOU KNOW, ARE EXTREMELY VAIN.)  A SMALL WINDOW CAN BE SEEN IN EITHER WALL, SOME FIFTY FEET UP."
            } else if (r == 113) {
                base = "YOU ARE AT THE EDGE OF A LARGE UNDERGROUND RESERVOIR.  AN OPAQUE CLOUD OF WHITE MIST FILLS THE ROOM AND RISES RAPIDLY UPWARD.  THE LAKE IS FED BY A STREAM, WHICH TUMBLES OUT OF A HOLE IN THE WALL ABOUT 10 FEET OVERHEAD AND SPLASHES NOISILY INTO THE WATER SOMEWHERE WITHIN THE MIST.  THE ONLY PASSAGE GOES BACK TOWARD THE SOUTH."
            } else if (r == 122) {
                base = "YOU ARE ON THE FAR SIDE OF THE CHASM.  A NE PATH LEADS AWAY FROM THE CHASM ON THIS SIDE."
            } else if (r == 124) {
                base = "THE PATH FORKS HERE.  THE LEFT FORK LEADS NORTHEAST.  A DULL RUMBLING SEEMS TO GET LOUDER IN THAT DIRECTION.  THE RIGHT FORK LEADS SOUTHEAST DOWN A GENTLE SLOPE.  THE MAIN CORRIDOR ENTERS FROM THE WEST."
            } else if (r == 126) {
                base = "YOU ARE ON THE EDGE OF A BREATH-TAKING VIEW.  FAR BELOW YOU IS AN ACTIVE VOLCANO, FROM WHICH GREAT GOUTS OF MOLTEN LAVA COME SURGING OUT, CASCADING BACK DOWN INTO THE DEPTHS.  THE GLOWING ROCK FILLS THE FARTHEST REACHES OF THE CAVERN WITH A BLOOD-RED GLARE, GIVING EVERY- THING AN EERIE, MACABRE APPEARANCE.  THE AIR IS FILLED WITH FLICKERING SPARKS OF ASH AND A HEAVY SMELL OF BRIMSTONE.  THE WALLS ARE HOT TO THE TOUCH, AND THE THUNDERING OF THE VOLCANO DROWNS OUT ALL OTHER SOUNDS.  EMBEDDED IN THE JAGGED ROOF FAR OVERHEAD ARE MYRIAD TWISTED FORMATIONS COMPOSED OF PURE WHITE ALABASTER, WHICH SCATTER THE MURKY LIGHT INTO SINISTER APPARITIONS UPON THE WALLS.  TO ONE SIDE IS A DEEP GORGE, FILLED WITH A BIZARRE CHAOS OF TORTURED ROCK WHICH SEEMS TO HAVE BEEN CRAFTED BY THE DEVIL HIMSELF.  AN IMMENSE RIVER OF FIRE CRASHES OUT FROM THE DEPTHS OF THE VOLCANO, BURNS ITS WAY THROUGH THE GORGE, AND PLUMMETS INTO A BOTTOMLESS PIT FAR OFF TO YOUR LEFT.  TO THE RIGHT, AN IMMENSE GEYSER OF BLISTERING STEAM ERUPTS CONTINUOUSLY FROM A BARREN ISLAND IN THE CENTER OF A SULFUROUS LAKE, WHICH BUBBLES OMINOUSLY.  THE FAR RIGHT WALL IS AFLAME WITH AN INCANDESCENCE OF ITS OWN, WHICH LENDS AN ADDITIONAL INFERNAL SPLENDOR TO THE ALREADY HELLISH SCENE.  A DARK, FOREBODING PASSAGE EXITS TO THE SOUTH."
            } else if (r == 104) {
                base = "YOU ARE IN A LONG SLOPING CORRIDOR WITH RAGGED SHARP WALLS."
            } else if (r == 105) {
                base = "YOU ARE IN A CUL-DE-SAC ABOUT EIGHT FEET ACROSS."
            } else if (r == 106) {
                base = "YOU ARE IN AN ANTEROOM LEADING TO A LARGE PASSAGE TO THE EAST.  SMALL PASSAGES GO WEST AND UP.  THE REMNANTS OF RECENT DIGGING ARE EVIDENT. A SIGN IN MIDAIR HERE SAYS \"CAVE UNDER CONSTRUCTION BEYOND THIS POINT. PROCEED AT OWN RISK.  [WITT CONSTRUCTION COMPANY]\""
            } else if (r == 107) {
                base = "YOU ARE IN A MAZE OF TWISTY LITTLE PASSAGES, ALL DIFFERENT."
            } else if (r == 110) {
                base = "YOU'RE AT A LOW WINDOW OVERLOOKING A HUGE PIT, WHICH EXTENDS UP OUT OF SIGHT.  A FLOOR IS INDISTINCTLY VISIBLE OVER 50 FEET BELOW.  TRACES OF WHITE MIST COVER THE FLOOR OF THE PIT, BECOMING THICKER TO THE LEFT. MARKS IN THE DUST AROUND THE WINDOW WOULD SEEM TO INDICATE THAT SOMEONE HAS BEEN HERE RECENTLY.  DIRECTLY ACROSS THE PIT FROM YOU AND 25 FEET AWAY THERE IS A SIMILAR WINDOW LOOKING INTO A LIGHTED ROOM.  A SHADOWY FIGURE CAN BE SEEN THERE PEERING BACK AT YOU."
            } else if (r == 111) {
                base = "A LARGE STALACTITE EXTENDS FROM THE ROOF AND ALMOST REACHES THE FLOOR BELOW.  YOU COULD CLIMB DOWN IT, AND JUMP FROM IT TO THE FLOOR, BUT HAVING DONE SO YOU WOULD BE UNABLE TO REACH IT TO CLIMB BACK UP."
            } else if (r == 112) {
                base = "YOU ARE IN A LITTLE MAZE OF TWISTING PASSAGES, ALL DIFFERENT."
            } else if (r == 114) {
                base = "DEAD END"
            } else if (r == 127) {
                base = "YOU ARE IN A SMALL CHAMBER FILLED WITH LARGE BOULDERS.  THE WALLS ARE VERY WARM, CAUSING THE AIR IN THE ROOM TO BE ALMOST STIFLING FROM THE HEAT.  THE ONLY EXIT IS A CRAWL HEADING WEST, THROUGH WHICH IS COMING A LOW RUMBLING."
            } else if (r == 128) {
                base = "YOU ARE WALKING ALONG A GENTLY SLOPING NORTH/SOUTH PASSAGE LINED WITH ODDLY SHAPED LIMESTONE FORMATIONS."
            } else if (r == 129) {
                base = "YOU ARE STANDING AT THE ENTRANCE TO A LARGE, BARREN ROOM.  A SIGN POSTED ABOVE THE ENTRANCE READS:  \"CAUTION!  BEAR IN ROOM!\""
            } else if (r == 17) {
                base = "YOU ARE ON THE EAST BANK OF A FISSURE SLICING CLEAR ACROSS THE HALL. THE MIST IS QUITE THICK HERE, AND THE FISSURE IS TOO WIDE TO JUMP."
                if (this.crystal_bridge.is_built()) {
                    base = base + " A glittering crystal bridge spans the fissure."
                }
            } else if (r == 69) {
                base = "YOU ARE IN A SECRET N/S CANYON ABOVE A LARGE ROOM."
            }
            if (r == this.bird.get_location() && this.bird.get_state() == "free") {
                base = base + " A cheerful little bird is sitting here singing."
            }
            if (r == this.SNAKE_ROOM && this.snake.is_blocking()) {
                base = base + " A huge green fierce snake bars the way!"
            }
            if (r == this.BEAR_HOME_ROOM) {
                let bs = this.bear.get_state()
                if (bs == "hungry") {
                    base = base + " There is a ferocious cave bear eying you from the far end of the room!"
                } else if (bs == "tame") {
                    base = base + " There is a gentle cave bear sitting placidly in one corner."
                }
            }
            if (r == this.TROLL_ROOM && this.troll.is_blocking_bridge()) {
                base = base + " A burly troll stands by the bridge and insists you throw him a treasure before you may cross."
            } else if (r == this.TROLL_ROOM && this.bear.get_state() == "released") {
                base = base + " There is a contented-looking bear wandering about nearby."
            }
            if (r == this.DRAGON_ROOM && this.dragon.is_alive()) {
                base = base + " A huge green fierce dragon bars the way!"
            }
            if (this.gold.get_location() == r && this.gold.get_state() == "in_room") {
                base = base + " There is a large sparkling nugget of gold here!"
            }
            if (this.silver.get_location() == r && this.silver.get_state() == "in_room") {
                base = base + " There are bars of silver here!"
            }
            if (this.diamonds.get_location() == r && this.diamonds.get_state() == "in_room") {
                base = base + " There are diamonds here!"
            }
            if (this.jewelry.get_location() == r && this.jewelry.get_state() == "in_room") {
                base = base + " There is precious jewelry here!"
            }
            if (this.pearl.get_location() == r && this.pearl.get_state() == "in_room") {
                base = base + " Off to one side lies a glistening pearl!"
            }
            if (this.vase.get_location() == r && this.vase.get_state() == "in_room") {
                base = base + " There is a delicate, precious, Ming vase here!"
            }
            if (this.eggs.get_location() == r && this.eggs.get_state() == "in_room") {
                base = base + " There is a large nest here, full of golden eggs!"
            }
            if (this.trident.get_location() == r && this.trident.get_state() == "in_room") {
                base = base + " There is a jewel-encrusted trident here!"
            }
            if (this.emerald.get_location() == r && this.emerald.get_state() == "in_room") {
                base = base + " There is an emerald here the size of a plover's egg!"
            }
            if (this.spices.get_location() == r && this.spices.get_state() == "in_room") {
                base = base + " There are rare spices here!"
            }
            if (this.chest.get_location() == r && this.chest.get_state() == "in_room") {
                base = base + " The pirate's treasure chest is here!"
            }
            if (this.pyramid.get_location() == r && this.pyramid.get_state() == "in_room") {
                base = base + " There is a platinum pyramid here, 8 inches on a side!"
            }
            if (this.rug.get_location() == r && this.rug.get_state() == "in_room" && !this.dragon.is_alive()) {
                base = base + " There is a Persian rug spread out on the floor!"
            }
            if (this.coins.get_location() == r && this.coins.get_state() == "in_room") {
                base = base + " There are many coins here!"
            }
            if (this.rod_item.is_in_room(r)) {
                base = base + " A three foot black rod with a rusty star on an end lies nearby."
            }
            if (this.keys_item.is_in_room(r)) {
                base = base + " There are some keys on the ground here."
            }
            if (this.lamp_item.is_in_room(r)) {
                base = base + " There is a shiny brass lamp nearby."
            }
            if (this.bottle_item.is_in_room(r)) {
                if (this.bottle.has_water()) {
                    base = base + " There is a bottle of water here."
                } else {
                    base = base + " There is an empty bottle here."
                }
            }
            if (this.cage_item.is_in_room(r)) {
                base = base + " There is a small wicker cage discarded nearby."
            }
            if (this.food_item.is_in_room(r)) {
                base = base + " There is food here."
            }
            if (this.pillow_item.is_in_room(r)) {
                base = base + " A small velvet pillow lies on the floor."
            }
            if (this.axe_item.is_in_room(r)) {
                base = base + " There is a little axe here."
            }
            if (this.clam_item.is_in_room(r)) {
                base = base + " There is an enormous clam here with its shell tightly closed."
            }
            if (this.oyster_item.is_in_room(r)) {
                base = base + " There is an enormous oyster here with its shell tightly closed."
            }
            if (this.batteries_item.is_in_room(r)) {
                base = base + " A fresh set of lamp batteries lies in the dispenser tray."
            }
            if (this.magazine_item.is_in_room(r)) {
                base = base + " There are a few recent issues of \"Spelunker Today\" magazine here."
            }
            if (this.mark_rod_item.is_in_room(r)) {
                base = base + " A three foot black rod with a rusty mark on an end lies nearby."
            }
            if (r == this.GRATE_ROOM) {
                if (this.grate.is_locked()) {
                    base = base + " The grate is locked."
                } else {
                    base = base + " The grate is open."
                }
            }
            return base
        }

        _verb_take(noun: string): string {
            if (noun == "bird") {
                if (this.bird.get_state() != "free") {
                    return "You can't be serious!"
                }
                if (this.player.get_room() != this.bird.get_location()) {
                    return "You can't be serious!"
                }
                if (this.rod_item.is_carried()) {
                    return "The bird was unafraid when you entered, but as you approach it becomes disturbed and you cannot catch it."
                }
                if (!this.cage_item.is_carried()) {
                    return "You can catch the bird, but you cannot carry it."
                }
                this.bird.capture()
                this.player.take(this.BIRD_ID)
                return "OK"
            }
            if (noun == "plant" || noun == "beanstalk") {
                return "The plant has exceptionally deep roots and cannot be pulled free."
            }
            if (noun == "bear") {
                if (this.player.get_room() == this.BEAR_HOME_ROOM && this.bear.get_state() != "released") {
                    return "The bear is still chained to the wall."
                }
                return "You can't be serious!"
            }
            if (noun == "rod") {
                if (this.rod_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.rod_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.ROD_ID)
                return "OK"
            }
            if (noun == "keys" || noun == "key") {
                if (this.keys_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.keys_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.KEYS_ID)
                return "OK"
            }
            if (noun == "lamp" || noun == "lantern") {
                if (this.lamp_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.lamp_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.LAMP_ID)
                return "OK"
            }
            if (noun == "bottle") {
                if (this.bottle_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.bottle_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.BOTTLE_ID)
                return "OK"
            }
            if (noun == "cage") {
                if (this.cage_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.cage_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.CAGE_ID)
                return "OK"
            }
            if (noun == "food") {
                if (this.food_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.food_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.FOOD_ID)
                return "OK"
            }
            if (noun == "pillow" || noun == "velvet") {
                if (this.pillow_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.pillow_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.PILLOW_ID)
                return "OK"
            }
            if (noun == "axe") {
                if (this.axe_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.axe_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.AXE_ID)
                return "OK"
            }
            if (noun == "clam") {
                if (this.clam_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.clam_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.CLAM_ID)
                return "OK"
            }
            if (noun == "oyster") {
                if (this.oyster_item.is_in_room(this.player.get_room())) {
                    return "You can't be serious — that oyster weighs a ton."
                }
                return "You can't be serious!"
            }
            if (noun == "batteries" || noun == "battery") {
                if (this.batteries_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.batteries_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.BATTERIES_ID)
                return "OK"
            }
            if (noun == "magazine") {
                if (this.magazine_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.magazine_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.MAGAZINE_ID)
                return "OK"
            }
            if (noun == "mark" || noun == "mark-rod" || noun == "stick") {
                if (this.mark_rod_item.is_carried()) {
                    return "You are already carrying it!"
                }
                if (!this.mark_rod_item.try_take(this.player.get_room())) {
                    return "You can't be serious!"
                }
                this.player.take(this.MARK_ROD_ID)
                return "OK"
            }
            if (noun == "chain") {
                let room = this.player.get_room()
                if (room == this.BEAR_HOME_ROOM) {
                    let bs = this.bear.get_state()
                    if (bs == "hungry") {
                        this.bear.take_chain()
                        this.player.die()
                        return "With a roar the bear lunges at you. You should have fed it first. You have been killed."
                    } else if (bs == "tame") {
                        this.bear.take_chain()
                        this.chain.try_take(room)
                        this.player.take(this.CHAIN_ID)
                        return "OK"
                    }
                }
                if (this.chain.try_take(room)) {
                    this.player.take(this.CHAIN_ID)
                    return "OK"
                }
                return "You can't be serious!"
            }
            return this._take_treasure_by_name(noun)
        }

        _verb_drop(noun: string): string {
            if (noun == "rod") {
                if (!this.rod_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.rod_item.try_drop(this.player.get_room())
                this.player.drop(this.ROD_ID)
                return "OK"
            }
            if (noun == "keys" || noun == "key") {
                if (!this.keys_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.keys_item.try_drop(this.player.get_room())
                this.player.drop(this.KEYS_ID)
                return "OK"
            }
            if (noun == "lamp" || noun == "lantern") {
                if (!this.lamp_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.lamp_item.try_drop(this.player.get_room())
                this.player.drop(this.LAMP_ID)
                return "OK"
            }
            if (noun == "bottle") {
                if (!this.bottle_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.bottle_item.try_drop(this.player.get_room())
                this.player.drop(this.BOTTLE_ID)
                return "OK"
            }
            if (noun == "cage") {
                if (!this.cage_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                if (this.player.carrying(this.BIRD_ID)) {
                    return "(Releasing the bird first — see RELEASE BIRD.)"
                }
                this.cage_item.try_drop(this.player.get_room())
                this.player.drop(this.CAGE_ID)
                return "OK"
            }
            if (noun == "food") {
                if (!this.food_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.food_item.try_drop(this.player.get_room())
                this.player.drop(this.FOOD_ID)
                return "OK"
            }
            if (noun == "pillow" || noun == "velvet") {
                if (!this.pillow_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.pillow_item.try_drop(this.player.get_room())
                this.player.drop(this.PILLOW_ID)
                return "OK"
            }
            if (noun == "axe") {
                if (!this.axe_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.axe_item.try_drop(this.player.get_room())
                this.player.drop(this.AXE_ID)
                return "OK"
            }
            if (noun == "clam") {
                if (!this.clam_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.clam_item.try_drop(this.player.get_room())
                this.player.drop(this.CLAM_ID)
                return "OK"
            }
            if (noun == "batteries" || noun == "battery") {
                if (!this.batteries_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.batteries_item.try_drop(this.player.get_room())
                this.player.drop(this.BATTERIES_ID)
                return "OK"
            }
            if (noun == "magazine") {
                if (!this.magazine_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                let here = this.player.get_room()
                this.magazine_item.try_drop(here)
                this.player.drop(this.MAGAZINE_ID)
                if (here == this.WITTS_END_ROOM && this.witts_end_bonus == 0) {
                    this.witts_end_bonus = 1
                    this.real_score = this.real_score + 1
                    return "Dropped — and what a fitting place to leave it."
                }
                return "OK"
            }
            if (noun == "mark" || noun == "mark-rod" || noun == "stick") {
                if (!this.mark_rod_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.mark_rod_item.try_drop(this.player.get_room())
                this.player.drop(this.MARK_ROD_ID)
                return "OK"
            }
            if (noun == "chain") {
                let room = this.player.get_room()
                if (this.bear.get_state() == "following") {
                    this.bear.drop_chain()
                    this.player.drop(this.CHAIN_ID)
                    let outcome_b = this.chain.try_drop(room)
                    if (room == this.TROLL_ROOM && this.troll.is_blocking_bridge()) {
                        this.troll.scared_off()
                        return "The bear lumbers toward the troll, who lets out a startled shriek and scurries away. The bear soon gives up the pursuit and wanders back."
                    }
                    if (outcome_b == "deposited") {
                        this.endgame.treasure_deposited()
                        this.score_treasures = this.score_treasures + this.chain.get_value()
                        this.real_score = this.real_score + this.chain.get_value()
                        return "OK"
                    }
                    return "OK"
                }
                if (this.chain.get_state() != "carried") {
                    return "You aren't carrying it!"
                }
                let outcome = this.chain.try_drop(room)
                this.player.drop(this.CHAIN_ID)
                if (outcome == "deposited") {
                    this.endgame.treasure_deposited()
                    this.score_treasures = this.score_treasures + this.chain.get_value()
                    this.real_score = this.real_score + this.chain.get_value()
                    return "OK"
                }
                return "OK"
            }
            return this._drop_treasure_by_name(noun)
        }

        _take_treasure_by_name(name: string): string {
            let room = this.player.get_room()
            if (name == "gold") {
                if (this.gold.try_take(room)) {
                    this.player.take(this.GOLD_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "silver") {
                if (this.silver.try_take(room)) {
                    this.player.take(this.SILVER_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "diamonds") {
                if (this.diamonds.try_take(room)) {
                    this.player.take(this.DIAMONDS_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "jewelry") {
                if (this.jewelry.try_take(room)) {
                    this.player.take(this.JEWELRY_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "pearl") {
                if (this.pearl.try_take(room)) {
                    this.player.take(this.PEARL_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "vase") {
                if (this.vase.try_take(room)) {
                    this.player.take(this.VASE_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "eggs") {
                if (this.eggs.try_take(room)) {
                    this.player.take(this.EGGS_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "trident") {
                if (this.trident.try_take(room)) {
                    this.player.take(this.TRIDENT_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "emerald") {
                if (this.emerald.try_take(room)) {
                    this.player.take(this.EMERALD_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "spices") {
                if (this.spices.try_take(room)) {
                    this.player.take(this.SPICES_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "chest") {
                if (this.chest.try_take(room)) {
                    this.player.take(this.CHEST_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "pyramid") {
                if (this.pyramid.try_take(room)) {
                    this.player.take(this.PYRAMID_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "rug") {
                if (this.dragon.is_alive() && room == this.DRAGON_ROOM) {
                    return "It is beyond your power to do that."
                }
                if (this.rug.try_take(room)) {
                    this.player.take(this.RUG_ID)
                    return "OK"
                }
                return "You can't be serious!"
            } else if (name == "coins") {
                if (this.coins.try_take(room)) {
                    this.player.take(this.COINS_ID)
                    return "OK"
                }
                return "You can't be serious!"
            }
            return "I don't know how to apply that word here."
        }

        _drop_treasure_by_name(name: string): string {
            let room = this.player.get_room()
            let outcome = ""
            let item_id = -1
            let value = 0
            if (name == "gold") {
                outcome = this.gold.try_drop(room)
                item_id = this.GOLD_ID
                value = this.gold.get_value()
            } else if (name == "silver") {
                outcome = this.silver.try_drop(room)
                item_id = this.SILVER_ID
                value = this.silver.get_value()
            } else if (name == "diamonds") {
                outcome = this.diamonds.try_drop(room)
                item_id = this.DIAMONDS_ID
                value = this.diamonds.get_value()
            } else if (name == "jewelry") {
                outcome = this.jewelry.try_drop(room)
                item_id = this.JEWELRY_ID
                value = this.jewelry.get_value()
            } else if (name == "pearl") {
                outcome = this.pearl.try_drop(room)
                item_id = this.PEARL_ID
                value = this.pearl.get_value()
            } else if (name == "vase") {
                let pillow_here = this.pillow_item.is_in_room(room)
                if (pillow_here) {
                    outcome = this.vase.try_drop_soft(room)
                } else {
                    outcome = this.vase.try_drop(room)
                }
                item_id = this.VASE_ID
                value = this.vase.get_value()
            } else if (name == "eggs") {
                outcome = this.eggs.try_drop(room)
                item_id = this.EGGS_ID
                value = this.eggs.get_value()
            } else if (name == "trident") {
                outcome = this.trident.try_drop(room)
                item_id = this.TRIDENT_ID
                value = this.trident.get_value()
            } else if (name == "emerald") {
                outcome = this.emerald.try_drop(room)
                item_id = this.EMERALD_ID
                value = this.emerald.get_value()
            } else if (name == "spices") {
                outcome = this.spices.try_drop(room)
                item_id = this.SPICES_ID
                value = this.spices.get_value()
            } else if (name == "chest") {
                outcome = this.chest.try_drop(room)
                item_id = this.CHEST_ID
                value = this.chest.get_value()
            } else if (name == "pyramid") {
                outcome = this.pyramid.try_drop(room)
                item_id = this.PYRAMID_ID
                value = this.pyramid.get_value()
            } else if (name == "rug") {
                outcome = this.rug.try_drop(room)
                item_id = this.RUG_ID
                value = this.rug.get_value()
            } else if (name == "coins") {
                outcome = this.coins.try_drop(room)
                item_id = this.COINS_ID
                value = this.coins.get_value()
            } else {
                return "You aren't carrying it!"
            }

            if (outcome == "not carried") {
                return "You aren't carrying it!"
            }
            if (outcome == "already deposited") {
                return "OK"
            }
            this.player.drop(item_id)
            if (outcome == "deposited") {
                this.endgame.treasure_deposited()
                this.score_treasures = this.score_treasures + value
                this.real_score = this.real_score + value
                return "OK"
            }
            if (outcome == "dropped_soft") {
                return "The vase is now resting, delicately, on a velvet pillow."
            }
            if (outcome == "broken") {
                return "You have taken the vase and hurled it delicately to the ground."
            }
            return "OK"
        }

        _verb_feed(noun: string): string {
            if (noun == "dwarf") {
                this.bump_dwarf_anger()
                return "You fool, dwarves eat only coal! Now you've made him *really* mad!!"
            }
            if (noun != "bear") {
                return "I don't know how to feed that."
            }
            if (this.player.get_room() != this.BEAR_HOME_ROOM) {
                return "You can't be serious!"
            }
            if (this.bear.get_state() != "hungry") {
                return "There's nothing here it wants to eat (except perhaps you)."
            }
            if (!this.food_item.is_carried()) {
                return "You aren't carrying it!"
            }
            this.food_item.consume()
            this.player.drop(this.FOOD_ID)
            this.bear.feed()
            return "The bear eagerly wolfs down your food, after which he seems to calm down considerably and even becomes rather friendly."
        }

        _verb_attack(noun: string): string {
            if (noun == "snake") {
                return "Attacking the snake both doesn't work and is very dangerous."
            }
            if (noun == "clam" || noun == "oyster") {
                return "The shell is very strong and is impervious to attack."
            }
            if (noun == "troll") {
                return "Trolls are close relatives with the rocks and have skin as tough as that of a rhinoceros. The troll fends off your blows effortlessly."
            }
            if (noun != "dragon") {
                return "Don't be ridiculous."
            }
            if (this.player.get_room() != this.DRAGON_ROOM) {
                return "There is nothing here to attack."
            }
            if (!this.dragon.is_alive()) {
                return "For crying out loud, the poor thing is already dead!"
            }
            this.dragon.attack()
            return "With what? Your bare hands?"
        }

        _verb_yes(): string {
            if (this.dragon.is_awaiting_confirmation()) {
                this.dragon.yes()
                return "Congratulations! You have just vanquished a dragon with your bare hands! (Unbelievable, isn't it?)"
            }
            return "I don't understand."
        }

        _verb_no(): string {
            if (this.dragon.is_awaiting_confirmation()) {
                this.dragon.no()
                return "OK"
            }
            return "I don't understand."
        }

        _verb_examine(noun: string): string {
            if (noun == "lamp") {
                if (this.lamp.is_lit()) {
                    return "Your brass lantern is currently lit. Battery: " + String(this.lamp.battery_left()) + " turns."
                }
                return "Your brass lantern is dark. Battery: " + String(this.lamp.battery_left()) + " turns."
            } else if (noun == "bird") {
                if (this.bird.get_state() == "dead") {
                    return "The little bird is now dead. Its body disappears."
                }
                if (this.player.carrying(this.BIRD_ID)) {
                    return "There is a little bird in the cage."
                }
                if (this.bird.get_state() == "released") {
                    return "You can't be serious!"
                }
                if (this.player.get_room() != this.bird.get_location()) {
                    return "You can't be serious!"
                }
                return "A cheerful little bird is sitting here singing."
            } else if (noun == "snake") {
                if (this.snake.is_blocking()) {
                    return "A huge green fierce snake bars the way!"
                }
                return "You can't be serious!"
            } else if (noun == "dragon") {
                if (this.dragon.is_alive()) {
                    return "A huge green fierce dragon bars the way!"
                }
                return "The body of a huge green dead dragon is lying off to one side."
            } else if (noun == "bear") {
                let bs = this.bear.get_state()
                if (bs == "hungry") {
                    return "There is a ferocious cave bear eying you from the far end of the room!"
                } else if (bs == "tame") {
                    return "There is a gentle cave bear sitting placidly in one corner."
                } else if (bs == "following") {
                    return "You are being followed by a very large, tame bear."
                } else if (bs == "released") {
                    return "There is a contented-looking bear wandering about nearby."
                }
                return "You can't be serious!"
            } else if (noun == "troll") {
                if (this.troll.is_blocking_bridge()) {
                    return "A burly troll stands by the bridge and insists you throw him a treasure before you may cross."
                }
                return "The troll is nowhere to be seen."
            } else if (noun == "sign") {
                if (this.player.get_room() == 33) {
                    return "The sign reads: 'Y2'."
                }
                return "You can't be serious!"
            }
            return "Peculiar. Nothing unexpected happens."
        }

        _verb_read(noun: string): string {
            if (noun == "sign") {
                if (this.player.get_room() == 33) {
                    return "The sign reads: 'Y2'."
                }
                return "You can't be serious!"
            }
            if (noun == "magazine") {
                if (this.magazine_item.is_carried() || this.magazine_item.is_in_room(this.player.get_room())) {
                    return "I'm afraid the magazine is written in dwarvish."
                }
                return "You can't be serious!"
            } else if (noun == "keys" || noun == "bottle") {
                return "Peculiar. Nothing unexpected happens."
            }
            return "Peculiar. Nothing unexpected happens."
        }

        _verb_chant(word: string): string {
            let was_waiting_foo = (this.eggs_chant.get_state() == "waiting_foo")
            let reply = this.eggs_chant.say(word)
            if (was_waiting_foo && word == "foo") {
                this.eggs.reappear(92)
                return reply + " The nest of golden eggs has appeared elsewhere!"
            }
            return reply
        }

        _verb_throw(noun: string): string {
            if (noun == "axe") {
                if (!this.axe_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.axe_item.try_drop(this.player.get_room())
                this.player.drop(this.AXE_ID)
                return this._attack_dwarf_in_current()
            }
            return this._throw_treasure_at_troll(noun)
        }

        _throw_treasure_at_troll(noun: string): string {
            let here = this.player.get_room()
            if (here != this.TROLL_ROOM || !this.troll.is_blocking_bridge()) {
                return "I don't know how to throw that."
            }
            if (noun == "gold" && this.player.carrying(this.GOLD_ID)) {
                this.player.drop(this.GOLD_ID)
                this.gold.consume()
            } else if (noun == "silver" && this.player.carrying(this.SILVER_ID)) {
                this.player.drop(this.SILVER_ID)
                this.silver.consume()
            } else if (noun == "diamonds" && this.player.carrying(this.DIAMONDS_ID)) {
                this.player.drop(this.DIAMONDS_ID)
                this.diamonds.consume()
            } else if (noun == "jewelry" && this.player.carrying(this.JEWELRY_ID)) {
                this.player.drop(this.JEWELRY_ID)
                this.jewelry.consume()
            } else if (noun == "pearl" && this.player.carrying(this.PEARL_ID)) {
                this.player.drop(this.PEARL_ID)
                this.pearl.consume()
            } else if (noun == "vase" && this.player.carrying(this.VASE_ID)) {
                this.player.drop(this.VASE_ID)
                this.vase.consume()
            } else if (noun == "eggs" && this.player.carrying(this.EGGS_ID)) {
                this.player.drop(this.EGGS_ID)
                this.eggs.consume()
            } else if (noun == "trident" && this.player.carrying(this.TRIDENT_ID)) {
                this.player.drop(this.TRIDENT_ID)
                this.trident.consume()
            } else if (noun == "emerald" && this.player.carrying(this.EMERALD_ID)) {
                this.player.drop(this.EMERALD_ID)
                this.emerald.consume()
            } else if (noun == "spices" && this.player.carrying(this.SPICES_ID)) {
                this.player.drop(this.SPICES_ID)
                this.spices.consume()
            } else if (noun == "chest" && this.player.carrying(this.CHEST_ID)) {
                this.player.drop(this.CHEST_ID)
                this.chest.consume()
            } else if (noun == "pyramid" && this.player.carrying(this.PYRAMID_ID)) {
                this.player.drop(this.PYRAMID_ID)
                this.pyramid.consume()
            } else if (noun == "rug" && this.player.carrying(this.RUG_ID)) {
                this.player.drop(this.RUG_ID)
                this.rug.consume()
            } else if (noun == "coins" && this.player.carrying(this.COINS_ID)) {
                this.player.drop(this.COINS_ID)
                this.coins.consume()
            } else if (noun == "chain" && this.player.carrying(this.CHAIN_ID)) {
                this.player.drop(this.CHAIN_ID)
                this.chain.consume()
            } else {
                return "You aren't carrying it!"
            }
            this.troll.scared_off()
            return "The troll catches your " + noun + " and scurries away out of sight."
        }

        _verb_wave(noun: string): string {
            if (noun != "rod") {
                return "Peculiar. Nothing unexpected happens."
            }
            if (!this.rod_item.is_carried()) {
                return "You aren't carrying it!"
            }
            let r = this.player.get_room()
            if (r != this.FISSURE_ROOM) {
                return "You wave the rod, feeling slightly silly. Nothing happens."
            }
            return this.crystal_bridge.wave()
        }

        _verb_unlock(noun: string): string {
            if (noun == "chain") {
                if (this.player.get_room() != this.BEAR_HOME_ROOM) {
                    return "There is nothing here to which the chain can be locked."
                }
                if (!this.keys_item.is_carried()) {
                    return "The chain is still locked."
                }
                let bs = this.bear.get_state()
                if (bs == "hungry") {
                    return "There is no way to get past the bear to unlock the chain, which is probably just as well."
                }
                return "The chain is now unlocked."
            }
            if (noun == "keys" || noun == "key") {
                return "You can't unlock the keys."
            }
            if (noun == "bottle" || noun == "bird" || noun == "cage" || noun == "food" || noun == "pillow" || noun == "rod") {
                return "It has no lock."
            }
            if (noun != "grate" && noun != "") {
                return "I don't know how to lock or unlock such a thing."
            }
            if (this.player.get_room() != this.GRATE_ROOM) {
                return "There is nothing here with a lock!"
            }
            return this.grate.unlock(this.keys_item.is_carried())
        }

        _verb_lock(noun: string): string {
            if (noun == "chain") {
                if (this.player.get_room() != this.BEAR_HOME_ROOM) {
                    return "There is nothing here to which the chain can be locked."
                }
                return "The chain is now locked."
            }
            if (noun != "grate" && noun != "") {
                return "I don't know how to lock or unlock such a thing."
            }
            if (this.player.get_room() != this.GRATE_ROOM) {
                return "There is nothing here with a lock!"
            }
            return this.grate.lock()
        }

        _verb_break(noun: string): string {
            let here = this.player.get_room()
            if (noun == "oyster") {
                if (this.oyster_item.is_carried()) {
                    return "I advise you to put down the oyster before opening it. >WRENCH!<"
                }
                if (!this.oyster_item.is_in_room(here)) {
                    return "You can't be serious!"
                }
                if (!this.rod_item.is_carried()) {
                    return "You don't have anything strong enough to open the oyster."
                }
                return "The oyster creaks open, revealing nothing but oyster inside. It promptly snaps shut again."
            }
            if (noun != "clam") {
                return "It is beyond your power to do that."
            }
            if (this.clam_item.is_carried()) {
                return "I advise you to put down the clam before opening it. >STRAIN!<"
            }
            if (!this.clam_item.is_in_room(here)) {
                return "You can't be serious!"
            }
            if (!this.rod_item.is_carried()) {
                return "You don't have anything strong enough to open the clam."
            }
            this.clam_item.consume()
            this.oyster_item.place(here)
            this.pearl.reappear(here)
            return "A glistening pearl falls out of the clam and rolls away."
        }

        _verb_insert(noun: string): string {
            if (noun == "batteries" || noun == "battery") {
                if (!this.batteries_item.is_carried()) {
                    return "You aren't carrying it!"
                }
                this.batteries_item.consume()
                this.player.drop(this.BATTERIES_ID)
                this.lamp.refresh()
                return "You replace the lamp's old batteries with the fresh ones. The lamp is now full."
            }
            if (noun != "coins" && noun != "coin") {
                return "Peculiar. Nothing unexpected happens."
            }
            if (this.player.get_room() != this.VENDING_ROOM) {
                return "Peculiar. Nothing unexpected happens."
            }
            let was_loaded = this.vending.is_loaded()
            let carrying_coins = this.player.carrying(this.COINS_ID)
            let msg = this.vending.insert(carrying_coins)
            if (was_loaded && carrying_coins && !this.vending.is_loaded()) {
                this.player.drop(this.COINS_ID)
                this.coins.reappear(0)
                this.batteries_item.place(this.VENDING_ROOM)
            }
            return msg
        }

        _at_water_source(): bool {
            let r = this.player.get_room()
            if (r == 1 || r == 3 || r == 4 || r == 7) {
                return true
            }
            if (r == 38 || r == 95 || r == 113) {
                return true
            }
            if (r == 83 || r == 84) {
                return true
            }
            return false
        }

        _at_oil_source(): bool {
            @@:(this.player.get_room() == this.OIL_SOURCE_ROOM)
        }

        _verb_fill(noun: string): string {
            if (noun == "bottle" || noun == "") {
                if (!this.bottle_item.is_carried()) {
                    if (this._at_water_source() || this._at_oil_source()) {
                        return "You have nothing in which to carry it."
                    }
                    return "You aren't carrying it!"
                }
                if (this._at_oil_source()) {
                    return this.bottle.fill_oil(true)
                }
                return this.bottle.fill(this._at_water_source())
            }
            if (noun == "vase") {
                if (!this._at_water_source() && !this._at_oil_source()) {
                    return "There is nothing here with which to fill the vase."
                }
                if (!this.player.carrying(this.VASE_ID)) {
                    return "There is nothing here with which to fill the vase."
                }
                this.player.drop(this.VASE_ID)
                this.vase.try_drop(this.player.get_room())
                return "The sudden change in temperature has delicately shattered the vase."
            }
            return "You can't fill that."
        }

        _verb_pour(noun: string): string {
            if (noun != "" && noun != "bottle" && noun != "water" && noun != "oil") {
                return "You can't pour that."
            }
            if (!this.bottle_item.is_carried()) {
                return "You aren't carrying it!"
            }
            if (!this.bottle.has_water() && !this.bottle.has_oil()) {
                return "You aren't carrying it!"
            }
            let r = this.player.get_room()
            let was_water = this.bottle.has_water()
            let was_oil = this.bottle.has_oil()
            let msg = this.bottle.pour()
            if (was_water && r == this.WEST_PIT_ROOM) {
                let grow_msg = this.plant.water()
                return "" + grow_msg
            }
            if (was_oil && r == this.WEST_PIT_ROOM) {
                return "The plant indignantly shakes the oil off its leaves and asks, \"Water?\""
            }
            if (was_oil && r == this.RUSTY_DOOR_ROOM && this.rusty_door.is_rusty()) {
                return this.rusty_door.oil()
            }
            if (was_water && r == this.RUSTY_DOOR_ROOM) {
                return this.rusty_door.water()
            }
            return msg
        }

        _verb_water(noun: string): string {
            if (noun != "" && noun != "plant" && noun != "beanstalk" && noun != "it") {
                return "Peculiar. Nothing unexpected happens."
            }
            if (this.player.get_room() != this.WEST_PIT_ROOM) {
                return "Peculiar. Nothing unexpected happens."
            }
            return this._verb_pour("water")
        }

        _verb_drink(noun: string): string {
            if (noun != "" && noun != "water" && noun != "bottle") {
                return "Peculiar. Nothing unexpected happens."
            }
            if (this._at_water_source() && !(
                this.bottle_item.is_carried() && this.bottle.has_water())) {
                return "You have taken a drink from the stream. The water tastes strongly of minerals, but is not unpleasant. It is extremely cold."
            }
            if (!this.bottle_item.is_carried()) {
                return "You aren't carrying it!"
            }
            return this.bottle.drink()
        }

        _verb_eat(noun: string): string {
            if (noun != "" && noun != "food") {
                return "I think I just lost my appetite."
            }
            if (!this.food_item.is_carried()) {
                return "There is nothing here to eat."
            }
            this.player.drop(this.FOOD_ID)
            this.food_item.consume()
            return "Thank you, it was delicious!"
        }

        _attack_dwarf_in_current(): string {
            let r = this.player.get_room()
            if (this.dwarf1.get_state() == "stalking" && this.dwarf1.get_room() == r) {
                this.dwarf1.attack()
                if (this.dwarf1.get_state() == "dead") {
                    return "You killed a little dwarf."
                }
                return "You attack a little dwarf, but he dodges out of the way."
            } else if (this.dwarf2.get_state() == "stalking" && this.dwarf2.get_room() == r) {
                this.dwarf2.attack()
                if (this.dwarf2.get_state() == "dead") {
                    return "You killed a little dwarf."
                }
                return "You attack a little dwarf, but he dodges out of the way."
            } else if (this.dwarf3.get_state() == "stalking" && this.dwarf3.get_room() == r) {
                this.dwarf3.attack()
                if (this.dwarf3.get_state() == "dead") {
                    return "You killed a little dwarf."
                }
                return "You attack a little dwarf, but he dodges out of the way."
            } else if (this.dwarf4.get_state() == "stalking" && this.dwarf4.get_room() == r) {
                this.dwarf4.attack()
                if (this.dwarf4.get_state() == "dead") {
                    return "You killed a little dwarf."
                }
                return "You attack a little dwarf, but he dodges out of the way."
            } else if (this.dwarf5.get_state() == "stalking" && this.dwarf5.get_room() == r) {
                this.dwarf5.attack()
                if (this.dwarf5.get_state() == "dead") {
                    return "You killed a little dwarf."
                }
                return "You attack a little dwarf, but he dodges out of the way."
            }
            return "Peculiar. Nothing unexpected happens."
        }

        _verb_release(noun: string): string {
            if (noun != "bird") {
                return "I don't know how to release that."
            }
            if (!this.player.carrying(this.BIRD_ID)) {
                return "You aren't carrying it!"
            }
            let room = this.player.get_room()
            this.bird.release(room)
            this.player.drop(this.BIRD_ID)
            let bs = this.bird.get_state()
            if (bs == "released" && this.snake.is_blocking()) {
                this.snake.bird_released_here()
                return "The little bird attacks the green snake, and in an astounding flurry drives the snake away."
            } else if (bs == "dead") {
                return "The little bird attacks the green dragon, and in an astounding flurry gets burnt to a cinder. The ashes blow away."
            }
            return "OK"
        }

        _verb_move(noun: string): string {
            let dest = parseInt(noun, 10)
            let plover_bird_msg = ""
            if (dest == 100 && this.player.carrying(this.BIRD_ID)) {
                this.bird.vanish()
                this.player.drop(this.BIRD_ID)
                plover_bird_msg = "OK "
            }
            let here = this.player.get_room()
            if (here == 103 && dest == 64) {
                if (this.player.carrying(this.CLAM_ID)) {
                    return "You can't fit this five-foot clam through that little passage!"
                }
                if (this.player.carrying(this.OYSTER_ID)) {
                    return "You can't fit this five-foot oyster through that little passage!"
                }
            }
            if (dest > 0) {
                this.player.move_to(dest)
            } else {
                let r = this.player.get_room()
                if (r == 1) {
                    this.player.move_to(3)
                } else {
                    this.player.move_to(1)
                }
            }
            let nr = this.player.get_room()
            if (nr == 20) {
                this.player.die()
                return plover_bird_msg + "You fell into a pit and broke every bone in your body!"
            }
            if (nr == 21) {
                this.player.die()
                return plover_bird_msg + "You didn't make it."
            }
            if (this._room_is_dark(nr) && !this.lamp.is_lit()) {
                return plover_bird_msg + "You move into darkness."
            }
            return plover_bird_msg + "You are " + this._verb_look().substring(7)
        }

        _room_is_dark(room: int): bool {
            if (room >= 1 && room <= 10) {
                return false
            }
            if (room == 100 || room == 115 || room == 116 || room == 126) {
                return false
            }
            return !this.lamp.is_lit()
        }

    domain:
        bus = @@AspectBus()
        lamp = @@Lamp()
        player = @@Player()
        darkness = @@DarknessGate()
        backpack = @@BackpackLimit()
        magic = @@MagicWordTeleport()
        score_ledger = @@ScoreLedger()
        bird = @@Bird()
        snake = @@Snake()
        bear = @@Bear()
        troll = @@Troll()

        dwarf1 = @@Dwarf(1)
        dwarf2 = @@Dwarf(2)
        dwarf3 = @@Dwarf(3)
        dwarf4 = @@Dwarf(4)
        dwarf5 = @@Dwarf(5)

        endgame = @@Endgame()

        cave_hint   = @@Hint(4)
        bird_hint   = @@Hint(5)
        snake_hint  = @@Hint(8)
        maze_hint   = @@Hint(75)
        plover_hint = @@Hint(25)
        witts_hint  = @@Hint(20)

        dragon = @@Dragon()

        pirate = @@Pirate(99)

        chance = @@Chance(1)

        eggs_chant = @@EggsIncantation()

        crystal_bridge = @@CrystalBridge()

        grate = @@Grate()

        rusty_door = @@RustyDoor()

        vending = @@VendingMachine()

        bottle = @@Bottle()
        plant  = @@Plant()

        gold      = @@Treasure(18, 14)
        silver    = @@Treasure(28, 14)
        diamonds  = @@Treasure(27, 14)
        jewelry   = @@Treasure(29, 14)
        pearl     = @@Treasure(0,  14)
        vase      = @@Treasure(97, 14, true)
        eggs      = @@Treasure(92, 14)
        trident   = @@Treasure(95, 14)
        emerald   = @@Treasure(100,14)
        spices    = @@Treasure(127,14)
        chest     = @@Treasure(0,  14)
        pyramid   = @@Treasure(101,14)
        rug       = @@Treasure(119,14)
        coins     = @@Treasure(30, 14)
        chain     = @@Treasure(130,14)

        BIRD_ID: int = 100
        CHAIN_ID: int = 101
        GOLD_ID: int = 110
        SILVER_ID: int = 111
        DIAMONDS_ID: int = 112
        JEWELRY_ID: int = 113
        PEARL_ID: int = 114
        VASE_ID: int = 115
        EGGS_ID: int = 116
        TRIDENT_ID: int = 117
        EMERALD_ID: int = 118
        SPICES_ID: int = 119
        CHEST_ID: int = 120
        PYRAMID_ID: int = 121
        RUG_ID: int = 122
        COINS_ID: int = 123
        BIRD_HOME_ROOM: int = 13
        SNAKE_ROOM: int = 19
        DRAGON_ROOM: int = 119
        BEAR_HOME_ROOM: int = 130
        TROLL_ROOM: int = 117
        CHEST_ROOM: int = 18
        DEPOSIT_ROOM: int = 3
        REPOSITORY_ROOM: int = 116
        FISSURE_ROOM: int = 17
        GRATE_ROOM: int = 8
        KEYS_HOME_ROOM: int = 3
        VENDING_ROOM: int = 140
        WEST_PIT_ROOM: int = 25
        BOTTLE_ID: int = 132
        BOTTLE_HOME_ROOM: int = 3
        OIL_SOURCE_ROOM: int = 24
        RUSTY_DOOR_ROOM: int = 94
        ROD_HOME_ROOM: int = 11
        ROD_ID: int = 130
        KEYS_ID: int = 131
        MARK_ROD_ID: int = 141
        CAGE_ID: int = 133
        CAGE_HOME_ROOM: int = 10
        FOOD_ID: int = 134
        FOOD_HOME_ROOM: int = 3
        PILLOW_ID: int = 135
        PILLOW_HOME_ROOM: int = 96
        AXE_ID: int = 136
        CLAM_ID: int = 137
        CLAM_HOME_ROOM: int = 103
        OYSTER_ID: int = 138
        BATTERIES_ID: int = 139
        MAGAZINE_ID: int = 140
        MAGAZINE_HOME_ROOM: int = 106
        LAMP_ID: int = 142
        LAMP_HOME_ROOM: int = 3
        WITTS_END_ROOM: int = 108
        PLOVER_ROOM: int = 100

        rod_item       = @@Item(11)
        keys_item      = @@Item(3)
        lamp_item      = @@Item(3)
        bottle_item    = @@Item(3)
        cage_item      = @@Item(10)
        food_item      = @@Item(3)
        pillow_item    = @@Item(96)
        clam_item      = @@Item(103)
        magazine_item  = @@Item(106)
        axe_item       = @@Item(-1)
        mark_rod_item  = @@Item(-1)
        batteries_item = @@Item(-1)
        oyster_item    = @@Item(-1)

        witts_end_bonus: int = 0

        turns: int = 0

        old_loc: int = -1
        old_loc2: int = -1

        brief_mode: bool = false

        look_detail_count: int = 0

        iwest_count: int = 0

        real_score: int = 0
        score_treasures: int = 0
        score_visits: int = 0
        score_hints: int = 0
        score_endgame: int = 0
        rooms_visited: list = []
        dwarf_axe_flag: bool = false
        dwarf_axe_miss_flag: bool = false
        dwarf_total_in_room: int = 0
        dwarf_attack_total: int = 0
        dwarf_hit_total: int = 0
        repository_teleport_done: bool = false

        chest_hint_done: bool = false

        dwarf_first_encounter_done: bool = false

        oyster_revealed: bool = false
        deep_cave_turns: int = 0
        dwarves_auto_woken: bool = false
        DWARF_WAKE_THRESHOLD: int = 13
        dwarf_anger: int = 2
        loaded_from_save: bool = false

        troll_bridge_down: bool = false
}
