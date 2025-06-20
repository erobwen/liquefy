import { basicWidgetTheme, label, checkboxInputField, numberInputField, textInput, inputField, button, panel } from "./src/BasicWidgets";
import { suitcaseIcon, plusIcon, crossIcon, icon } from "./src/Icons";
import { svgImage } from "./src/images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./src/Layout";
import { overlay, Overlay, overlayFrame, OverlayFrame } from "./src/overlay";
import { portalEntrance, PortalEntrance, portalExit } from "./src/Portals";
import { card, cardColumn, cardRow } from "./src/card";
import { modalPopover } from "./src/dialogues";
import { listItem } from "./src/listItem";

export const basicTheme = {
  components: {
    card, cardColumn, cardRow,
    basicWidgetTheme, label, checkboxInputField, numberInputField, input: textInput, textInput, inputField, button, panel,
    suitcaseIcon, plusIcon, crossIcon, icon,
    svgImage,
    layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
    overlay, Overlay, overlayFrame, OverlayFrame,
    modalPopover,
    listItem,
    portalEntrance, PortalEntrance, portalExit
  }
}

export { // Note: A copy paste of allFunctions, since we are not allowed to use spread operators for export. 
  card, cardColumn, cardRow,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInput, inputField, button, panel,
  suitcaseIcon, plusIcon, crossIcon, icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  overlay, Overlay, overlayFrame, OverlayFrame,
  modalPopover,
  listItem,
  portalEntrance, PortalEntrance, portalExit
};
