import { applicationMenuFrame } from "./ApplicationMenuFrame";
import { basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel } from "./BasicWidgets";
import { suitcaseIcon, plusIcon, crossIcon, icon } from "./Icons";
import { svgImage } from "./images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./Layout";
import { modal, Modal, modalFrame, ModalFrame } from "./Modal";
import { portalEntrance, PortalEntrance, portalExit } from "./Portals";
import { globalContext } from "@liquefy/flow.core";

export function setBasicUIAsTheme() {
  globalContext.components.input = inputField;
  globalContext.components.textInputField = textInputField; 
  globalContext.components.checkboxInputField = checkboxInputField; 
  globalContext.components.numberInputField = numberInputField; 
  globalContext.components.label = label; 
}

export {
  applicationMenuFrame,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel,
  suitcaseIcon, plusIcon, crossIcon, icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  modal, Modal, modalFrame, ModalFrame,
  portalEntrance, PortalEntrance, portalExit
};
