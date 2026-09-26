import { Component, observable, locateService, toPropertiesWithChildren } from "@liquefy/cascade.component";
import { div } from "@liquefy/cascade.dom";

/**
 * Color schemes - a theme's colors, all from two: a base color (the app's
 * frame, its surfaces and its text, in tones of it) and an accent (what
 * stands out: emphasis, focus, the active item).
 *
 * The tones are made in HSB: the color's hue kept, its brightness set to a
 * preset level for each role - and its saturation lowered for the light
 * ones, which would otherwise glare - then back to RGB. Any base gives a
 * frame dark enough for white text on it, and a page light enough to read
 * on.
 *
 * Everything that has a color uses them as CSS variables - `themeColor.page`
 * is `var(--cascade-page, ...)` - set on an element by whoever gives a part
 * of the app its colors (colorSchemeScope() below, or the app's own frame):
 * changing a color rewrites that one element's variables, and nothing else
 * has to be built again. Each variable falls back to the default scheme's
 * color, so a component shown outside any scheme still looks right.
 *
 * A theme provides its ColorScheme through the service locator, as
 * `{ type: "colorScheme" }` - so what gives colors asks for the scheme of
 * whatever theme is in its render context, and a part of the app with a
 * theme of its own gets that theme's colors too.
 */

// --- Color conversion ---

export function hexToRgb(hex) {
  let value = String(hex).replace("#", "").trim();
  if (value.length === 3) value = value.split("").map((digit) => digit + digit).join("");
  const number = parseInt(value, 16);
  if (value.length !== 6 || isNaN(number)) return { r: 0, g: 0, b: 0 };
  return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
}

export function rgbToHex({ r, g, b }) {
  const part = (value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
  return "#" + part(r) + part(g) + part(b);
}

// Hue in degrees (0-360), saturation and brightness from 0 to 1.
export function rgbToHsb({ r, g, b }) {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, b: max };
}

export function hsbToRgb({ h, s, b }) {
  const chroma = b * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = b - chroma;
  const [red, green, blue] =
    h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] :
    h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return { r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255 };
}

const clamp = (value) => Math.max(0, Math.min(1, value));

// A color's hue, at a saturation and brightness of its own.
function tone(hsb, saturation, brightness) {
  return rgbToHex(hsbToRgb({ h: hsb.h, s: clamp(saturation), b: clamp(brightness) }));
}

function translucent(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Every color a theme uses, from its base and its accent.
 */
export function deriveColors(base, accent) {
  const B = rgbToHsb(hexToRgb(base));
  const A = rgbToHsb(hexToRgb(accent));
  // The frame: the base itself, unless it's too bright or too saturated
  // for white text on it.
  const frameSaturation = Math.min(B.s, 0.65);
  const frameBrightness = Math.min(B.b, 0.42);
  const accentHex = rgbToHex(hsbToRgb(A));
  return {
    base: rgbToHex(hsbToRgb(B)),
    chrome: tone(B, frameSaturation, frameBrightness),
    chromeDark: tone(B, frameSaturation, frameBrightness * 0.84),
    chromeLight: tone(B, frameSaturation, frameBrightness * 1.18),
    onChrome: "#ffffff",
    text: tone(B, Math.min(B.s, 0.45), 0.30),
    textSoft: tone(B, Math.min(B.s, 0.25), 0.45),
    page: tone(B, Math.min(B.s * 0.12, 0.08), 0.965),
    surface: "#ffffff",
    surfaceHover: tone(B, Math.min(B.s * 0.06, 0.04), 0.985),
    filled: tone(B, Math.min(B.s * 0.2, 0.12), 0.935),
    border: tone(B, Math.min(B.s * 0.3, 0.16), 0.88),
    borderStrong: tone(B, Math.min(B.s * 0.35, 0.2), 0.8),
    accent: accentHex,
    accentDark: tone(A, A.s, A.b * 0.6),
    accentLight: tone(A, A.s * 0.2, 0.97),
    accentFaint: translucent(accentHex, 0.08),
    accentSoft: translucent(accentHex, 0.16),
    accentRing: translucent(accentHex, 0.25),
  };
}

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());

// The colors, as the CSS variables they're used through.
export function colorVariables(colors) {
  const variables = {};
  for (const name in colors) variables["--cascade-" + kebab(name)] = colors[name];
  return variables;
}

export const defaultColors = { base: "#34495e", accent: "#2e86c1" };

// Each color, as used in a style: its variable - falling back to the
// default scheme's color.
export const themeColor = {};
{
  const fallback = deriveColors(defaultColors.base, defaultColors.accent);
  for (const name in fallback) themeColor[name] = `var(--cascade-${kebab(name)}, ${fallback[name]})`;
}

/**
 * A theme's color scheme: its base and accent colors (observable - change
 * them, and whatever shows them follows), what they were to begin with,
 * and the CSS variables they give. `extraVariables(base, accent)` adds
 * variables of the theme's own (the Material theme: mdui's).
 */
export class ColorScheme {
  constructor({ base, accent, extraVariables }) {
    this.initialColors = Object.freeze({ base, accent });
    this.colors = observable({ base, accent });
    this.extraVariables = extraVariables || null;
  }

  get base() { return this.colors.base; }
  set base(value) { this.colors.base = value; }
  get accent() { return this.colors.accent; }
  set accent(value) { this.colors.accent = value; }

  reset() {
    this.colors.base = this.initialColors.base;
    this.colors.accent = this.initialColors.accent;
  }

  isChanged() {
    return this.colors.base !== this.initialColors.base || this.colors.accent !== this.initialColors.accent;
  }

  variables() {
    const { base, accent } = this.colors;
    return {
      ...colorVariables(deriveColors(base, accent)),
      ...(this.extraVariables ? this.extraVariables(base, accent) : {}),
    };
  }
}

// The color scheme of the theme in the render context of the component
// building - or null, if there's none.
const noScheme = { locate: () => null };
export function currentColorScheme() {
  return locateService({ type: "colorScheme" }, noScheme) || null;
}

/**
 * colorSchemeScope({ key, style, children }) - a div giving what's in it
 * the colors of the theme in its render context: its scheme's variables,
 * and its text color. A part of the app with a theme of its own
 * (serviceProvider()) puts one around itself, to have its colors as well.
 */
export function colorSchemeScope(...parameters) {
  return new ColorSchemeScope(toPropertiesWithChildren(parameters));
}

export class ColorSchemeScope extends Component {
  setProperties({ style, children }) {
    this.style = style || null;
    this.scopeChildren = children || [];
  }

  build() {
    const scheme = currentColorScheme();
    return div(
      { key: "scope", style: { ...(scheme ? scheme.variables() : {}), color: themeColor.text, ...this.style } },
      this.scopeChildren,
    );
  }
}
