/**
 * The object graph, drawn with Cytoscape.js.
 *
 * A DOMNodeComponent (cascade manual 11.24): it creates its own element and Cytoscape instance
 * once, and on every change of its properties brings the graph up to date by diffing: elements
 * that are gone are removed, new ones added next to their tree parent, and the rest get new
 * data and classes. The layout (fcose, which understands regions as compound nodes) runs only
 * when the graph's structure changed, starting from the current positions, so that stepping
 * through a timeline moves as little as possible.
 */

import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { BubbleSetsPlugin } from "cytoscape-bubblesets";
import { layers } from "cytoscape-layers";
import { DOMNodeComponent } from "@liquefy/cascade.dom";
import { cohortColor, colors } from "./colors.js";

cytoscape.use(fcose);

const MAX_LABEL = 16;

const shorten = (text) => (text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text);

const style = [
  {
    selector: "node.object",
    style: {
      width: 22,
      height: 22,
      label: "data(label)",
      "font-size": 8,
      "text-wrap": "wrap",
      "text-valign": "bottom",
      "text-margin-y": 3,
      color: colors.text,
      "background-color": colors.stable,
      "border-width": 1.5,
      "border-color": colors.stableBorder,
    },
  },
  { selector: "node.root", style: { "background-color": colors.root, "border-color": colors.root, shape: "diamond", width: 28, height: 28 } },
  { selector: "node.deferred", style: { "background-color": "#ffffff", "border-color": colors.deferred, "border-style": "dashed", "border-width": 2.5 } },
  { selector: "node.held", style: { "background-color": "#ffffff", "border-color": colors.held, "border-style": "dashed", "border-width": 2.5 } },
  { selector: "node.unstable", style: { "background-color": "#ffffff", "border-color": "data(color)", "border-width": 4 } },
  { selector: "node.marked", style: { "background-color": "data(color)", "border-color": "data(color)", "border-width": 2 } },
  // Implicitly unstable: unstable because its region is suspended, still on its internal tree.
  { selector: "node.suspended", style: { "background-color": "data(color)", "background-opacity": 0.3, "border-color": "data(color)", "border-width": 1.5 } },
  { selector: "node.reclaimed", style: { opacity: 0.35, "background-color": "#ffffff", "border-color": colors.reclaimed, "border-style": "dotted", "border-width": 2 } },
  { selector: "node.shared", style: { shape: "round-rectangle" } },
  { selector: "node.read", style: { "underlay-color": colors.read, "underlay-opacity": 0.55, "underlay-padding": 5, "underlay-shape": "ellipse" } },
  { selector: "node.written", style: { "underlay-color": colors.written, "underlay-opacity": 0.6, "underlay-padding": 5, "underlay-shape": "ellipse" } },
  { selector: "node.subject", style: { "underlay-color": colors.subject, "underlay-opacity": 0.9, "underlay-padding": 8, "underlay-shape": "ellipse" } },
  // An outline, so that the selected object's own border (its GC state) stays visible.
  { selector: "node.selected", style: { "outline-color": colors.selected, "outline-width": 3, "outline-offset": 2, "outline-opacity": 1, "font-weight": "bold" } },
  {
    selector: "node.region",
    style: {
      label: "data(label)",
      "font-size": 10,
      "text-valign": "top",
      "text-halign": "center",
      "text-margin-y": -2,
      color: colors.muted,
      "background-color": colors.region,
      "background-opacity": 1,
      "border-color": colors.regionBorder,
      "border-width": 1,
      shape: "round-rectangle",
      padding: 12,
    },
  },
  // Meta-regions: a box around the region boxes it holds, lighter the higher the level.
  { selector: "node.region.meta", style: { "background-color": "data(fill)", "background-opacity": 0.5, "border-color": colors.metaBorder, "border-width": 1.5, "border-style": "solid", padding: 10, "font-size": 11, "font-weight": "bold" } },
  { selector: "node.region.pending", style: { "border-color": colors.structure, "border-style": "dashed", "border-width": 2 } },
  { selector: "node.region.suspended", style: { "background-color": "data(color)", "background-opacity": 0.1, "border-color": "data(color)", "border-style": "solid", "border-width": 3, color: "data(color)" } },
  { selector: "node.region.selected", style: { "outline-color": colors.selected, "outline-width": 3, "outline-offset": 1, "outline-opacity": 1 } },
  { selector: "node.region.ghost", style: { "border-style": "dotted", "background-opacity": 0.3 } },
  { selector: "node.region.subject", style: { "underlay-color": colors.subject, "underlay-opacity": 0.6, "underlay-padding": 6, "underlay-shape": "round-rectangle" } },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": colors.edge,
      "target-arrow-color": colors.edge,
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.7,
      "curve-style": "bezier",
    },
  },
  { selector: "edge.tree", style: { width: 2.5, "line-color": colors.tree, "target-arrow-color": colors.tree } },
  { selector: "edge.weak", style: { "line-style": "dotted", "line-color": colors.weak, "target-arrow-color": colors.weak } },
  { selector: "edge.flag", style: { width: 1.5, "line-style": "dashed", "line-color": colors.flag, "target-arrow-color": colors.flag, opacity: 0.8 } },
  { selector: "edge.flag.copied", style: { "line-style": "dotted", opacity: 0.45 } },
  { selector: "edge.flag.meta", style: { width: 1, "line-style": "dashed", opacity: 0.45 } },
  { selector: "edge.dimmed", style: { opacity: 0.25 } },
  { selector: "edge.selected", style: { "line-color": colors.selected, "target-arrow-color": colors.selected, opacity: 1, label: "data(label)", "font-size": 8, "text-background-color": "#ffffff", "text-background-opacity": 0.8 } },
];

