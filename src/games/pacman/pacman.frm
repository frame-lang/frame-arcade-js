@@[target("javascript")]

// Pac-Man — ghost-AI mode machine (HSM).
// $Scatter and $Chase are children of $Hunting (they share power_pellet,
// dot_eaten, caught, pause via `=> $^`). A power pellet flips to $Frightened;
// being eaten sends the ghost to $Eaten, then back to $Scatter on revive.
@@system PacmanGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        dots(): int  { @@:(this.remaining) }
        lives(): int { @@:(this.ghostLives) }

    interface:
        start()
        scatter()
        chase()
        power_pellet()
        pellet_done()
        eaten()
        revived()
        dot_eaten()
        caught()
        pause()
        resume()
        restart()

    machine:
        $Idle {
            start() { -> $Scatter }
        }

        // Parent: normal hunting behavior shared by Scatter + Chase.
        $Hunting {
            power_pellet() { -> $Frightened }
            dot_eaten() {
                this.remaining = this.remaining - 1
                if (this.remaining <= 0) {
                    -> $Win
                }
            }
            caught() {
                this.ghostLives = this.ghostLives - 1
                if (this.ghostLives <= 0) {
                    -> $GameOver
                }
                -> $Scatter
            }
            pause() { push$ -> $Paused }
        }

        $Scatter => $Hunting {
            chase() { -> $Chase }
            => $^
        }

        $Chase => $Hunting {
            scatter() { -> $Scatter }
            => $^
        }

        $Frightened {
            eaten() { -> $Eaten }
            pellet_done() { -> $Chase }
            dot_eaten() {
                this.remaining = this.remaining - 1
                if (this.remaining <= 0) {
                    -> $Win
                }
            }
        }

        $Eaten {
            revived() { -> $Scatter }
        }

        $Paused {
            resume() { -> pop$ }
        }

        $Win {
            restart() {
                this.remaining = this.dotCount
                this.ghostLives = 3
                -> $Idle
            }
        }

        $GameOver {
            restart() {
                this.remaining = this.dotCount
                this.ghostLives = 3
                -> $Idle
            }
        }

    domain:
        dotCount: int = 24
        remaining: int = 24
        ghostLives: int = 3
}
