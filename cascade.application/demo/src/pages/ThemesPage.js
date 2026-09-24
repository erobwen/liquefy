import { Component, serviceProvider } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, widget, row, column, basicTheme, fitContainerStyle, overflowVisibleStyle } from "@liquefy/cascade.ui";
import { materialTheme } from "@liquefy/cascade.ui.material";

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
 */
export class ThemesPage extends Component {
  initializeState() {
    return { clicks: 0 };
  }

  build() {
    return column(
      { key: "page", style: { ...fitContainerStyle, ...overflowVisibleStyle, gap: "20px", padding: "16px" } },
      div(
        { key: "info", style: { padding: "12px 16px", background: "#eaf4ff", border: "1px solid #b8dcff", borderRadius: "6px" } },
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
      section("alwaysMaterial", "Always Material, whatever the app's theme:", materialTheme),
      section("alwaysBasic", "Always Basic, whatever the app's theme:", basicTheme),
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
    { key, style: { gap: "8px" } },
    text({ key: key + "Label", text: label }),
    serviceProvider({ key: key + "Provider", serviceLocator: theme, child: new SampleButtons({ key: key + "Sample" }) }),
  );
}

class SampleButtons extends Component {
  build() {
    return row(
      { key: "sample", style: { gap: "12px" } },
      button({ key: "first" }, text({ key: "firstText", text: "First" })),
      button({ key: "second", variant: "tonal" }, text({ key: "secondText", text: "Second" })),
    );
  }
}
