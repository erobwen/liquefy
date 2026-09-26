import { Component, RenderContext, observable } from "@liquefy/cascade.component";

// A render target of your own - no DOM anywhere: a paper, whose state is
// where the next word goes.
class Paper {
  constructor(width) {
    this.width = width;
    this.column = 0;
    this.line = 1;
    return observable(this);
  }
}

// A word, laying itself out on the paper: where the one before it left
// off - on the next line, if it doesn't fit.
class Word extends Component {
  setProperties({ text }) {
    this.text = text;
  }

  render(context) {
    const paper = context.target;
    let { line, column } = paper;
    if (column > 0 && column + this.text.length > paper.width) {
      line = line + 1;
      column = 0;
    }
    console.log(`  "${this.text}" - line ${line}, column ${column}`);
    paper.line = line;
    paper.column = column + this.text.length + 1;
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
new Sentence({ words }).renderOnto(new RenderContext(new Paper(20)));

console.log("-- a longer third word:");
words.words = ["Temporal", "signals", "gracefully", "out", "words", "on", "paper"];
