import { Component, callback } from "@liquefy/cascade.component";
import { div, span, text, button as htmlButton } from "@liquefy/cascade.dom";
import { dialog, checkbox } from "@liquefy/cascade.ui";

/**
 * The settings dialog - all that's set up in Tabula, in one place, shown
 * modally (see TabulaApp.js): a page for the app's own settings, and one
 * for every kind of document that has any (a document type's
 * `settingsPage()`, see documents.js). The pages listed on the left, the one
 * chosen on the right.
 *
 *   settingsDialog({ pages, page, onPage, close })
 *
 * `pages`: [{ key, title, icon, build }] - `build()` makes the page's
 * content, built by the dialog, so it follows the settings it reads. A page
 * is made of options (settingOption()) under headings (settingGroup()).
 */
export class SettingsDialog extends Component {
  setProperties({ pages, page, onPage, close }) {
    this.pages = pages || [];
    this.page = page;
    this.onPage = onPage;
    this.close = close;
  }

  build() {
    const current = this.pages.find((each) => each.key === this.page) || this.pages[0];
    return dialog(
      { title: "Settings", close: this.close, style: { height: "100%", display: "flex", flexDirection: "column" } },
      div(
        { style: { display: "flex", flex: "1 1 auto", minHeight: 0, gap: "0" } },
        div(
          { style: navigationStyle },
          this.pages.map((each) => htmlButton(
            {
              key: "page-" + each.key,
              onclick: callback("page" + each.key, () => this.onPage(each.key)),
              style: { ...navigationItemStyle, ...(each === current ? navigationCurrentStyle : {}) },
            },
            span({ class: "material-symbols-outlined", style: { fontSize: "20px" } }, text(each.icon || "tune")),
            text(each.title),
          )),
        ),
        div(
          { style: { flex: "1 1 auto", minWidth: 0, overflowY: "auto", padding: "4px 24px 24px" } },
          current ? current.build() : null,
        ),
      ),
    );
  }
}

export const settingsDialog = (...parameters) => new SettingsDialog(...parameters);

// A heading over a group of options, and what the group is about.
export function settingGroup(title, about) {
  return div(
    { style: { margin: "20px 0 4px" } },
    div({ style: { fontWeight: 700, fontSize: "15px" } }, text(title)),
    about ? div({ style: { fontSize: "13px", opacity: 0.7, marginTop: "2px" } }, text(about)) : null,
  );
}

// One option: what it's called, what it does, and its control - a checkbox,
// buttons to choose among. Room on the right for an illustration of it
// (`illustration`, a component - an image, an animation), where there is
// one; none yet.
export function settingOption({ title, description, control, illustration = null }) {
  return div(
    { style: optionStyle },
    div(
      { style: { flex: "1 1 auto", minWidth: 0 } },
      div({ style: { display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between" } },
        div({ style: { fontWeight: 600, fontSize: "14px" } }, text(title)),
        control,
      ),
      description ? div({ style: { fontSize: "13px", opacity: 0.75, marginTop: "4px", lineHeight: 1.45 } }, text(description)) : null,
    ),
    illustration ? div({ style: { flex: "none", width: "160px" } }, illustration) : null,
  );
}

// An option that's on or off: settingOption() with a checkbox for its
// control.
export function settingSwitch({ key, title, description, checked, onChange, illustration }) {
  return settingOption({ title, description, illustration, control: checkbox({ key, checked, onChange }) });
}

// Choosing one among a few: buttons side by side, the chosen one filled.
export function settingChoice({ choices, value, onChoose }) {
  return div(
    { style: { display: "flex", gap: "4px", flex: "none" } },
    choices.map((choice) => htmlButton(
      {
        key: "choice" + choice.value,
        onclick: () => onChoose(choice.value),
        style: { ...choiceStyle, ...(choice.value === value ? choiceCurrentStyle : {}) },
      },
      text(choice.label),
    )),
  );
}

const navigationStyle = {
  flex: "none", width: "200px", padding: "8px", borderRight: "1px solid #e0e0e0",
  display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto",
};
const navigationItemStyle = {
  display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", border: "none", borderRadius: "8px",
  background: "transparent", font: "inherit", fontSize: "14px", textAlign: "left", cursor: "pointer", color: "#1f1f1f",
};
const navigationCurrentStyle = { background: "#d3e3fd", color: "#0b57d0", fontWeight: 600 };
const optionStyle = { display: "flex", gap: "16px", padding: "12px 0", borderBottom: "1px solid #eee" };
const choiceStyle = {
  padding: "4px 10px", border: "1px solid #c4c7c5", borderRadius: "999px", background: "white",
  font: "inherit", fontSize: "13px", cursor: "pointer", color: "#1f1f1f",
};
const choiceCurrentStyle = { background: "#0b57d0", borderColor: "#0b57d0", color: "white" };
