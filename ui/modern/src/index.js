import { getGlobalTheme } from "@liquefy/themed-ui";
import { adjustLightness, grayColor, rgba2hex } from "./Color";
import { modernButton, ModernButton } from "./ModernButton";
import { ModernTextField, modernTextField } from "./ModernTextField";
import { borderStyle, hardPaperShadow, panelStyle, paperShadow } from "./Style";
import { paper, paperColumn, paperRow } from "./Paper";

const button = modernButton;

const allFunctions = {
  rgba2hex, grayColor, adjustLightness, 
  modernButton, ModernButton, 
  button,
  paper, paperRow, paperColumn,
  modernTextField, ModernTextField,
  paperShadow, hardPaperShadow, 
  panelStyle, borderStyle
}

export function setModernUIAsTheme() {
  Object.assign(getGlobalTheme().components, allFunctions);
}

export { // Note: A copy paste of allFunctions, since we are not allowed to use spread operators for export. 
  rgba2hex, grayColor, adjustLightness, 
  modernButton, ModernButton, 
  button,
  paper, paperRow, paperColumn,
  modernTextField, ModernTextField,
  paperShadow, hardPaperShadow, 
  panelStyle, borderStyle
};