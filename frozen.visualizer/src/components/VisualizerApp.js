/**
 * The visualizer: a scenario picker, the object graph, a side panel explaining the current
 * frame, and controls for stepping and playing through the recording.
 */

import { Component, callback } from "@liquefy/cascade.component";
import { div, span, h1, h3, p, ul, li, pre, select, option, input, label, text } from "@liquefy/cascade.dom";
import { row, column, filler, button, iconButton, checkbox, tabBar } from "@liquefy/cascade.ui";
import { GraphView } from "./GraphView.js";
import { colors, cohortColor, stepKinds } from "./colors.js";
import { scenarios } from "../recording/scenarios.js";
import { model, load, goTo, goToTransaction, lastFrame, viewAt } from "../model.js";

const MAX_CHANGES = 40;

const select$ = (id) => {
  model.selected = id;
};

/** An object id that selects the object when clicked. */
function chip(id, { color = null } = {}) {
  const active = model.selected === id;
  return span(
    {
      style: {
        display: "inline-block",
        padding: "1px 6px",
        margin: "1px 3px 1px 0",
        borderRadius: "8px",
        fontFamily: "ui-monospace, monospace",
        fontSize: "11px",
        cursor: "pointer",
        background: active ? colors.selected : "#eef1f5",
        color: active ? "#ffffff" : colors.text,
        borderLeft: color ? `4px solid ${color}` : "none",
      },
      onclick: () => select$(active ? null : id),
    },
    text(id),
  );
}

/** A worklist item that stands for a whole suspended region or meta-region. */
function regionChip(region) {
  return span(
    {
      style: {
        display: "inline-block", padding: "0 6px", margin: "1px 3px 1px 0", borderRadius: "3px",
        fontFamily: "ui-monospace, monospace", fontSize: "11px", border: `1.5px solid ${colors.unstable}`, color: colors.text,
      },
      title: `The whole suspended cluster ${region}`,
    },
    text(`cluster ${region}`),
  );
}

function section(title, ...children) {
  return div(
    { style: { padding: "10px 14px", borderBottom: `1px solid ${colors.line}` } },
    h3({ style: { margin: "0 0 6px 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", color: colors.muted } }, text(title)),
    ...children,
  );
}

function badge(frame) {
  const kind = frame.kind === "check" && frame.reclaimed ? "checkReclaim" : frame.kind;
  const { title, color } = stepKinds[kind] ?? { title: kind, color: colors.muted };
  return span({ style: { background: color, color: "#ffffff", borderRadius: "4px", padding: "2px 8px", fontSize: "12px", fontWeight: 600 } }, text(title));
}

const muted = (content) => span({ style: { color: colors.muted, fontSize: "12px" } }, text(content));

// The legend. Every look GraphView's stylesheet can give an element has an entry here, drawn
// with the same colors, borders and shapes - keep the two in step.

const stableNode = { background: colors.stable, border: `1.5px solid ${colors.stableBorder}` };

/** A small node as the graph draws it. */
function swatch(style, { square = false } = {}) {
  return span({
    style: {
      display: "inline-block", width: "14px", height: "14px", borderRadius: square ? "3px" : "50%", boxSizing: "border-box",
      verticalAlign: "middle", margin: "0 7px 0 3px", flex: "none", ...style,
    },
  });
}

function legendItem(sample, title) {
  return div({ style: { whiteSpace: "nowrap", display: "flex", alignItems: "center" } }, sample, text(title));
}

const nodeItem = (style, title, options) => legendItem(swatch(style, options), title);

/** A ring around a node: the graph's underlay. */
const haloItem = (color, title) => nodeItem({ ...stableNode, boxShadow: `0 0 0 4px ${color}` }, title);

const edgeItem = (style, title) => legendItem(span({ style: { display: "inline-block", width: "22px", margin: "0 6px 0 0", flex: "none", ...style } }), title);

const regionItem = (style, title) => legendItem(span({ style: { display: "inline-block", width: "22px", height: "13px", borderRadius: "3px", boxSizing: "border-box", margin: "0 6px 0 0", flex: "none", background: colors.region, ...style } }), title);

const legendHeading = (title) => div({ style: { gridColumn: "1 / -1", fontWeight: 600, color: colors.muted, marginTop: "4px" } }, text(title));

