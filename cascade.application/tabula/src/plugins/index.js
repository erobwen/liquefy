import { structuredTextPlugin } from "./structuredText/index.js";
import { plainTextPlugin } from "./plainText/index.js";
import { spreadsheetPlugin } from "./spreadsheet/index.js";
import { framesPlugin } from "./frames/index.js";

// Every plugin Tabula comes with - the ones the user can turn on and off in
// the settings (see ../shell/TabulaApp.js). For now, compiled in; later,
// loaded.
export const plugins = [structuredTextPlugin, plainTextPlugin, spreadsheetPlugin, framesPlugin];
