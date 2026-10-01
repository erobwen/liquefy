# Ripple's document model

A document is a tree of parts, as a DAISY 2 book is (`parts.js`):

- **Part** - what every node of the document is.
- **Paragraph** - a leaf: text, as spans. A span may be bold or italic; that's
  the only styling there is, and it's the span's - a paragraph as a whole holds
  no style at all.
- **Section** - a `title` (a paragraph) and `children`: its paragraphs first,
  then the sections inside it - never a paragraph after a section.
- **Document** - the outermost section: its title is the document's, and it
  holds the paper it's printed on.

Where a caret can be: in a paragraph's text (`textPosition`); and at a
**marker** - a place between text - of which there are two kinds: every list's
gaps (`gap(list, index)`: between two of its children, or a section's title
and its first child - never before the first or after the last), and every
part's own start and end (`partStart(part)`, `partEnd(part)`: a document's, a
section's, a title's, a paragraph's). Between two paragraphs A and B of one
section there are three: the end of A, the gap between them, the start of B.
Where the markers go on the papers, and what area each stands for, is worked
out from the laid-out text (`../paper/markers.js`).

What a part looks like comes from where it is: a section's title is a heading
for how deep the section is, every other paragraph is body text (see
`../layout/typography.js`). Every part is a Cascade component of its own on
the paper (`../layout/DocumentLayout.js`).

`testDocument.js` is the document Ripple opens with. The tests (`test/`, and
`../layout/test/`, run with `npm test` in `cascade.application/ripple`) cover
the parts' rules and how a document is laid out.
