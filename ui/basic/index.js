import { applicationMenuFrame } from "./src/ApplicationMenuFrame";
import { basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel } from "./src/BasicWidgets";
import { suitcaseIcon, plusIcon, crossIcon, icon } from "./src/Icons";
import { svgImage } from "./src/images";
import { layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle } from "./src/Layout";
import { modal, Modal, modalFrame, ModalFrame } from "./src/Modal";
import { portalEntrance, PortalEntrance, portalExit } from "./src/Portals";
import { paper, paperColumn, paperRow } from "./src/Paper";


export const basicTheme = {
  components: {
    applicationMenuFrame,
    paper, paperColumn, paperRow,
    basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel,
    suitcaseIcon, plusIcon, crossIcon, icon,
    svgImage,
    layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
    modal, Modal, modalFrame, ModalFrame,
    portalEntrance, PortalEntrance, portalExit
  }
}

export { // Note: A copy paste of allFunctions, since we are not allowed to use spread operators for export. 
  applicationMenuFrame,
  paper, paperColumn, paperRow,
  basicWidgetTheme, label, checkboxInputField, numberInputField, textInputField, inputField, button, panel,
  suitcaseIcon, plusIcon, crossIcon, icon,
  svgImage,
  layoutBorderStyle, flexContainerStyle, rowStyle, columnStyle, centerStyle, middleStyle, centerMiddleStyle, naturalSizeStyle, fitContainerStyle, fillerStyle, wrapper, row, column, center, middle, centerMiddle, filler, zStackElementStyle, zStack, overflowVisibleStyle,
  modal, Modal, modalFrame, ModalFrame,
  portalEntrance, PortalEntrance, portalExit
};
