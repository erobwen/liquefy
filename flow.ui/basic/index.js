import { alert } from "./src/alert.js";
import { basicWidgetTheme, label, panel } from "./src/BasicWidgets.js";
import { 
  input, textInput, numberInput, checkboxInput, 
} from "./src/input.js";
import { button, buttonIcon, } from "./src/buttons.js";
import { icon } from "./src/Icons.js";
import { svgImage } from "./src/images.js";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./src/Layout.js";
import { overlay, Overlay, overlayFrame, OverlayFrame } from "./src/overlay.js";
import { portalContents, PortalContents, portal } from "./src/Portals.js";
import { card, cardShadow, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow } from "./src/card.js";
import { dialogue } from "./src/dialogue.js";
import { modalContainer, ModalContainer } from "./src/modalContainer.js";
import { popover } from "./src/popover.js";
import { listItem } from "./src/listItem.js";

export const basicTheme = {
  components: {
    alert,
    card, cardShadow, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
    basicWidgetTheme, label, panel,
    input, textInput, numberInput, checkboxInput,
    button, buttonIcon, 
    icon,
    svgImage,
    layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
    overlay, Overlay, overlayFrame, OverlayFrame,
    popover, modalContainer, ModalContainer, dialogue,
    listItem,
    portalContents, PortalContents, portal
  }
}

export { // Note: A copy paste of basicTheme.components, since we are not allowed to use spread operators for export. 
  alert,
  card, cardShadow, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
  basicWidgetTheme, label, 
  input, textInput, numberInput, checkboxInput,
  panel,
  button, buttonIcon, 
  icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  overlay, Overlay, overlayFrame, OverlayFrame,
  popover, modalContainer, ModalContainer, dialogue,
  listItem,
  portalContents, PortalContents, portal
};
