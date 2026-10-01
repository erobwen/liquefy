import { Component } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";
import { iconButton, dropdown, themeColor } from "@liquefy/cascade.ui";
import { position, wordAt } from "./editing.js";
import { resolveParagraphStyle } from "./styles.js";
import { isFormatted, toggleBold, toggleItalic, setParagraphStyle, setAlignment, toggleFirstLineIndent, paragraphFormatAt } from "./formatting.js";

/**
 * Formatting the word processor's model at the caret of a PaperEditor (see
 * cascade.print) - the editor knows nothing of formatting: this asks it
 * what's selected (selection()) and makes the change through it (apply()),
 * which gives the keyboard back to the text afterwards.
 *
 *  - "bold", "italic": toggled for the selection - or, with nothing
 *    selected, the word the caret is inside, as in Word.
 *  - "style", "align": set to `value` for every paragraph the selection
 *    touches; "firstLineIndent": toggled for them.
 */
export function applyFormat(editor, document, kind, value) {
  const selection = editor.selection();
  if (!selection) return;
  const { anchor, focus } = selection;
  editor.apply(() => {
    if (kind === "bold" || kind === "italic") {
      const range = textRange(selection);
      if (range) (kind === "bold" ? toggleBold : toggleItalic)(document, ...range);
    } else if (kind === "style") {
      setParagraphStyle(document, anchor, focus, value);
    } else if (kind === "align") {
      setAlignment(document, anchor, focus, value);
    } else if (kind === "firstLineIndent") {
      toggleFirstLineIndent(document, anchor, focus, value);
    }
  });
}

// What's formatted how at the caret, for a toolbar: { bold, italic, style,
// align, firstLineIndent } - bold and italic for all of the selection, the
// rest for the paragraph the caret is in - or null before there's a caret.
export function currentFormat(editor, document) {
  const selection = editor.selection();
  if (!selection) return null;
  const { anchor, focus } = selection;
  return {
    bold: isFormatted(document, anchor, focus, (font) => font.weight >= 600),
    italic: isFormatted(document, anchor, focus, (font) => !!font.italic),
    ...paragraphFormatAt(document, focus),
  };
}

// What bold and italic apply to: the selection - or, with nothing
// selected, the word the caret is inside (not at either end of). Null if
// neither.
function textRange({ anchor, focus, selected }) {
  if (selected) return [anchor, focus];
  const { paragraph, offset } = focus;
  const [start, end] = wordAt(paragraph, offset);
  return start < offset && offset < end ? [position(paragraph, start), position(paragraph, end)] : null;
}

// The paragraph styles in the style menu, by name in the sample document's
// stylesheet - every one of them.
const paragraphStyles = [
  { style: "Title", label: "Title" },
  { style: "Subtitle", label: "Subtitle" },
  { style: "Heading1", label: "Heading 1" },
  { style: "Heading2", label: "Heading 2" },
  { style: "Normal", label: "Normal" },
  { style: "Body", label: "Body text" },
  { style: "Quote", label: "Quote" },
];

// How a style looks, for its entry in the style menu: its font - the size
// scaled down to fit in a menu, larger styles still larger.
function stylePreview(stylesheet, style) {
  const { font } = resolveParagraphStyle(stylesheet, style);
  return {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: font.italic ? "italic" : "normal",
    fontSize: Math.round(Math.min(22, 9 + font.size * 0.55)) + "px",
  };
}

const alignments = [
  { align: "left", icon: "format_align_left", title: "Align left" },
  { align: "center", icon: "format_align_center", title: "Center" },
  { align: "right", icon: "format_align_right", title: "Align right" },
];

/**
 * FormatToolbar - the formatting buttons: showing what's on at the caret,
 * and setting it there. A component of its own: it follows every move of
 * the caret, the page around it doesn't.
 *
 * Properties: `editor` - the PaperEditor - and `document`, the model it
 * edits.
 */
export class FormatToolbar extends Component {
  setProperties({ editor, document }) {
    this.editor = editor;
    this.document = document;
  }

  build() {
    const { editor, document } = this;
    const current = currentFormat(editor, document);
    const disabled = !current;
    const format = (kind, value) => applyFormat(editor, document, kind, value);
    const on = { background: themeColor.accentLight, color: themeColor.accentDark };
    const toggle = (kind, icon, title, active) => iconButton({
      icon, title, disabled, style: active ? on : {}, onClick: () => format(kind),
    });
    return [
      dropdown({
        options: paragraphStyles.map(({ style, label }) => ({ value: style, label, style: stylePreview(document.styles, style) })),
        value: current ? current.style : null,
        placeholder: "Style",
        title: "Paragraph style",
        disabled,
        onSelect: (style) => format("style", style),
        style: { minWidth: "128px" },
      }),
      separator(),
      toggle("bold", "format_bold", "Bold (Ctrl+B)", current && current.bold),
      toggle("italic", "format_italic", "Italic (Ctrl+I)", current && current.italic),
      separator(),
      ...alignments.map(({ align, icon, title }) => iconButton({
        icon, title, disabled, style: current && current.align === align ? on : {}, onClick: () => format("align", align),
      })),
      separator(),
      toggle("firstLineIndent", "format_indent_increase", "First line indent", current && current.firstLineIndent > 0),
    ];
  }
}

function separator() {
  return div({ style: { width: "1px", alignSelf: "stretch", margin: "4px 2px", background: themeColor.border } });
}
