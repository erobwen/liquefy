import { model } from "./Flow";

/**
 * Flow creation stack. When a flow is created and running its constructor, it can find its creator using these functions. 
 */
export let creators = [];

export function getCreator() {
  if (!creators.length) return null;
  return creators[creators.length - 1];
}

export function getRenderContext() {
  const creator = getCreator();
  return creator ? creator.renderContext : null;
}

// Compositional and creator inheritance.
export function inherit(key) {
  const creator = getCreator();
  return creator ? creator.inherit(key) : null;
}


/**
 * Global context
 */
export const globalContext = model({});

// Helper function that ensures that your set value is a model, so respond to future changes can happen. 
export function modifyGlobalContext(...pathAndValue) {
  const value = model(pathAndValue.pop());
  const target = globalContext; 
  while(pathAndValue.length > 1) {
    fragment = pathAndValue.shift()
  }
  target[pathAndValue[0]] = value;
}


