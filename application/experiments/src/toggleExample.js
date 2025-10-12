import { button } from "../components/basic/BasicWidgets";
import { column } from "../components/basic/Layout";
import { Flow, model, observable, repeat } from "../flow/Flow";

/*
* Notes: This file is an experiment in how to compare Flow to the combo of React + StateReducerPattern
* It is a remake of the contrived example from the following page: 
* https://kentcdodds.com/blog/the-state-reducer-pattern-with-react-hooks
*/

class ToggleModel {
  constructor() {
    this.on = true; 
    return model(this);
  }

  toggle() {
    this.on = !this.on
  }

  setOn() {
    this.on = true
  }

  setOff() {
    this.on = false
  }
}

class ExhaustableToggleModel extends ToggleModel {
  constructor() {
    super();
    this.clicksSinceReset = 0;
  }

  tooManyClicks() {
    return this.clicksSinceReset > 4;
  }

  toggle() {
    this.clicksSinceReset += 1;
    if (!this.tooManyClicks()) {
      super.toggle();
    }
  }

  reset() {
    this.clicksSinceReset = 0;
  }
}

export class ToggleView extends Flow {
  initialize() {
    this.toggle = new ExhaustableToggleModel();
  }
  build() {
    return column(
      button("Switch Off", {onClick: () => {this.toggle.setOff()}}),
      button("Switch On", {onClick: () => {this.toggle.setOn()}}),
      !this.toggle.tooManyClicks() &&
        button(this.toggle.on ? "ON" : "OFF", {onClick: () => {this.toggle.toggle()}}),
      this.toggle.tooManyClicks() && 
        button("Reset", {onClick: () => this.toggle.reset()})
    )
  }
}