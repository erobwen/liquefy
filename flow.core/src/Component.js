import { toProperties, findImplicitChildren, toPropertiesWithChildren } from "./implicitProperties.js";
import { creators, getCreator, globalContext } from "./buildContext.js";
import { buildComponentTime, configuration, finalize, invalidateOnChange, isObservable, observable, repeat, trace, traceWarnings, withoutRecording, workOnPriorityLevel } from "./Flow.js";
const log = console.log;


/**
 * Component
 */
export class Component {
  theme;
  renderTarget; 

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

    // Get and inherit certain things from creator.
    this.creator = getCreator(); // Note this can only be done in constructor!
    this.inheritFromCreator(); // Deprecated: Get from render context instead. 

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


  /**
   * Lifecycle methods
   */
  readParameters(parameters) {
    return toPropertiesWithChildren(parameters)
  }

  setProperties(properties) {
    Object.assign(this, properties)
  }

  setProperty(property, value) {
    this[property] = value; 
  }

  initialize() {
    // throw new Error("Not implemented yet");
    // Use this.ensure(action) to establish reactive relations here. 
  }
  
  terminate() {
    // throw new Error("Not implemented yet");
  }

  build(_repeater) {
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
    } else if (this.renderParent) {
      // This is to ensure inheritance works over component compositions, so that children can inherit properties from parent in compositions like parent({children: child() }). 
       return this.renderParent.inheritUncached(property); 
    } else if (this.creator) {
      // This might be useful for maintaining inheritance while a child component is decoupled from the visible tree. 
      // But it cannot be as the first option as inheritance would then skip over the renderParent structure. 
      // Note that a composed component might not have an equivalent creator, and if not visible it has no renderParent.
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
  //   } else if (this.renderParent) {
  //     const valueFromEquivalent = this.renderParent.inheritFromEquivalentCreator(property);
  //     if (valueFromEquivalent) {
  //       return valueFromEquivalent;
  //     }
  //     return this.renderParent.inheritFromParentContainer(property)
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

  ensureAtBuildTime(action) {
    this.ensure(action, {priority: buildComponentTime});
  }


  /**
   * Internal lifecycle functions
   */

  onEstablish() {
    this.causality.established = true; 
    this.unobservable.established = true; 
    this.renderContext = null;
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
    if (this.buildRepeater) {
      this.buildRepeater.notifyDisposeToCreatedObjects();
      this.buildRepeater.dispose();
      this.buildRepeater.repeaterAction = () => {};
    }
    if (this.ensureRepeaters) this.ensureRepeaters.map(repeater => repeater.dispose()); // Do you want a disposed repeater to nullify all its writed values? Probably not....
    this.terminate();
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
    const primitive = this.observeableBuild();
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
    // Also consider reactivity... Since we observe buildRepeater here, it will re-run if not built yet. 
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


  /**
   * Internal build functions
   */
  ensureEstablished() {
    if (!this.unobservable.established) {
      this.onEstablish();
    }
  }

  // Note: Important helper that sets up an observable renderContext property.
  requireObserveable(context) {
    if (isObservable(context)) {
      // Verify we have no own context?
      return context;
    }
    throw new Error("Must be an observeable object! Otherwise we cannot track changes to it.");
    // let observeable = this.getRenderContext();
    // Object.assign(observeable, context);
    // return observeable; 
  }

  /**
   * Bounds
   */
  getBounds() {
    if (this.renderContext) {
      return this.renderContext.dimensions;
    }
  }

  /**
   * Render
   * 
    */

     // Not a good idea to assign the whole render context. variables like firstPass will trigger re-render. Better to deconstruct it...
      // IF it is an observeable, we can assign it. If not, we better deconstruct it. Assign it to an incoming object. 
  

  getRenderContext() {
    return this;
  }

  setContext(renderContext) {
    const context = getRenderContext()
    Object.assign(context, renderContext);
    return context;
  }

  renderedByParent(child) {
    this.renderedChildren.includes(child) &&  this.nextRenderState !== null;
  }

  observeableRender(renderContext) { 
    
    finalize(this);

    this.setContext(renderContext); // Consider: We will not get a new context if parent abandons us.... 

    // Note what happens if reactive build returns something else, it means the parent render repeater has to invalidate...
    // Could we make this invalidation more local?... have a small repeater here that just deals with change in the reactive build. 
    if (!this.unobservable.renderRepeater) {
      this.unobservable.renderRepeater = repeat(this.toString() + ".renderRepeater", repeater => {
        if (trace) console.group(repeater.causalityString());
        const renderContext = this.getRenderContext();

        // Verify rendering. Parent may leave us be, so we need to verify in the panent data structure that we are still visible.
        const {renderParent, renderTarget} = renderContext;
        if (renderParent === null && renderTarget !== null) {
          this.isVisible = true;
        } else if (renderParent && renderParent.renderedByParent(this)) {
          this.isVisible = renderParent.isVisible;
        } else {
          this.isVisible = false;
        }

        // Render.
        this.nextRenderState = this.render(renderContext);

        if (trace) console.groupEnd();
      },{
        priority: buildComponentTime, 
      })
    }

    return this.nextRenderState;
  }

  render(renderContext) {
    // Build and then render what was built
    let morePrimitiveComponent = this.observeableBuild();
    this.renderedChildren = (morePrimitiveComponent instanceof Array) ? [...morePrimitiveComponent] : [morePrimitiveComponent];
    let {renderParent, renderState} = renderContext;
    for (let fragment of this.renderedChildren) {
      renderState = fragment.observeableRender({
        renderParent, // Note: "this" is compositionParent, not render parent! 
        renderState, 
      });
    }
    return renderState;
  }
  

  isBuilt() {
    return typeof this.buildRepeater !== "undefined";
  }

  observeableBuild() {
    // log("getPrimitive")
    const name = this.toString(); // For chrome debugger.
    finalize(this);
    if (!this.unobservable.buildRepeater) {
      this.unobservable.buildRepeater = repeat(
        this.toString() + ".buildRepeater",
        (repeater) => {
          if (trace) console.group(repeater.causalityString());

          // Pushing
          creators.push(this);

          // Build and rebuild
          this.newBuild = this.build(repeater);
          if (typeof this.newBuild === "undefined") throw new Error("Build function has to return something! Return null if you dont wish your component to display. ")
          repeater.finishRebuilding();
          this.newBuild = repeater.establishedShapeRoot;

          // Establish relationship between equivalent child and this (its creator).
          if (this.newBuild !== null) {
            if (this.newBuild instanceof Array) {
              for (let fragment of this.newBuild) {
                fragment.equivalentCreator = this;
              }
            } else {
              this.newBuild.equivalentCreator = this;
            }
            this.equivalentChild = this.newBuild;
          }
          
          // Popping
          creators.pop();

          if (trace) console.groupEnd();
        }, {
          priority: buildComponentTime, 
          rebuildShapeAnalysis: getShapeAnalysis(me)
        }
      );
    }
    return me.newBuild;
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
    const primitive = this.observeableBuild();
    if (primitive instanceof Array) throw new Error("Dimensions not supported for fragmented components.");
    return primitive ? primitive.dimensions(contextNode) : null;
  }

  reactiveBoundingClientRect() {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a component without a key. The reason is that a call to dimensions from a parent build function will finalize the component early, and without a key, causality cannot send proper onEstablish event to your component component before it is built");
    const primitive = this.observeableBuild();
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
    shapeRoot: () => component.newBuild,
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

