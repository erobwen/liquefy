# Ripple's document model

Ripple's own model - Word's, to begin with - laid out, shown, edited and
printed with cascade.print, which knows nothing of it. It started as a copy of
the Cascade demo's word processor model
(`cascade.application/demo/src/pages/wordProcessor`) and is Ripple's to change
from here: the two are separate, and nothing ties one to the other.

- `styles.js` - the stylesheet, and how a paragraph's and a span's look is
  resolved from it: defaults, paragraph style (and what it's `basedOn`),
  character style, direct formatting.
- `WordDocument.js` - the model laid out with cascade.print: `WordSection`
  and `WordParagraph`, subclasses of cascade.print's `Section` and
  `Paragraph`, saying which paper a section is on and what a paragraph's text
  and fonts are.
- `editing.js` - the edits typing makes: insert, delete, split and merge
  paragraphs, delete a selection, move through the text.
- `formatting.js` - what a toolbar does: bold, italic, paragraph style,
  alignment, first line indent.
- `wordEditing.js` - the edits, as cascade.print's `PaperEditor` asks for them.
- `FormatToolbar.js` - the toolbar, formatting at the editor's caret.
- `sampleDocument.js` - the document Ripple opens with.

The tests (`test/`, run with `npm test` in `cascade.application/ripple`) cover
the model on its own, laid out, and edited through the editor.
