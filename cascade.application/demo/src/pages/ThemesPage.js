import { Component, serviceProvider } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import {
  button, widget, icon, iconButton, card, alert, listItem, dialog, popover, overlay,
  row, column, basicTheme, fillerStyle, overflowVisibleStyle,
} from "@liquefy/cascade.ui";
import { modalPresentation } from "../components/modal.js";
import { materialTheme } from "@liquefy/cascade.ui.material";
import { pageActions } from "../components/pageActions.js";
import source from "./ThemesPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "Themes are service locators:",
  points: [
    "Every widget is asked for through the render context, and whichever theme is in it provides one.",
    "Switching the theme replaces whole components, not just their style - app state stays where it was.",
    "A part of the app can have a theme of its own, or be denied the right to change it.",
  ],
};

/**
 * Themes - the cascade counterpart of flow.application/demo's own theme
 * switch. Nothing in the app names a theme when building a widget:
 * `button(...)` asks the render context's service locator for one. The
 * switch here changes the app's *root* service locator, so every themed
 * widget on every page rebuilds as the new theme's - whole components
 * replaced, not just restyled - while all app state stays where it was.
 *
 * Changing the root services isn't something any component can just do:
 * this page gets them through inherit("rootServiceLocator"), which the
 * app's root component provides (see ../services.js). A subtree that
 * provides `rootServiceLocator: null` itself takes that ability away from
 * everything below it - the second switch below is inside one.
 *
 * Services are contextual too: the two sample sections each get a theme of
 * their own through serviceProvider(), whatever the rest of the app uses.
 * And a widget no theme provides still renders, as a visibly marked
 * placeholder (with a console warning), rather than breaking the page.
 *
 * The two sample sections show every themed widget there is (see
 * cascade.ui's widgets.js) - the same components, side by side, in each
 * theme.
 */
export class ThemesPage extends Component {
  initializeState() {
    return { clicks: 0 };
  }

  build() {
    return column(
      // As tall as its content - the work area around it scrolls.
      { key: "page", style: { ...overflowVisibleStyle, boxSizing: "border-box", width: "100%", gap: "20px", padding: "16px" } },
      pageActions(this, { information, source, fileName: "src/pages/ThemesPage.js" }),
      alert(
        { key: "info" },
        text({
          key: "infoText",
          text: "Every button in the demo's pages is a themed widget: the app asks for a button, and whichever " +
            "theme is in its render context provides one. Switching the theme here changes it for the whole " +
            "app - try the Recursive Demo and Hybrid Modal Dialog pages afterwards. The click count survives.",
        }),
      ),
      new ThemeSwitch({ key: "themeSwitch" }),
      row(
        { key: "buttons", style: { gap: "12px", alignItems: "center" } },
        button({ key: "clickMe" }, text({ key: "clickMeText", text: "Click me" }), () => { this.clicks = this.clicks + 1; }),
        button({ key: "reset", variant: "outlined" }, text({ key: "resetText", text: "Reset" }), () => { this.clicks = 0; }),
        text({ key: "clicks", text: "Clicks: " + this.clicks }),
      ),
      column(
        { key: "blocked", style: { gap: "8px" } },
        text({ key: "blockedLabel", text: "The same switch, inside a part of the app that doesn't pass on the right to change the theme:" }),
        new NoThemeSwitching({ key: "noThemeSwitching" }),
      ),
      row(
        { key: "sections", style: { gap: "24px", alignItems: "flex-start", flexWrap: "wrap" } },
        section("alwaysMaterial", "Always Material, whatever the app's theme:", materialTheme),
        section("alwaysBasic", "Always Basic, whatever the app's theme:", basicTheme),
      ),
      column(
        { key: "degradation", style: { gap: "8px" } },
        text({ key: "degradationLabel", text: "A widget no theme provides still renders, as a marked placeholder:" }),
        widget("rating", { key: "rating", children: [text({ key: "ratingText", text: "★★★☆☆" })] }),
      ),
    );
  }
}

