


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
  const creator = getCreator();
  return creator ? creator.theme : null;
}