function legend(view, cohortColors) {
  const unstable = cohortColors ? colors.muted : colors.unstable;
  const cohortNote = cohortColors ? " (cohort's color)" : "";
  return div(
    {
      style: {
        fontSize: "11px", color: colors.text,
        display: "grid", gridTemplateColumns: "repeat(2, auto)", justifyContent: "start", columnGap: "14px", rowGap: "4px",
      },
    },
    legendHeading("Objects"),
    nodeItem({ background: colors.root, transform: "rotate(45deg) scale(0.85)" }, "ROOT", { square: true }),
    nodeItem(stableNode, "stable"),
    nodeItem({ background: "#fff", border: `2.5px dashed ${colors.deferred}` }, "deferred cut"),
    nodeItem({ background: "#fff", border: `2.5px dashed ${colors.held}` }, "held (time)"),
    nodeItem({ background: "#fff", border: `4px solid ${unstable}` }, `unstable${cohortNote}`),
    nodeItem({ background: unstable }, `marked${cohortNote}`),
    nodeItem({ background: `${unstable}4d`, border: `1.5px solid ${unstable}` }, `unstable with its region${cohortNote}`),
    nodeItem({ background: "#fff", border: `2px dotted ${colors.reclaimed}`, opacity: 0.35 }, "reclaimed now"),
    nodeItem(stableNode, "square: shared", { square: true }),
    regionItem({ background: "transparent", border: `1.5px solid ${unstable}`, borderRadius: "8px" }, `cohort outline${cohortNote}`),
    ...(cohortColors && view.cohorts.length > 0
      ? [legendHeading("Cohorts"), ...view.cohorts.map((cohort) => nodeItem({ background: cohortColor(cohort.id) }, cohort.id))]
      : []),
    legendHeading("This step"),
    haloItem(colors.subject, "subject"),
    haloItem(colors.read, "looked at: its record or its edges were read"),
    haloItem(colors.written, "written"),
    nodeItem({ ...stableNode, outline: `3px solid ${colors.selected}`, outlineOffset: "2px" }, "selected"),
    legendHeading("Regions (id · objects)"),
    regionItem({ border: `1px solid ${colors.regionBorder}` }, "region"),
    regionItem({ background: colors.metaLevels[0], border: `1.5px solid ${colors.metaBorder}` }, "meta-region (id · level · clusters, objects): holds region boxes, and is itself in a meta-region one level up; deeper fill for higher levels"),
    regionItem({ border: `2px dashed ${colors.structure}` }, "structure task pending"),
    regionItem({ background: `${unstable}1a`, border: `3px solid ${unstable}` }, `suspended: everything in it is unstable as a unit${cohortNote}`),
    regionItem({ border: `1px solid ${colors.regionBorder}`, boxShadow: `0 0 0 4px ${colors.subject}` }, "this step's region or meta-region"),
    regionItem({ border: `1px dotted ${colors.regionBorder}`, opacity: 0.5 }, "deleted, still shown"),
    legendHeading("Edges"),
    edgeItem({ borderTop: `3px solid ${colors.tree}` }, "spanning tree"),
    edgeItem({ borderTop: `1px solid ${colors.edge}` }, "reference"),
    edgeItem({ borderTop: `2px dotted ${colors.weak}` }, "weak reference"),
    edgeItem({ borderTop: `2px dashed ${colors.flag}` }, "entry flag (regions)"),
    edgeItem({ borderTop: `2px solid ${colors.selected}` }, "selected's edges (others fade)"),
  );
}

export class VisualizerApp extends Component {
  onEstablish() {
    super.onEstablish();
    const u = this.unobservable;
    let last = 0;
    u.timer = setInterval(() => {
      if (!model.playing || !model.recording) return;
      const now = performance.now();
      if (now - last < 1000 / model.speed) return;
      last = now;
      if (model.frame < lastFrame()) goTo(model.frame + 1);
      else model.playing = false;
    }, 15);
    u.keys = (event) => {
      if (!model.recording || ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
      const actions = {
        ArrowRight: () => (event.shiftKey ? goToTransaction(1) : goTo(model.frame + 1)),
        ArrowLeft: () => (event.shiftKey ? goToTransaction(-1) : goTo(model.frame - 1)),
        Home: () => goTo(0),
        End: () => goTo(lastFrame()),
        " ": () => { model.playing = !model.playing; },
        Escape: () => { model.selected = null; },
      };
      if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
      }
    };
    document.addEventListener("keydown", u.keys);
  }

