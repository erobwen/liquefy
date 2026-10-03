# Ripple's document model

A document is a tree of flows, as a DAISY 2 book is (`flows.js`):

- **Flow** - what every node of the document is.
- **Paragraph** - a leaf: text, as spans. A span may be bold or italic; that's
  the only styling there is, and it's the span's - a paragraph as a whole holds
  no style at all.
- **Section** - a `title` (a paragraph) and `children`: paragraphs and the
  sections inside it, in any order.
- **Document** - the outermost section: its title is the document's, and it
  holds the paper it's printed on.

Where a caret can be: in a paragraph's text (`textPosition`); and at a
**marker** - a place between text - of which there are two kinds: every list's
gaps (`gap(list, index)`: between two of its children, or a section's title
and its first child - never before the first or after the last; a gap may be
two places, one above the other: its **split marker**, to add something
between the two flows, and its **join marker**, to join them into one), and
every flow's own start and end (`flowStart(flow)`, `flowEnd(flow)`: a document's, a
section's, a title's, a paragraph's). Between two paragraphs A and B of one
section there are three: the end of A, the gap between them, the start of B.
Where the markers go on the papers, and what area each stands for, is worked
out from the laid-out text (`../paper/markers.js`).

A section always has a title - an empty one is laid out as a faint "Title"
placeholder. Its **title level** is 1 at the root, its parent's + 1 inside
another section, each pushed further down by the section's own `titleOffset`;
a paragraph's is infinite (`titleLevel`). A section followed by a sibling of a
higher title level - a paragraph, or a section further down - gets an **exit
title** (`hasExitTitle`, `exitTitle`): after all that's in it, a fleuron, an
arrow, and the title of the section it's in, where the sibling is - set a
title level below that title - so nobody takes the sibling for being inside
it. It's laid out, but no text of the document's and nowhere a caret goes.

What a flow looks like comes from where it is: a section's title is a heading
for its title level, every other paragraph is body text (see
`../layout/typography.js`). Every flow is a Cascade component of its own on
the paper (`../layout/DocumentLayout.js`).

`testDocument.js` is the document Ripple opens with. The tests (`test/`, and
`../layout/test/`, run with `npm test` in `cascade.application/ripple`) cover
the flows' rules and how a document is laid out.
