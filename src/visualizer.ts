import { instance } from "@viz-js/viz";

/**
 * Renders a Frame state chart (Graphviz DOT from `framec -l graphviz`) as an
 * inline SVG and highlights the current state by name.
 *
 * This is the reusable core of the project: any game whose `.fjs` produces a
 * DOT chart and whose machine exposes `current_state()` can drop this in.
 * Graphviz names each node by its state (e.g. `Rally`), and Frame's
 * `@@:system.state` returns that same string — so highlighting is a name match.
 */
export class StateChart {
  private nodes = new Map<string, SVGGElement>();
  private current: string | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly dot: string,
  ) {}

  async render(): Promise<void> {
    const viz = await instance();
    const svg = viz.renderSVGElement(this.dot);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";

    this.container.replaceChildren(svg);

    // Index nodes by state name (graphviz: <g class="node"><title>State</title>…).
    this.nodes.clear();
    svg.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
      const name = g.querySelector("title")?.textContent?.trim();
      if (name) this.nodes.set(name, g);
    });

    if (this.current) this.paint(this.current, true);
  }

  /** Highlight `state`; clears the previous one. No-op if unchanged. */
  highlight(state: string): void {
    if (state === this.current) return;
    if (this.current) this.paint(this.current, false);
    this.paint(state, true);
    this.current = state;
  }

  private paint(state: string, active: boolean): void {
    this.nodes.get(state)?.classList.toggle("active", active);
  }
}
