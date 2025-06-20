

/**
 * Default style
 */
export function addDefaultStyle(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
  return properties;
}