  onDispose() {
    clearInterval(this.unobservable.timer);
    document.removeEventListener("keydown", this.unobservable.keys);
    super.onDispose();
  }

  build() {
    const recording = model.recording;
    const view = recording ? viewAt(recording, model.frame) : null;
    return column(
      { style: { height: "100%", background: colors.background, color: colors.text, fontFamily: "system-ui, sans-serif", fontSize: "13px" } },
      this.header(recording),
      row(
        { style: { flex: "1 1 0", minHeight: 0 } },
        div(
          { style: { flex: "1 1 0", position: "relative", minWidth: 0, background: colors.surface, borderRight: `1px solid ${colors.line}` } },
          recording
            ? new GraphView({
                key: "graph",
                view,
                recordingId: recording.id,
                selected: model.selected,
                onSelect: callback("select", select$),
                showFlags: model.showFlags,
                showWeak: model.showWeak,
                cohortColors: model.cohortColors,
                cohortOutlines: model.cohortOutlines,
                fitRequest: model.fitRequest,
              })
            : div({ style: { padding: "20px", color: colors.reclaimed } }, pre(text(model.error ?? "Nothing loaded"))),
        ),
        div({ style: { width: "360px", overflowY: "auto", background: colors.surface } }, ...(view ? this.panels(recording, view) : [])),
      ),
      recording ? this.controls(recording) : null,
    );
  }

  header(recording) {
    const scenario = scenarios.find((s) => s.key === model.scenarioKey);
    const options = recording ? Object.entries(recording.options).map(([key, value]) => `${key} ${value}`).join(" · ") : "";
    return column(
      { style: { padding: "10px 14px", gap: "6px", background: colors.surface, borderBottom: `1px solid ${colors.line}` } },
      row(
        { style: { alignItems: "center", gap: "12px", flexWrap: "wrap" } },
        h1({ style: { fontSize: "16px", margin: 0 } }, text("frozen · garbage collector")),
        select(
          {
            style: { fontSize: "13px", padding: "4px" },
            onchange: callback("scenario", (event) => load(event.target.value)),
          },
          ...scenarios.map((s) => option({ value: s.key, selected: s.key === model.scenarioKey }, text(s.title))),
        ),
        model.scenarioKey === "random"
          ? row(
              { style: { alignItems: "center", gap: "8px" } },
              label(text("Seed "), input({ type: "number", value: String(model.seed), style: { width: "70px" }, oninput: callback("seed", (event) => { model.seed = event.target.value; }) })),
              label(text("Transactions "), input({ type: "number", value: String(model.transactions), style: { width: "60px" }, oninput: callback("transactions", (event) => { model.transactions = event.target.value; }) })),
              button(text("Record"), callback("record", () => load("random"))),
            )
          : null,
        row(
          { style: { alignItems: "center", gap: "8px" } },
          label(
            { title: "Region weight (objects plus outgoing edges) above which a region splits. Empty: the scenario's." },
            text("Region cap "),
            input({ type: "number", min: "2", value: model.regionCap, placeholder: String(recording?.options.regionCap ?? ""), style: { width: "54px" }, onchange: callback("regionCap", (event) => { model.regionCap = event.target.value; load(model.scenarioKey, { deferCuts: model.deferCuts }); }) }),
          ),
          label(
            { title: "Members above which a meta-region splits, and top-level clusters above which a level is added. Empty: the scenario's." },
            text("Cluster cap "),
            input({ type: "number", min: "2", value: model.clusterCap, placeholder: String(recording?.options.clusterCap ?? 32), style: { width: "54px" }, onchange: callback("clusterCap", (event) => { model.clusterCap = event.target.value; load(model.scenarioKey, { deferCuts: model.deferCuts }); }) }),
          ),
        ),
        checkbox({
          label: "Deferred cuts and holds",
          checked: model.deferCuts,
          onChange: callback("deferCuts", (checked) => load(model.scenarioKey, { deferCuts: checked })),
        }),
        filler(),
        muted(options),
      ),
      p({ style: { margin: 0, color: colors.muted, maxWidth: "1100px" } }, text(scenario?.description ?? "")),
    );
  }

