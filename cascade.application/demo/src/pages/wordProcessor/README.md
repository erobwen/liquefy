# The word processor's model

The demo's Word Processor page (`../WordProcessorPage.js`) is cascade.print
put to use with a model of its own - Word's - which lives here, apart from
cascade.print: cascade.print lays out, shows, edits and prints any model, and
knows nothing of this one.

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
- `sampleDocument.js` - the document the page opens with.

The tests (`test/`, run with `npm test` in the demo) cover the model on its
own, laid out, and edited through the editor.
