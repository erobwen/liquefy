import { alert } from "./src/alert";
import { basicWidgetTheme, label, panel } from "./src/BasicWidgets";
import { 
  input, textInput, numberInput, checkboxInput, 
  inputField, textInputField, checkboxInputField, numberInputField
} from "./src/input";
import { button, buttonIcon, } from "./src/buttons";
import { icon } from "./src/Icons";
import { svgImage } from "./src/images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./src/Layout";
import { overlay, Overlay, overlayFrame, OverlayFrame } from "./src/overlay";
import { portalContents, PortalContents, portal } from "./src/Portals";
import { card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow } from "./src/card";
import { dialogue } from "./src/dialogue";
import { modalContainer, ModalContainer } from "./src/modalContainer";
import { popover } from "./src/popover";
import { listItem } from "./src/listItem";

export const basicTheme = {
  components: {
    alert,
    card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
    basicWidgetTheme, label, panel,
    input, textInput, numberInput, checkboxInput,
    inputField, textInputField, checkboxInputField, numberInputField,
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
  card, cardShadow0, cardShadow1, cardShadow2, cardShadow3, cardShadow4, cardShadow5, cardShadow6, cardColumn, cardRow,
  basicWidgetTheme, label, 
  input, textInput, numberInput, checkboxInput, 
  inputField, textInputField, checkboxInputField, numberInputField, 
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
