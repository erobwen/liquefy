

/**
 * Default style
 */
export function addDefaultStyleToProperties(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
  return properties;
}
