import { settingsFor } from "../../shell/settings.js";

/**
 * How structured text is edited - not what a structured text is, so not
 * saved with it (its paper, its numbered titles, its indented paragraphs
 * are: they're the document's, see ../../model/flows.js). The
 * "structuredText" section of Tabula's settings (see
 * ../../shell/settings.js): one for all of them, wherever they are, kept
 * between visits - changed in the settings dialog (see settingsPage.js).
 * The classic app's settings, all of them (see ../../Tabula.js):
 *
 *  - markerTypes: which kinds of marker the caret goes to besides the text
 *    ({ type: false } for one it doesn't - see ../../paper/markers.js).
 *  - sectionEnds: where a section's end is, for the caret - "bottomRight"
 *    (beside its last line, at the right edge: out of the way, there for
 *    who knows it is - to take the whole section out with Backspace, say),
 *    "below" (a bar under its last line, a row of its own) or "none".
 *  - newSectionsBeside: "New sections on the same level" - a section made
 *    from a blank paragraph on the level of the section it's in, or of
 *    what comes after it, at once; off (the default), digging down first
 *    (see ../../paper/editing.js's ladder).
 *  - exitTitles, depressedTitles: the two fundamental ones - whether a
 *    document may get exit titles ("end titles": a section with text after
 *    it, in the section around) and depressed ones; the rules never take a
 *    path that makes one, and any change that would is refused (see
 *    ../../paper/editing.js's guarded()). End titles allowed, depressed ones
 *    not, by default.
 *  - depressedTitles, besides: whether Enter and Backspace ever set a section
 *    further down than its place (a title offset) on the way - and whether
 *    its appearance can be adjusted so by hand.
 *  - keepEmptyLine: whether the empty line a section is made on stays,
 *    before it, while it's being made - gone once the caret moves on; off
 *    (the default), the section takes its place.
 *  - demoteWithChildren: a section demoted whole, its sub-sections in it.
 *  - showFocusOutline: the flow the caret is in, outlined.
 *  - showAllAreas: every marker's area drawn at once.
 */
export const structuredTextDefaults = Object.freeze({
  markerTypes: Object.freeze({ paragraphStart: false, paragraphEnd: false, titleStart: false, sectionStart: false }),
  sectionEnds: "bottomRight",
  newSectionsBeside: false,
  exitTitles: true,
  depressedTitles: false,
  keepEmptyLine: false,
  demoteWithChildren: true,
  showFocusOutline: false,
  showAllAreas: false,
});

// For a build: the settings, through the service locator.
export const structuredTextSettings = () => settingsFor("structuredText", structuredTextDefaults);
