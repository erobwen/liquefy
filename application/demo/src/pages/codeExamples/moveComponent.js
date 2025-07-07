
import { Component } from "@liquefy/flow.core";
import { wrapper, filler, button, row, column } from "@liquefy/basic-ui";


/**
 * A minimalistic example of animating a moving component.
 */
export class MoveComponent extends Component {
  initialize() {
    this.moveComponent = false; 
  }

  render() {
    // animate: true below activates default animation on the text div. 
    const movedComponent = div("Some Text", {animate: true}); 
    return column(
      button("Move it!", () => { this.moveComponent = !this.moveComponent; }),
    ),
    row(
      wrapper("originalContainer", 
        movedComponent.show(!this.moveComponent), // Shows here originally!
      ),
      filler(), 
      wrapper("moveToContainer", 
        movedComponent.show(this.moveComponent), // Animates to here!
      ),
    )
  }
}