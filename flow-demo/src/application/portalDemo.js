import { observable, world, repeat, when, Component, finalize, readFlowProperties } from "../flow/Flow";
import { DOMFlowTarget } from "../flow.DOM/DOMFlowTarget.js";
import { portalEntrance } from "../components/basic/Portals";
import { button, text } from "../components/basic/BasicWidgets";
import { column, filler, row } from "../components/basic/Layout";

const log = console.log;
const loga = (action) => {
  log("-----------" + action + "-----------");
}


/**
 * This is a demo-application that showcases some of the principles of Flow. 
 * Please read the comments for a tour over what features exists and how they work.  
 * 
 * This simple program just demonstrates the recursive and state preserving capabilities 
 * of Flow. A number of components are created recursivley according to the "count" state.
 * And each component has its own state that can be toggled on/off. Note that the state of each individual 
 * component is maintained, while the whole recursive chain of components are re-built. 
 * Also, open and expand the view-elements debug panel in Chrome, to verify minimal updates
 * to the DOM when the UI is rebuilt.  
 */
export class PortalExample extends Component {
  // Lifecycle function build is run reactivley on any change, either in the model or in the view model. It reads data from anywhere in the model or view model, and the system automatically infers all dependencies.
  setProperties({portal}) {
    this.name = "Portal Example";
    this.portal = portal;
  }
  
  setState() {
    this.showPortal = true;
    this.showFlyingTextInPortal = false; 
  }

  build() {
    const flyingText = text("flying text in portal", {animate: true, key: "flying-content"}); 
    const staticText = text("text in portal", {key: "content", animate: true})

    const portalContent = [staticText];
    if (this.showFlyingTextInPortal) portalContent.push(flyingText)

    // return flyingText; 

    return (
      column(
        text("portal demo"),
        row(
          button(this.showPortal ? "Close Portal" : "Open Portal", ()=> {this.showPortal = !this.showPortal}),
          filler()
        ),
        row(
          button(this.showFlyingTextInPortal ? "Fly from portal" : "Fly to portal", ()=> {flyingText.animate = true; this.showFlyingTextInPortal = !this.showFlyingTextInPortal}),
          flyingText.show(!this.showFlyingTextInPortal),
          filler(),
          {style: {overflow: "visible"}}
        ), 
        portalEntrance(
          {
            // children: text("[portal active]"), Will create infinite loop! investigate! 
            key: "portalEntrance", 
            portalExit: this.portal, 
            portalContent 
          })
          .show(this.showPortal),
        {style: {overflow: "visible"}}
      )
    );
  }
}
  

/**
 * Start the demo
 */
  
export function startPortalDemo() {
  const root = new PortalExample();
  new DOMFlowTarget(document.getElementById("flow-root")).setContent(root);
}