  /** The sidebar: tabs, so that what grows and shrinks (cohorts) doesn't move the rest. */
  panels(recording, view) {
    const pending = view.deferrals.length + view.structureTasks.length + view.rehomeTasks.length;
    const tabs = [
      { key: "step", title: "Step" },
      { key: "cohorts", title: `Cohorts (${view.cohorts.length})${pending ? ` · ${pending} pending` : ""}` },
      { key: "legend", title: "Legend" },
    ];
    const content = {
      step: () => this.stepPanels(recording, view),
      cohorts: () => this.cohortPanels(view),
      legend: () => [section("Legend", legend(view, model.cohortColors))],
    }[model.sidebarTab]();
    return [
      tabBar({
        tabs,
        selected: model.sidebarTab,
        onSelect: callback("tab", (key) => { model.sidebarTab = key; }),
        style: { position: "sticky", top: 0, zIndex: 1, background: colors.surface, borderBottom: `1px solid ${colors.line}` },
      }),
      ...content,
    ];
  }

  stepPanels(recording, view) {
    const frame = recording.timeline.frame(model.frame);
    const changes = view.changes;
    const objects = view.objects.filter((o) => o.display !== "reclaimed");
    return [
      section(
        "This step",
        row({ style: { alignItems: "center", gap: "8px", marginBottom: "6px" } }, badge(frame), muted(`frame ${model.frame + 1} of ${recording.timeline.length} · clock ${view.clock}`)),
        p({ style: { margin: "4px 0", fontWeight: 600, lineHeight: 1.35 } }, text(view.summary)),
        view.caption ? p({ style: { margin: "6px 0", padding: "6px 8px", background: "#fff8db", borderLeft: `3px solid ${colors.subject}`, lineHeight: 1.35 } }, text(view.caption)) : null,
        changes.length > 0
          ? ul(
              { style: { margin: "6px 0 0 0", paddingLeft: "18px", lineHeight: 1.45 } },
              ...changes.slice(0, MAX_CHANGES).map((change) => li(text(change))),
              changes.length > MAX_CHANGES ? li(text(`and ${changes.length - MAX_CHANGES} more`)) : null,
            )
          : muted("No object changed."),
        frame.reads.length > 0 ? div({ style: { marginTop: "6px" } }, muted(`Objects looked at (${frame.reads.length}): `), ...frame.reads.map((id) => chip(id))) : null,
      ),
      model.selected ? this.selection(view) : null,
      section(
        "Database",
        muted(`${objects.length} objects · ${view.regions.filter((r) => !r.ghost && r.level === 0).length} regions · ${view.regions.filter((r) => r.level > 0).length} meta-regions · ${view.flags.length} entry flags · ${view.edges.length} edges`),
      ),
    ];
  }

  cohortPanels(view) {
    return [
      section("Cohorts", ...(view.cohorts.length > 0 ? view.cohorts.map((cohort) => this.cohort(cohort)) : [muted("None: nothing is being collected.")])),
      section("Deferred cuts", ...(view.deferrals.length > 0
        ? view.deferrals.map((d) => div(chip(d.id, { color: d.kind === "ms" ? colors.held : colors.deferred }), muted(`until ${d.deadline}`)))
        : [muted("None.")])),
      section("Structure tasks", muted(view.structureTasks.length > 0 ? `Clusters to re-check: ${view.structureTasks.join(", ")}` : "None."), view.rehomeTasks.length > 0 ? div(muted(`To re-home (when nothing else is pending): ${view.rehomeTasks.join(", ")}`)) : null),
    ];
  }

