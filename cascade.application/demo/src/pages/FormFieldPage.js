import { Component, callback, deeplyObservable, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, span, text, input, label, select, option, table, thead, tbody, tr, th, td } from "@liquefy/cascade.dom";
import { button, card, checkbox, icon, row, column, themeColor } from "@liquefy/cascade.ui";
import { pageActions, informationBox } from "../components/pageActions.js";
import { pageColumn, sectionTitle } from "../components/layout.js";
import source from "./FormFieldPage.js?raw";

// What this page is about - first on the page (see
// ../components/pageActions.js's informationBox()).
const information = {
  summary: "Form fields with a state vocabulary - disabled, readonly, invalid, valid, error, flux, updating and locked - each with a look of its own.",
  points: [
    "Most of it is the browser's: disabled, readonly, :user-invalid and :user-valid come from the input's own attributes and pseudo-classes, and the field only renders the attributes.",
    "The rest is about a server: an unsaved change (flux), a value being loaded (updating), someone else editing (locked), a save that failed (error). Cascade never shows anything between two waves, so none of this is Cascade's own updating - it lasts as long as a request does, over several waves.",
    "So it's kept as plain observable data next to the value - what the server has, whether it's loading, what went wrong - written by the event handlers and by the server's replies. The field reads it, and works out one data-state from it.",
    "Edit a field and leave it to save it. Make the server slow, reject values or go offline, and watch the state table follow.",
  ],
};

/**
 * Form Field - a sketch of form fields with a state vocabulary: a field's
 * value tracked together with what is known about it beyond the value
 * (trackedField()), and a FormField that shows it - one data-state on its
 * input group, and the attributes its input takes - styled by a small
 * stylesheet of its own, since :has(), :user-invalid and :user-valid can't
 * be written as inline style.
 *
 * Two layers, kept apart:
 * - The browser's own states - disabled, readonly, :user-invalid,
 *   :user-valid - stay the browser's. Whether the user has touched a field
 *   yet is the browser's to know (:user-invalid waits for it), so nothing
 *   here keeps it.
 * - The server's states - flux, updating, locked, error - are data,
 *   written outside any repeater: by an event handler, or by a server
 *   reply arriving later. Each write is a wave of its own; a state that
 *   "lasts" is just a value that stays written until the reply comes.
 */
export class FormFieldPage extends Component {
  initialState() {
    // Disabled and read only are the form's, not the data's: the page
    // decides them. Locked is the data's (someone else is editing it).
    return { disabled: false, readonly: false };
  }

  build() {
    const { disabled, readonly } = this;
    return pageColumn(
      pageActions({ source, fileName: "src/pages/FormFieldPage.js" }),
      informationBox(information),
      row(
        { style: { gap: "16px", flexWrap: "wrap", alignItems: "flex-start" } },
        card(
          { style: { flex: "1 1 320px", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "14px" } },
          sectionTitle("Contact details"),
          new FormField({ label: "Name", field: fields.name, required: true, disabled, readonly }),
          new FormField({ label: "Email", field: fields.email, type: "email", required: true, disabled, readonly }),
          new FormField({ label: "Phone", field: fields.phone, type: "tel", pattern: "\\+?[0-9 \\-]{6,}", hint: "Digits, spaces and dashes.", disabled, readonly }),
          new FormField({ label: "Company", field: fields.company, disabled, readonly }),
        ),
        column(
          { style: { flex: "1 1 320px", gap: "16px" } },
          this.serverControls(),
          new StateTable(),
        ),
      ),
    );
  }

  serverControls() {
    const anyLocked = Object.values(fields).some((field) => field.locked);
    return card(
      { style: { display: "flex", flexDirection: "column", gap: "10px" } },
      sectionTitle("The server, and the form"),
      row(
        { style: { alignItems: "center", gap: "8px" } },
        span(text("Saves are")),
        select(
          {
            value: server.behavior,
            onchange: callback("behavior", (event) => { server.behavior = event.target.value; }),
            style: { height: "32px", padding: "0 6px", font: "inherit", color: "inherit", border: "1px solid " + themeColor.border, borderRadius: "6px", background: themeColor.surface },
          },
          option({ value: "accept" }, text("accepted")),
          option({ value: "reject" }, text("rejected (about the value)")),
          option({ value: "offline" }, text("lost (the server is offline)")),
        ),
      ),
      row(
        { style: { alignItems: "center", gap: "8px" } },
        span(text("Latency")),
        input({
          type: "range", min: 0, max: 4000, step: 100, value: server.latency, title: "Latency",
          oninput: callback("latency", (event) => { server.latency = Number(event.target.value); }),
          style: { flex: "1 1 auto", margin: 0, accentColor: themeColor.chrome },
        }),
        span({ style: { minWidth: "52px", textAlign: "right", fontVariantNumeric: "tabular-nums" } }, text((server.latency / 1000).toFixed(1) + " s")),
      ),
      row(
        { style: { alignItems: "center", gap: "12px", flexWrap: "wrap" } },
        checkbox({ label: "Disabled", checked: this.disabled, onChange: callback("disabled", (checked) => { this.disabled = checked; }) }),
        checkbox({ label: "Read only", checked: this.readonly, onChange: callback("readonly", (checked) => { this.readonly = checked; }) }),
        checkbox({ label: "Locked by someone else", checked: anyLocked, onChange: callback("locked", (checked) => {
          transaction(() => Object.values(fields).forEach((field) => { field.locked = checked; }));
        }) }),
      ),
      button({ style: { alignSelf: "flex-start" } }, text("Reload from server"), callback("reload", () => Object.values(fields).forEach(reload))),
    );
  }
}

