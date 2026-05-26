@@[target("javascript")]

// CCA NPC state machines.
//
// CANONICAL: mirrors the Godot reference
// (frame-arcade/cca/frame/npcs.fgd) exactly — same systems
// (Bird / Snake / Bear / Troll / Dwarf(seed) / Dragon /
// Pirate(seed) / Chance(seed)), states, and transitions. Only action
// bodies differ (JS): the seeded LCG PRNG used by Dwarf/Pirate/Chance
// uses Math.imul + `>>> 0` for correct 32-bit wrapping (JS numbers are
// doubles, not 64-bit ints), and GDScript Array/Dictionary become JS
// array/object. @@[persist] + ": RefCounted" dropped.

@@[main]
@@system Bird {

    operations:
        current_state(): string { @@:(@@:system.state) }

    interface:
        capture()
        release(at_room: int)
        vanish()
        get_state(): string
        get_location(): int

    machine:
        $Free {
            capture() {
                this.location_room = -1
                -> $Caged
            }
            get_state(): string  { @@:("free") }
            get_location(): int  { @@:(this.location_room) }
        }

        $Caged {
            release(at_room: int) {
                this.location_room = at_room
                if (at_room == this.SNAKE_ROOM) {
                    -> $Released
                } else if (at_room == this.DRAGON_ROOM) {
                    -> $Dead
                } else {
                    -> $Free
                }
            }
            vanish() {
                this.location_room = -1
                -> $Dead
            }
            get_state(): string  { @@:("caged") }
            get_location(): int  { @@:(-1) }
        }

        $Released {
            get_state(): string  { @@:("released") }
            get_location(): int  { @@:(this.location_room) }
        }

        $Dead {
            get_state(): string  { @@:("dead") }
            get_location(): int  { @@:(-1) }
        }

    domain:
        location_room: int = 13
        SNAKE_ROOM: int = 19
        DRAGON_ROOM: int = 119
}

@@system Snake {

    interface:
        bird_released_here()
        get_state(): string
        is_blocking(): bool

    machine:
        $Blocking {
            bird_released_here() {
                -> $Gone
            }
            get_state(): string   { @@:("blocking") }
            is_blocking(): bool   { @@:(true) }
        }

        $Gone {
            get_state(): string   { @@:("gone") }
            is_blocking(): bool   { @@:(false) }
        }
}

@@system Bear {

    interface:
        feed()
        take_chain()
        drop_chain()
        get_state(): string
        is_friendly(): bool
        is_dangerous(): bool

    machine:
        $Hungry {
            feed() {
                -> $Tame
            }
            take_chain() {
                -> $Attacking
            }
            get_state(): string   { @@:("hungry") }
            is_friendly(): bool   { @@:(false) }
            is_dangerous(): bool  { @@:(true) }
        }

        $Tame {
            take_chain() {
                -> $Following
            }
            get_state(): string   { @@:("tame") }
            is_friendly(): bool   { @@:(true) }
            is_dangerous(): bool  { @@:(false) }
        }

        $Following {
            drop_chain() {
                -> $Released
            }
            get_state(): string   { @@:("following") }
            is_friendly(): bool   { @@:(true) }
            is_dangerous(): bool  { @@:(false) }
        }

        $Released {
            get_state(): string   { @@:("released") }
            is_friendly(): bool   { @@:(true) }
            is_dangerous(): bool  { @@:(false) }
        }

        $Attacking {
            get_state(): string   { @@:("attacking") }
            is_friendly(): bool   { @@:(false) }
            is_dangerous(): bool  { @@:(true) }
        }
}

@@system Troll {

    interface:
        pay_toll()
        scared_off()
        get_state(): string
        is_blocking_bridge(): bool

    machine:
        $Demanding {
            pay_toll()    { -> $TollPaid }
            scared_off()  { -> $Vanished }
            get_state(): string         { @@:("demanding") }
            is_blocking_bridge(): bool  { @@:(true) }
        }

        $TollPaid {
            get_state(): string         { @@:("toll_paid") }
            is_blocking_bridge(): bool  { @@:(false) }
        }

        $Vanished {
            get_state(): string         { @@:("vanished") }
            is_blocking_bridge(): bool  { @@:(false) }
        }
}

