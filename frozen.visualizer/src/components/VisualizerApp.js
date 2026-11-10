/**
 * The visualizer: a scenario picker, the object graph, a side panel explaining the current
 * frame, and controls for stepping and playing through the recording.
 */

import { Component, callback } from "@liquefy/cascade.component";
import { div, span, h1, h3, p, ul, li, pre, select, option, input, label, text } from "@liquefy/cascade.dom";
import { row, column, filler, button, iconButton, checkbox } from "@liquefy/cascade.ui";
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

function section(title, ...children) {
  return div(
    { style: { padding: "10px 14px", borderBottom: `1px solid ${colors.line}` } },
    h3({ style: { margin: "0 0 6px 0", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", color: colors.muted } }, text(title)),
    ...children,
  );
}

function badge(kind) {
  const { title, color } = stepKinds[kind] ?? { title: kind, color: colors.muted };
  return span({ style: { background: color, color: "#ffffff", borderRadius: "4px", padding: "2px 8px", fontSize: "12px", fontWeight: 600 } }, text(title));
}

const muted = (content) => span({ style: { color: colors.muted, fontSize: "12px" } }, text(content));

function swatch(style) {
  return span({ style: { display: "inline-block", width: "14px", height: "14px", borderRadius: "50%", boxSizing: "border-box", verticalAlign: "middle", marginRight: "5px", ...style } });
}

function legendItem(swatchStyle, title) {
  return div({ style: { whiteSpace: "nowrap" } }, swatch(swatchStyle), text(title));
}

function edgeSample(style, title) {
  return div({ style: { whiteSpace: "nowrap" } }, span({ style: { display: "inline-block", width: "22px", verticalAlign: "middle", marginRight: "5px", ...style } }), text(title));
}

function legend() {
  return div(
    {
      style: {
        position: "absolute", left: "10px", bottom: "10px", padding: "8px 10px", background: "rgba(255,255,255,0.92)",
        border: `1px solid ${colors.line}`, borderRadius: "6px", fontSize: "11px", color: colors.text,
        display: "grid", gridTemplateColumns: "auto auto auto", columnGap: "14px", rowGap: "3px", pointerEvents: "none",
      },
    },
    legendItem({ background: colors.stable, border: `1.5px solid ${colors.stableBorder}` }, "stable"),
    legendItem({ background: "#fff", border: `2.5px dashed ${colors.deferred}` }, "deferred"),
    legendItem({ background: "#fff", border: `2.5px dashed ${colors.held}` }, "held (time)"),
    legendItem({ background: "#fff", border: `4px solid ${colors.muted}` }, "unstable"),
    legendItem({ background: colors.muted }, "marked"),
    legendItem({ background: "#fff", border: `2px dotted ${colors.reclaimed}`, opacity: 0.6 }, "reclaimed"),
    legendItem({ background: colors.stable, borderRadius: "3px", border: `1.5px solid ${colors.stableBorder}` }, "shared"),
    legendItem({ background: colors.subject }, "this step's subject"),
    legendItem({ background: colors.read }, "record read"),
    edgeSample({ borderTop: `3px solid ${colors.tree}` }, "tree edge"),
    edgeSample({ borderTop: `1px solid ${colors.edge}` }, "reference"),
    edgeSample({ borderTop: `2px dotted ${colors.weak}` }, "weak"),
    edgeSample({ borderTop: `2px dashed ${colors.flag}` }, "entry flag"),
    legendItem({ background: colors.written }, "written"),
    legendItem({ background: "#fff", borderRadius: "3px", border: `2px dashed ${colors.structure}` }, "structure task"),
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
                fitRequest: model.fitRequest,
              })
            : div({ style: { padding: "20px", color: colors.reclaimed } }, pre(text(model.error ?? "Nothing loaded"))),
          legend(),
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
        filler(),
        muted(options),
      ),
      p({ style: { margin: 0, color: colors.muted, maxWidth: "1100px" } }, text(scenario?.description ?? "")),
    );
  }

  panels(recording, view) {
    const frame = recording.timeline.frame(model.frame);
    const changes = view.changes;
    const objects = view.objects.filter((o) => o.display !== "reclaimed");
    return [
      section(
        "This step",
        row({ style: { alignItems: "center", gap: "8px", marginBottom: "6px" } }, badge(frame.kind), muted(`frame ${model.frame + 1} of ${recording.timeline.length} · clock ${view.clock}`)),
        p({ style: { margin: "4px 0", fontWeight: 600, lineHeight: 1.35 } }, text(view.summary)),
        view.caption ? p({ style: { margin: "6px 0", padding: "6px 8px", background: "#fff8db", borderLeft: `3px solid ${colors.subject}`, lineHeight: 1.35 } }, text(view.caption)) : null,
        changes.length > 0
          ? ul(
              { style: { margin: "6px 0 0 0", paddingLeft: "18px", lineHeight: 1.45 } },
              ...changes.slice(0, MAX_CHANGES).map((change) => li(text(change))),
              changes.length > MAX_CHANGES ? li(text(`and ${changes.length - MAX_CHANGES} more`)) : null,
            )
          : muted("No object changed."),
        frame.reads.length > 0 ? div({ style: { marginTop: "6px" } }, muted(`Records read (${frame.reads.length}): `), ...frame.reads.map((id) => chip(id))) : null,
      ),
      view.cohorts.length > 0
        ? section("Cohorts", ...view.cohorts.map((cohort) => this.cohort(cohort)))
        : null,
      view.deferrals.length > 0
        ? section("Deferred cuts", ...view.deferrals.map((d) => div(chip(d.id, { color: d.kind === "ms" ? colors.held : colors.deferred }), muted(`until ${d.deadline}`))))
        : null,
      view.structureTasks.length > 0 ? section("Structure tasks", muted(`Regions to re-check: ${view.structureTasks.join(", ")}`)) : null,
      model.selected ? this.selection(view) : null,
      section(
        "Database",
        muted(`${objects.length} objects · ${view.regions.filter((r) => !r.ghost).length} regions · ${view.flags.length} entry flags · ${view.edges.length} edges`),
      ),
    ];
  }

  cohort(cohort) {
    const list = (name, ids) => div({ style: { margin: "2px 0" } }, muted(`${name} (${ids.length}): `), ...ids.map((id) => chip(id)));
    return div(
      { style: { marginBottom: "8px" } },
      div(swatch({ background: cohortColor(cohort.id) }), span({ style: { fontWeight: 600 } }, text(cohort.id)),
        muted(` · ${cohort.state} · ${cohort.members.length} members${cohort.absorbed.length ? ` · absorbed ${cohort.absorbed.join(", ")}` : ""}`)),
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
      checkbox({ label: "Weak", checked: model.showWeak, onChange: callback("weak", (checked) => { model.showWeak = checked; }) }),
      control("fit_screen", "Fit the graph", callback("fit", () => { model.fitRequest++; })),
    );
  }
}
