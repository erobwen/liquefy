import { alert } from "./src/alert";
import { basicWidgetTheme, label, checkboxInputField, numberInputField, textInput, inputField, panel } from "./src/BasicWidgets";
import { button, buttonIcon, } from "./src/buttons";
import { icon } from "./src/Icons";
import { svgImage } from "./src/images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./src/Layout";
import { overlay, Overlay, overlayFrame, OverlayFrame } from "./src/overlay";
import { portalContents, PortalContents, portalExit } from "./src/Portals";
import { card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow } from "./src/card";
import { popover, modal, Modal, dialogue } from "./src/dialogues";
import { listItem } from "./src/listItem";

export const basicTheme = {
  components: {
    alert,
    card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
    basicWidgetTheme, label, checkboxInputField, numberInputField, input: textInput, textInput, inputField, panel,
    button, buttonIcon, 
    icon,
    svgImage,
    layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
    overlay, Overlay, overlayFrame, OverlayFrame,
    popover, modal, Modal, dialogue,
    listItem,
    portalContents, PortalContents, portalExit
  }
}

export { // Note: A copy paste of basicTheme.components, since we are not allowed to use spread operators for export. 
  alert,
  card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInput, inputField, panel,
  button, buttonIcon, 
  icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  overlay, Overlay, overlayFrame, OverlayFrame,
  popover, modal, Modal, dialogue,
  listItem,
  portalContents, PortalContents, portalExit
};
