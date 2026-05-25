@@[target("javascript")]

// Stealth — guard AI as a flat FSM (Frame as an alternative to behavior trees).
// Patrol -> Suspicious -> Alert -> Search -> Return -> Patrol, with the obvious
// re-acquire / give-up edges. The chart is the guard's "mind" — its current
// state lights up as it reacts to the player.
@@system GuardAI {

    operations:
        current_state(): string { @@:(@@:system.state) }
        alerts(): int { @@:(this.detections) }

    interface:
        start()
        spotted()
        confirmed()
        lost()
        searched()
        returned()
        caught_player()
        pause()
        resume()
        restart()

    machine:
        $Idle {
            start() { -> $Patrol }
        }

        $Patrol {
            spotted() { -> $Suspicious }
            pause() { -> $Paused }
        }

        $Suspicious {
            confirmed() {
                this.detections = this.detections + 1
                -> $Alert
            }
            lost() { -> $Patrol }
        }

        $Alert {
            caught_player() { -> $Caught }
            lost() { -> $Search }
        }

        $Search {
            spotted() { -> $Alert }
            searched() { -> $Return }
        }

        $Return {
            spotted() { -> $Suspicious }
            returned() { -> $Patrol }
        }

        $Caught {
            restart() { -> $Idle }
        }

        $Paused {
            resume() { -> $Patrol }
        }

    domain:
        detections: int = 0
}
