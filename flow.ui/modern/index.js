import { adjustLightness, grayColor, rgba2hex } from "./src/Color";
import { modernButton, ModernButton } from "./src/ModernButton";
import { ModernTextField, modernTextField } from "./src/ModernTextField";
import { borderStyle, hardCardShadow, panelStyle, cardShadow } from "./src/Style";
import { card, cardColumn, cardRow } from "./src/Paper";

const button = modernButton;

export const modernTheme = {
  components: {
    button,
    card, cardRow, cardColumn,
  }, 
  styles: {
    cardShadow, 
    hardCardShadow, 
    panelStyle, 
    borderStyle
  }
}

export { // Note: A copy paste of allFunctions, since we are not allowed to use spread operators for export. 
  rgba2hex, grayColor, adjustLightness, 
  modernButton, ModernButton, 
  button,
  card, cardRow, cardColumn,
  modernTextField, ModernTextField,
  cardShadow, hardCardShadow, 
  panelStyle, borderStyle
};