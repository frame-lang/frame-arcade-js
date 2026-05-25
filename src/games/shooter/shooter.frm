@@[target("javascript")]

// Side-scrolling shooter — multi-phase boss HSM.
// $Phase1/$Phase2/$Phase3 are children of $Boss; they share player_hit via
// `=> $^`. Each phase watches boss HP and transitions to the next phase, the
// last to $Victory.
@@system ShooterGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        score(): int   { @@:(this.points) }
        lives(): int   { @@:(this.ships) }
        boss_hp(): int { @@:(this.bossHp) }

    interface:
        start()
        enemy_killed()
        wave_cleared()
        boss_hit()
        player_hit()
        pause()
        resume()
        restart()

    machine:
        $Title {
            start() { -> $Wave }
        }

        $Wave {
            enemy_killed() { this.points = this.points + 50 }
            wave_cleared() { -> $Phase1 }
            player_hit() {
                this.ships = this.ships - 1
                if (this.ships <= 0) {
                    -> $GameOver
                }
            }
            pause() { -> $Paused }
        }

        // Parent: shared boss-fight behavior.
        $Boss {
            player_hit() {
                this.ships = this.ships - 1
                if (this.ships <= 0) {
                    -> $GameOver
                }
            }
        }

        $Phase1 => $Boss {
            boss_hit() {
                this.bossHp = this.bossHp - 1
                if (this.bossHp <= this.threshold2) {
                    -> $Phase2
                }
            }
            => $^
        }

        $Phase2 => $Boss {
            boss_hit() {
                this.bossHp = this.bossHp - 1
                if (this.bossHp <= this.threshold3) {
                    -> $Phase3
                }
            }
            => $^
        }

        $Phase3 => $Boss {
            boss_hit() {
                this.bossHp = this.bossHp - 1
                if (this.bossHp <= 0) {
                    -> $Victory
                }
            }
            => $^
        }

        $Paused {
            resume() { -> $Wave }
        }

        $Victory {
            restart() {
                this.points = 0
                this.ships = 3
                this.bossHp = this.bossMax
                -> $Title
            }
        }

        $GameOver {
            restart() {
                this.points = 0
                this.ships = 3
                this.bossHp = this.bossMax
                -> $Title
            }
        }

    domain:
        points: int = 0
        ships: int = 3
        bossMax: int = 30
        bossHp: int = 30
        threshold2: int = 20
        threshold3: int = 10
}