/** The Cytoscape elements for a view, as a Map from id to { group, data, classes }. */
function elementsOf(view, { selected, showFlags, metaFlags, showWeak, cohortColors }) {
  const elements = new Map();
  const { highlight } = view;
  // A selected cluster, or the region of a selected object: only its flags are shown.
  const selectedCluster = selected?.startsWith("R:") ? selected.slice(2) : null;
  const focus = selected === null ? null : selectedCluster ?? view.objects.find((object) => object.id === selected)?.region ?? null;
  for (const region of view.regions) {
    const classes = ["region"];
    if (region.pending) classes.push("pending");
    if (region.ghost) classes.push("ghost");
    if (highlight.region === region.id) classes.push("subject");
    if (selectedCluster === region.id) classes.push("selected");
    let label = region.level > 0 ? `${region.id} · level ${region.level} · ${region.members} clusters, ${region.objects} objects` : `${region.id} · ${region.members}`;
    let color = colors.regionBorder;
    if (region.level > 0) classes.push("meta");
    if (region.suspended) {
      classes.push("suspended");
      label += ` · suspended in ${region.suspended.cohort}`;
      color = cohortColors ? cohortColor(region.suspended.cohort) : colors.unstable;
    }
    elements.set(`R:${region.id}`, {
      group: "nodes",
      data: {
        id: `R:${region.id}`,
        parent: region.container ? `R:${region.container}` : undefined,
        level: region.level,
        label,
        color,
        fill: colors.metaLevels[Math.min(region.level, colors.metaLevels.length) - 1] ?? colors.region,
      },
      classes: classes.join(" "),
    });
  }
  for (const object of view.objects) {
    const classes = ["object", object.display];
    if (object.shared) classes.push("shared");
    if (highlight.subject.has(object.id)) classes.push("subject");
    else if (highlight.written.has(object.id)) classes.push("written");
    else if (highlight.read.has(object.id)) classes.push("read");
    if (selected === object.id) classes.push("selected");
    const label = object.caption ? `${object.id}\n${shorten(object.caption)}` : object.id;
    elements.set(object.id, {
      group: "nodes",
      data: {
        id: object.id,
        parent: object.region ? `R:${object.region}` : undefined,
        label,
        color: object.cohort ? (cohortColors ? cohortColor(object.cohort) : colors.unstable) : colors.stable,
        treeParent: object.treeParent,
      },
      classes: classes.join(" "),
    });
  }
  for (const edge of view.edges) {
    if (edge.kind === "weak" && !showWeak) continue;
    const classes = [edge.kind];
    if (selected !== null && selectedCluster === null) classes.push(edge.source === selected || edge.target === selected ? "selected" : "dimmed");
    elements.set(edge.id, { group: "edges", data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label }, classes: classes.join(" ") });
  }
  if (showFlags) {
    for (const flag of view.flags) {
      const touches = focus !== null && (flag.source === focus || flag.target === focus);
      if (focus !== null && !touches) continue;
      if (flag.level > 0 && !metaFlags && !touches) continue;
      elements.set(flag.id, { group: "edges", data: { id: flag.id, source: `R:${flag.source}`, target: `R:${flag.target}` }, classes: `flag${flag.level > 0 ? " meta" : ""}${flag.copied ? " copied" : ""}` });
    }
  }
  return elements;
}

