# Frame Arcade (JS)

Classic arcade games where the game logic is a **[Frame](https://github.com/frame-lang/framec) state machine**, rendered in the browser with **[Phaser](https://phaser.io)**, shown **beside a live state chart** generated from the same `.frm` spec — the highlighted node is the machine's current state as you play.

This is the web counterpart to the Godot/GDScript [`frame-arcade`](https://github.com/frame-lang/frame-arcade) mini-book: same "Frame is the brain, the engine is the body" pattern, but Phaser instead of Godot, and with the state machine visualized live.

## Architecture

```
pong.frm ──framec -l javascript──▶ pong.machine.js   (the brain: states + flow + score)
         └─framec -l graphviz────▶ pong.dot          (the chart)

Phaser scene (the body) ── reads current_state(), fires events ──▶ machine
StateChart (visualizer)  ── reads current_state() each frame ────▶ highlights the chart
```

- **Frame owns flow.** Every state transition (`Attract → Serve → Rally → … → GameOver`) lives in `pong.frm`. Phaser never decides flow — it reads `current_state()` and fires interface events (`serve`, `point_scored`, `pause`, …).
- **Phaser owns the body.** Rendering, input, and per-frame physics.
- **The visualizer is reusable.** `src/visualizer.ts` renders any Frame `.dot` chart and highlights a node by state name — works for every game.

## Prerequisites

- Node 18+
- [`framec`](https://github.com/frame-lang/framec) on your `PATH` (the `gen` step transpiles the `.frm`). Override with `FRAMEC=/path/to/framec`.

## Run

```bash
npm install
npm run dev      # regenerates from .frm, then starts Vite
```

Open the printed localhost URL. Controls: **W/S** (or ↑/↓) move the left paddle, **SPACE** starts/serves/replays, **P** pauses.

## Add a game

1. Write `src/games/<name>/<name>.frm` (a JavaScript-target Frame spec; use `this.` and host-language branching).
2. `npm run gen` regenerates `<name>.machine.js` + `<name>.dot`.
3. Add a Phaser scene that reads `current_state()` and fires the machine's interface events.
4. Reuse `StateChart` for the live chart.
