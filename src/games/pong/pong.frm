@@[target("javascript")]

// Pong — game-flow state machine.
// Frame owns the discrete game flow (attract -> serve -> rally -> point -> game over)
// and the score. Phaser owns continuous physics/rendering and reads current_state()
// each frame, firing interface events (serve, point_scored, pause, ...) as play happens.
//
// Note: this is a JavaScript-target spec, so instance access uses `this.` and
// branching uses host (JS) syntax — only `->`, `@@:`, and `@@:system.state` are
// Frame constructs. (Per-target instance access is documented in the QuickStart.)
@@system PongGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        score(): string         { @@:(this.left + " : " + this.right) }
        left_score(): int       { @@:(this.left) }
        right_score(): int      { @@:(this.right) }
        win_score(): int        { @@:(this.win) }

    interface:
        start()
        serve()
        point_scored(scorer: string)
        pause()
        resume()
        restart()

    machine:
        $Attract {
            start() { -> $Serve }
        }

        $Serve {
            serve() { -> $Rally }
            pause() { push$ -> $Paused }
        }

        $Rally {
            point_scored(scorer: string) {
                if (scorer == "left") {
                    this.left = this.left + 1
                }
                if (scorer == "right") {
                    this.right = this.right + 1
                }
                if (this.left >= this.win || this.right >= this.win) {
                    -> $GameOver
                }
                -> $Serve
            }
            pause() { push$ -> $Paused }
        }

        $Paused {
            resume() { -> pop$ }
        }

        $GameOver {
            restart() {
                this.left = 0
                this.right = 0
                -> $Attract
            }
        }

    domain:
        left: int = 0
        right: int = 0
        win: int = 5
}
