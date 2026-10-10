import { Component, callback, frozen } from "@liquefy/cascade.component";
import { div, span, text, input } from "@liquefy/cascade.dom";
import { card, listItem, iconButton, popover, themeColor } from "@liquefy/cascade.ui";
import { matchingCategories, exactCategory, createCategory } from "./model.js";

/**
 * Pieces the file system's panels share: category chips, a category
 * picker, a text input, and how a panel's edges look.
 */

export const border = "1px solid " + themeColor.border;

// A category, as a chip - with a cross removing it, if there's `onRemove`.
// `faded`: only some of the files shown have it.
export function chip({ key, label, onRemove, faded, title }) {
  return span(
    {
      key,
      title,
      style: {
        display: "inline-flex", alignItems: "center", gap: "2px", flex: "none", height: "28px", boxSizing: "border-box",
        padding: onRemove ? "0 2px 0 10px" : "0 10px", borderRadius: "14px", fontSize: "13px", whiteSpace: "nowrap",
        background: themeColor.accentFaint, border: "1px solid " + themeColor.accentSoft, color: themeColor.text,
        opacity: faded ? 0.5 : 1,
      },
    },
    text(label),
    onRemove ? iconButton({ icon: "close", title: "Remove " + label, onClick: onRemove, style: { flex: "none", width: "24px", height: "24px", padding: 0, fontSize: "16px" } }) : null,
  );
}

// A plain text input, in the theme's colors.
export function textInput(properties) {
  return input({
    type: "text",
    ...properties,
    style: {
      height: "32px", boxSizing: "border-box", padding: "0 10px", font: "inherit", minWidth: 0,
      border, borderRadius: "6px", background: themeColor.surface, color: themeColor.text,
      ...properties.style,
    },
  });
}

// Puts the keyboard's focus in the input marked `name` - once the frame
// it's shown in is drawn.
export function focusSoon(name) {
  requestAnimationFrame(() => {
    const found = document.querySelector("[data-focus='" + name + "']");
    if (found) found.focus();
  });
}

// The categories matching what's typed - all of them, when nothing is - to
// pick one of; and, with `allowCreate`, a new one named as typed, when
// none is. With `countOf(category)`, each shows a number beside it (how
// many files picking it would show, say) - faded at none.
export function categoryChoices({ query, leaveOut, allowCreate, pick, keyPrefix, countOf }) {
  const matches = matchingCategories(query, leaveOut);
  const create = allowCreate && query.trim() !== "" && !exactCategory(query);
  const choices = matches.map((each) => {
    const count = countOf ? countOf(each) : null;
    return listItem(
      { key: keyPrefix + each.id, style: count === 0 ? { opacity: 0.5 } : {} },
      div(
        { style: { display: "flex", alignItems: "center", gap: "12px", width: "100%" } },
        span({ style: { flex: "1 1 auto" } }, text(each.name)),
        count === null ? null : span({ style: { flex: "none", fontSize: "12px", color: themeColor.textSoft } }, text(String(count))),
      ),
      callback(keyPrefix + "pick" + each.id, () => pick(each)),
    );
  });
  if (create) {
    choices.push(listItem(
      { key: keyPrefix + "create" },
      text("Create “" + query.trim() + "”"),
      callback(keyPrefix + "create", () => pick(createCategory(query))),
    ));
  }
  if (choices.length === 0) {
    choices.push(div({ key: keyPrefix + "none", style: { padding: "8px", color: themeColor.textSoft } }, text("No category matches")));
  }
  return { choices, first: matches[0] || null, create };
}

/**
 * A popover for picking a category: type to narrow the list down, Enter
 * picks the first one. Whoever opens it says what to leave out - those
 * already there - and whether a new one may be made.
 *
 *  - anchor, showing, close: as popover()'s.
 *  - title: above the field.
 *  - leaveOut: categories not offered.
 *  - allowCreate: offer making a new one, named as typed.
 *  - onPick(category): picked (it closes itself).
 *  - focusName: the field's name, for focusSoon() - see whoever opens it.
 */
export class CategoryPicker extends Component {
  setProperties({ anchor, showing, close, title, leaveOut, allowCreate, onPick, focusName }) {
    this.anchor = anchor || null;
    this.showing = !!showing;
    this.close = close || null;
    this.title = title || "";
    this.leaveOut = frozen(leaveOut || []);
    this.allowCreate = !!allowCreate;
    this.onPick = onPick || null;
    this.focusName = focusName || "categoryPicker";
  }

  initialState() {
    return { query: "" };
  }

  build() {
    const pick = (category) => {
      this.query = "";
      if (this.onPick) this.onPick(category);
    };
    const { choices, first, create } = categoryChoices({
      query: this.query, leaveOut: this.leaveOut, allowCreate: this.allowCreate, pick, keyPrefix: "",
    });
    return popover(
      {
        anchor: this.anchor,
        showing: this.showing,
        close: callback("close", () => {
          this.query = "";
          if (this.close) this.close();
        }),
      },
      card(
        { style: { width: "260px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px", boxSizing: "border-box" } },
        div({ style: { fontWeight: "bold" } }, text(this.title)),
        textInput({
          "data-focus": this.focusName,
          placeholder: this.allowCreate ? "Find or create a category" : "Find a category",
          value: this.query,
          oninput: callback("input", (event) => { this.query = event.target.value; }),
          onkeydown: callback("keydown", (event) => {
            if (event.key !== "Enter") return;
            if (first) pick(first);
            else if (create) pick(createCategory(this.query));
          }),
        }),
        div({ style: { maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column" } }, choices),
      ),
    );
  }
}
