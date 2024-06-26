import getWorld from "@liquefy/causaility";
import { isObservable } from "./Flow.js";
import { logMark, isUpperCase } from "./utility.js";
const log = console.log;

export function addDefaultStyleToProperties(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
}

export function findKeyInProperties(properties) {
  if (!properties.stringsAndNumbers) return properties;
  if (properties.stringsAndNumbers.length) {
    properties.key = properties.stringsAndNumbers.pop();
  }
  if (properties.stringsAndNumbers.length) {
    throw new Error("Found too many loose strings in flow parameters");
  }
  delete properties.stringsAndNumbers;
  return properties; 
}

export function findTextAndKeyInProperties(properties) {
  // console.log(properties)
  if (!properties.stringsAndNumbers) return properties;
  if (properties.stringsAndNumbers.length) {
    properties.text = properties.stringsAndNumbers.pop() + "";
  }
  if (properties.stringsAndNumbers.length) {
    properties.key = properties.stringsAndNumbers.pop();
  }
  if (properties.stringsAndNumbers.length) {
    throw new Error("Found too many loose strings in flow parameters");
  }
  delete properties.stringsAndNumbers;
  return properties;
}

export function findTextAndKeyInPropertiesUsingCase(properties) {
  // console.log(properties)
  if (!properties.stringsAndNumbers) return properties;
  while(properties.stringsAndNumbers.length) {
    const string = properties.stringsAndNumbers.pop();
    if (properties.text && !properties.key) {
      // only key left
      properties.key = string; 
    } else if (properties.key && !properties.text) {
      // only text left
      properties.text = string; 
    } else if (/[a-z0-9]/.test(string[0]+"") && !properties.key) { //!(/[A-Z]|\s/.test(string[0] + "")
      // We assume this is a key
      properties.key = string;
    } else if (!properties.text){
      // Big character, assume it is a text.
      properties.text = string; 
    } else {
      throw new Error("Could not match loose strings in flow parameters, add them to properties.");
    }
  }
  delete properties.stringsAndNumbers;
  return properties;
}

export function findTextKeyAndOnClickInProperties(properties) {
  findTextAndKeyInPropertiesUsingCase(properties);
  if (!properties.functions) return properties;
  if (properties.functions.length) {
    properties.onClick = properties.functions.pop();
  }
  if (properties.functions.length) {
    throw new Error("Found too many loose functions in flow parameters");
  }
  delete properties.functions;
  return properties;
}

export function findBuildInProperties(properties) {
  findKeyInProperties(properties);
  if (!properties.functions) return properties;
  if (properties.functions.length) {
    properties.buildFunction = properties.functions.pop();
  }
  if (properties.functions.length) {
    throw new Error("Found too many loose functions in flow parameters");
  }
  delete properties.functions;
  return properties;
}

export function readFlowProperties(arglist) {
  if (!(arglist instanceof Array)) throw new Error("readFlowProperties expects an array");
  // Shortcut if argument is a properties object
  if (arglist[0] !== null && typeof(arglist[0]) === "object" && !(arglist[0] instanceof Array) && !isObservable(arglist[0]) && typeof(arglist[1]) === "undefined") {
    return arglist[0];
  }

  // The long way
  let properties = {};
  while (arglist.length > 0) {
    if (typeof arglist[0] === "function") {
      if (!properties.functions) {
        properties.functions = [];
      }
      properties.functions.push(arglist.shift());
    }

    // String or numbers
    if ((typeof arglist[0] === "string" || typeof arglist[0] === "number") && !arglist[0].causality) {
      if (!properties.stringsAndNumbers) {
        properties.stringsAndNumbers = [];
      }
      properties.stringsAndNumbers.push(arglist.shift());
    }

    // No argument, skip!
    if (!arglist[0]) {
      arglist.shift();
      continue;
    }

    if (arglist[0] === true) {
      throw new Error("Could not make sense of flow parameter 'true'");
    }

    // Not a flow object
    if (typeof arglist[0] === "object" && !arglist[0].causality) {
      if (arglist[0] instanceof Array) {
        if (!properties.children) properties.children = [];
        for (let child of arglist.shift()) { // TODO: Use iterator! 
          properties.children.push(child);
        }
      } else {
        Object.assign(properties, arglist.shift());
      }
    }

    // A flow object
    if (typeof arglist[0] === "object" && arglist[0].causality) {
      if (!properties.children) properties.children = [];
      properties.children.push(arglist.shift());
    }
    //if (properties.children && !(typeof(properties.children) instanceof Array)) properties.children = [properties.children];
  }
  return properties;
}

function *iterateChildren(properties) {
  if (properties.children instanceof Array) {
    for (let child of properties.children) {
      if (child instanceof Flow && child !== null) {
        yield child;
      }
    }
  } else if (properties.children instanceof Flow  && properties.children !== null) {
    yield properties.children;
  }
}