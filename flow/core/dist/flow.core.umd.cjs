(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require("@liquefy/causaility")) : typeof define === "function" && define.amd ? define(["exports", "@liquefy/causaility"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory((global.flow = global.flow || {}, global.flow.core = {}), global.getWorld));
})(this, function(exports2, getWorld) {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  const log$1 = console.log;
  function deepFreeze(o) {
    Object.freeze(o);
    if (o === void 0) {
      return o;
    }
    Object.getOwnPropertyNames(o).forEach(function(prop) {
      if (o[prop] !== null && (typeof o[prop] === "object" || typeof o[prop] === "function") && !Object.isFrozen(o[prop])) {
        deepFreeze(o[prop]);
      }
    });
    return o;
  }
  function insertAfter(newNode, referenceNode) {
    if (referenceNode.nextSibling) {
      referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    } else {
      referenceNode.parentNode.appendChild(newNode);
    }
  }
  const animationFrameBackgroundColor = "rgba(150, 150, 255, 1)";
  const animationFrameColor = "#000000";
  const animationFrameSeparatorBackgroundColor = "rgba(170, 170, 255, 1)";
  function logAnimationFrameGroup(counter) {
    if (!exports2.traceAnimation) return;
    const text = "      Animation Frame " + counter + "      ";
    const colors = `background: ${animationFrameBackgroundColor}; color: ${animationFrameColor}`;
    console.group("%c" + text, colors);
  }
  function logAnimationFrameEnd() {
    if (!exports2.traceAnimation) return;
    console.groupEnd();
  }
  function logAnimationSeparator(text) {
    if (!exports2.traceAnimation) return;
    const colors = `background: ${animationFrameSeparatorBackgroundColor}; color: ${animationFrameColor}`;
    console.log("%c" + text, colors);
  }
  function logMark(text) {
    console.log("%c" + text, "background: #222; color: #bada55");
  }
  function isUpperCase(string) {
    if (string.toUpperCase() === string) {
      return true;
    } else
      return false;
  }
  function draw(bounds, color = "black") {
  }
  const camelCased = (myString) => myString.replace(/-([a-z])/g, function(g) {
    return g[1].toUpperCase();
  });
  function addDefaultStyleToProperties(properties, defaultStyle) {
    properties.style = Object.assign({}, defaultStyle, properties.style);
  }
  function findKeyInProperties(properties) {
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
  function findTextAndKeyInProperties(properties) {
    if (!properties.stringsAndNumbers) return properties;
    if (properties.stringsAndNumbers.length) {
      properties.text = properties.stringsAndNumbers.pop();
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
  function findTextAndKeyInPropertiesUsingCase(properties) {
    if (!properties.stringsAndNumbers) return properties;
    while (properties.stringsAndNumbers.length) {
      const string = properties.stringsAndNumbers.pop();
      if (properties.text && !properties.key) {
        properties.key = string;
      } else if (properties.key && !properties.text) {
        properties.text = string;
      } else if (/[a-z0-9]/.test(string[0] + "") && !properties.key) {
        //!(/[A-Z]|\s/.test(string[0] + "")
        properties.key = string;
      } else if (!properties.text) {
        properties.text = string;
      } else {
        throw new Error("Could not match loose strings in flow parameters, add them to properties.");
      }
    }
    delete properties.stringsAndNumbers;
    return properties;
  }
  function findTextKeyAndOnClickInProperties(properties) {
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
  function findBuildInProperties(properties) {
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
  function readFlowProperties$1(arglist) {
    if (!(arglist instanceof Array)) throw new Error("readFlowProperties expects an array");
    if (arglist[0] !== null && typeof arglist[0] === "object" && !(arglist[0] instanceof Array) && !isObservable(arglist[0]) && typeof arglist[1] === "undefined") {
      return arglist[0];
    }
    let properties = {};
    while (arglist.length > 0) {
      if (typeof arglist[0] === "function") {
        if (!properties.functions) {
          properties.functions = [];
        }
        properties.functions.push(arglist.shift());
      }
      if ((typeof arglist[0] === "string" || typeof arglist[0] === "number") && !arglist[0].causality) {
        if (!properties.stringsAndNumbers) {
          properties.stringsAndNumbers = [];
        }
        properties.stringsAndNumbers.push(arglist.shift());
      }
      if (!arglist[0]) {
        arglist.shift();
        continue;
      }
      if (arglist[0] === true) {
        throw new Error("Could not make sense of flow parameter 'true'");
      }
      if (typeof arglist[0] === "object" && !arglist[0].causality) {
        if (arglist[0] instanceof Array) {
          if (!properties.children) properties.children = [];
          for (let child of arglist.shift()) {
            properties.children.push(child);
          }
        } else {
          Object.assign(properties, arglist.shift());
        }
      }
      if (typeof arglist[0] === "object" && arglist[0].causality) {
        if (!properties.children) properties.children = [];
        properties.children.push(arglist.shift());
      }
    }
    return properties;
  }
  let creators = [];
  function getCreator() {
    if (!creators.length) return null;
    return creators[creators.length - 1];
  }
  function getTarget() {
    const creator = getCreator();
    return creator ? creator.target : null;
  }
  function getTheme() {
    const creator = getCreator();
    return creator ? creator.theme : null;
  }
  const log = console.log;
  const world = getWorld({
    useNonObservablesAsValues: true,
    warnOnNestedRepeater: false,
    emitReBuildEvents: true,
    priorityLevels: 3,
    // onEventGlobal: event => collectEvent(event)
    onFinishedPriorityLevel
  });
  const {
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
  const model = deeplyObservable;
  const configuration = {
    warnWhenNoKey: false,
    traceReactivity: false,
    traceAnimation: false,
    traceWarnings: false,
    autoAssignProperties: false,
    defaultTransitionAnimations: null,
    onFinishReBuildingFlowCallbacks: [],
    onFinishReBuildingDOMCallbacks: []
  };
  function setFlowConfiguration(newConfiguration) {
    Object.assign(configuration, newConfiguration);
    exports2.trace = configuration.traceReactivity;
    exports2.traceAnimation = configuration.traceAnimation;
    exports2.traceWarnings = configuration.traceWarnings;
  }
  exports2.trace = false;
  exports2.traceAnimation = false;
  exports2.traceWarnings = false;
  exports2.activeTrace = false;
  const activeTraceModel = model({
    on: false
  });
  window.activeTrace = activeTraceModel;
  repeat(() => {
    exports2.activeTrace = activeTraceModel.on;
  });
  window.components = {};
  window.idToComponent = {};
  window.world = world;
  window.model = model;
  function onFinishedPriorityLevel(level, didActualWork) {
    if (exports2.trace) log("<<<finished priority: " + level + ">>>");
    if (level === 1 && didActualWork) {
      configuration.onFinishReBuildingFlowCallbacks.forEach((callback2) => callback2());
    }
    if (level === 2) {
      configuration.onFinishReBuildingDOMCallbacks.forEach((callback2) => callback2());
    }
  }
  class Component {
    constructor(...parameters) {
      __publicField(this, "theme");
      __publicField(this, "target");
      let properties = findKeyInProperties(readFlowProperties$1(parameters));
      if (properties.build) {
        properties.buildFunction = properties.build;
        delete properties.build;
      }
      this._ = null;
      if (!this.key) this.key = properties.key ? properties.key : null;
      delete properties.key;
      if (configuration.autoAssignProperties) {
        Object.assign(this, properties);
      }
      this.creator = getCreator();
      this.inheritFromCreator();
      let me = observable(this, this.key);
      me.setProperties(properties);
      me._ = me.toString();
      if (configuration.warnWhenNoKey && me.key === null && me.creator) {
        if (exports2.traceWarnings) console.warn(
          "Component " + me.toString() + " with no key, add key for better performance."
        );
      }
      return me;
    }
    get id() {
      return this.causality.id;
    }
    get get() {
      return this.causality.target;
    }
    get unobservable() {
      if (!this.causality.unobservable) this.causality.unobservable = this.initialUnobservables();
      return this.causality.unobservable;
    }
    initialUnobservables() {
      return {};
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
    setProperties() {
    }
    setState() {
    }
    ensure() {
    }
    onDidDisplayFirstFrame() {
    }
    disposeState() {
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
      return result;
    }
    inheritCached(property) {
      const context = this.getContext();
      if (typeof context[property] === "undefined") {
        invalidateOnChange(
          () => {
            context[property] = this.inheritUncached(property);
            withoutRecording(() => {
            });
          },
          () => {
            delete context[property];
          }
        );
      }
      return context[property];
    }
    inheritUncached(property) {
      const context = this.getContext();
      if (typeof context[property] !== "undefined") {
        return context[property];
      } else if (this.equivalentCreator) {
        return this.equivalentCreator.inheritUncached(property);
      } else if (this.parentPrimitive) {
        return this.parentPrimitive.inheritUncached(property);
      } else if (this.creator) {
        return this.creator.inheritUncached(property);
      } else {
        if (exports2.traceWarnings) console.warn("Could not find inherited property: " + property);
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
      if (typeof propertyValue !== "undefined") {
        return propertyValue;
      } else if (this.equivalentCreator) {
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
      this.derriveRepeaters.push(repeat(action, { priority: 1 }));
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
      if (exports2.trace) log("Established:" + this.toString());
    }
    startGeneralEnsure() {
      const proto = Object.getPrototypeOf(this);
      if (!proto.hasOwnProperty("ensure")) return;
      if (!this.generalEnsureRepeater) {
        this.generalEnsureRepeater = repeat(
          this.toString() + ".generalRepeater",
          (repeater) => {
            this.ensure();
          }
        );
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
      if (exports2.trace) log("Disposed:" + this.toString());
      if (this.buildRepeater) {
        this.buildRepeater.notifyDisposeToCreatedObjects();
        this.buildRepeater.dispose();
        this.buildRepeater.repeaterAction = () => {
        };
      }
      if (this.derriveRepeaters) this.derriveRepeaters.map((repeater) => repeater.dispose());
      this.disposeState();
    }
    onVisibilityWillChange(visibility) {
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
      return classDescription + ":" + this.causality.id + this.buildUniqueName();
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
      return this.findChild(key);
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
          if (exports2.traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
        }
        this.parentPrimitive = parentPrimitive;
      }
      workOnPriorityLevel(1, () => this.getPrimitive().ensureBuiltRecursive(flowTarget, parentPrimitive));
      return this.getPrimitive(parentPrimitive);
    }
    getPrimitive(parentPrimitive) {
      if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
        if (this.parentPrimitive) {
          if (exports2.traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
        }
        this.parentPrimitive = parentPrimitive;
      }
      const me = this;
      this.toString();
      finalize(me);
      if (!me.buildRepeater) {
        me.buildRepeater = repeat(
          this.toString() + ".buildRepeater",
          (repeater) => {
            if (exports2.trace) console.group(repeater.causalityString());
            creators.push(me);
            me.newBuild = me.build(repeater);
            repeater.finishRebuilding();
            me.newBuild = repeater.establishedShapeRoot;
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
            creators.pop();
            if (!me.newBuild) {
              me.primitive = null;
            } else if (!(me.newBuild instanceof Array)) {
              me.primitive = me.newBuild.getPrimitive(this.parentPrimitive);
            } else {
              me.primitive = me.newBuild.map((fragment) => fragment.getPrimitive(this.parentPrimitive)).reduce((result, childPrimitive) => {
                if (childPrimitive instanceof Array) {
                  childPrimitive.forEach((fragment) => result.push(fragment));
                } else {
                  result.push(childPrimitive);
                }
              }, []);
            }
            if (exports2.trace) console.groupEnd();
          },
          {
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
      } else if (this.children instanceof Component && this.children !== null) {
        yield this.children;
      }
    }
    dimensions(contextNode) {
      if (!this.key && exports2.traceWarnings) console.warn("It is considered unsafe to use dimensions on a flow without a key. The reason is that a call to dimensions from a parent build function will finalize the flow early, and without a key, causality cannot send proper onEstablish event to your flow component before it is built");
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
  function when(condition, operation) {
    return repeat(() => {
      const value = condition();
      if (value) {
        operation(value);
      }
    });
  }
  function callback(callback2, key) {
    return observable(callback2, key);
  }
  function component(descriptionOrBuildFunction, possibleBuildFunction) {
    if (exports2.traceWarnings) console.warn("Deprecated: dont use this function, build a macro component instead using flow parameter helper functions.");
    let description;
    let buildFunction;
    if (typeof descriptionOrBuildFunction === "string") {
      description = descriptionOrBuildFunction;
      buildFunction = possibleBuildFunction;
    } else {
      buildFunction = descriptionOrBuildFunction;
    }
    function flowBuilder(...parameters) {
      const properties = findKeyInProperties(readFlowProperties$1(parameters));
      properties.buildFunction = buildFunction;
      const flow = new Component(properties);
      if (description) flow.description = description;
      return flow;
    }
    return flowBuilder;
  }
  function getShapeAnalysis(flow) {
    return {
      allowMatch: (establishedFlow, newFlow) => {
        return establishedFlow instanceof Component && newFlow instanceof Component && (!newFlow.tagName || newFlow.tagName === establishedFlow.tagName) && newFlow.className() === establishedFlow.className() && newFlow.classNameOverride === establishedFlow.classNameOverride;
      },
      shapeRoot: () => flow.newBuild,
      slotsIterator: function* (establishedObject, newObject, hasKey, childrenProperty = false) {
        if (establishedObject instanceof Array && newObject instanceof Array) {
          let newIndex = 0;
          let establishedIndex = 0;
          while (newIndex < newObject.length) {
            while (hasKey(newObject[newIndex]) && newIndex < newObject.length) newIndex++;
            while (hasKey(establishedObject[establishedIndex]) && establishedIndex < establishedObject.length) establishedIndex++;
            const establishedChild = establishedObject[establishedIndex];
            const newChild = newObject[newIndex];
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
              yield* this.slotsIterator(
                establishedObject[property],
                newObject[property],
                hasKey,
                true
              );
            } else {
              const establishedChild = establishedObject[property];
              const newChild = newObject[property];
              if (isObservable(newChild) && isObservable(establishedChild)) {
                yield [establishedChild, newChild];
              }
            }
          }
        }
      },
      translateReferences: (flow2, translateReference) => {
        for (let property in flow2) {
          flow2[property] = translateReference(flow2[property]);
        }
        const children = flow2.children;
        if (children instanceof Array) {
          let index = 0;
          while (index < children.length) {
            children[index] = translateReference(children[index]);
            index++;
          }
        } else if (children instanceof Component) {
          flow2.children = translateReference(children);
        }
      }
    };
  }
  class FlowPrimitive extends Component {
    findKey(key) {
      if (this.key === key) return this;
      return this.findChild(key);
    }
    findChild(key) {
      if (this.children) {
        for (let child of this.children) {
          if (child !== null) {
            let result = child.findKey(key);
            if (result !== null) return result;
          }
        }
      }
      return null;
    }
    getPrimitive(parentPrimitive) {
      if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
        if (this.parentPrimitive) {
          if (exports2.traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
        }
        this.parentPrimitive = parentPrimitive;
      }
      return this;
    }
    ensureBuiltRecursive(flowTarget, parentPrimitive) {
      this.toString();
      if (flowTarget) this.visibleOnTarget = flowTarget;
      if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
        if (this.parentPrimitive) {
          if (exports2.traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
          if (parentPrimitive === this) throw new Error("What the fuck just happened. ");
        }
        this.parentPrimitive = parentPrimitive;
      }
      finalize(this);
      if (!this.expandRepeater) {
        this.expandRepeater = repeat(this.toString() + ".expandRepeater", (repeater) => {
          if (exports2.trace) console.group(repeater.causalityString());
          if (exports2.trace) console.log([...state.workOnPriorityLevel]);
          if (this.parentPrimitive) {
            if (this.parentPrimitive.childPrimitives && this.parentPrimitive.childPrimitives.includes(this)) {
              this.visibleOnTarget = this.parentPrimitive.visibleOnTarget;
            } else {
              this.visibleOnTarget = null;
              this.previousParentPrimitive = this.parentPrimitive;
              this.parentPrimitive = null;
            }
          }
          let scan = this.equivalentCreator;
          while (scan) {
            if (scan.visibleOnTarget === this.visibleOnTarget) {
              scan = null;
            } else {
              if (this.parentPrimitive && this.parentPrimitive !== scan.parentPrimitive) {
                if (this.parentPrimitive) {
                  if (exports2.traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
                }
                scan.parentPrimitive = this.parentPrimitive;
              }
              scan.parentPrimitive = this.parentPrimitive;
              scan.visibleOnTarget = this.visibleOnTarget;
              scan.isVisible = !!this.visibleOnTarget;
              scan.onVisibilityWillChange(scan.isVisible);
              scan = scan.equivalentCreator;
            }
          }
          this.childPrimitives = this.getPrimitiveChildren();
          for (let childPrimitive of this.childPrimitives) {
            childPrimitive.ensureBuiltRecursive(flowTarget, this);
          }
          if (exports2.trace) console.groupEnd();
        }, { priority: 1 });
      }
      return this;
    }
    onVisibilityWillChange() {
    }
    *iteratePrimitiveChildren() {
      for (let child of this.iterateChildren()) {
        let primitive = child.getPrimitive(this);
        if (primitive instanceof Array) {
          for (let fragment of primitive) {
            yield fragment;
          }
        } else {
          if (primitive) yield primitive;
        }
      }
    }
    getChildren() {
      return [...this.iterateChildren()];
    }
    getPrimitiveChildren() {
      return [...this.iteratePrimitiveChildren()];
    }
    inheritAnimation() {
      let result = this.inheritFromEquivalentCreator("animate");
      if (!result && this.parentPrimitive) {
        result = this.parentPrimitive.inheritFromEquivalentCreator("animateChildren");
      }
      if (!result && this.previousParentPrimitive) {
        result = this.previousParentPrimitive.inheritFromEquivalentCreator("animateChildren");
      }
      if (result === true) result = this.getStandardAnimation();
      return result;
    }
    getStandardAnimation() {
      throw new Error("Not implemented yet");
    }
    get animation() {
      if (!this.cachedAnimation) {
        invalidateOnChange(
          () => {
            this.cachedAnimation = this.inheritAnimation();
          },
          () => {
            delete this.cachedAnimation;
          }
        );
      }
      return this.cachedAnimation;
    }
  }
  class FlowTarget {
    // constructor() {
    //     super();
    //     flowTargets.push(this);
    // }
    dispose() {
    }
    setContent(flow) {
      if (!(flow instanceof Flow)) throw new Error("Flow target content must be a flow!");
      this.flow = flow;
      flow.target = this;
      flow.ensureEstablished();
      workOnPriorityLevel(1, () => this.flow.ensureBuiltRecursive(this));
      if (flow.getPrimitive() instanceof Array) throw new Error("Cannot have fragments on the top level");
      this.ensureContentInPlace();
    }
    ensureContentInPlace() {
      throw new Error("Not implemented yet!");
    }
    // General creation method, this is similar to a service locator in the service locator pattern. 
    // The purpose of this method is to choose what FlowPrimitive to create, given the properties object.
    // This makes it possible to create total custom FlowTargets that reinterprets the properties in 
    // new ways. For example, a DOMFlowTarget may create FlowPrimitive objects that renders a DOM in a web browsser.
    // But the same flow could be sent to a FlowTarget that renders a native app, or create contents for a printout, 
    // or create a server rendered page. The possibilities are endless!      
    create(...parameters) {
      readFlowProperties(parameters);
      throw new Error("Not implemented yet!");
    }
    // dispose() {
    //     flowTargets.splice(flowTargets.indexOf(this), 1);
    // }
  }
  exports2.Component = Component;
  exports2.FlowPrimitive = FlowPrimitive;
  exports2.FlowTarget = FlowTarget;
  exports2.activeTraceModel = activeTraceModel;
  exports2.addDefaultStyleToProperties = addDefaultStyleToProperties;
  exports2.callback = callback;
  exports2.camelCased = camelCased;
  exports2.component = component;
  exports2.configuration = configuration;
  exports2.continueInvalidations = continueInvalidations;
  exports2.creators = creators;
  exports2.deepFreeze = deepFreeze;
  exports2.deeplyObservable = deeplyObservable;
  exports2.draw = draw;
  exports2.finalize = finalize;
  exports2.findBuildInProperties = findBuildInProperties;
  exports2.findKeyInProperties = findKeyInProperties;
  exports2.findTextAndKeyInProperties = findTextAndKeyInProperties;
  exports2.findTextAndKeyInPropertiesUsingCase = findTextAndKeyInPropertiesUsingCase;
  exports2.findTextKeyAndOnClickInProperties = findTextKeyAndOnClickInProperties;
  exports2.getCreator = getCreator;
  exports2.getTarget = getTarget;
  exports2.getTheme = getTheme;
  exports2.insertAfter = insertAfter;
  exports2.invalidateOnChange = invalidateOnChange;
  exports2.isObservable = isObservable;
  exports2.isUpperCase = isUpperCase;
  exports2.log = log$1;
  exports2.logAnimationFrameEnd = logAnimationFrameEnd;
  exports2.logAnimationFrameGroup = logAnimationFrameGroup;
  exports2.logAnimationSeparator = logAnimationSeparator;
  exports2.logMark = logMark;
  exports2.model = model;
  exports2.observable = observable;
  exports2.postponeInvalidations = postponeInvalidations;
  exports2.readFlowProperties = readFlowProperties$1;
  exports2.repeat = repeat;
  exports2.sameAsPreviousDeep = sameAsPreviousDeep;
  exports2.setFlowConfiguration = setFlowConfiguration;
  exports2.state = state;
  exports2.transaction = transaction;
  exports2.when = when;
  exports2.withoutRecording = withoutRecording;
  exports2.workOnPriorityLevel = workOnPriorityLevel;
  exports2.world = world;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
});
