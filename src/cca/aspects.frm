@@[target("javascript")]

// CCA aspect bus — priority-ordered FSM-interceptor pattern.
//
// CANONICAL: mirrors the Godot reference
// (frame-arcade/cca/frame/aspects.fgd) exactly — same systems
// (AspectBus / LoudAspect / MuteAspect / LogAspect / Conductor),
// states, and transitions. AspectBus is the reusable
// registration+dispatch lifecycle ($Idle/$Dispatching); the others
// are the end-to-end demo. The playable game (cca.frm) imports only
// AspectBus; the demo aspects exist for parity + the standalone demo.
//
// Host-code adaptations (action bodies only, topology unaffected):
// GDScript Array<Dictionary> -> JS array of objects (.append->.push,
// .remove_at->.splice, .size()->.length); .to_upper()->.toUpperCase();
// .begins_with()->.startsWith(); the sort_custom(func(a,b)...) lambda
// becomes a manual selection sort (Frame reserves `=>` for HSM
// forwarding, so an arrow function in a body would misparse).
// @@[persist] + ": RefCounted" dropped.

@@system AspectBus {

    interface:
        register(name: string, priority: int)
        unregister(name: string)
        is_registered(name: string): bool
        begin_dispatch()
        end_dispatch()
        ordered_names(): list

    machine:
        $Idle {
            register(name: string, priority: int) {
                this._add_or_replace(name, priority)
            }

            unregister(name: string) {
                this._remove(name)
            }

            begin_dispatch() {
                -> $Dispatching
            }

            end_dispatch() {
            }

            is_registered(name: string): bool { @@:(this._has(name)) }
            ordered_names(): list             { @@:(this._names_sorted()) }
        }

        $Dispatching {
            register(name: string, priority: int) {
                this.pending_register.push({ "name": name, "priority": priority })
            }

            unregister(name: string) {
                this.pending_unregister.push(name)
            }

            begin_dispatch() {
            }

            end_dispatch() {
                this._apply_pending()
                -> $Idle
            }

            is_registered(name: string): bool { @@:(this._has(name)) }
            ordered_names(): list             { @@:(this._names_sorted()) }
        }

    actions:
        _add_or_replace(name: string, priority: int) {
            let i = 0
            while (i < this.listeners.length) {
                if (this.listeners[i].name == name) {
                    this.listeners[i].priority = priority
                    return
                }
                i = i + 1
            }
            this.listeners.push({ "name": name, "priority": priority })
        }

        _remove(name: string) {
            let i = 0
            while (i < this.listeners.length) {
                if (this.listeners[i].name == name) {
                    this.listeners.splice(i, 1)
                    return
                }
                i = i + 1
            }
        }

        _has(name: string): bool {
            let i = 0
            while (i < this.listeners.length) {
                if (this.listeners[i].name == name) {
                    return true
                }
                i = i + 1
            }
            return false
        }

        _names_sorted(): list {
            let prios = []
            let names = []
            let i = 0
            while (i < this.listeners.length) {
                prios.push(this.listeners[i].priority)
                names.push(this.listeners[i].name)
                i = i + 1
            }
            let result = []
            while (names.length > 0) {
                let best = 0
                let j = 1
                while (j < prios.length) {
                    if (prios[j] > prios[best]) {
                        best = j
                    }
                    j = j + 1
                }
                result.push(names[best])
                prios.splice(best, 1)
                names.splice(best, 1)
            }
            return result
        }

        _apply_pending() {
            let i = 0
            while (i < this.pending_unregister.length) {
                this._remove(this.pending_unregister[i])
                i = i + 1
            }
            this.pending_unregister = []

            i = 0
            while (i < this.pending_register.length) {
                let p = this.pending_register[i]
                this._add_or_replace(p.name, p.priority)
                i = i + 1
            }
            this.pending_register = []
        }

    domain:
        listeners: list = []
        pending_register: list = []
        pending_unregister: list = []
}

@@system LoudAspect {

    interface:
        try_handle(event: Dictionary): Dictionary
        toggle()

    machine:
        $On {
            try_handle(event: Dictionary): Dictionary {
                let data = event.data
                let transformed = { "name": event.name, "data": data.toUpperCase() + "!" }
                @@:({ "verdict": "transform", "event": transformed })
            }
            toggle() { -> $Off }
        }

        $Off {
            try_handle(event: Dictionary): Dictionary {
                @@:({ "verdict": "pass", "event": event })
            }
            toggle() { -> $On }
        }
}

@@system MuteAspect {

    interface:
        try_handle(event: Dictionary): Dictionary

    machine:
        $Active {
            try_handle(event: Dictionary): Dictionary {
                let name = event.name
                if (name.startsWith("shh")) {
                    this.muted_count = this.muted_count + 1
                    @@:return({ "verdict": "consume", "event": event })
                }
                @@:({ "verdict": "pass", "event": event })
            }
        }

    domain:
        muted_count: int = 0
}

@@system LogAspect {

    interface:
        try_handle(event: Dictionary): Dictionary
        get_count(): int
        get_last(): Dictionary

    machine:
        $Active {
            try_handle(event: Dictionary): Dictionary {
                this.events_seen = this.events_seen + 1
                this.last_event = event
                @@:({ "verdict": "observe", "event": event })
            }

            get_count(): int          { @@:(this.events_seen) }
            get_last(): Dictionary    { @@:(this.last_event) }
        }

    domain:
        events_seen: int = 0
        last_event: Dictionary = {}
}

@@[main]
@@system Conductor {

    operations:
        current_state(): string { @@:(@@:system.state) }

    interface:
        setup_default_aspects()
        publish(name: string, data: string): string
        toggle_loud()
        register_log_late()
        log_count(): int
        muted_count(): int
        loud_state(): string

    machine:
        $Active {
            setup_default_aspects() {
                this.bus.register("mute", 700)
                this.bus.register("loud", 500)
                this.bus.register("log", 100)
            }

            publish(name: string, data: string): string {
                let event = { "name": name, "data": data }

                this.bus.begin_dispatch()
                let names = this.bus.ordered_names()
                let i = 0
                let consumed_by = ""
                while (i < names.length) {
                    let aname = names[i]
                    let result = this._dispatch_to(aname, event)
                    let verdict = result.verdict
                    if (verdict == "consume") {
                        consumed_by = aname
                        i = names.length
                    } else if (verdict == "transform") {
                        event = result.event
                    }
                    i = i + 1
                }
                this.bus.end_dispatch()

                if (consumed_by != "") {
                    @@:return("consumed:" + consumed_by)
                }
                @@:("handled:" + event.data)
            }

            toggle_loud() {
                this.loud.toggle()
            }

            register_log_late() {
                this.bus.register("log", 50)
            }

            log_count(): int     { @@:(this.log_aspect.get_count()) }
            muted_count(): int   { @@:(this.mute.muted_count) }
            loud_state(): string {
                if (this.loud.try_handle({ "name": "_probe", "data": "x" }).verdict == "transform") {
                    @@:return("on")
                }
                @@:("off")
            }
        }

    actions:
        _dispatch_to(name: string, event: Dictionary): Dictionary {
            if (name == "mute") {
                return this.mute.try_handle(event)
            } else if (name == "loud") {
                return this.loud.try_handle(event)
            } else if (name == "log") {
                return this.log_aspect.try_handle(event)
            }
            return { "verdict": "pass", "event": event }
        }

    domain:
        bus = @@AspectBus()
        loud = @@LoudAspect()
        mute = @@MuteAspect()
        log_aspect = @@LogAspect()
}
