@@[target("javascript")]

// Breakout — game-flow state machine (JavaScript target: `this.`, host branching).
// Frame owns flow + score/lives/brick count; Phaser owns paddle/ball/brick physics
// and fires brick_hit / ball_lost as collisions happen.
@@system BreakoutGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        score(): int  { @@:(this.points) }
        lives(): int  { @@:(this.balls) }
        bricks(): int { @@:(this.remaining) }

    interface:
        start()
        serve()
        brick_hit()
        ball_lost()
        pause()
        resume()
        restart()

    machine:
        $Title {
            start() { -> $Serve }
        }

        $Serve {
            serve() { -> $Playing }
            pause() { -> $Paused }
        }

        $Playing {
            brick_hit() {
                this.points = this.points + 10
                this.remaining = this.remaining - 1
                if (this.remaining <= 0) {
                    -> $Cleared
                }
            }
            ball_lost() {
                this.balls = this.balls - 1
                if (this.balls <= 0) {
                    -> $GameOver
                }
                -> $Serve
            }
            pause() { -> $Paused }
        }

        $Cleared {
            // next level: refill bricks, serve again
            serve() {
                this.remaining = this.brickCount
                -> $Playing
            }
        }

        $Paused {
            resume() { -> $Playing }
        }

        $GameOver {
            restart() {
                this.points = 0
                this.balls = 3
                this.remaining = this.brickCount
                -> $Title
            }
        }

    domain:
        points: int = 0
        balls: int = 3
        brickCount: int = 40
        remaining: int = 40
}
