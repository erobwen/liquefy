import { repeat, observable, Component, transaction, toProperties, toPropertiesWithChildren } from "@liquefy/flow.core";

import { text, div, DOMRenderContext, toPropertiesWithImplicitSingleText, standardAnimation, addDefaultStyle, fitTextWithinWidth } from "@liquefy/flow.DOM";

import { wrapper, basicWidgetTheme, overflowVisibleStyle, numberInputField, centerMiddle, overlay, column, fitContainerStyle, naturalSizeStyle, fillerStyle, filler, row, zStack, layoutBorderStyle } from "@liquefy/basic-ui";
import { buttonIcon } from "@liquefy/ui-material";
import { zStackElementStyle, modalPopover } from "@liquefy/basic-ui";

import { logMark } from "@liquefy/flow.core";

const log = console.log;

/**
 * Flow definitions
 */

// Parent flow
export class ProgrammaticReactiveLayout extends Component {
  
  receive({ bounds, name }) {
    this.name = name; 
    this.bounds = bounds; 
  } 

  initialize() {
    this.rows = 3; 
    this.columns = 3;
    this.menuOpen = false;
  }

  render() {
    // console.log("ProgrammaticReactiveLayout")
    // console.log(this.bounds)

    // Create control panel
    const controlPanel = column("control-panel",
      row(numberInputField("Rows", this, "rows")),
      row(numberInputField("Columns", this, "columns")),
      text("Try change the size of the browser window, and add/remove columns/rows. Try do this with css :-)"),
      {style: naturalSizeStyle}
    );
    const controlPanelHeight = controlPanel.dimensions().height; 

    // Create bottom toolbar
    const menuButton = buttonIcon("menuButton", 
      () => { this.menuOpen = true; },
      { icon: "more_horiz", style: {width: "40px"} }
    )
    let toolbarWidthLeft = this.bounds.width;
    const toolbarContents = [];
    const popupMenuContents = [];
    
    const tools = ["search", "home", "settings", "star", "key", "bolt"]
    let toolCount = 0;
    const totalTools = 20;
    while(toolCount++ < totalTools) {
      const isLast = toolCount === totalTools;
      const nextWidget = buttonIcon("toolButton" + toolCount, 
        () => { console.log("pushed tool")},
        { icon: tools[toolCount % tools.length], style: {width: "40px"}}
      )
      const widgetWidth = nextWidget.dimensions().width;
      if (widgetWidth + (isLast ? 0 : menuButton.dimensions().width) <= toolbarWidthLeft) {
        toolbarWidthLeft -= widgetWidth;
        toolbarContents.push(nextWidget)
      } else {
        if (toolbarContents[toolbarContents.length - 1] !== menuButton) {
          toolbarContents.push(menuButton);
          toolbarWidthLeft -= menuButton.dimensions().width
        }
        popupMenuContents.push(nextWidget)
      }
    }
    const toolbar = row(toolbarContents);
    const toolbarHeight = toolbar.dimensions().height;
    const extraToolbar = row("extraMenu", popupMenuContents, {style: {backgroundColor: "#fef7ff", ...layoutBorderStyle}});

    // Create grid of layouts
    const gridHeight = this.bounds.height - controlPanelHeight - toolbarHeight;
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
      controlPanel,
      column(rows, {style: fillerStyle}),
      toolbar,
      overlay(modalPopover(
        extraToolbar,
        {
          bounds: this.bounds,
          close: () => { this.menuOpen = false; }, 
          reference: menuButton,
        }
      )).show(this.menuOpen),
      {style: {
        height: "100%", 
        width: "100%", 
      }}
    );
  }
}



export class BoundsDisplay extends Component {

  receive({bounds, style}) {
    this.bounds = bounds;
    this.style = style; 
  } 
    
  render() {
    const text = "Bounds: " + Math.round(this.bounds.width) + " x " + Math.round(this.bounds.height);
    return (
      centerMiddle(
        scaledTextWithMaxFontSize(
          {text, width: this.bounds.width}
        ),
        {style: {
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
          ...fitContainerStyle,
          overflow: "hidden",
          fontSize: fontSize + "px",
          ...properties.style
        }
      }
    )
  );
}


export class FixedAspectRatioDisplay extends Component {

  receive({bounds, style}) {
    this.bounds = bounds;
    this.style = style; 
  } 

  initialize() {
    this.aspectRatio = (Math.random()*4 + 1) / (1 + (Math.random()*4));
  }
  
  render() {
    const fittedString = "Fitted String"// + this.key;
    
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


function subtractWidth(bounds, width) {
  return {width: bounds.width - width, height: bounds.height};
}


function subtractHeight(bounds, width) {
  return {width: bounds.width - width, height: bounds.height};
}