  cohort(cohort) {
    // Region items ("@r5") stand for a whole suspended region.
    const item = (id) => (id.startsWith("@") ? regionChip(id.slice(1)) : chip(id));
    const list = (name, ids) => div({ style: { margin: "2px 0" } }, muted(`${name} (${ids.length}): `), ...ids.map(item));
    const regions = cohort.regions.length ? ` · suspended regions ${cohort.regions.join(", ")}` : "";
    return div(
      { style: { marginBottom: "8px" } },
      div(swatch({ background: model.cohortColors ? cohortColor(cohort.id) : colors.unstable }), span({ style: { fontWeight: 600 } }, text(cohort.id)),
        muted(` · ${cohort.state} · ${cohort.members.length} members${regions}${cohort.absorbed.length ? ` · absorbed ${cohort.absorbed.join(", ")}` : ""}`)),
      list("expand", cohort.expand),
      list("mark", cohort.mark),
      list("check", cohort.check),
    );
  }

  selection(view) {
    const object = view.objects.find((o) => o.id === model.selected);
    if (!object) return section("Selected", muted(`${model.selected} does not exist at this frame.`));
    const referrers = view.edges.filter((e) => e.target === object.id);
    const facts = [
      ["state", object.display],
      ["region", object.region],
      ["tree parent", object.treeParent ?? "none"],
      ["cohort", object.cohort ?? "none"],
      ["shared", object.shared ? "yes" : "no"],
    ];
    return section(
      `Selected: ${object.id}`,
      ...facts.map(([name, value]) => div(muted(`${name}: `), text(String(value)))),
      div({ style: { marginTop: "4px" } }, muted("referrers: "), ...(referrers.length ? referrers.map((e) => chip(e.source)) : [muted("none")])),
      pre({ style: { margin: "6px 0 0 0", padding: "6px", background: colors.background, fontSize: "11px", whiteSpace: "pre-wrap" } }, text(JSON.stringify(object.fields, null, 1))),
    );
  }

  controls(recording) {
    const last = recording.timeline.length - 1;
    const control = (icon, title, action, disabled = false) => iconButton({ icon, title, disabled, onClick: action });
    return row(
      { style: { alignItems: "center", gap: "4px", padding: "6px 12px", background: colors.surface, borderTop: `1px solid ${colors.line}` } },
      control("first_page", "First frame (Home)", callback("first", () => goTo(0)), model.frame === 0),
      control("skip_previous", "Previous transaction (Shift+Left)", callback("previousTransaction", () => goToTransaction(-1)), model.frame === 0),
      control("chevron_left", "Previous step (Left)", callback("previous", () => goTo(model.frame - 1)), model.frame === 0),
      control(model.playing ? "pause" : "play_arrow", "Play or pause (Space)", callback("play", () => {
        if (!model.playing && model.frame === last) goTo(0);
        model.playing = !model.playing;
      })),
      control("chevron_right", "Next step (Right)", callback("next", () => goTo(model.frame + 1)), model.frame === last),
      control("skip_next", "Next transaction (Shift+Right)", callback("nextTransaction", () => goToTransaction(1)), model.frame === last),
      control("last_page", "Last frame (End)", callback("last", () => goTo(last)), model.frame === last),
      input({
        type: "range",
        min: "0",
        max: String(last),
        value: String(model.frame),
        style: { flex: "1 1 0", margin: "0 10px" },
        oninput: callback("seek", (event) => goTo(Number(event.target.value))),
      }),
      muted(`${model.frame + 1} / ${last + 1}`),
      label(
        { style: { marginLeft: "12px", fontSize: "12px" } },
        text("Speed "),
        select(
          { onchange: callback("speed", (event) => { model.speed = Number(event.target.value); }) },
          ...[1, 2, 4, 8, 16, 30].map((speed) => option({ value: String(speed), selected: speed === model.speed }, text(`${speed}/s`))),
        ),
      ),
      checkbox({ label: "Flags", checked: model.showFlags, onChange: callback("flags", (checked) => { model.showFlags = checked; }) }),
      checkbox({ label: "Cohort outlines", checked: model.cohortOutlines, onChange: callback("cohortOutlines", (checked) => { model.cohortOutlines = checked; }) }),
      checkbox({ label: "Cohort colors", checked: model.cohortColors, onChange: callback("cohortColors", (checked) => { model.cohortColors = checked; }) }),
      checkbox({ label: "Weak", checked: model.showWeak, onChange: callback("weak", (checked) => { model.showWeak = checked; }) }),
      control("fit_screen", "Fit the graph", callback("fit", () => { model.fitRequest++; })),
    );
  }
}
