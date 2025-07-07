import { Component } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, p, ul, li } from "@liquefy/flow.DOM";
import { button, card, cardColumn, cardRow } from "@liquefy/themed-ui";

import { naturalSizeStyle, filler, column, row, centerMiddle, portalContents, layoutBorderStyle, fillerStyle, portal, fitContainerStyle } from "@liquefy/basic-ui";

import { informationButton, displayCodeButton } from "../components/information";
import file from './portalDemo?raw';

export const borderStyle = {
  boxSizing: "border-box",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "gray",
  borderRadius: "3px",
}


/**
 * Portal Example
 */
export class PortalExample extends Component {
  receive({style, portal, topBarPortal}) {    
    // Properties
    this.portal = portal;
    this.topBarPortal = topBarPortal;
    this.style = style;

    // Metadata
    this.name = "Portals";
    this.usesExternalAnimations = true;
  }
  
  initialize() {
    this.showPortal = false;
    this.showFlyingTextInPortal = false; 
  }

  render() {
    const textStyle = {fontSize: "16px", fontFamily: "sans-serif", color: "black", ...borderStyle, boxSize: "border-box", padding: 10, backgroundColor: "white"};
    const flyingText = div("flyingContent", text("flying text in portal"), {animate: true, style: textStyle}); 
    const staticText = div("staticContent", text("Static text in portal"), {animate: true, style: textStyle});

    return (
      column(
        topPortalContents(this.topBarPortal),
        
        // Control panel
        cardRow("controlPannel",
          button(this.showPortal ? "Close Portal" : "Open Portal", ()=> {this.showPortal = !this.showPortal}),
          button(this.showFlyingTextInPortal ? "Fly from portal" : "Fly to portal", ()=> {this.showFlyingTextInPortal = !this.showFlyingTextInPortal}),
          filler(),
          {
            style: {...naturalSizeStyle, gap: 10, padding: 10},
            variant: "filled"        
          }
        ),

        // Center text
        centerMiddle(
          flyingText.show(!this.showFlyingTextInPortal),
          {style: {...fillerStyle, overflow: "visible"}}
        ), 

        // Portal contents
        portalContents("portalContents",
          staticText,
          flyingText.show(this.showFlyingTextInPortal),
          // cardColumn("portalCard", // TODO: There were some glitches when using a card here.
            // {
            //   animate: true,
            //   variant: "filled", 
            //   style: {
            //     ...naturalSizeStyle, padding: 10, marginBottom: 10, alignItems: "start", boxSize: "border-box",
            //   }
            // }
          // ).show(this.showPortal),
          {
            portal: this.portal
          }
        ).show(this.showPortal),
        
        {style: {...fitContainerStyle, overflow: "visible"}}
      )
    );
  }
}
  

/**
 * Standalone example. 
 */
export class PortalStandaloneExample extends Component {
  render() {
    const portal = portal("portal", {style: {width: "300px", height: "300px", ...layoutBorderStyle}})
    const example = new PortalExample("example", {portal});
    return row(div(portal), filler(), div(example)); 
  }
}


/**
 * Start as standalone (useful for reactive debugging etc.)
 */
export function startPortalDemo() {
  const example = new PortalStandaloneExample();
  new DOMRenderContext(document.getElementById("root")).render(example);
}


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("animationExampleInformation", 
    informationButton(
      column(
        p("A demo of the portal mechanism:"),
        ul(
          li("Executes in component render time, meaning that a portal can be populated without it first having to render once and establish the dom node element."), 
          li("It works by a portalContents component setting the children of the portal compoennt if it is visible on screen, and removing its content if hidden. "),
          li("It works seemlessly with DOM transition animations, and you can have elements fly between portals. Just make sure to set overflow: visible on surrounding elements to not hide the flying dom node."),
        ),
        { style: {width: 800, whiteSpace: "normal"}}
      )
    ),
    displayCodeButton({code: file, fileName: "src/pages/portalDemo.js"}),
    {
      portal: topBarPortal
    }
  )
