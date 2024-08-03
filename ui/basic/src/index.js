import { getGlobalTheme } from "@liquefy/flow.core";

import { applicationMenuFrame } from "./ApplicationMenuFrame";
import { basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel, findInputFieldContent, getInputFieldProperties } from "./BasicWidgets";
import { suitcaseIcon, plusIcon, crossIcon, icon } from "./Icons";
import { svgImage } from "./images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./Layout";
import { modal, Modal, modalFrame, ModalFrame } from "./Modal";
import { portalEntrance, PortalEntrance, portalExit } from "./Portals";
import { paper, paperColumn, paperRow } from "./Paper";


const allFunctions = {
  applicationMenuFrame, findInputFieldContent, getInputFieldProperties,
  paper, paperColumn, paperRow,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel,
  suitcaseIcon, plusIcon, crossIcon, icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  modal, Modal, modalFrame, ModalFrame,
  portalEntrance, PortalEntrance, portalExit
}

export function setBasicUIAsTheme() {
  Object.assign(getGlobalTheme().components, allFunctions);
}

export { // Note: A copy paste of allFunctions, since we are not allowed to use spread operators for export. 
  applicationMenuFrame, findInputFieldContent, getInputFieldProperties,
  paper, paperColumn, paperRow,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel,
  suitcaseIcon, plusIcon, crossIcon, icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  modal, Modal, modalFrame, ModalFrame,
  portalEntrance, PortalEntrance, portalExit
};
