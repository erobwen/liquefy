import { model } from "./Flow";

/**
 * Flow creation stack. When a flow is created and running its constructor, it can find its creator using these functions. 
 */
export let creators = [];

export function getCreator() {
  if (!creators.length) return null;
  return creators[creators.length - 1];
}

export function getTarget() {
  const creator = getCreator();
  return creator ? creator.target : null;
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


/**
 * Theme
 */
globalContext.theme = model({
  modifiers: model({}),
  components: model({})
}); 
console.log("theme set!");

export function getGlobalTheme() {
  return globalContext.theme;
}

export function setGlobalTheme(theme) {
  globalContext.theme = globalContext.theme = model(theme);
}

export function getTheme() {
  return getCreator().inherit("theme");
}

