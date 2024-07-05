import getWorld from "@liquefy/causaility";
import { logMark, isUpperCase } from "./utility.js";
import { getFlowProperties, findImplicitChildren } from "./flowParameters";
import { creators, getCreator } from "./flowBuildContext.js";
const log = console.log;


/**
 * World (from causality)
 */
export const world = getWorld({
  useNonObservablesAsValues: true,
  warnOnNestedRepeater: false,
  emitReBuildEvents: true, 
  priorityLevels: 3,
  // onEventGlobal: event => collectEvent(event)
  onFinishedPriorityLevel: onFinishedPriorityLevel
});



/**
 * World functions
 */
export const {
  transaction,
  observable,
  deeplyObservable,
  isObservable, 
  repeat,
  finalize,
  withoutRecording,
  sameAsPreviousDeep,
  workOnPriorityLevel,
  invalidateOnChange,
  postponeInvalidations,
  continueInvalidations,
  state
} = world;

/**
 * Testers
 */
export function isComponent(object) {
  return object instanceof Component;
}

export function isModel(object) {
  return isObservable() || !isComponent(object);
}



/**
 * Model creation
 */
export const model = deeplyObservable;


/**
 * Flow configuration
 */
export const configuration = {
  warnWhenNoKey: false,
  traceReactivity: false,
  traceAnimation: false,
  traceWarnings: false, 
  autoAssignProperties: false, 
  defaultTransitionAnimations: null,
  onFinishReBuildingFlowCallbacks: [],
  onFinishReBuildingDOMCallbacks:  [],
}

export function setFlowConfiguration(newConfiguration) {
  Object.assign(configuration, newConfiguration);
  trace = configuration.traceReactivity;
  traceAnimation = configuration.traceAnimation;
  traceWarnings = configuration.traceWarnings; 
}


/**
 * Debugging
 */
export let trace = false;
export let traceAnimation = false; 
export let traceWarnings = false; 
export let activeTrace = false; 
export const activeTraceModel = model({
  on: false 
})
window.activeTrace = activeTraceModel;
repeat(() => {
  activeTrace = activeTraceModel.on;
})
window.components = {};
window.idToComponent = {}
window.world = world;
window.model = model;


function onFinishedPriorityLevel(level, didActualWork) {
  // if (trace)
  if (trace) log("<<<finished priority: " + level + ">>>");
  // if (finishedAllLevels) log("no more repeaters...");

  // Finished re building flow with expanded primitives. Measure bounds and style before FLIP animation. 
  if (level === 1 && didActualWork) {
    // log(configuration.onFinishReBuildingFlowCallbacks)
    configuration.onFinishReBuildingFlowCallbacks.forEach(callback => callback())
  }

  // Let flow rebuild the DOM, while not removing nodes of animated flows (they might move if inserted elsewhere)

  // Finished re building DOM, proceed with animations.  
  if (level === 2) {
    configuration.onFinishReBuildingDOMCallbacks.forEach(callback => callback())
  }
}

/**
 * Flow TODO: Move to separate file. 
 */
export class Component {
  theme;
  target; 

  get id() {
    return this.causality.id;
  }

  get get() { // TODO: Move this to causality, as some optional generic "get target" property, maybe use underscore? 
    return this.causality.target;
  }

  get unobservable() {
    if (!this.causality.unobservable) this.causality.unobservable = this.initialUnobservables();
    return this.causality.unobservable;
  }

  initialUnobservables() {
    return {};
  }

  constructor(...parameters) {
    // Process parameters. 
    let properties = getFlowProperties(parameters);
    findImplicitChildren(properties);

    // log("Flow constructor: " + this.className() + "." + properties.key);

    // For debug purposes, this place this property first in the list and makes it easier to identify flows when they are proxies in the debugger. 
    this._ = null; 

    // Key & class name override
    if (!this.key) this.key = properties.key ? properties.key : null;
    delete properties.key;
    if (properties.classNameOverride) {
      this.classNameOverride = properties.classNameOverride;
      delete properties.classNameOverride; 
    }

    // this.flowDepth = this.creator ? this.creator.flowDepth + 1 : 0;
    
    // Auto set all properties to this. Have an option for this?
    if (configuration.autoAssignProperties) {
      if (properties.className) {
        console.log(properties.className);
        throw new Error("Dont!");
      }
      Object.assign(this, properties);
    }
    
    // Get and inherit certain things from creator.
    this.creator = getCreator(); // Note this can only be done in constructor!
    this.inheritFromCreator();

    // Create observable
    let me = observable(this, this.key);

    // Set properties through interface, set default values here.
    me.setProperties(properties); 
        
    // Debug & warning
    me._ = me.toString(); 
    if (configuration.warnWhenNoKey && me.key === null && me.creator)
    if (traceWarnings) console.warn(
        "Component " +
          me.toString() +
          " with no key, add key for better performance."
      );

    return me;
  }

  
  /**
   * Creator inheritance
   */