// Switches the app's theme - if it's allowed to: whatever it inherits as
// rootServiceLocator is the only way it can reach the root services at all.
class ThemeSwitch extends Component {
  build() {
    const root = this.inherit("rootServiceLocator");
    if (!root) {
      return row(
        { key: "switch", style: { gap: "12px", alignItems: "center" } },
        text({ key: "notAllowed", text: "Theme switching isn't available here." }),
      );
    }
    const themeNames = Object.keys(root.themes);
    const current = root.themeName;
    const next = themeNames[(themeNames.indexOf(current) + 1) % themeNames.length];
    return row(
      { key: "switch", style: { gap: "12px", alignItems: "center" } },
      text({ key: "current", text: "Current theme: " + root.themes[current].title }),
      button({ key: "toggle" }, text({ key: "toggleText", text: "Switch to " + root.themes[next].title }), () => root.selectTheme(next)),
    );
  }
}

// Provides `rootServiceLocator: null` (provide()'s default is the
// component itself, so a field is all it takes) - inherit() stops at the
// first provider it finds, so nothing it builds can reach the root
// services, whatever is provided further up.
class NoThemeSwitching extends Component {
  setProperties() {
    this.rootServiceLocator = null;
  }

  build() {
    return new ThemeSwitch({ key: "blockedSwitch" });
  }
}

function section(key, label, theme) {
  return column(
    { key, style: { ...fillerStyle, ...overflowVisibleStyle, gap: "8px", minWidth: "320px" } },
    text({ key: key + "Label", text: label }),
    serviceProvider({ key: key + "Provider", serviceLocator: theme, child: new SampleButtons({ key: key + "Sample" }) }),
  );
}

// Every themed widget, as whichever theme is in the context provides it.
class SampleButtons extends Component {
  initializeState() {
    return { chosen: "inbox", dialogOpen: false, popoverOpen: false, anchor: null, favorite: false };
  }

  build() {
    const heading = (key, value) => text({ key, text: value });
    const closeDialog = () => { this.dialogOpen = false; };
    return column(
      { key: "sample", style: { gap: "12px" } },
      row(
        { key: "buttons", style: { gap: "12px", alignItems: "center" } },
        button({ key: "first" }, text({ key: "firstText", text: "First" })),
        button({ key: "second", variant: "tonal" }, text({ key: "secondText", text: "Second" })),
        iconButton({ key: "favorite", icon: this.favorite ? "favorite" : "favorite_border", title: "Favorite" }, () => { this.favorite = !this.favorite; }),
        iconButton({ key: "info", icon: "info", title: "More information" }, (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          this.anchor = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
          this.popoverOpen = true;
        }),
        button({ key: "openDialog" }, text({ key: "openDialogText", text: "Open dialog" }), () => { this.dialogOpen = true; }),
      ),
      heading("alertsHeading", "Alerts"),
      ...["info", "success", "warning", "error"].map((severity) =>
        alert({ key: severity, severity }, text({ key: severity + "Text", text: "An alert of severity " + severity + "." }))),
      heading("cardsHeading", "Cards"),
      row(
        { key: "cards", style: { gap: "12px" } },
        ...["elevated", "filled", "outlined"].map((variant) =>
          card({ key: variant, variant, style: { flex: "1 1 0" } }, text({ key: variant + "Text", text: "A card, " + variant }))),
      ),
      heading("listHeading", "List items"),
      card(
        { key: "list", style: { padding: "4px" } },
        ...[["inbox", "Inbox"], ["sent", "Sent"], ["drafts", "Drafts"]].map(([key, title]) =>
          listItem({ key, active: this.chosen === key }, text({ key: key + "Text", text: title }), () => { this.chosen = key; })),
      ),
      row(
        { key: "iconRow", style: { gap: "8px", alignItems: "center" } },
        ...["home", "search", "settings", "shopping_cart"].map((name) => icon({ key: name, name })),
      ),
      popover(
        { key: "popover", anchor: this.anchor, showing: this.popoverOpen, close: () => { this.popoverOpen = false; } },
        card({ key: "popoverCard", style: { maxWidth: "320px" } },
          text({ key: "popoverText", text: "A popover: shown beside what was clicked, over everything else. Click outside it to close it." })),
      ),
      overlay(
        modalPresentation(
          dialog(
            { key: "dialog", title: "A themed dialog", close: closeDialog, style: { width: "360px", flex: "none" } },
            column(
              { key: "dialogBody", style: { padding: "16px", gap: "12px" } },
              text({ key: "dialogText", text: "Title bar, close button and body - all from the theme." }),
              button({ key: "done" }, text({ key: "doneText", text: "Done" }), closeDialog),
            ),
          ),
          closeDialog,
        ),
        { key: "dialogOverlay", showing: this.dialogOpen },
      ),
    );
  }
}