// --- The model: a value, and what is known about it ---

/**
 * A field's value, tracked together with what is known about it beyond
 * the value - all of it plain observable data:
 * - value: what the field shows, as the user edits it.
 * - initial: the value as loaded - `value !== initial` is "modified".
 * - saved: what the server has - `value !== saved` is "flux".
 * - saving: how many saves are on their way.
 * - loading: a fresh value is on its way from the server ("updating").
 * - locked: someone else is editing it.
 * - invalid: the server rejected the value - about the content.
 * - error: something went wrong that isn't about the content.
 */
function trackedField(value) {
  return deeplyObservable({ value, initial: value, saved: value, saving: 0, loading: false, locked: false, invalid: null, error: null });
}

// The one data-state a field's group shows, of those its data can be in -
// the most pressing one. The browser's own states aren't here: they're
// the input's (see FormField).
function dataState(field) {
  if (field.error) return "error";
  if (field.loading) return "updating";
  if (field.value !== field.saved) return "flux";
  if (field.locked) return "locked";
  return null;
}

// A pretend server: how it answers, and how long it takes.
const server = deeplyObservable({ behavior: "accept", latency: 1200 });

function save(field) {
  const sent = field.value;
  const { behavior, latency } = server;
  transaction(() => {
    field.saving++;
    field.error = null;
    field.invalid = null;
  });
  setTimeout(() => transaction(() => {
    field.saving--;
    if (behavior === "offline") field.error = "Couldn't reach the server: the change isn't saved.";
    else if (behavior === "reject") field.invalid = "The server won't take \"" + sent + "\".";
    else field.saved = sent;
  }), latency);
}

// The server's value, loaded again: unsaved changes are gone, and it's
// unmodified again.
function reload(field) {
  field.loading = true;
  setTimeout(() => transaction(() => {
    field.loading = false;
    field.value = field.initial = field.saved;
    field.invalid = null;
    field.error = null;
  }), server.latency);
}

const fields = {
  name: trackedField("Ada Lovelace"),
  email: trackedField("ada@analytical.example"),
  phone: trackedField("+44 20 7946 0000"),
  company: trackedField(""),
};

function transaction(action) {
  postponeInvalidations();
  try {
    action();
  } finally {
    continueInvalidations();
  }
}

// --- The field ---

/**
 * Form Field - a label, an input group (the input and its state icon), and
 * a message under it. All the field decides is which attributes go where:
 * - On the input: disabled, readonly (also when locked: the control
 *   itself is what stops keyboard editing), required/type/pattern for the
 *   browser's own validation, and aria-invalid for a rejected value - an
 *   error about the content, for a screen reader to hear.
 * - On the group: data-state (see dataState()), aria-busy while updating,
 *   and .modified - so a value typed back to what it was isn't shown as a
 *   change.
 * Everything else - which look wins, the icon - is the stylesheet's.
 *
 * A changed value is saved when the user leaves the field (change), if the
 * browser finds it valid.
 */
class FormField extends Component {
  setProperties({ label, field, type, required, pattern, hint, disabled, readonly }) {
    this.label = label;
    this.field = field;
    this.type = type || "text";
    this.required = !!required;
    this.pattern = pattern;
    this.hint = hint || null;
    this.disabled = !!disabled;
    this.readonly = !!readonly;
  }

  build() {
    ensureStyleSheet();
    const { field } = this;
    const state = dataState(field);
    const message = field.invalid || field.error || this.hint;
    return label(
      { class: "form-field" },
      span({ class: "form-field-label" }, text(this.label)),
      div(
        { class: "input-group" + (field.value !== field.initial ? " modified" : ""), "data-state": state, "aria-busy": state === "updating" ? "true" : null },
        input({
          type: this.type,
          required: this.required,
          pattern: this.pattern,
          value: field.value,
          disabled: this.disabled,
          readonly: this.readonly || field.locked,
          "aria-invalid": field.invalid ? "true" : null,
          oninput: callback("input", (event) => transaction(() => {
            field.value = event.target.value;
            // The rejection was about the value: a new one isn't rejected yet.
            field.invalid = null;
          })),
          onchange: callback("change", (event) => {
            if (field.value !== field.saved && event.target.checkValidity()) save(field);
          }),
        }),
        // Every state's icon - the stylesheet shows the one that applies.
        span(
          { class: "suffix state" },
          ...Object.entries(stateIcons).map(([state, name]) => span({ key: state, class: state }, icon({ name, style: { fontSize: "20px" } }))),
        ),
      ),
      span({ class: "form-field-message" + (field.invalid || field.error ? " problem" : "") }, text(message || "")).showIf(!!message),
    );
  }
}

