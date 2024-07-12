import { model } from "./flow";



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

export function getTheme() {
  return this.inherit("theme");
}

export const defaultGlobalContext = model({
  theme: {
    modifiers: {},
    components: {}
  }
}); 

export const globalContext = defaultGlobalContext;


// Helper function that ensures that your set value is a model, so respond to future changes can happen. 
export function modifyGlobalContext(...pathAndValue) {
  const value = model(pathAndValue.pop());
  const target = globalContext; 
  while(pathAndValue.length > 1) {
    fragment = pathAndValue.shift()
  }
  target[pathAndValue[0]] = value;
}


export function setGlobalTheme(theme) {
  globalTheme = globalContext.theme = model(theme);
}

export function inherit(key) {
  const creator = getCreator();
  return creator ? creator.inherit(key) : null;
}


// Creator inheritance.