  setTheme(theme) {
    this.theme = theme; 
  }

  setTarget(target) {
    this.target = target; 
  }


  /**
   * Lifecycle methods
   */
  setProperties(properties) {
    // throw new Error("Not implemented yet");
  }

  setState() {
    // throw new Error("Not implemented yet");
    // Use this.derrive(action) to establish reactive relations here. 
  }

  ensure() {
    // Component worker here.
  }

  onDidDisplayFirstFrame() {
    // Component was drawn for the first animation frame, 
    // If you want to change an animated property on entry, now is the time. 
  }
  
  disposeState() {
    // throw new Error("Not implemented yet");
  }


  /**
   * Inheritance 
   */
  inheritFromCreator() {
    if (this.creator) {
      this.setTarget(this.creator.target);
      this.setTheme(this.creator.theme);
    }
  }

  inherit(property) {
    const result = this.inheritCached(property);
    // withoutRecording(()=> {
    //   // log("inherit: " + property + " result: " + result);
    // })
    return result; 
  }

  inheritCached(property) {
    const context = this.getContext();
    if (typeof(context[property]) === "undefined") {
      invalidateOnChange(
        () => {
          // log("caching")
          context[property] = this.inheritUncached(property);
          withoutRecording(()=> {
            // log(context[property]);
          });
        },
        () => {
          // log('%c Invalidate!!! ', 'background: #222; color: #bada55');
          delete context[property];
        }
      )
    }
    return context[property];
  }

  inheritUncached(property) {
    const context = this.getContext();
    if (typeof(context[property]) !== "undefined") {
      return context[property] 
    } else if (this.equivalentCreator) {
      return this.equivalentCreator.inheritUncached(property); 
    } else if (this.parentPrimitive) {
      // This is to ensure inheritance works over component compositions, so that children can inherit properties from parent in compositions like parent({children: child() }). 
       return this.parentPrimitive.inheritUncached(property); 
    } else if (this.creator) {
      // This might be useful for maintaining inheritance while a child component is decoupled from the visible tree. 
      // But it cannot be as the first option as inheritance would then skip over the parentPrimitive structure. 
      // Note that a composed component might not have an equivalent creator, and if not visible it has no parentPrimitive.
      return this.creator.inheritUncached(property); 
    } else {
      if (traceWarnings) console.warn("Could not find inherited property: " + property);
    }
  }
  
  // inheritFromParentContainer(property) {
  //   if (this[property]) {
  //     return this[property];
  //   } else if (this.parentPrimitive) {
  //     const valueFromEquivalent = this.parentPrimitive.inheritFromEquivalentCreator(property);
  //     if (valueFromEquivalent) {
  //       return valueFromEquivalent;
  //     }
  //     return this.parentPrimitive.inheritFromParentContainer(property)
  //   } else {
  //     return null; 
  //   }
  // }

  inheritFromEquivalentCreator(property) {
    const propertyValue = this[property];
    if (typeof(propertyValue) !== "undefined") {
      return propertyValue;
    } else if (this.equivalentCreator) {
      // log(this.equivalentCreator)
      return this.equivalentCreator.inheritFromEquivalentCreator(property);
    } else {
      return null;
    }
  }

  getContext() {
    return this; 
  }

  build(repeater) {
    if (this.buildFunction) {
      return this.buildFunction(this);
    }
    throw new Error("Not implemented yet");
  }

  
  /**
   * Internal methods
   */

  derrive(action) {
    if (!this.derriveRepeaters) {
      this.derriveRepeaters = [];
    }
    this.derriveRepeaters.push(repeat(action));
  }

  derriveAtBuild(action) {
    if (!this.derriveRepeaters) {
      this.derriveRepeaters = [];
    }
    this.derriveRepeaters.push(repeat(action, {priority: 1}));
  }

  ensureEstablished() {
    if (!this.unobservable.established) {
      this.onEstablish();
    }
  }

  onEstablish() {
    this.causality.established = true; 
    this.unobservable.established = true; 
    window.components[this.toString()] = this;
    window.idToComponent[this.id] = this;
    creators.push(this);
    this.setState();
    creators.pop();
    this.startGeneralEnsure();
    if (trace) log("Established:" + this.toString());
    // Lifecycle, override to do expensive things. Like opening up connections etc.
    // However, this will not guarantee a mount. For that, just observe specific properties set by the integration process.
  }