@@system Dwarf(seed: int) {

    interface:
        wake_up(at_room: int)
        attack()
        try_throw_axe(anger: int): bool
        flee()
        step_to(new_room: int)
        snap_to_player(at_room: int)
        mark_unseen()
        pick_destination(candidates: list, forbidden: list): int
        get_state(): string
        get_room(): int
        get_prev_room(): int
        is_seen(): bool
        get_seed(): int
        get_step(): int
        get_attack_step(): int
        get_pick_step(): int

    machine:
        $Hidden {
            wake_up(at_room: int) {
                this.room = at_room
                this.prev_room = at_room
                -> $Stalking
            }
            try_throw_axe(anger: int): bool {
                @@:(false)
            }
            pick_destination(candidates: list, forbidden: list): int {
                @@:(-1)
            }
            get_state(): string      { @@:("hidden") }
            get_room(): int          { @@:(-1) }
            get_prev_room(): int     { @@:(-1) }
            is_seen(): bool          { @@:(false) }
            get_seed(): int          { @@:(this.seed) }
            get_step(): int          { @@:(this.step) }
            get_attack_step(): int   { @@:(this.attack_step) }
            get_pick_step(): int     { @@:(this.pick_step) }
        }

        $Stalking {
            attack() {
                this.step = this.step + 1
                let x = (Math.imul(this.seed, 1664525) + Math.imul(this.step, 1013904223)) >>> 0
                x = Math.imul((x >>> 16) ^ x, 22695477) >>> 0
                let roll = x % 100
                if (roll < 70) {
                    -> $Dead
                }
            }
            try_throw_axe(anger: int): bool {
                this.attack_step = this.attack_step + 1
                let x = (Math.imul(this.seed, 22695477) + Math.imul(this.attack_step, 1664525)) >>> 0
                x = Math.imul((x >>> 16) ^ x, 1013904223) >>> 0
                let roll = x % 100
                let hit_pct = 0
                if (anger > 2) {
                    hit_pct = Math.floor(95 * (anger - 2) / 10)
                }
                @@:(roll < hit_pct)
            }
            step_to(new_room: int) {
                this.prev_room = this.room
                this.room = new_room
            }
            snap_to_player(at_room: int) {
                this.seen = true
                this.room = at_room
            }
            mark_unseen() {
                this.seen = false
            }
            flee() {
                -> $Hidden
            }
            pick_destination(candidates: list, forbidden: list): int {
                let filtered = []
                let i = 0
                while (i < candidates.length) {
                    let c = candidates[i]
                    i = i + 1
                    if (c == this.room || c == this.prev_room) {
                        continue
                    }
                    if (c < 15 || c > 130) {
                        continue
                    }
                    if (forbidden.includes(c)) {
                        continue
                    }
                    if (!filtered.includes(c)) {
                        filtered.push(c)
                    }
                }
                if (filtered.length == 0) {
                    if (this.prev_room == -1) {
                        @@:return(this.room)
                    }
                    @@:return(this.prev_room)
                }
                this.pick_step = this.pick_step + 1
                let y = (Math.imul(this.seed, 134775813) + Math.imul(this.pick_step, 22695477)) >>> 0
                y = Math.imul((y >>> 16) ^ y, 1664525) >>> 0
                let idx = y % filtered.length
                @@:(filtered[idx])
            }
            get_state(): string      { @@:("stalking") }
            get_room(): int          { @@:(this.room) }
            get_prev_room(): int     { @@:(this.prev_room) }
            is_seen(): bool          { @@:(this.seen) }
            get_seed(): int          { @@:(this.seed) }
            get_step(): int          { @@:(this.step) }
            get_attack_step(): int   { @@:(this.attack_step) }
            get_pick_step(): int     { @@:(this.pick_step) }
        }

        $Dead {
            try_throw_axe(anger: int): bool {
                @@:(false)
            }
            pick_destination(candidates: list, forbidden: list): int {
                @@:(-1)
            }
            get_state(): string      { @@:("dead") }
            get_room(): int          { @@:(-1) }
            get_prev_room(): int     { @@:(-1) }
            is_seen(): bool          { @@:(false) }
            get_seed(): int          { @@:(this.seed) }
            get_step(): int          { @@:(this.step) }
            get_attack_step(): int   { @@:(this.attack_step) }
            get_pick_step(): int     { @@:(this.pick_step) }
        }

    domain:
        seed: int = seed
        room: int = -1
        prev_room: int = -1
        seen: bool = false
        step: int = 0
        attack_step: int = 0
        pick_step: int = 0
}

@@system Dragon {

    interface:
        attack()
        yes()
        no()
        cancel()
        get_state(): string
        is_alive(): bool
        is_awaiting_confirmation(): bool

    machine:
        $Sleeping {
            attack() {
                -> $Asked
            }
            yes() { }
            no() { }
            cancel() { }
            get_state(): string                  { @@:("sleeping") }
            is_alive(): bool                     { @@:(true) }
            is_awaiting_confirmation(): bool     { @@:(false) }
        }

        $Asked {
            yes() {
                -> $Dead
            }
            no() {
                -> $Sleeping
            }
            cancel() {
                -> $Sleeping
            }
            attack() {
            }
            get_state(): string                  { @@:("asked") }
            is_alive(): bool                     { @@:(true) }
            is_awaiting_confirmation(): bool     { @@:(true) }
        }

        $Dead {
            attack() { }
            yes() { }
            no() { }
            cancel() { }
            get_state(): string                  { @@:("dead") }
            is_alive(): bool                     { @@:(false) }
            is_awaiting_confirmation(): bool     { @@:(false) }
        }
}

