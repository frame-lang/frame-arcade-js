@@[target("javascript")]

// Space Invaders — hierarchical state machine.
// $Marching and $Diving are children of $Wave; they inherit $Wave's shared
// handlers (invader_killed, reached_bottom, pause) via the trailing `=> $^`.
@@system InvadersGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        score(): int     { @@:(this.points) }
        lives(): int     { @@:(this.ships) }
        invaders(): int  { @@:(this.alive) }

    interface:
        start()
        dive()
        land()
        invader_killed()
        reached_bottom()
        pause()
        resume()
        restart()

    machine:
        $Title {
            start() { -> $Marching }
        }

        // Parent: shared behavior for the whole wave.
        $Wave {
            invader_killed() {
                this.points = this.points + 25
                this.alive = this.alive - 1
                if (this.alive <= 0) {
                    -> $Victory
                }
            }
            reached_bottom() {
                this.ships = this.ships - 1
                if (this.ships <= 0) {
                    -> $GameOver
                }
            }
            pause() { push$ -> $Paused }
        }

        $Marching => $Wave {
            dive() { -> $Diving }
            => $^
        }

        $Diving => $Wave {
            land() { -> $Marching }
            => $^
        }

        $Paused {
            resume() { -> pop$ }
        }

        $Victory {
            restart() {
                this.points = 0
                this.ships = 3
                this.alive = this.invaderCount
                -> $Title
            }
        }

        $GameOver {
            restart() {
                this.points = 0
                this.ships = 3
                this.alive = this.invaderCount
                -> $Title
            }
        }

    domain:
        points: int = 0
        ships: int = 3
        invaderCount: int = 24
        alive: int = 24
}