const stateIcons = { valid: "check_circle", flux: "cloud_upload", updating: "progress_activity", locked: "lock", invalid: "error" };

// --- What the fields know: their data, as it is ---

class StateTable extends Component {
  build() {
    const cell = (value) => td(text(value));
    return card(
      { style: { display: "flex", flexDirection: "column", gap: "8px", overflowX: "auto" } },
      sectionTitle("The data behind the fields"),
      table(
        { class: "form-field-states" },
        thead(tr(th(text("Field")), th(text("Value")), th(text("Saved")), th(text("Saving")), th(text("data-state")))),
        tbody(
          Object.entries(fields).map(([name, field]) => tr(
            { key: name },
            cell(name),
            cell(field.value),
            cell(field.saved),
            cell(String(field.saving)),
            cell(dataState(field) || "-"),
          )),
        ),
      ),
    );
  }
}

// --- The look ---

const c = { ...themeColor, error: "#c0392b", flux: "#e67e22", success: "#2e8b57" };

// A field's problems that the user should see now: the browser's
// (:user-invalid, after interaction) and the server's (aria-invalid).
const invalid = ":has(:user-invalid, [aria-invalid=\"true\"])";

const styleSheet = `
.form-field { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.form-field-label { font-weight: 500; }
.form-field-message { font-size: 12px; opacity: 0.75; }
.form-field-message.problem { color: ${c.error}; opacity: 1; }

.input-group {
  display: flex; align-items: center; box-sizing: border-box; height: 36px; padding-right: 8px;
  background: ${c.surface}; border: 1px solid ${c.border}; border-radius: 6px;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}
.input-group > input {
  flex: 1 1 auto; min-width: 0; height: 100%; padding: 0 10px; margin: 0;
  font: inherit; color: inherit; background: transparent; border: none; outline: none;
}
.input-group:hover { border-color: ${c.borderStrong}; }
.input-group:focus-within { border-color: ${c.accent}; box-shadow: 0 0 0 3px ${c.accentRing}; }
.input-group .suffix.state { display: flex; }
.input-group .suffix.state > * { display: none; }

/* The input's own states. */
.input-group:has(:disabled) { opacity: 0.6; cursor: not-allowed; }
.input-group:has(:disabled) > input { cursor: not-allowed; }
/* Locked takes readonly too, but isn't dimmed. */
.input-group:not([data-state="locked"]):has(:where(input, textarea)[readonly]) { opacity: 0.85; }
.input-group:is(:has(:disabled), :has([readonly])):hover { border-color: ${c.border}; }

/* Valid: a change, saved - nothing pending. */
.input-group.modified:not([data-state]):has(:user-valid):not(:focus-within) { border-color: ${c.success}; }
.input-group.modified:not([data-state]):has(:user-valid):not(:focus-within) .suffix.state > .valid { display: block; color: ${c.success}; }

/* The data's states. */
.input-group[data-state="flux"] { border-color: ${c.flux}; }
.input-group[data-state="flux"]:not(${invalid}) .suffix.state > .flux { display: block; color: ${c.flux}; }
.input-group[data-state="updating"] { border-color: ${c.border}; border-style: dashed; cursor: progress; }
.input-group[data-state="updating"] > * { pointer-events: none; }
.input-group[data-state="updating"]:not(${invalid}) .suffix.state > .updating { display: block; opacity: 0.6; animation: form-field-spin 1s linear infinite; }
.input-group[data-state="locked"] { cursor: not-allowed; }
.input-group[data-state="locked"]:hover { border-color: ${c.border}; }
.input-group[data-state="locked"] > * { pointer-events: none; }
.input-group[data-state="locked"]:not(${invalid}) .suffix.state > .locked { display: block; opacity: 0.6; }

/* Invalid, or an error: last, so it wins. */
.input-group${invalid}, .input-group[data-state="error"] { border-color: ${c.error}; }
.input-group${invalid} .suffix.state > .invalid, .input-group[data-state="error"] .suffix.state > .invalid { display: block; color: ${c.error}; }

@keyframes form-field-spin { to { transform: rotate(360deg); } }

.form-field-states { border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.form-field-states th, .form-field-states td { padding: 4px 10px 4px 0; text-align: left; white-space: nowrap; }
.form-field-states th { font-weight: 500; opacity: 0.7; border-bottom: 1px solid ${c.border}; }
`;

// Per document - each gets its own copy.
const documentsStyled = new WeakSet();

function ensureStyleSheet() {
  if (typeof(document) === "undefined" || !document.head || documentsStyled.has(document)) return;
  documentsStyled.add(document);
  const element = document.createElement("style");
  element.setAttribute("data-form-field", "");
  element.textContent = styleSheet;
  document.head.appendChild(element);
}
