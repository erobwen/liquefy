import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";

const list = { display: "flex", flexDirection: "column", gap: "6px", padding: "12px", borderRadius: "8px", minWidth: "170px", minHeight: "44px" };
const todo = { ...list, background: "#eaf2f8", fontSize: "18px", color: "#1b4f72" };
const done = { ...list, background: "#eafaf1", fontSize: "13px", color: "#7f8c8d" };
const task = { padding: "6px 10px", borderRadius: "6px", background: "white", cursor: "pointer", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)" };

// Moving to another parent. Both lists are in one container, so a task
// going from one to the other is just a move inside it: it flies there,
// above everything else, taking on the size and color of text over there
// on its way.
//
// Both lists are one piece of state, written once. Written one after the
// other, a task would be in neither list for a rebuild in between - gone
// for good, and back as a new one, fading in.
export class TwoLists extends Component {
  initialState() {
    return { lists: { todo: ["Write", "Test", "Review", "Release"], done: ["Plan"] } };
  }

  move(name) {
    const { todo, done } = this.lists;
    this.lists = todo.includes(name)
      ? { todo: todo.filter((each) => each !== name), done: [name, ...done] }
      : { todo: [...todo, name], done: done.filter((each) => each !== name) };
  }

  build() {
    const tasks = (names) => names.map((name) => div(
      { key: name, style: task, onclick: callback("move" + name, () => this.move(name)) },
      text(name),
    ));
    return flipAnimationContainer(
      { style: { display: "flex", alignItems: "flex-start", gap: "40px" } },
      div({ key: "todo", style: todo }, tasks(this.lists.todo)),
      div({ key: "done", style: done }, tasks(this.lists.done)),
    );
  }
}
