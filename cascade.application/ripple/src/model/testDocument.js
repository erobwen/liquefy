import { paperSizes, margins, mm } from "../print/index.js";
import { document, section, paragraph, bold, italic } from "./parts.js";

// A document to open with - a small book, sections in sections, about the
// very structure it's written in. Its titles are numbered by where they are
// (1, 1.1, 2.1.1, ...), to see the structure - and what the caret does in it.
export function testDocument() {
  return document({ title: "Ripple", paper: paperSizes.A4, margins: margins(mm(25)) },
    paragraph("A word processor where a document is a ", bold("tree of parts"), ", as a DAISY book is: ",
      "sections inside sections, each with a title, and paragraphs of text in them."),
    paragraph("Nothing in it has a style of its own. Where a part is decides how it looks - ",
      "a section's title is a heading for how deep the section is, everything else is body text - ",
      "and only a word here and there is ", bold("bold"), " or ", italic("italic"), "."),

    section("1 Parts",
      paragraph("Every node of a document is a ", italic("part"), ". There are only two kinds of them."),
      section("1.1 Paragraphs",
        paragraph("A paragraph is a leaf: text, in spans. A span may be bold, or italic, or both - ",
          "the only styling there is, and it's the span's, never the paragraph's."),
        paragraph("So two paragraphs side by side always look the same, wherever they are, ",
          "unless what's written in them says otherwise."),
      ),
      section("1.2 Sections",
        paragraph("A section has a title - a paragraph - and children: first its paragraphs, then the sections inside it. ",
          "A paragraph never comes after a section; what would follow one belongs in a section of its own."),
        paragraph("The document itself is the outermost section. Its title is the title of the whole document, ",
          "and it knows the paper the document is printed on."),
      ),
    ),

    section("2 On paper",
      paragraph("Every part is a component of its own, rendered onto a sequence of papers by ",
        bold("cascade.print"), ". A section renders its title, then its children, one after another - ",
        "the order the tree is read in, which is the order the text flows down the papers."),
      section("2.1 Headings by depth",
        paragraph("The document's title is set largest, centered. A chapter's title is a little smaller, ",
          "a section's inside it smaller still, and every level below that the same: bold and italic, ",
          "in the size of the text."),
        section("2.1.1 A section three levels deep",
          paragraph("This one, for instance."),
          section("2.1.1.1 And one deeper still",
            paragraph("Set the same as the level above - the headings stop getting smaller here."),
          ),
        ),
      ),
      section("2.2 Paragraphs, laid out",
        paragraph("Each paragraph is laid out the way cascade.print lays out any: broken into lines first, ",
          "then the lines placed on the papers from wherever the part before it left off."),
        paragraph("Change a paragraph and only it is broken into lines again; ",
          "the parts after it are only moved, as far as they need to be."),
      ),
    ),

    section("3 What comes next",
      paragraph("Editing again - typing, selecting, splitting and joining paragraphs - now on the tree: ",
        "Enter in a title, a paragraph at the end of a section, a section moved up a level."),
    ),
  );
}
