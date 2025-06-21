import { Component } from "./Component.js";
import { isObservable } from "./Flow.js";
import { getRenderContext } from "./buildContext.js";


export function extractExpectedProperty(object, property) {
  if (typeof(object[property]) === "undefined") throw new Error("Could not find expected property: " + property);
  const result = object[property];
  delete object[property];
  return result; 
}

export function extractProperty(object, property) {
  const result = object[property];
  delete object[property];
  return result; 
}

export function extractProperties(object, properties) {
  const condensed = {};
  properties.forEach(property => {
    if (typeof(property) !== "string") {
      property.partial.forEach(part => {
        if (object[part]) {
          condensed[part] = object[part]   
        }
      });
      if (object[property.compound]) {
        condensed[property.compound] = object[property.compound];
      }
    } else {
      if (object[property]) {
        condensed[property] = object[property];
      }
    }
  });
  return condensed;
}

export function findImplicitChildren(properties) {
  if (!properties.componentContent) return properties;

  let children = null;
  for (let item of extractProperty(properties, "componentContent")) {
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

export function createTextNodesFromStringChildren(properties, keyPrefix) {
  if (!properties.children) return;

  let stamp = 1;

  properties.children = properties.children.map(child => {
    if (typeof child === "undefined" || child === null || child === false) {
      return child; 
    } else if (typeof child === "string" || typeof child === "number") {
      return getRenderContext().primitive({type: "textNode", key: keyPrefix ? keyPrefix + ".text-" + stamp++ : null, text: child});
    } else if (child instanceof Component) {
      return child; 
    } else {
      throw new Error("Dont know what to do with flow component child: " + child.toString());  
    }
  }); 
}

export function toPropertiesWithChildren(arglist) {
  const properties = toProperties(arglist);
  findImplicitChildren(properties);
  return properties;
} 

export function toProperties(arglist) {
  if (!(arglist instanceof Array)) throw new Error("toProperties expects an array");

  // Shortcut if argument is a single properties object. 
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
  let content = null;
  let firstContentLoose = false;

  while (arglist.length > 0) {
    let current = arglist.shift();

    // No argument, skip!
    if (typeof current === "undefined" || current === null) {
      continue;
    }

    // Loose content
    if (typeof current === "boolean"
      || typeof current === "function"
      || typeof current === "string" 
      || typeof current === "number" 
      || isObservable(current)) { // model or component
      if (!content) {
        firstContentLoose = true;
        content = [];
      }
      content.push(current);
    }

    // A plain object, either a properties object, or a content array
    if (typeof current === "object" && !current.causality) {
      if (current instanceof Array) {
        if (!content) {
          content = current;
        } else {
          current.forEach(element => content.push(element))
        }
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

  if (content) {
    const firstContent = content[0];
    if (firstContentLoose && canBeKey(firstContent)) {
      implicitKey = content.shift() + "";
      if (content.length === 0) {
        content = null;
      }
    }
    properties.componentContent = content;
  }

  if (implicitKey) {
    if (properties.key) {
      throw new Error("Cannot define key both explicitly and implicitly in flow argument list.");
    }
    properties.key = implicitKey;
  }

  return properties;
}


const canBeKey = (content) => 
  ((typeof content === "string" && /[a-z]/.test(content[0])) || (typeof content === "number"))
