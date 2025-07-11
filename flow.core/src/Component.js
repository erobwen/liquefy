import { toProperties, findImplicitChildren, toPropertiesWithChildren } from "./implicitProperties.js";
import { creators, getCreator, globalContext } from "./buildContext.js";
import { renderComponentTime, configuration, finalize, invalidateOnChange, isObservable, observable, repeat, trace, traceWarnings, withoutRecording, workOnPriorityLevel } from "./Flow.js";
const log = console.log;


/**
 * Component
 */
export class Component {
  theme;
  renderContext; 

  get id() {
    return this.causality.id;
  }

  get target() { 
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
    let properties = this.readParameters(parameters);

    // log("Component constructor: " + this.getComponentTypeName() + "." + properties.key);
    // For debug purposes, this place this property first in the list and makes it easier to identify flows when they are proxies in the debugger. 
    this._ = null; 

    // Key & class name override
    if (!this.key) this.key = properties.key ? properties.key : null;
    delete properties.key;
    if (properties.componentTypeName) {
      this.componentTypeName = properties.componentTypeName; // Debug type
      delete properties.componentTypeName; 
    }

    // this.componentDepth = this.creator ? this.creator.componentDepth + 1 : 0;
    
    // Get and inherit certain things from creator.
    this.creator = getCreator(); // Note this can only be done in constructor!
    this.inheritFromCreator();

    // Create observable
    let me = observable(this, this.key);

    // Set properties through interface, set default values here.
    me.receive(properties); 
        
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

  setRenderContext(renderContext) {
    this.renderContext = renderContext; 
  }


  /**
   * Lifecycle methods
   */
  readParameters(parameters) {
    return toPropertiesWithChildren(parameters)
  }

  receive(properties) {
    Object.assign(this, properties)
  }

  receiveProperty(property, value) {
    this[property] = value; 
  }

  initialize() {
    // throw new Error("Not implemented yet");
    // Use this.ensure(action) to establish reactive relations here. 
  }
  
  terminate() {
    // throw new Error("Not implemented yet");
  }

  render(_repeater) {
    throw new Error("Not implemented yet");
  }


  /**
   * Inheritance 
   */

  provide() {
    return this; 
  }

  inherit(property) {
    const result = this.inheritCached(property);
    // withoutRecording(()=> {
    //   // log("inherit: " + property + " result: " + result);
    // })
    return result; 
  }

  inheritFromCreator() {
    if (this.creator) {
      this.setRenderContext(this.creator.renderContext);
      this.setTheme(this.creator.theme);
    }
  }

  inheritCached(property) {
    const context = this.provide();
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
    const context = this.provide();
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
    } else if (typeof(globalContext[property]) !== "undefined") {
      return globalContext[property];
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

  
  /**
   * Ensure reactivity
   */

  ensure(action, options=null) {
    const description = this.toString() + ".ensureRepeater"; 
    const wrappedAction = (repeater) => {
      if (trace) console.group(repeater.causalityString() + " " + repeater.id);
      creators.push(this);
      action(); 
      creators.pop();
      if (trace) console.groupEnd();
    }
    const unobservable = this.unobservable;
    if (!unobservable.ensureRepeaters) {
      unobservable.ensureRepeaters = [];
    }
    unobservable.ensureRepeaters.push(repeat(description, wrappedAction, options));
  }

  ensureAtRenderTime(action) {
    this.ensure(action, {priority: renderComponentTime});
  }


  /**
   * Internal lifecycle functions
   */

  onEstablish() {
    this.causality.established = true; 
    this.unobservable.established = true; 
    window.components[this.toString()] = this;
    window.idToComponent[this.id] = this;
    creators.push(this);
    this.initialize(); // TODO: Consider: what happens with children created with keys in this call. They will not be accessible through getChild?  
    creators.pop();
    if (trace) log("Established:" + this.toString());
    // Lifecycle, override to do expensive things. Like opening up connections etc.
    // However, this will not guarantee a mount. For that, just observe specific properties set by the integration process.
    return this; 
  }

  onDispose() {
    delete window.components[this.toString()];
    delete window.idToComponent[this.id];
    // Dispose created by repeater in call. 
    if (trace) log("Disposed:" + this.toString());
    if (this.renderRepeater) {
      this.renderRepeater.notifyDisposeToCreatedObjects();
      this.renderRepeater.dispose();
      this.renderRepeater.repeaterAction = () => {};
    }
    if (this.ensureRepeaters) this.ensureRepeaters.map(repeater => repeater.dispose()); // Do you want a disposed repeater to nullify all its writed values? Probably not....
    this.terminate();
  }

  onVisibilityWillChange(visibility) { // Deprecated? Just observe Component.isVisible instead. 
    // log("onVisibilityWillChange: " + this.toString() + ".visibility = " + visibility);
    // Called if the visibility is changed for this component. 
    // Since Flow allows hidden component that maintain their state but are not disposed, 
    // this is how you know if your component is visible.  
    // Tips: It might be better do do a ensure and simply reading isVisible instead of 
    // overloading this method. 
  }


  /**
   * Debug
   */
  getComponentTypeName() {
    let result;
    withoutRecording(() => {
      result = this.componentTypeName ? this.componentTypeName : this.constructor.name;
    });
    return result;
  }

  toString() {
    return (
      this.getComponentTypeName() +
      ":" +
      this.causality.id +
      this.keyString()
    );
  }


  /**
   * Naming and paths
   */
  keyString() {
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

  findChild(key) { // Note: did not work in some situations getChild worked.  
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
    // Also consider reactivity... Since we observe renderRepeater here, it will re-run if not built yet. 
    // Should we work according to creator hierarchy or primitive parent hierarchy?
    if (typeof keyOrPath === "string") {
      const key = keyOrPath;
      if (typeof this.renderRepeater.buildIdObjectMap[key] === "undefined")
        return null;
      return this.renderRepeater.buildIdObjectMap[key];
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


  /**
   * Internal build functions
   */
  ensureEstablished() {
    if (!this.unobservable.established) {
      this.onEstablish();
    }
  }

  connectAllPrimitives(renderContext, parentPrimitive) {
    const peekParentPrimitive = withoutRecording(() => this.parentPrimitive); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back!
    if (parentPrimitive && peekParentPrimitive !== parentPrimitive) { // Why not set to null? Something to do with animation?
      if (peekParentPrimitive) {
        // log("Component.connectAllPrimitives");
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive
    } 
    workOnPriorityLevel(renderComponentTime, () => this.getPrimitive().connectAllPrimitives(renderContext, parentPrimitive));
    return this.getPrimitive(parentPrimitive);
  }

  isRendered() {
    return typeof this.renderRepeater !== "undefined";
  }

  getPrimitive(parentPrimitive) {
    let peekParentPrimitive = withoutRecording(() => this.parentPrimitive); // It could be still the parent is expanding. We dont want parent dependent on child. This allows for change of parent without previous parent taking it back!
    // if (parentPrimitive && this.parentPrimitive && this.parentPrimitive !== parentPrimitive) console.warn("Changed parent primitive for " + this.toString());
    if (parentPrimitive && peekParentPrimitive !== parentPrimitive) {
      if (peekParentPrimitive) {
        // log("getPrimitive");
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + peekParentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive
    } 
    peekParentPrimitive = withoutRecording(() => this.parentPrimitive)
    // log("getPrimitive")
    const me = this;
    const name = this.toString(); // For chrome debugger.
    finalize(me);
    if (!me.renderRepeater) {
      me.renderRepeater = repeat(
        this.toString() + ".renderRepeater",
        (repeater) => {
          if (trace) console.group(repeater.causalityString());
          
          // Pushing
          creators.push(me);

          // Build and rebuild
          me.newRendering = me.render(repeater);
          if (typeof me.newRendering === "undefined") throw new Error("Build function has to return something! Return null if you dont wish your component to display. ")
          repeater.finishRebuilding();
          me.newRendering = repeater.establishedShapeRoot;

          // Establish relationship between equivalent child and this (its creator).
          if (me.newRendering !== null) {
            if (me.newRendering instanceof Array) {
              for (let fragment of me.newRendering) {
                fragment.equivalentCreator = me;
              }
            } else {
              me.newRendering.equivalentCreator = me;
            }
            me.equivalentChild = me.newRendering;
          }
          
          // Popping
          creators.pop();
         
          // Recursive call, to make sure we get a primitive. 
          if (!me.newRendering) {
            me.primitive = null; 
          } else if (!(me.newRendering instanceof Array)) {
            me.primitive = me.newRendering.getPrimitive(peekParentPrimitive)  // Use object if it changed from outside, but do not observe primitive as this is the role of the expanderRepeater! 
          } else {
            me.primitive = me.newRendering
              .map(fragment => fragment.getPrimitive(peekParentPrimitive))
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
          priority: renderComponentTime, 
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
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a component without a key. The reason is that a call to dimensions from a parent build function will finalize the component early, and without a key, causality cannot send proper onEstablish event to your component component before it is built");
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) throw new Error("Dimensions not supported for fragmented components.");
    return primitive ? primitive.dimensions(contextNode) : null;
  }

  reactiveBoundingClientRect() {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a component without a key. The reason is that a call to dimensions from a parent build function will finalize the component early, and without a key, causality cannot send proper onEstablish event to your component component before it is built");
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) throw new Error("reactiveBoundingClientRect not supported for fragmented components.");
    return primitive ? primitive.reactiveBoundingClientRect(contextNode) : null;
  }

  getEquivalentRoot() {
    if (!this.equivalentCreator) return this;
    return this.equivalentCreator.getEquivalentRoot();
  }

  show(value) {
    return value ? this : null; 
  }
}


/**
 * Build merge pattern matching
 */

function getShapeAnalysis(component) {
  return {
    allowMatch: (establishedComponent, newComponent) => {
      // log(establishedComponent instanceof Component);
      // log(newComponent instanceof Component);
      // log(newComponent.getComponentTypeName() === establishedComponent.getComponentTypeName());
      // log(newComponent.componentTypeName === establishedComponent.componentTypeName);
      return (establishedComponent instanceof Component && newComponent instanceof Component
        && (!newComponent.tagName || newComponent.tagName === establishedComponent.tagName)  
        && (newComponent.getComponentTypeName() === establishedComponent.getComponentTypeName()) 
        && (newComponent.componentTypeName === establishedComponent.componentTypeName));
    },
    shapeRoot: () => component.newRendering,
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
          // if (property === "children") {
          if (establishedObject[property] instanceof Array && newObject[property] instanceof Array) { // Could we do this for all arrays?
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

