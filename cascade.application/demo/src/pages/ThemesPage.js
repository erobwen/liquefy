import { Component, serviceProvider, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import {
  button, widget, icon, iconButton, card, controlPanel, alert, listItem, dialog, popover, overlay, colorField, tabBar,
  row, column, filler, basicTheme, fillerStyle, overflowVisibleStyle, colorSchemeScope, currentColorScheme,
} from "@liquefy/cascade.ui";
import { modalPresentation } from "../components/modal.js";
import { materialTheme } from "@liquefy/cascade.ui.material";
import { pageActions } from "../components/pageActions.js";
import { pageColumn, sectionTitle } from "../components/layout.js";
import source from "./ThemesPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "Themes are service locators:",
  points: [
    "Every widget is asked for through the render context, and whichever theme is in it provides one.",
    "Switching the theme replaces whole components, not just their style - app state stays where it was.",
    "A part of the app can have a theme of its own, or be denied the right to change it.",
    "A theme is its colors too: a base and an accent, and every other color made from them. Pick them for either theme - for the app's own, the whole app follows, frame and all.",
    "Narrow, the two themes are tabs.",
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
 * theme - or, where there isn't room for both, as tabs.
 *
 * A theme is its colors too (see cascade.ui's colorScheme.js): a base and
 * an accent, every other color made from them. Each section has pickers
 * for its theme's - they change that theme, so for the app's own theme the
 * whole app follows. Each section is given its theme's colors by a
 * colorSchemeScope() around it, which asks the theme in its context for
 * them: the same way the app's frame gives the whole app the colors of the
 * app's theme.
 */

// The themes shown - by the names the app's root services know them by
// (see ../services.js).
const themes = [
  { key: "material", title: "Material", theme: materialTheme },
  { key: "basic", title: "Basic", theme: basicTheme },
];

// Narrower than this, the themes are tabs.
const SIDE_BY_SIDE_WIDTH = 760;
export class ThemesPage extends Component {
  initializeState() {
    return { clicks: 0, tab: "material" };
  }

  build() {
    const wide = (this.renderContext.usableWidth || 1000) >= SIDE_BY_SIDE_WIDTH;
    const root = this.inherit("rootServiceLocator");
    // Both sections, every build - only which are shown depends on the
    // width: a section left out of a build would be gone, and come back
    // anew (its samples' state reset).
    const sections = themes.map(({ key, title, theme }) => new ThemeSection({
      key: key + "Section", title, theme, isAppTheme: !!root && root.themeName === key,
    }));
    // As tall as its content - the work area around it scrolls.
    return pageColumn(
      { key: "page" },
      pageActions({ information, source, fileName: "src/pages/ThemesPage.js" }),
      alert(
        { key: "info" },
        text({
          key: "infoText",
          text: "Every button in the demo's pages is a themed widget: the app asks for a button, and whichever " +
            "theme is in its render context provides one. A theme can change things such as color and style, " +
            "but it can also replace entire components. "+
            "Switching the theme here changes it for the whole " +
            "app - try the Recursive Demo and Hybrid Modal Dialog pages afterwards. The click count survives. " +
            "And pick a theme's colors below: for the app's own theme, the whole app follows.",
        }),
      ),
      new ThemeSwitch({ key: "themeSwitch" }),
      controlPanel(
        { key: "buttons" },
        button({ key: "clickMe" }, text({ key: "clickMeText", text: "Click me" }), () => { this.clicks = this.clicks + 1; }),
        button({ key: "reset", variant: "outlined" }, text({ key: "resetText", text: "Reset" }), () => { this.clicks = 0; }),
        text({ key: "clicks", text: "Clicks: " + this.clicks }),
      ),
      column(
        { key: "blocked", style: { gap: "8px", overflow: "visible" } },
        sectionTitle("blockedLabel", "The same switch, inside a part of the app that doesn't pass on the right to change the theme:"),
        new NoThemeSwitching({ key: "noThemeSwitching" }),
      ),
      wide
        ? row({ key: "sections", style: { gap: "24px", alignItems: "flex-start", overflow: "visible" } }, sections)
        : column(
          { key: "tabbed", style: { gap: "16px", overflow: "visible" } },
          tabBar({
            key: "themeTabs",
            tabs: themes.map(({ key, title }) => ({ key, title })),
            selected: this.tab,
            onSelect: callback("selectTab", (tab) => { this.tab = tab; }),
          }),
          sections[themes.findIndex(({ key }) => key === this.tab)],
        ),
      column(
        { key: "degradation", style: { gap: "8px" } },
        sectionTitle("degradationLabel", "A widget no theme provides still renders, as a marked placeholder:"),
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
      return controlPanel(
        { key: "switch" },
        text({ key: "notAllowed", text: "Theme switching isn't available here." }),
      );
    }
    const themeNames = Object.keys(root.themes);
    const current = root.themeName;
    const next = themeNames[(themeNames.indexOf(current) + 1) % themeNames.length];
    return controlPanel(
      { key: "switch" },
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

// A theme, whatever the app's is: its own services, and its own colors,
// for everything in it - and pickers for its colors on top.
class ThemeSection extends Component {
  setProperties({ title, theme, isAppTheme }) {
    this.title = title;
    this.theme = theme;
    this.isAppTheme = isAppTheme;
  }

  build() {
    return serviceProvider({
      key: "provider",
      serviceLocator: this.theme,
      child: colorSchemeScope(
        { key: "scope", style: { ...fillerStyle, ...overflowVisibleStyle, display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
        new ColorSchemeEditor({ key: "editor", title: this.title, isAppTheme: this.isAppTheme }),
        new SampleButtons({ key: "sample" }),
      ),
    });
  }
}

// The colors of the theme in the context: its base and accent - every
// other color follows them - and a way back to where they started.
class ColorSchemeEditor extends Component {
  setProperties({ title, isAppTheme }) {
    this.title = title;
    this.isAppTheme = isAppTheme;
  }

  build() {
    const scheme = currentColorScheme();
    return controlPanel(
      { key: "editor" },
      div({ key: "title", style: { fontWeight: "bold" } }, text({ key: "titleText", text: this.title + (this.isAppTheme ? " - the app's theme" : "") })),
      filler({ key: "editorFiller" }),
      colorField({ key: "base", label: "Base", value: scheme.base, onInput: callback("base", (value) => { scheme.base = value; }) }),
      colorField({ key: "accent", label: "Accent", value: scheme.accent, onInput: callback("accent", (value) => { scheme.accent = value; }) }),
      button({ key: "reset", disabled: !scheme.isChanged() }, text({ key: "resetText", text: "Reset" }), callback("reset", () => scheme.reset())),
    );
  }
}

// Every themed widget, as whichever theme is in the context provides it.
class SampleButtons extends Component {
  initializeState() {
    return { chosen: "inbox", dialogOpen: false, popoverOpen: false, anchor: null, favorite: false };
  }

  build() {
    const heading = (key, value) => sectionTitle(key, value);
    const closeDialog = () => { this.dialogOpen = false; };
    return column(
      { key: "sample", style: { gap: "12px", overflow: "visible" } },
      row(
        { key: "buttons", style: { gap: "12px", alignItems: "center", flexWrap: "wrap", overflow: "visible" } },
        button({ key: "first" }, text({ key: "firstText", text: "First" })),
        button({ key: "second", variant: "tonal" }, text({ key: "secondText", text: "Second" })),
        iconButton({ key: "favorite", icon: this.favorite ? "favorite" : "favorite_border", title: "Favorite" }, () => { this.favorite = !this.favorite; }),
        iconButton({ key: "info", icon: "info", title: "More information" }, (event) => {
          // The button itself - the popover follows it, should it move.
          this.anchor = event.currentTarget;
          this.popoverOpen = true;
        }),
        button({ key: "openDialog" }, text({ key: "openDialogText", text: "Open dialog" }), () => { this.dialogOpen = true; }),
      ),
      heading("alertsHeading", "Alerts"),
      ...["info", "success", "warning", "error"].map((severity) =>
        alert({ key: severity, severity }, text({ key: severity + "Text", text: "An alert of severity " + severity + "." }))),
      heading("cardsHeading", "Cards"),
      row(
        { key: "cards", style: { gap: "12px", overflow: "visible" } },
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
