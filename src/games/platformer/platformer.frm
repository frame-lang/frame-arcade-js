@@[target("javascript")]

// Platformer — locomotion as two HSM clusters:
//   $OnGround = { $Idle, $Running }   $InAir = { $Jumping, $Falling }
// Children inherit their cluster's shared handlers via `=> $^`. Phaser fires
// run/halt/jump/apex/land/step_off as physics dictates; the chart shows which
// locomotion state the player is in.
@@system PlatformerGame {

    operations:
        current_state(): string { @@:(@@:system.state) }
        coins(): int { @@:(this.collected) }

    interface:
        start()
        run()
        halt()
        jump()
        step_off()
        apex()
        land()
        coin()
        goal()
        pause()
        resume()
        restart()

    machine:
        $Title {
            start() { -> $Idle }
        }

        $OnGround {
            jump() { -> $Jumping }
            step_off() { -> $Falling }
            coin() { this.collected = this.collected + 1 }
            goal() { -> $Win }
            pause() { push$ -> $Paused }
        }

        $Idle => $OnGround {
            run() { -> $Running }
            => $^
        }

        $Running => $OnGround {
            halt() { -> $Idle }
            => $^
        }

        $InAir {
            coin() { this.collected = this.collected + 1 }
            pause() { push$ -> $Paused }
        }

        $Jumping => $InAir {
            apex() { -> $Falling }
            => $^
        }

        $Falling => $InAir {
            land() { -> $Idle }
            => $^
        }

        $Paused {
            resume() { -> pop$ }
        }

        $Win {
            restart() {
                this.collected = 0
                -> $Title
            }
        }

    domain:
        collected: int = 0
}
