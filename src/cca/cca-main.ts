import { CcaDriver } from "./driver";
import dot from "./cca.dot?raw";
import { StateChart } from "../visualizer";

/**
 * CCA terminal page entry. Mounts the CcaDriver behind a scrolling
 * text log + input line, and the live Frame state chart (the Adventure
 * machine's current state glows as you play). Loaded by cca.html.
 */

const logEl = document.getElementById("log")!;
const inputEl = document.getElementById("cmd") as HTMLInputElement;
const vizEl = document.getElementById("viz")!;
const scoreEl = document.getElementById("score");

const driver = new CcaDriver();
const chart = new StateChart(vizEl, dot);

// Up-arrow command history (session only).
const history: string[] = [];
let histIdx = -1;

function appendEcho(text: string): void {
  const e = document.createElement("div");
  e.className = "echo";
  e.textContent = "> " + text;
  logEl.appendChild(e);
}

function appendLines(lines: string[]): void {
  for (const line of lines) {
    const p = document.createElement("div");
    p.className = "line";
    // Preserve blank lines as vertical spacing; \n inside a line wraps.
    p.textContent = line === "" ? " " : line;
    logEl.appendChild(p);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function refresh(): void {
  chart.highlight(driver.currentState());
  if (scoreEl) scoreEl.textContent = `score ${driver.score()}`;
}

function submit(text: string): void {
  const trimmed = text.trim();
  if (trimmed !== "") {
    history.push(trimmed);
    histIdx = history.length;
  }
  appendEcho(text);
  appendLines(driver.input(text));
  refresh();
}

inputEl.addEventListener("keydown", (ev: KeyboardEvent) => {
  if (ev.key === "Enter") {
    const text = inputEl.value;
    inputEl.value = "";
    submit(text);
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    if (histIdx > 0) {
      histIdx -= 1;
      inputEl.value = history[histIdx];
    }
  } else if (ev.key === "ArrowDown") {
    ev.preventDefault();
    if (histIdx < history.length - 1) {
      histIdx += 1;
      inputEl.value = history[histIdx];
    } else {
      histIdx = history.length;
      inputEl.value = "";
    }
  }
});

async function boot(): Promise<void> {
  await chart.render();
  appendLines(driver.start());
  refresh();
  inputEl.focus();
}

// Keep focus on the input when clicking anywhere in the log.
logEl.addEventListener("click", () => inputEl.focus());

void boot();
