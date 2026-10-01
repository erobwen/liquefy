import { Component, observable, frozen } from "@liquefy/cascade.component";

// A render target of your own - no DOM anywhere: a paper, holding the words
// laid out on it, in order. A temporal array: each word sees it as the
// words before it left it.
class Paper {
  constructor(width) {
    this.width = width;
    this.words = observable([]);
    return observable(this);
  }
}

// A word, laying itself out on the paper: right after the last word placed
// before it - on the next line, if it doesn't fit.
class Word extends Component {
  setProperties({ text }) {
    this.text = text;
  }

  render(paper) {
    // Only the last word: it's laid out again only if that one moved or
    // changed - not for anything else on the paper.
    const previous = paper.words.at(-1);
    let line = previous ? previous.line : 1;
    let column = previous ? previous.column + previous.text.length + 1 : 0;
    if (column > 0 && column + this.text.length > paper.width) {
      line = line + 1;
      column = 0;
    }
    console.log(`  "${this.text}" - line ${line}, column ${column}`);
    // Frozen: a value, compared by content - placed the same as before,
    // and the word after it doesn't lay out again.
    paper.words.push(frozen({ text: this.text, line, column }));
  }
}

class Sentence extends Component {
  setProperties({ words }) {
    this.words = words;
  }

  build() {
    return this.words.words.map((text, index) => new Word({ key: "word" + index, text }));
  }
}

const words = observable({ words: ["Temporal", "signals", "lay", "out", "words", "on", "paper"] });
const paper = new Paper(20);
new Sentence({ words }).renderOnto(paper);
//   "Temporal" - line 1, column 0
//   "signals" - line 1, column 9
//   "lay" - line 1, column 17
//   "out" - line 2, column 0
//   "words" - line 2, column 4
//   "on" - line 2, column 10
//   "paper" - line 2, column 13

// A longer third word: only it, and the words after it, lay out again -
// "Temporal" and "signals" are where they were.
words.words = ["Temporal", "signals", "gracefully", "out", "words", "on", "paper"];
//   "gracefully" - line 2, column 0
//   "out" - line 2, column 11
//   "words" - line 2, column 15
//   "on" - line 3, column 0
//   "paper" - line 3, column 3

// A word of the same length: it lays out again, and so does the next -
// which lands where it was, so the rest stay put.
words.words = ["Temporal", "signals", "gracefully", "put", "words", "on", "paper"];
//   "put" - line 2, column 11
//   "words" - line 2, column 15

// Read from outside, the paper holds all of them - as the last word left it.
console.log(paper.words.map((word) => word.text).join(" "));
//   Temporal signals gracefully put words on paper
