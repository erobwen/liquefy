import { Component } from "@liquefy/flow.core";

import { text, div, p, ul, li, DOMRenderContext, toPropertiesWithImplicitSingleText, fitTextWithinWidth } from "@liquefy/flow.DOM";

import { basicWidgetTheme, centerMiddle, column, fitContainerStyle, naturalSizeStyle, fillerStyle, row, layoutBorderStyle, portalContents } from "@liquefy/basic-ui";

import { cardRow, numberInput } from "@liquefy/themed-ui";
import { displayCodeButton, informationButton } from "../components/information";

import waves from '../../public/surface.jpg';
import file from './programmaticReactiveLayout?raw';


/**
 * Programmatic Reactive Layout
 */
export class ProgrammaticReactiveLayout extends Component {
  
  receive({ bounds, topBarPortal, style }) {
    this.name = "Programmatic Reactive Layout"; 
    this.bounds = bounds; 
    this.topBarPortal = topBarPortal;
    this.style = style;
  } 

  initialize() {
    this.rows = 3; 
    this.columns = 3;
  }

  render() {
    // Create control panel
    const controlPanel = cardRow("controlPannel",
      numberInput("Rows", this, "rows"),
      numberInput("Columns", this, "columns"),
      {
        style: {...naturalSizeStyle, gap: 10, padding: 10, marginBottom: 10},
        variant: "filled"        
      }
    );
    const controlPanelHeight = controlPanel.dimensions().height; 

    // Create grid of layouts
    const gridHeight = this.bounds.height - controlPanelHeight;
    const gridWidth = this.bounds.width;
    const rows = [];
    let rowIndex = 0;
    const rowHeight = gridHeight / this.rows;
    const columnWidth = gridWidth / this.columns;
    let cellType = false; 
    while(rowIndex < this.rows) {
      const columns = [];
      let columnIndex = 0;
      cellType = rowIndex % 3;
      while(columnIndex < this.columns) {
        const key = rowIndex + "x" + columnIndex;
        const bounds = {width: columnWidth, height: rowHeight};
        switch(cellType) {
          case 0: 
            columns.push(new BoundsDisplay({key, bounds, style: fillerStyle}));
            break; 
          case 1: 
            columns.push(new StringDisplay({key, bounds, style: fillerStyle}));
            break; 
          case 2: 
            columns.push(new FixedAspectRatioDisplay({key, bounds, style: fillerStyle}));
            break; 
        }

        cellType = (cellType + 1)% 3; 
        columnIndex++;
      }
      const currentRow = row(columns, {style: fillerStyle});
      rows.push(currentRow);
      rowIndex++;
    } 

    return column(
      topPortalContents(this.topBarPortal),
      controlPanel,
      column(rows, {style: fillerStyle}),
      {style: {...fitContainerStyle, whiteSpace: "pre", ...this.style}}
    );
  }
}


/**
 * Bounds Display
 */
export class BoundsDisplay extends Component {

  receive({bounds, style}) {
    this.bounds = bounds;
    this.style = style; 
  } 
    
  render() {
    const text = "Bounds: " + Math.round(this.bounds.width) + " x " + Math.round(this.bounds.height);
    return (
      centerMiddle(
        scaledTextWithMaxFontSize({
          text, 
          width: this.bounds.width, 
          style: { backgroundColor: "rgba(255, 255, 255, 0.3)" } }
        ),
        {style: {
          backgroundImage: `url(${waves})`,
          backgroundSize: "tiled",
          overflow: "hidden",
          border: "1px solid",
          backgroundColor: "silver", 
          boxSizing: "border-box",
          ...this.style
        }}
      )
    );
  }
}


/**
 * String Display
 */
export class StringDisplay extends Component {

  receive({bounds, style}) {
    this.bounds = bounds;
    this.style = style; 
  } 
  
  render() {
    const fittedString = "Text that fit the width of container"// + this.key; 
    return (
      centerMiddle(
        text(fittedString), 
        {style: {
          whiteSpace: "pre",
          overflow: "hidden",
          border: "1px solid",
          boxSizing: "border-box",
          fontSize: fitTextWithinWidth(fittedString, this.bounds.width) + "px",
          ...this.style
        }}
      )
    );
  }
}

function scaledTextWithMaxFontSize(...parameters) {
  const properties = toPropertiesWithImplicitSingleText(parameters);

  const fontSize = Math.min(basicWidgetTheme.fontSize, fitTextWithinWidth(properties.text, properties.width*0.8));
  return (
    centerMiddle(
      {
        key: properties.key,
        children: text(properties.text),
        style: {
          whiteSpace: "pre",
          ...fitContainerStyle,
          overflow: "hidden",
          fontSize: fontSize + "px",
          ...properties.style
        }
      }
    )
  );
}


/**
 * Fixed Aspect Ratio Display
 */
export class FixedAspectRatioDisplay extends Component {

  receive({bounds, style}) {
    this.bounds = bounds;
    this.style = style; 
  } 

  initialize() {
    this.aspectRatio = (Math.random()*4 + 1) / (1 + (Math.random()*4));
  }
  
  render() {
    const boundsAspectRatio = this.bounds.width / this.bounds.height; 

    let width; 
    let height; 
    if (this.aspectRatio > boundsAspectRatio) {
      // Constrained by width
      const padding = Math.min(10, this.bounds.width*0.1);
      width = this.bounds.width - padding*2;
      height = width / this.aspectRatio;
    } else {
      // Constrained by height
      const padding = Math.min(10, this.bounds.height*0.1);
      height = this.bounds.height - padding*2;
      width = height * this.aspectRatio; 
    }

    return (
      centerMiddle(
        div(
          scaledTextWithMaxFontSize( 
            {
              text: "Width / Height = " + Math.round(this.aspectRatio * 100) / 100,
              width
            }
          ),{
          style: {
            border: "1px solid",
            boxSizing: "border-box",
            backgroundColor: "#bbbbff",
            width: width + "px", 
            height: height + "px"
          }
        }), 
        {style: {
          overflow: "hidden",
          border: "1px solid",
          boxSizing: "border-box",
          ...this.style
        }}
      )
    );
  }
}


/**
 * This is what you would typically do in index.js to start this app. 
 */
export function startProgrammaticReactiveLayout() {
  new DOMRenderContext(document.getElementById("root")).render(
    new ProgrammaticReactiveLayout()
  );
}


/**
 * Top portal content
 */
const topPortalContents = (topBarPortal) =>
  portalContents("programmaticReactiveLayoutInformation", 
    informationButton(
      column(
        p("Demonstrates the principles of programmatic responsiveness."),
        p("Try change the width of the window and see how the layout responds."),
        ul(
          li("All components are aware of their pixel budget in terms of width/height and respond accordingly."),
          li("Programmaticly fitting a div of constant aspect ratio within a container."),
          li("Programmaticly fitting a text within a container, by dynamically calculating font size."),
        ),
        { style: {width: 800, whiteSpace: "normal"}}
      )
    ),
    displayCodeButton({code: file, fileName: "src/pages/programmaticReactiveLayout.js"}),
    {
      portal: topBarPortal
    }
  )
