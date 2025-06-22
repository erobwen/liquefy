

/**
 * Default style
 */
export function addDefaultStyle(properties, defaultStyle) {
  if (!properties) return; 
  properties.style = Object.assign({}, defaultStyle, properties.style);
  return properties;
}
