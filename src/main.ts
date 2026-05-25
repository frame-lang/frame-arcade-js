import Phaser from "phaser";
// Generated from pong.frm by `npm run gen` (framec -l javascript / -l graphviz).
import { PongGame } from "./games/pong/pong.machine.js";
import dot from "./games/pong/pong.dot?raw";
import { StateChart } from "./visualizer";
import { PongScene, type PongMachine, GAME_W, GAME_H } from "./games/pong/PongScene";

async function main(): Promise<void> {
  const machine = PongGame._create() as PongMachine;

  // The state chart, rendered from the same .frm spec, highlights the live state.
  const chart = new StateChart(document.getElementById("viz")!, dot);
  await chart.render();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#0b0e14",
    scene: new PongScene(machine),
  });

  // Drive the visualizer straight from the machine: one read per frame.
  const tick = (): void => {
    chart.highlight(machine.current_state());
    requestAnimationFrame(tick);
  };
  tick();
}

void main();