  startGeneralEnsure() {
    // Only start if ensure is implemented
    const proto = Object.getPrototypeOf(this);
    if (!proto.hasOwnProperty("ensure")) return;

    if (!this.generalEnsureRepeater) {
      this.generalEnsureRepeater = repeat(
        this.toString() + ".generalRepeater",
        (repeater) => {
          // if (trace) console.group(repeater.causalityString());
          this.ensure();
          // if (trace) console.groupEnd();
        });
    }
  }

  onRemoveFromFlowTarget() {
    if (this.onClose) {
      this.onClose();
    }
  }

  onDispose() {
    delete window.components[this.toString()];
    delete window.idToComponent[this.id];
    // Dispose created by repeater in call. 
    if (trace) log("Disposed:" + this.toString());
    if (this.buildRepeater) {
      this.buildRepeater.notifyDisposeToCreatedObjects();
      this.buildRepeater.dispose();
      this.buildRepeater.repeaterAction = () => {};
    }
    if (this.derriveRepeaters) this.derriveRepeaters.map(repeater => repeater.dispose()); // Do you want a disposed repeater to nullify all its writed values? Probably not....
    this.disposeState();
  }

  onVisibilityWillChange(visibility) {
    // log("onVisibilityWillChange: " + this.toString() + ".visibility = " + visibility);
    // Called if the visibility is changed for this component. 
    // Since Flow allows hidden component that maintain their state but are not disposed, 
    // this is how you know if your component is visible.  
    // Tips: It might be better do do a derrive and simply reading isVisible instead of 
    // overloading this method. 
  }

  className() {
    let result;
    withoutRecording(() => {
      result = this.constructor.name;
    });
    return result;
  }

  toString() {
    let classNameOverride;
    withoutRecording(() => {
      classNameOverride = this.classNameOverride;
    });

    let classDescription = classNameOverride ? classNameOverride : this.className();
    if (classDescription === "Flow" && this.description)
      classDescription = this.description;
    return (
      classDescription +
      ":" +
      this.causality.id +
      this.buildUniqueName()
    );
  }

  uniqueName() {
    let result;
    withoutRecording(() => {
      result = (this.key ? this.key + ":" : "") + this.causality.id;
    });
    return result;
  }

  buildUniqueName() {
    let result;
    withoutRecording(() => {
      result = this.key ? this.key : null;
    });
    if (!result) return "";
    return "(" + result + ")";
  }

  findKey(key) {
    if (this.key === key) return this;
    return this.findChild(key)
  }

  findChild(key) {
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) {
      for (let fragment of primitive) {
        const result = fragment.findKey();
        if (result) return result; 
      }
      return null;
    } else {
      return primitive.findKey(key);
    }
  }

  getChild(keyOrPath) {
    // TODO: Think this function through. 
    // Should we work according to creator hierarchy or primitive parent hierarchy?
    if (typeof keyOrPath === "string") {
      const key = keyOrPath;
      if (typeof this.buildRepeater.buildIdObjectMap[key] === "undefined")
        return null;
      return this.buildRepeater.buildIdObjectMap[key];
    } else {
      const path = keyOrPath;
      const child = this.getChild(path.shift());
      if (path.length === 0) {
        return child;
      } else {
        if (this.children) {

        }
        return child.getChild(path);
      }
    }
  }

  getPath() {
    const tag = this.key ? this.key : "<no-tag>";
    let path;
    if (!this.creator) {
      return [];
    } else {
      path = this.creator.getPath();
      path.push(tag);
      return path;
    }
  }

  ensureBuiltRecursive(flowTarget, parentPrimitive) {
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        // log("Flow.ensureBuiltRecursive");
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive
    } 
    workOnPriorityLevel(1, () => this.getPrimitive().ensureBuiltRecursive(flowTarget, parentPrimitive));
    return this.getPrimitive(parentPrimitive);
  }

  getPrimitive(parentPrimitive) {
    // if (parentPrimitive && this.parentPrimitive && this.parentPrimitive !== parentPrimitive) console.warn("Changed parent primitive for " + this.toString());
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        // log("getPrimitive");
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive
    } 
    // log("getPrimitive")
    const me = this;
    const name = this.toString(); // For chrome debugger.
    finalize(me);
    if (!me.buildRepeater) {
      me.buildRepeater = repeat(
        this.toString() + ".buildRepeater",
        (repeater) => {
          if (trace) console.group(repeater.causalityString());
          
          // Pushing
          creators.push(me);

          // Build and rebuild
          me.newBuild = me.build(repeater);
          repeater.finishRebuilding();
          // if (window.idToComponent[14]) console.log(window.idToComponent[14].animate);
          me.newBuild = repeater.establishedShapeRoot;

          // Establish relationship between equivalent child and this (its creator).
          if (me.newBuild !== null) {
            if (me.newBuild instanceof Array) {
              for (let fragment of me.newBuild) {
                fragment.equivalentCreator = me;
              }
            } else {
              me.newBuild.equivalentCreator = me;
            }
            me.equivalentChild = me.newBuild;
          }
          
          // Popping
          creators.pop();
         
          // Recursive call
          if (!me.newBuild) {
            me.primitive = null; 
          } else if (!(me.newBuild instanceof Array)) {
            me.primitive = me.newBuild.getPrimitive(this.parentPrimitive)  // Use object if it changed from outside, but do not observe primitive as this is the role of the expanderRepeater! 
          } else {
            me.primitive = me.newBuild
              .map(fragment => fragment.getPrimitive(this.parentPrimitive))
              .reduce((result, childPrimitive) => {
                if (childPrimitive instanceof Array) {
                  childPrimitive.forEach(fragment => result.push(fragment));
                } else {
                  result.push(childPrimitive);
                }
              }, []);
          }

          if (trace) console.groupEnd();
        }, {
          priority: 1, 
          rebuildShapeAnalysis: getShapeAnalysis(me)
        }
      );
    }
    return me.primitive;
  }
  
  *iterateChildren() {
    if (this.children instanceof Array) {
      for (let child of this.children) {
        if (child instanceof Component && child !== null) {
          yield child;
        }
      }
    } else if (this.children instanceof Component  && this.children !== null) {
      yield this.children;
    }
  }

  dimensions(contextNode) {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a flow without a key. The reason is that a call to dimensions from a parent build function will finalize the flow early, and without a key, causality cannot send proper onEstablish event to your flow component before it is built");
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) throw new Error("Dimensions not supported for fragmented components.");
    return primitive ? primitive.dimensions(contextNode) : null;
  }

  getEquivalentRoot() {
    if (!this.equivalentCreator) return this;
    return this.equivalentCreator.getEquivalentRoot();
  }

  show(value) {
    return value ? this : null; 
  }
}


