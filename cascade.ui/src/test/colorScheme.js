import { JSDOM } from "jsdom";
import assert from "assert";
import { RenderContext, CompoundServiceLocator, serviceProvider } from "@liquefy/cascade.component";
import { DOMElementTarget, DOMServiceLocator, text } from "@liquefy/cascade.dom";
import {
  hexToRgb, rgbToHex, rgbToHsb, hsbToRgb, deriveColors, colorVariables, themeColor, defaultColors,
  ColorScheme, colorSchemeScope, BasicThemeServiceLocator,
} from "../index.js";

// Color schemes: a theme's colors, all from a base and an accent - tones
// of them, made in HSB - used as CSS variables that whoever gives a part of
// the app its colors sets on an element.
describe("color schemes", function () {
  it("converts between hex, RGB and HSB, and back", function () {
    assert.deepEqual(hexToRgb("#34495e"), { r: 52, g: 73, b: 94 });
    assert.deepEqual(hexToRgb("#fff"), { r: 255, g: 255, b: 255 });
    for (const hex of ["#34495e", "#2e86c1", "#6750a4", "#c2185b", "#000000", "#ffffff", "#808080"]) {
      assert.equal(rgbToHex(hsbToRgb(rgbToHsb(hexToRgb(hex)))), hex, hex);
    }
    const hsb = rgbToHsb(hexToRgb("#34495e"));
    assert.equal(Math.round(hsb.h), 210);
    assert.equal(Math.round(hsb.b * 100), 37);
  });

  it("the default scheme gives the app's own slate frame, and a light page of the same hue", function () {
    const colors = deriveColors(defaultColors.base, defaultColors.accent);
    assert.equal(colors.chrome, "#34495e", "the base itself: dark enough already");
    assert.equal(colors.accent, "#2e86c1");
    const page = rgbToHsb(hexToRgb(colors.page));
    assert.ok(page.b > 0.95 && page.s < 0.1, "light, and hardly saturated");
    assert.ok(Math.abs(page.h - 210) < 10, "the base's hue (as near as a pale color, rounded to hex, can be)");
  });

  it("any base gives a frame dark enough for white text - a bright one is toned down", function () {
    for (const base of ["#ffeb3b", "#ffffff", "#00e5ff", "#c2185b"]) {
      const chrome = rgbToHsb(hexToRgb(deriveColors(base, "#000000").chrome));
      assert.ok(chrome.b <= 0.43, base + ": dark");
      assert.ok(chrome.s <= 0.66, base + ": not glaring");
    }
  });

  it("the colors, as CSS variables - and each one used through its variable, with the default as fallback", function () {
    const variables = colorVariables(deriveColors("#34495e", "#2e86c1"));
    assert.equal(variables["--cascade-chrome"], "#34495e");
    assert.equal(variables["--cascade-chrome-dark"] !== undefined, true);
    assert.equal(themeColor.chrome, "var(--cascade-chrome, #34495e)");
  });

  it("a theme provides its scheme; a scope gives what's in it that scheme's colors - and follows a color picked", function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    const container = document.createElement("div");
    const theme = new BasicThemeServiceLocator();
    const scheme = theme.locate({ type: "colorScheme" });
    assert.ok(scheme instanceof ColorScheme);

    const serviceLocator = new CompoundServiceLocator(new DOMServiceLocator(), theme);
    colorSchemeScope({ key: "scope" }, text({ key: "inside", text: "Inside" }))
      .renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator }));
    const scope = container.firstChild;
    assert.equal(scope.style.getPropertyValue("--cascade-chrome"), "#34495e");
    assert.equal(scope.textContent, "Inside");

    scheme.base = "#2e7d32";
    assert.notEqual(scope.style.getPropertyValue("--cascade-chrome"), "#34495e", "picked: the scope's colors follow");
    assert.ok(scheme.isChanged());
    scheme.reset();
    assert.equal(scope.style.getPropertyValue("--cascade-chrome"), "#34495e", "and back");
    assert.ok(!scheme.isChanged());
  });

  it("a part of the app with a theme of its own gets that theme's colors, whatever the app's", function () {
    const dom = new JSDOM("<!DOCTYPE html><body></body>");
    global.document = dom.window.document;
    const container = document.createElement("div");
    const app = new BasicThemeServiceLocator();
    const other = new BasicThemeServiceLocator();
    other.colorScheme.base = "#c2185b";
    serviceProvider({ key: "provider", serviceLocator: other, child: colorSchemeScope({ key: "scope" }) })
      .renderOnto(new RenderContext(new DOMElementTarget(container), { serviceLocator: new CompoundServiceLocator(new DOMServiceLocator(), app) }));
    assert.equal(container.firstChild.style.getPropertyValue("--cascade-base"), "#c2185b");
  });
});
