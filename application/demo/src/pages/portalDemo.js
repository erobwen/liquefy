import { Component } from "@liquefy/flow.core";
import { DOMRenderContext, text, div } from "@liquefy/flow.DOM";
import { filler, column, row } from "@liquefy/basic-ui";
import { button } from "@liquefy/basic-ui";
import { portalContents } from "@liquefy/basic-ui";
import { layoutBorderStyle, portalExit } from "@liquefy/basic-ui";


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
  receive({portal}) {
    this.name = "Portals";
    this.portal = portal;
    this.usesExternalAnimations = true; 
  }
  
  initialize() {
    this.showPortal = false;
    this.showFlyingTextInPortal = false; 
  }

  render() {
    const flyingText = div("flying-content", text("flying text in portal"), {animate: true}); 
    const staticText = div("content", text("Static text in portal"), {animate: true});

    const portalChildren = [staticText];
    if (this.showFlyingTextInPortal) portalChildren.push(flyingText)

    // return flyingText; 

    return (
      column(
        text("portal demo"),
        row(
          button(this.showPortal ? "Close Portal" : "Open Portal", ()=> {this.showPortal = !this.showPortal}),
          filler()
        ),
        row(
          button(this.showFlyingTextInPortal ? "Fly from portal" : "Fly to portal", ()=> {this.showFlyingTextInPortal = !this.showFlyingTextInPortal}),
          flyingText.show(!this.showFlyingTextInPortal),
          filler(),
          {style: {overflow: "visible"}}
        ), 
        portalContents("portalContents",
          {
            // children: text("[portal active]"), Will create infinite loop! investigate! 
            portalExit: this.portal, 
            children: portalChildren 
          })
          .show(this.showPortal),
        {style: {overflow: "visible"}}
      )
    );
  }
}
  
export class PortalStandaloneExample extends Component {
  render() {
    const portal = portalExit("portal", {style: {width: "300px", height: "300px", ...layoutBorderStyle}})
    // const portal = div("portal", {style: {width: "300px", height: "300px", ...layoutBorderStyle}});
    const example = new PortalExample("example", {portal});
    return row(div(example), filler(), div(portal)); 
  }
}


/**
 * Start the demo
 */
  
export function startPortalDemo() {
  const root = new PortalStandaloneExample();
  new DOMRenderContext(document.getElementById("root")).render(root);
}