export class GraphView extends DOMNodeComponent {
  setProperties({ view, recordingId, selected = null, onSelect = null, showFlags = true, metaFlags = false, showWeak = true, cohortColors = false, cohortOutlines = true, fitRequest = 0 }) {
    this.cohortColors = cohortColors;
    this.cohortOutlines = cohortOutlines;
    this.view = view;
    this.recordingId = recordingId;
    this.selected = selected;
    this.onSelect = onSelect;
    this.showFlags = showFlags;
    this.metaFlags = metaFlags;
    this.showWeak = showWeak;
    this.fitRequest = fitRequest;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node) {
      u.node = document.createElement("div");
      Object.assign(u.node.style, { width: "100%", height: "100%", position: "absolute", inset: "0" });
      u.cy = cytoscape({ container: u.node, style, layout: { name: "preset" }, minZoom: 0.1, maxZoom: 1.6, wheelSensitivity: 0.3 });
      u.cy.on("tap", "node.object", (event) => u.onSelect?.(event.target.id()));
      // A cluster's node id is "R:<id>", which is also how a selected cluster is named.
      u.cy.on("tap", "node.region", (event) => u.onSelect?.(event.target.id()));
      u.cy.on("tap", (event) => {
        if (event.target === u.cy) u.onSelect?.(null);
      });
      // Cohort outlines, drawn just above the nodes: below them, the opaque region boxes
      // would hide them.
      u.outlines = new Map(); // cohort id → { path, signature }
      u.bubbles = new BubbleSetsPlugin(u.cy, { layer: layers(u.cy).nodeLayer.insertAfter("svg") });
      u.bubbles.layer.node.style.pointerEvents = "none";
      u.resizeObserver = new ResizeObserver(() => u.cy.resize());
      u.resizeObserver.observe(u.node);
    }
    u.onSelect = this.onSelect;
    if (this.view) this.update(u);
    if (u.fitRequest !== this.fitRequest) {
      u.fitRequest = this.fitRequest;
      u.cy.animate({ fit: { padding: 30 } }, { duration: 250 });
    }
    return u.node;
  }

  update(u) {
    const { cy } = u;
    const fresh = u.recordingId !== this.recordingId;
    u.recordingId = this.recordingId;
    const wanted = elementsOf(this.view, { selected: this.selected, showFlags: this.showFlags, metaFlags: this.metaFlags, showWeak: this.showWeak, cohortColors: this.cohortColors });
    let structureChanged = fresh;

    cy.batch(() => {
      if (fresh) {
        this.removeOutlines(u, () => true);
        cy.elements().remove();
      }
      // Remove what is gone (edges first, so that removing a region does not take its members).
      cy.edges().forEach((edge) => {
        if (!wanted.has(edge.id())) {
          edge.remove();
          structureChanged = true;
        }
      });
      cy.nodes().forEach((node) => {
        if (!wanted.has(node.id())) {
          node.children().move({ parent: null });
          node.remove();
          structureChanged = true;
        }
      });

      // Clusters first, from the top level down, then objects, then edges: parents and
      // endpoints must exist.
      const order = [...wanted.values()].sort((a, b) => rank(a) - rank(b));
      for (const element of order) {
        const existing = cy.getElementById(element.data.id);
        if (existing.nonempty()) {
          if (element.group === "nodes" && (existing.data("parent") ?? undefined) !== element.data.parent) {
            existing.move({ parent: element.data.parent ?? null });
            structureChanged = true;
          }
          const { parent, ...data } = element.data;
          existing.data(data);
          existing.classes(element.classes);
          continue;
        }
        const added = cy.add({ group: element.group, data: element.data, classes: element.classes });
        if (element.group === "nodes" && !element.data.id.startsWith("R:")) {
          added.position(startingPosition(cy, element.data));
        }
        structureChanged = true;
      }
    });

    this.updateOutlines(u);
    if (structureChanged) this.layout(u, fresh);
  }

  /**
   * Lays out the graph at the next animation frame: the first time, the element is not in the
   * page yet, and while playing fast, several updates in one frame need only one layout.
   */
  /**
   * One outline per cohort around its members (a bubble set: it routes around other objects,
   * and follows the nodes as they move). An outline is redrawn when its members or color change.
   */
  updateOutlines(u) {
    const wanted = new Map();
    if (this.cohortOutlines) {
      for (const cohort of this.view.cohorts) {
        if (cohort.members.length === 0) continue;
        const color = this.cohortColors ? cohortColor(cohort.id) : colors.unstable;
        wanted.set(cohort.id, { members: cohort.members, color, signature: `${color}|${cohort.members.join(",")}` });
      }
    }
    this.removeOutlines(u, (id, outline) => wanted.get(id)?.signature !== outline.signature);
    const objects = u.cy.nodes(".object");
    for (const [id, outline] of wanted) {
      if (u.outlines.has(id)) continue;
      const members = objects.filter((node) => outline.members.includes(node.id()));
      if (members.empty()) continue;
      const path = u.bubbles.addPath(members, null, objects.difference(members), {
        virtualEdges: true,
        nonMemberInfluenceFactor: -2.5, // push harder away from objects outside the cohort
        style: { fill: outline.color, fillOpacity: "0.1", stroke: outline.color, strokeWidth: "1.5", strokeOpacity: "0.9" },
      });
      u.outlines.set(id, { path, signature: outline.signature });
    }
  }

  removeOutlines(u, test) {
    for (const [id, outline] of u.outlines) {
      if (!test(id, outline)) continue;
      u.bubbles.removePath(outline.path);
      u.outlines.delete(id);
    }
  }

  layout(u, fresh) {
    u.freshLayout = u.freshLayout || fresh;
    if (u.layoutFrame) return;
    u.layoutFrame = requestAnimationFrame(() => {
      u.layoutFrame = null;
      const fresh = u.freshLayout;
      u.freshLayout = false;
      if (u.cy.destroyed()) return;
      u.cy.resize();
      this.runLayout(u, fresh);
    });
  }

  runLayout(u, fresh) {
    u.layout?.stop();
    u.layout = u.cy.layout({
      name: "fcose",
      quality: fresh ? "proof" : "default",
      randomize: fresh,
      animate: !fresh,
      animationDuration: 250,
      fit: fresh,
      padding: 30,
      nodeDimensionsIncludeLabels: true,
      idealEdgeLength: 45,
      nodeRepulsion: 6000,
      nestingFactor: 0.15,
      gravity: 0.3,
      tile: true,
    });
    // Whatever moved out of view is brought back: the graph is fitted when it no longer fits.
    u.layout.one("layoutstop", () => {
      if (u.cy.destroyed() || u.cy.elements().empty()) return;
      const box = u.cy.elements().boundingBox();
      const extent = u.cy.extent();
      if (box.x1 < extent.x1 || box.x2 > extent.x2 || box.y1 < extent.y1 || box.y2 > extent.y2) {
        u.cy.animate({ fit: { padding: 30 } }, { duration: 200 });
      }
    });
    u.layout.run();
  }

  onDispose() {
    const u = this.unobservable;
    u.layout?.stop();
    if (u.layoutFrame) cancelAnimationFrame(u.layoutFrame);
    u.resizeObserver?.disconnect();
    u.bubbles?.destroy();
    u.cy?.destroy();
    super.onDispose();
  }
}

function rank(element) {
  if (element.group === "edges") return 1000;
  return element.data.id.startsWith("R:") ? -element.data.level : 100;
}

/** A new node starts next to its tree parent, or in its region, so the layout moves it little. */
function startingPosition(cy, data) {
  const jitter = () => (Math.random() - 0.5) * 40;
  const parent = data.treeParent ? cy.getElementById(data.treeParent) : null;
  if (parent && parent.nonempty() && parent.id() !== data.id) {
    const { x, y } = parent.position();
    return { x: x + jitter(), y: y + 40 + jitter() };
  }
  const region = data.parent ? cy.getElementById(data.parent) : null;
  if (region && region.nonempty() && region.children().length > 1) {
    const box = region.boundingBox();
    return { x: (box.x1 + box.x2) / 2 + jitter(), y: (box.y1 + box.y2) / 2 + jitter() };
  }
  const extent = cy.extent();
  return { x: (extent.x1 + extent.x2) / 2 + jitter(), y: (extent.y1 + extent.y2) / 2 + jitter() };
}
