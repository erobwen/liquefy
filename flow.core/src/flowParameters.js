import { Component, isObservable } from "./Flow.js";
import { getTarget } from "./flowBuildContext.js";
const log = console.log;

export function addDefaultStyleToProperties(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
  return properties;
}

export function extractProperty(object, property) {
  const result = object[property];
  delete object[property];
  return result; 
}

export function findImplicitChildren(properties) {
  if (!properties.content) return properties;

  let children = null;
  for (let item of extractProperty(properties, "content")) {
    if (!children) children = [];
    children.push(item);
  }
  if (children) {
    if (properties.children) {
      throw new Error("Children both implicitly defined as loose flow parameters, but also explicitly in flow properties.");
    }
    properties.children = children;
  }
  createTextNodesFromStringChildren(properties, properties.key);
  return properties;
}

export function findImplicitChildrenAndOnClick(properties) {
  const content = extractProperty(properties, "content");
  let children = null;
  let onClick = null;
  for (let item of content) {
    if (typeof item === "function") {
      if (onClick) throw new Error("Can only have one onClick function as flow content.");
      onClick = item; 
    } else {
      if (!children) children = [];
      children.push(item);
    }
  }
  if (onClick) {
    if (properties.onClick) {
      throw new Error("implicitly defined onClick already defined explicitly in properties.");
    }
    properties.onClick = onClick;
  }
  if (!properties.onClick) throw new Error("Expected onClick defined as a property.");
  if (children) {
    if (properties.children) {
      throw new Error("implicitly defined children already defined explicitly in properties.");
    }
    properties.children = children;
  }
  createTextNodesFromStringChildren(properties, properties.key);
  return properties;
}

function createTextNodesFromStringChildren(properties, keyPrefix) {
  if (!properties.children) return;

  let stamp = 1;

  properties.children = properties.children.map(child => {
    if (typeof child === "string" || typeof child === "number") {
      return getTarget().create({type: "textNode", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, text: child});
    } else if (child instanceof Component) {
      return child; 
    } else {
      throw new Error("Dont know what to do with flow component child: " + child.toS());  
    }
  }); 
}

export function readFlowProperties(arglist) {
  if (!(arglist instanceof Array)) throw new Error("readFlowProperties expects an array");

  // Shortcut if argument is a properties object
  const first = arglist[0]; 
  if (arglist.length === 1 && first !== null && typeof(first) === "object" && !(first instanceof Array) && !isObservable(first)) {
    return first;
  }

  // Interpret arguments
  return buildPropertiesObject(arglist);
}

function buildPropertiesObject(arglist) {

  // Things to find in arglist
  let properties = null;
  let looseContent = null;
  let contentArray = null;

  while (arglist.length > 0) {
    let current = arglist.shift();

    // No argument, skip!
    if (current === null) {
      continue;
    }

    // Loose content
    if (typeof current === "boolean"
      || typeof current === "function"
      || typeof current === "string" 
      || typeof current === "number" 
      || (typeof current === "object" && current.causality)) { // model or Component
      if (!looseContent) {
        looseContent = [];
      }
      looseContent.push(current);
    }

    // A plain object, either a properties object, or a content array
    if (typeof current === "object" && !current.causality) {
      if (current instanceof Array) {
        if (contentArray) {
          throw new Error("Cannot have two content arrays in flow argument list")
        }
        contentArray = current; 
      } else {
        if (properties) {
          throw new Error("Cannot have two properties objects in flow argument list")
        }
        properties = current; 
      }
    }
  }

  let implicitKey = null;

  if (!properties) properties = {};

  if (contentArray) {
    if (looseContent) {
      implicitKey = looseContent.shift() + "";
    }
    if (looseContent.size > 0) {
      throw new Error("Cannot have both loose content and a content array in flow argument");
    }
    properties.content = contentArray;
  } else if (looseContent) {
    const firstContent = looseContent[0];
    if (((typeof firstContent === "string") && (/[a-z]/.test(firstContent[0]))) || typeof firstContent === "number") {
      implicitKey = looseContent.shift() + "";
    }
    properties.content = looseContent;
  }

  if (implicitKey) {
    if (properties.key) {
      throw new Error("Cannot define key both explicitly and implicitly in flow argument list.");
    }
    properties.key = implicitKey;
  }

  return properties;
}
