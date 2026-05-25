import Phaser from "phaser";
import { GAMES } from "./games";
import type { GameDef } from "./games/types";
import { StateChart } from "./visualizer";

const menuEl = document.getElementById("menu")!;
const vizEl = document.getElementById("viz")!;
const teachesEl = document.getElementById("teaches")!;
const controlsEl = document.getElementById("controls")!;

let game: Phaser.Game | null = null;
let raf = 0;

function renderMenu(activeId: string): void {
  menuEl.replaceChildren(
    ...GAMES.map((g) => {
      const b = document.createElement("button");
      b.textContent = g.title;
      b.className = "tab" + (g.id === activeId ? " active" : "");
      b.onclick = () => void load(g);
      return b;
    }),
  );
}

async function load(def: GameDef): Promise<void> {
  if (game) { game.destroy(true); game = null; }
  cancelAnimationFrame(raf);

  const machine = def.createMachine();

  const chart = new StateChart(vizEl, def.dot);
  await chart.render();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: def.width ?? 720,
    height: def.height ?? 480,
    backgroundColor: "#0b0e14",
    scene: new def.Scene(machine),
  });

  teachesEl.textContent = def.teaches;
  controlsEl.textContent = def.controls;
  renderMenu(def.id);
  if (location.hash.slice(1) !== def.id) location.hash = def.id;

  const tick = (): void => {
    chart.highlight(machine.current_state());
    raf = requestAnimationFrame(tick);
  };
  tick();
}

const initial = GAMES.find((g) => g.id === location.hash.slice(1)) ?? GAMES[0];
void load(initial);
