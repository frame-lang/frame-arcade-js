@@[target("javascript")]

// Asteroids — state stack (push$ / pop$) for hyperspace.
// hyperspace pushes the current $Flying compartment and jumps to $Hyperspace;
// arrive pops straight back to the saved compartment. pause/resume use the same
// stack, so you return to exactly where you were.
@@system AsteroidsGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        score(): int { @@:(this.points) }
        lives(): int { @@:(this.ships) }
        rocks(): int { @@:(this.alive) }

    interface:
        start()
        hyperspace()
        arrive()
        rock_destroyed()
        hit()
        next()
        pause()
        resume()
        restart()

    machine:
        $Title {
            start() { -> $Flying }
        }

        $Flying {
            hyperspace() { push$ -> $Hyperspace }
            rock_destroyed() {
                this.points = this.points + 20
                this.alive = this.alive - 1
                if (this.alive <= 0) {
                    -> $Cleared
                }
            }
            hit() {
                this.ships = this.ships - 1
                if (this.ships <= 0) {
                    -> $GameOver
                }
            }
            pause() { push$ -> $Paused }
        }

        $Hyperspace {
            arrive() { -> pop$ }
        }

        $Cleared {
            next() {
                this.alive = this.rockCount
                -> $Flying
            }
        }

        $Paused {
            resume() { -> pop$ }
        }

        $GameOver {
            restart() {
                this.points = 0
                this.ships = 3
                this.alive = this.rockCount
                -> $Title
            }
        }

    domain:
        points: int = 0
        ships: int = 3
        rockCount: int = 12
        alive: int = 12
}
