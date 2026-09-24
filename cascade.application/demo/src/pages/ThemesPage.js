import { Component, serviceProvider } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button, widget, row, column, basicTheme, fitContainerStyle, overflowVisibleStyle } from "@liquefy/cascade.ui";
import { materialTheme } from "@liquefy/cascade.ui.material";
import { themes, themeSelection, selectTheme } from "../services.js";

/**
 * Themes - the cascade counterpart of flow.application/demo's own theme
 * switch. Nothing here names a theme when building a widget: `button(...)`
 * asks the render context's service locator for one (see
 * ../services.js). Switching theme replaces that locator's theme part, and
 * every themed widget rebuilds as the new theme's - whole components
 * replaced, not just restyled - while this page's own state (the click
 * count) stays exactly where it was.
 *
 * Services are contextual: the two sections below each get a theme of
 * their own through serviceProvider(), whatever the rest of the app uses -
 * a component that only works with one theme can have it. And a widget no
 * theme provides still renders, as a visibly marked placeholder (with a
 * console warning), rather than breaking the page.
 */
export class ThemesPage extends Component {
  initializeState() {
    return { clicks: 0 };
  }

  build() {
    const current = themeSelection.name;
    const other = current === "basic" ? "material" : "basic";

    return column(
      { key: "page", style: { ...fitContainerStyle, ...overflowVisibleStyle, gap: "20px", padding: "16px" } },
      div(
        { key: "info", style: { padding: "12px 16px", background: "#eaf4ff", border: "1px solid #b8dcff", borderRadius: "6px" } },
        text({
          key: "infoText",
          text: "Every button on this page is a themed widget: the app asks for a button, and whichever theme is " +
            "in its render context provides one. Switch themes and they are replaced by the other theme's " +
            "buttons - the click count below survives.",
        }),
      ),
      row(
        { key: "switch", style: { gap: "12px", alignItems: "center" } },
        text({ key: "current", text: "Current theme: " + themes[current].title }),
        button({ key: "toggle" }, text({ key: "toggleText", text: "Switch to " + themes[other].title }), () => selectTheme(other)),
      ),
      row(
        { key: "buttons", style: { gap: "12px", alignItems: "center" } },
        button({ key: "clickMe" }, text({ key: "clickMeText", text: "Click me" }), () => { this.clicks = this.clicks + 1; }),
        button({ key: "reset", variant: "outlined" }, text({ key: "resetText", text: "Reset" }), () => { this.clicks = 0; }),
        text({ key: "clicks", text: "Clicks: " + this.clicks }),
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