@@system Pirate(seed: int = 42) {

    interface:
        treasures_carried(n: int)
        try_steal(): bool
        step_to(new_room: int)
        snap_to_player(at_room: int)
        mark_unseen()
        pick_destination(candidates: list, forbidden: list): int
        get_room(): int
        get_prev_room(): int
        is_seen(): bool
        get_state(): string
        is_stalking(): bool
        get_pick_step(): int

    machine:
        $Dormant {
            treasures_carried(n: int) {
                if (n >= this.ACTIVATION_THRESHOLD) {
                    -> $Stalking
                }
            }
            try_steal(): bool {
                @@:(false)
            }
            step_to(new_room: int) {
            }
            snap_to_player(at_room: int) { }
            mark_unseen() { }
            pick_destination(candidates: list, forbidden: list): int {
                @@:(-1)
            }
            get_room(): int      { @@:(-1) }
            get_prev_room(): int { @@:(-1) }
            is_seen(): bool      { @@:(false) }
            get_state(): string  { @@:("dormant") }
            is_stalking(): bool  { @@:(false) }
            get_pick_step(): int { @@:(this.pick_step) }
        }

        $Stalking {
            treasures_carried(n: int) {
            }
            try_steal(): bool {
                this.step = this.step + 1
                let x = (Math.imul(this.seed, 1664525) + Math.imul(this.step, 1013904223)) >>> 0
                x = Math.imul((x >>> 16) ^ x, 22695477) >>> 0
                let roll = x % 100
                if (roll < 25) {
                    -> $Vanished
                    @@:return(true)
                }
                @@:(false)
            }
            step_to(new_room: int) {
                this.prev_room = this.room
                this.room = new_room
            }
            snap_to_player(at_room: int) {
                this.seen = true
                this.room = at_room
            }
            mark_unseen() {
                this.seen = false
            }
            pick_destination(candidates: list, forbidden: list): int {
                let filtered = []
                let i = 0
                while (i < candidates.length) {
                    let c = candidates[i]
                    i = i + 1
                    if (c == this.room || c == this.prev_room) {
                        continue
                    }
                    if (c < 15 || c > 130) {
                        continue
                    }
                    if (forbidden.includes(c)) {
                        continue
                    }
                    if (!filtered.includes(c)) {
                        filtered.push(c)
                    }
                }
                if (filtered.length == 0) {
                    if (this.prev_room == -1) {
                        @@:return(this.room)
                    }
                    @@:return(this.prev_room)
                }
                this.pick_step = this.pick_step + 1
                let y = (Math.imul(this.seed, 134775813) + Math.imul(this.pick_step, 22695477)) >>> 0
                y = Math.imul((y >>> 16) ^ y, 1664525) >>> 0
                let idx = y % filtered.length
                @@:(filtered[idx])
            }
            get_room(): int      { @@:(this.room) }
            get_prev_room(): int { @@:(this.prev_room) }
            is_seen(): bool      { @@:(this.seen) }
            get_state(): string  { @@:("stalking") }
            is_stalking(): bool  { @@:(true) }
            get_pick_step(): int { @@:(this.pick_step) }
        }

        $Vanished {
            treasures_carried(n: int) { }
            try_steal(): bool {
                @@:(false)
            }
            step_to(new_room: int) { }
            snap_to_player(at_room: int) { }
            mark_unseen() { }
            pick_destination(candidates: list, forbidden: list): int {
                @@:(-1)
            }
            get_room(): int      { @@:(this.room) }
            get_prev_room(): int { @@:(this.prev_room) }
            is_seen(): bool      { @@:(false) }
            get_state(): string  { @@:("vanished") }
            is_stalking(): bool  { @@:(false) }
            get_pick_step(): int { @@:(this.pick_step) }
        }

    domain:
        seed: int = seed
        step: int = 0
        room: int = -1
        prev_room: int = -1
        seen: bool = false
        ACTIVATION_THRESHOLD: int = 3
        pick_step: int = 0
}

@@system Chance(seed: int) {

    interface:
        decide(name: string, pct: int): bool
        decide_range(name: string, n: int): int
        force(name: string, value: int)
        clear_forced(name: string)
        reseed(new_seed: int)
        get_seed(): int
        get_step(): int

    machine:
        $Rolling {
            decide(name: string, pct: int): bool {
                if (name in this.forced) {
                    @@:return(this.forced[name] != 0)
                }
                this.step = this.step + 1
                let x = (Math.imul(this.seed, 1664525) + Math.imul(this.step, 1013904223)) >>> 0
                x = Math.imul((x >>> 16) ^ x, 22695477) >>> 0
                let roll = x % 100
                @@:(roll < pct)
            }
            decide_range(name: string, n: int): int {
                if (name in this.forced) {
                    @@:return(this.forced[name])
                }
                this.step = this.step + 1
                let x = (Math.imul(this.seed, 1664525) + Math.imul(this.step, 1013904223)) >>> 0
                x = Math.imul((x >>> 16) ^ x, 22695477) >>> 0
                @@:(x % n)
            }
            force(name: string, value: int) {
                this.forced[name] = value
            }
            clear_forced(name: string) {
                delete this.forced[name]
            }
            reseed(new_seed: int) {
                this.seed = new_seed
                this.step = 0
            }
            get_seed(): int { @@:(this.seed) }
            get_step(): int { @@:(this.step) }
        }

    domain:
        seed: int = seed
        step: int = 0
        forced: Dictionary = {}
}
