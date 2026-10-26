import { observable, repeat, accessInitialValues, withoutRecording, locateService } from "@liquefy/cascade.component";

/**
 * Settings - how Tabula is set up, for every document opened in it: not
 * what's in a document (that's saved with it), but how it's shown and
 * edited - a structured text's caret going to section ends, the creation
 * dot's color. Kept by the app as a whole, in one plain object, each part
 * of the app with a section of its own:
 *
 *   { tabula: { creationColor: "#4285f4" }, structuredText: { newSectionsBeside: true, ... } }
 *
 * Every section is observable: whatever reads a setting follows it.
 *
 * A part of the app asks for its section through the service locator,
 * the same as for anything else it needs - by name, with what it has if
 * nothing's set yet:
 *
 *   const settings = settingsFor("structuredText", { newSectionsBeside: true });
 *   settings.newSectionsBeside = false;   // from an event handler, say
 *
 * Not file-wide, deliberately: a document can hold documents of every
 * kind, and parts of the same kind in different places - how one kind is
 * edited is one setting, wherever it is. What differs from one part of a
 * document to another belongs in that part, saved with it.
 *
 * Settings are kept between visits where there's a localStorage to keep
 * them in (see persistSettings()).
 */
export class Settings {
  constructor(initial = {}) {
    this.sections = observable({});
    for (const name of Object.keys(initial)) {
      const values = initial[name];
      if (values && typeof(values) === "object") this.sections[name] = observable({ ...values });
    }
  }

  // The section `name`, made with `defaults` if there's none - and given
  // any of them it doesn't have yet (a setting added since it was saved).
  // Written at the baseline, wherever it's asked for from: from a build,
  // a plain write would be that build's, at its place in the tree, and
  // undone with it (see cascade.component's setState()).
  section(name, defaults = {}) {
    let section = withoutRecording(() => this.sections[name]);
    const missing = withoutRecording(() => Object.keys(defaults).filter((key) => !section || !(key in section)));
    if (!section || missing.length > 0) {
      accessInitialValues(() => {
        if (!section) {
          section = observable({});
          this.sections[name] = section;
        }
        for (const key of missing) section[key] = defaults[key];
      });
    }
    return this.sections[name];
  }

  // All of it, as plain data - for saving.
  toJSON() {
    const result = {};
    for (const name of Object.keys(this.sections)) result[name] = { ...this.sections[name] };
    return result;
  }
}

// A service locator handing out sections of `settings`:
// `{ type: "settings", name, defaults }`.
export function settingsLocator(settings) {
  return {
    locate(query) {
      if (query.type !== "settings") return undefined;
      return settings.section(query.name, query.defaults || {});
    },
  };
}

// For a component's build: its section of the settings, through the
// service locators where it's placed.
export function settingsFor(name, defaults = {}) {
  return locateService({ type: "settings", name, defaults });
}

// Settings kept in localStorage, under `key`: loaded now, and saved every
// time anything in them changes. Where there's no localStorage (or it
// can't be used), settings for this visit only.
export function persistSettings(key) {
  let initial = {};
  try {
    initial = JSON.parse(globalThis.localStorage.getItem(key) || "{}") || {};
  } catch (error) {
    initial = {};
  }
  const settings = new Settings(initial);
  repeat(() => {
    // Read all of it - every section, every setting - so any change saves.
    const json = JSON.stringify(settings.toJSON());
    try {
      globalThis.localStorage.setItem(key, json);
    } catch (error) {
      // No storage: kept for this visit only.
    }
  }, { independent: true });
  return settings;
}

// The app's own settings (the "tabula" section): the creation dot's color -
// the blue of the structured text's placeholders, unless it's picked.
export const appSettingsDefaults = Object.freeze({ creationColor: "#4285f4" });
