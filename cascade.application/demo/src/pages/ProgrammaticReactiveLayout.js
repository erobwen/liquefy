import { Component } from "@liquefy/cascade.component";

/**
 * Programmatic Reactive Layout - a simplified replica of
 * flow.application/demo/src/pages/programmaticReactiveLayout.js: a rows/
 * columns control panel and a grid of cells, each showing its own real
 * measured width/height. The font-fitted text and fixed-aspect-ratio
 * cells from the original are left for later - this is just the core
 * "components are aware of their own real pixel budget" idea.
 *
 * The grid's own real DOM is rebuilt (not reconciled cell-by-cell)
 * whenever rows/columns changes - simplest correct thing for a variable
 * cell count in a demo page; each cell has no independent state of its
 * own, so there's nothing individual identity would buy here.
 */
export class ProgrammaticReactiveLayout extends Component {
  constructor() {
    super();
    this.rows = 3;
    this.columns = 3;
  }

  render(context) {
    const u = this.unobservable;
    if (!u.el) {
      u.el = context.target.createChild("div");
      u.el.element.style.cssText = "box-sizing: border-box; overflow: hidden;";

      u.controlPanel = u.el.createChild("div");
      u.controlPanel.element.style.cssText = "display: flex; gap: 16px; margin-bottom: 12px;";
      u.rowsField = createNumberField(u.controlPanel, "Rows", (value) => { this.rows = value; });
      u.columnsField = createNumberField(u.controlPanel, "Columns", (value) => { this.columns = value; });

      u.grid = u.el.createChild("div");
      u.grid.element.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    }

    // Reading usableWidth/usableHeight here - not just measuring this
    // page's own already-laid-out DOM after the fact - is what makes this
    // rerun on a plain window resize at all: a resize only invalidates
    // whatever actually *read* a context field that changed (see
    // MenuFrame/WorkArea above), and getBoundingClientRect() alone never
    // creates that dependency (it's not an observable read of anything -
    // it just reflects whatever CSS already decided, which does keep
    // resizing correctly on its own, but leaves this component with
    // nothing telling it to rerun and recompute the *text* describing it).
    u.el.element.style.width = context.usableWidth + "px";
    u.el.element.style.height = context.usableHeight + "px";

    u.rowsField.value = this.rows;
    u.columnsField.value = this.columns;

    if (u.builtRows !== this.rows || u.builtColumns !== this.columns) {
      u.grid.element.innerHTML = "";
      u.cellEls = [];
      for (let row = 0; row < this.rows; row++) {
        const rowEl = u.grid.createChild("div");
        rowEl.element.style.cssText = "display: flex; gap: 4px;";
        for (let column = 0; column < this.columns; column++) {
          const cellEl = rowEl.createChild("div");
          cellEl.element.style.cssText =
            "display: flex; align-items: center; justify-content: center; " +
            "background: #dfe6e9; border: 1px solid #b2bec3; box-sizing: border-box; font-size: 12px;";
          u.cellEls.push(cellEl);
        }
      }
      u.builtRows = this.rows;
      u.builtColumns = this.columns;
    }

    // Real measurement, not a computed guess - the whole point of this
    // page: a genuine pixel budget, handed down and divided, the same
    // principle the toolbar/menu breakpoint above already runs on. Driven
    // straight from context.usableWidth/usableHeight (read above) rather
    // than reading back the grid's own CSS-computed size.
    const controlPanelHeight = u.controlPanel.element.getBoundingClientRect().height;
    const gridWidth = context.usableWidth;
    const gridHeight = context.usableHeight - controlPanelHeight;
    u.grid.element.style.width = gridWidth + "px";
    u.grid.element.style.height = gridHeight + "px";

    const columnGaps = (this.columns - 1) * 4;
    const rowGaps = (this.rows - 1) * 4;
    const cellWidth = (gridWidth - columnGaps) / this.columns;
    const cellHeight = (gridHeight - rowGaps) / this.rows;
    u.cellEls.forEach((cellEl) => {
      cellEl.element.style.width = cellWidth + "px";
      cellEl.element.style.height = cellHeight + "px";
      cellEl.element.textContent = Math.round(cellWidth) + " x " + Math.round(cellHeight);
    });
  }

  onRetract() {
    this.unobservable.el.element.remove();
  }

  onReattach(context) {
    context.target.element.appendChild(this.unobservable.el.element);
  }
}

function createNumberField(container, label, onChange) {
  const wrapper = container.createChild("label");
  wrapper.element.style.cssText = "display: flex; align-items: center; gap: 6px; font-size: 13px;";
  wrapper.element.appendChild(document.createTextNode(label + ":"));
  const field = document.createElement("input");
  field.type = "number";
  field.min = "1";
  field.max = "8";
  field.style.width = "48px";
  field.addEventListener("input", () => {
    const value = Math.max(1, Math.min(8, parseInt(field.value, 10) || 1));
    onChange(value);
  });
  wrapper.element.appendChild(field);
  return field;
}
