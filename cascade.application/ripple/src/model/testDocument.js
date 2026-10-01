import { paperSizes, margins, mm } from "@liquefy/cascade.print";
import { document, section, paragraph, bold, italic } from "./parts.js";

// A document to open with - a small book, sections in sections, about the
// very structure it's written in.
export function testDocument() {
  return document({ title: "Ripple", paper: paperSizes.A4, margins: margins(mm(25)) },
    paragraph("A word processor where a document is a ", bold("tree of parts"), ", as a DAISY book is: ",
      "sections inside sections, each with a title, and paragraphs of text in them."),
    paragraph("Nothing in it has a style of its own. Where a part is decides how it looks - ",
      "a section's title is a heading for how deep the section is, everything else is body text - ",
      "and only a word here and there is ", bold("bold"), " or ", italic("italic"), "."),

    section("Parts",
      paragraph("Every node of a document is a ", italic("part"), ". There are only two kinds of them."),
      section("Paragraphs",
        paragraph("A paragraph is a leaf: text, in spans. A span may be bold, or italic, or both - ",
          "the only styling there is, and it's the span's, never the paragraph's."),
        paragraph("So two paragraphs side by side always look the same, wherever they are, ",
          "unless what's written in them says otherwise."),
      ),
      section("Sections",
        paragraph("A section has a title - a paragraph - and children: first its paragraphs, then the sections inside it. ",
          "A paragraph never comes after a section; what would follow one belongs in a section of its own."),
        paragraph("The document itself is the outermost section. Its title is the title of the whole document, ",
          "and it knows the paper the document is printed on."),
      ),
    ),

    section("On paper",
      paragraph("Every part is a component of its own, rendered onto a sequence of papers by ",
        bold("cascade.print"), ". A section renders its title, then its children, one after another - ",
        "the order the tree is read in, which is the order the text flows down the papers."),
      section("Headings by depth",
        paragraph("The document's title is set largest, centered. A chapter's title is a little smaller, ",
          "a section's inside it smaller still, and every level below that the same: bold and italic, ",
          "in the size of the text."),
        section("A section three levels deep",
          paragraph("This one, for instance."),
          section("And one deeper still",
            paragraph("Set the same as the level above - the headings stop getting smaller here."),
          ),
        ),
      ),
      section("Paragraphs, laid out",
        paragraph("Each paragraph is laid out the way cascade.print lays out any: broken into lines first, ",
          "then the lines placed on the papers from wherever the part before it left off."),
        paragraph("Change a paragraph and only it is broken into lines again; ",
          "the parts after it are only moved, as far as they need to be."),
      ),
    ),

    section("What comes next",
      paragraph("Editing again - typing, selecting, splitting and joining paragraphs - now on the tree: ",
        "Enter in a title, a paragraph at the end of a section, a section moved up a level."),
    ),
  );
}
