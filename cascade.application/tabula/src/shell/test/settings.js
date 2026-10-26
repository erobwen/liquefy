import assert from "assert";
import { repeat } from "@liquefy/cascade.component";
import { Settings, settingsLocator, persistSettings } from "../settings.js";

describe("Settings", function () {
  it("hand out a section per part of the app - made from its defaults, given defaults added since", function () {
    const settings = new Settings({ structuredText: { newSectionsBeside: false } });
    const section = settings.section("structuredText", { newSectionsBeside: true, showAllAreas: false });
    assert.strictEqual(section.newSectionsBeside, false, "what was set stays set");
    assert.strictEqual(section.showAllAreas, false, "what's new gets its default");
    assert.strictEqual(settings.section("structuredText"), section, "the same section every time");
    assert.deepStrictEqual(settings.toJSON(), { structuredText: { newSectionsBeside: false, showAllAreas: false } });
  });

  it("are found through the service locator, by name", function () {
    const settings = new Settings();
    const locator = settingsLocator(settings);
    assert.strictEqual(locator.locate({ type: "widget", name: "button" }), undefined);
    const section = locator.locate({ type: "settings", name: "tabula", defaults: { creationColor: "#4285f4" } });
    assert.strictEqual(section.creationColor, "#4285f4");
  });

  it("are followed by whatever reads them - and made from a repeater, written at the baseline: changed later, the change is seen", function () {
    const settings = new Settings();
    const seen = [];
    // Asked for from inside a repeater, as a build does: the section and
    // its defaults are made there - and must not be that repeater's writing.
    repeat(() => {
      seen.push(settings.section("tabula", { creationColor: "#4285f4" }).creationColor);
    });
    settings.section("tabula").creationColor = "#ff0000";
    assert.deepStrictEqual(seen, ["#4285f4", "#ff0000"]);
  });

  it("are kept in localStorage - loaded, and saved on every change", function () {
    const stored = {};
    const saved = globalThis.localStorage;
    globalThis.localStorage = { getItem: (key) => stored[key] || null, setItem: (key, value) => { stored[key] = value; } };
    try {
      stored["test.settings"] = JSON.stringify({ tabula: { creationColor: "#00ff00" } });
      const settings = persistSettings("test.settings");
      assert.strictEqual(settings.section("tabula").creationColor, "#00ff00");
      settings.section("tabula").creationColor = "#0000ff";
      assert.deepStrictEqual(JSON.parse(stored["test.settings"]), { tabula: { creationColor: "#0000ff" } });
    } finally {
      globalThis.localStorage = saved;
    }
  });
});