export function when(condition, operation) { // TODO: Move to causality. 
  return repeat(() => {
    const value = condition();
    if (value) {
      operation(value);
    }
  });
}


export function callback(callback, key) {
  return observable(callback, key);
}


function getShapeAnalysis(flow) {
  return {
    allowMatch: (establishedFlow, newFlow) => {
      // log(establishedFlow instanceof Flow);
      // log(newFlow instanceof Flow);
      // log(newFlow.className() === establishedFlow.className());
      // log(newFlow.classNameOverride === establishedFlow.classNameOverride);
      return (establishedFlow instanceof Component && newFlow instanceof Component
        && (!newFlow.tagName || newFlow.tagName === establishedFlow.tagName)  
        && (newFlow.className() === establishedFlow.className()) 
        && (newFlow.classNameOverride === establishedFlow.classNameOverride));
    },
    shapeRoot: () => flow.newBuild,
    slotsIterator: function*(establishedObject, newObject, hasKey, childrenProperty=false) {
      if (establishedObject instanceof Array && newObject instanceof Array) {
        let newIndex = 0;
        let establishedIndex = 0;
        while(newIndex < newObject.length) {
          while(hasKey(newObject[newIndex]) && newIndex < newObject.length) newIndex++;
          while(hasKey(establishedObject[establishedIndex]) && establishedIndex < establishedObject.length) establishedIndex++;
          const establishedChild = establishedObject[establishedIndex];
          const newChild = newObject[newIndex]

          if (isObservable(newChild) && isObservable(establishedChild)) {
            yield [establishedChild, newChild];
          }

          newIndex++;
          establishedIndex++;
        }  
      } else if (establishedObject instanceof Component && newObject instanceof Component) {
        if (childrenProperty) yield [establishedObject, newObject];
        for (let property in newObject) {
          if (property === "children") {
            yield * this.slotsIterator(
              establishedObject[property], 
              newObject[property],
              hasKey,
              true
            )
          } else {
            const establishedChild = establishedObject[property];
            const newChild = newObject[property]

            if (isObservable(newChild) && isObservable(establishedChild)) {
              yield [establishedChild, newChild];
            }
          }
        }
      }
    },
    translateReferences: (flow, translateReference) => {
      for (let property in flow) {
        flow[property] = translateReference(flow[property]); 
      }
      const children = flow.children; // TODO: use iterator! 
      if (children instanceof Array) {
        let index = 0;
        while(index < children.length) {
          children[index] = translateReference(children[index]);
          index++;
        }
      } else if (children instanceof Component) {
        flow.children = translateReference(children);
      }
    }
  }
}

