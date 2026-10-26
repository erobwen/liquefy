import { settingsFor } from "../../shell/settings.js";

/**
 * How structured text is edited - not what a structured text is, so not
 * saved with it (its paper, its numbered titles, its indented paragraphs
 * are: they're the document's, see ../../model/flows.js). The
 * "structuredText" section of Tabula's settings (see
 * ../../shell/settings.js): one for all of them, wherever they are, kept
 * between visits - changed from a document's context menu (see menus.js).
 * The classic app's settings, all of them (see ../../Tabula.js):
 *
 *  - markerTypes: which kinds of marker the caret goes to besides the text
 *    ({ type: false } for one it doesn't - see ../../paper/markers.js).
 *  - sectionEnds: a section's end "below" its last line, or "beside" it.
 *  - newSectionsBeside: a section made from a blank paragraph split off
 *    its parent at once (see ../../paper/editing.js).
 *  - demoteWithChildren: a section demoted whole, its sub-sections in it.
 *  - showFocusOutline: the flow the caret is in, outlined.
 *  - showAllAreas: every marker's area drawn at once.
 */
export const structuredTextDefaults = Object.freeze({
  markerTypes: Object.freeze({ paragraphStart: false, paragraphEnd: false, titleStart: false, sectionStart: false }),
  sectionEnds: "below",
  newSectionsBeside: true,
  demoteWithChildren: true,
  showFocusOutline: false,
  showAllAreas: false,
});

// For a build: the settings, through the service locator.
export const structuredTextSettings = () => settingsFor("structuredText", structuredTextDefaults);
