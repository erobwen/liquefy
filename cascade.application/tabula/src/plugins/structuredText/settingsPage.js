import { markerTypes } from "../../paper/markers.js";
import { settingGroup, settingOption, settingSwitch, settingChoice } from "../../shell/settingsDialog.js";
import { structuredTextSettings } from "./settings.js";

/**
 * Structured text's page of the settings dialog (see
 * ../../shell/settingsDialog.js) - how it's edited, all of it (see
 * settings.js): built by the dialog, so it follows the settings.
 *
 * First the two fundamental ones - what may appear in a document at all:
 * every rule after them takes no path that makes what they don't allow, and
 * any change that would is refused (see ../../paper/editing.js's
 * guarded()). Then the rules themselves, how Enter, Backspace and Tab make
 * and take apart sections; then the caret's stops, and what's shown.
 */
export function structuredTextSettingsPage() {
  const settings = structuredTextSettings();
  const toggle = (key, title, description) => settingSwitch({
    key, title, description,
    checked: settings[key],
    onChange: (checked) => { settings[key] = checked; },
  });
  return [
    settingGroup("Fundamentals", "What may appear in a document. Nothing you do makes what isn't allowed - "
      + "the buttons for it are off, and keys that would are refused, with a flash. What's there already stays."),
    toggle("exitTitles", "Allow end titles",
      "A section followed by text that isn't in it - its title ends there, a paragraph after it belonging to the section around. "
      + "Off: no paragraph comes after a section in the same section; Enter puts empty lines inside the section before instead."),
    toggle("depressedTitles", "Allow depressed titles",
      "A title shown further down than its place - smaller, its level adjusted - only how it looks, the structure as it is. "
      + "Off: Enter and Backspace never set one so, and the appearance of titles can't be adjusted."),

    settingGroup("Making sections", "Enter on an empty line makes it a section's title; each Enter after it goes up a level, "
      + "Backspace back down, one step at a time."),
    toggle("newSectionsBeside", "New sections on the same level",
      "On: the new section is on the level of the one you're in, at once. Off: Enter digs down first - a section under the one you're in."),
    toggle("keepEmptyLine", "Keep the empty line a section is made on",
      "Before the new section, while you make it - gone when you move on. Off: the section takes its place."),
    toggle("demoteWithChildren", "Include sub-sections when demoting",
      "Tab in a title moves its section into the one before - with its sub-sections, or leaving them after it."),

    settingGroup("The caret", "Where the caret stops besides the text."),
    settingOption({
      title: "Section ends",
      description: "Where the caret finds a section's end - Backspace there takes the whole section out. "
        + "Bottom right: beside its last line, out of the way.",
      control: settingChoice({
        choices: [{ value: "bottomRight", label: "Bottom right" }, { value: "below", label: "Below" }, { value: "none", label: "None" }],
        value: settings.sectionEnds,
        onChoose: (value) => { settings.sectionEnds = value; },
      }),
    }),
    // Section ends: above, for their own.
    markerTypes.filter(({ type }) => type !== "sectionEnd").map(({ type, label }) => settingSwitch({
      key: type,
      title: label,
      checked: settings.markerTypes[type] !== false,
      onChange: (checked) => { settings.markerTypes = Object.freeze({ ...settings.markerTypes, [type]: checked }); },
    })),

    settingGroup("Show", "For seeing how it works."),
    toggle("showFocusOutline", "Outline around what the caret is in"),
    toggle("showAllAreas", "Every marker's area"),
  ];
}
