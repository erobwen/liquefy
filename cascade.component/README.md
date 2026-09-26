# cascade.component

The component model of [Cascade](https://github.com/erobwen/liquefy#readme):
components that build reactively into other components, with stable identity,
state, services and inheritance - on the temporal signals of
[cascade.reactive](https://github.com/erobwen/liquefy/tree/main/cascade.reactive#readme).

It knows nothing about the DOM: [cascade.dom](https://github.com/erobwen/liquefy/tree/main/cascade.DOM#readme)
renders it in a browser.

```console
npm install @liquefy/cascade.component @liquefy/cascade.reactive
```

## A component

```js
import { Component, callback } from "@liquefy/cascade.component";
import { div, text } from "@liquefy/cascade.dom";
import { button } from "@liquefy/cascade.ui";

class Counter extends Component {
  // Properties: given by whoever builds it - again on every rebuild.
  setProperties({ label }) {
    this.label = label;
  }

  // State: established once, then changed only by the user.
  initializeState() {
    return { count: 0 };
  }

  // Reactive: runs again whenever anything it read changes - and only what
  // actually changed in what it returns is touched.
  build() {
    return div(
      { key: "counter" },
      text({ key: "label", text: this.label + ": " + this.count }),
      button({ key: "more" }, text({ key: "moreText", text: "More" }), callback("more", () => { this.count++; })),
    );
  }
}
```

- **Keys** give what a build returns a stable identity: built again with the
  same key, a component is the *same* component, its state and elements kept.
- **`.show(condition)`** leaves a child out without dropping it.
- **`callback(key, fn)`** is a named, stable callback - passed as a property, it
  doesn't count as a change on every rebuild (a plain closure is fine for a
  quick prototype).
- **`this.inherit(name)`** finds a value provided by a component further up.
- **Services** - every element and widget is asked for through the render
  context's service locator (`CompoundServiceLocator`,
  `ObservableCompoundServiceLocator`, `serviceProvider()`), so themes can
  replace whole components, and any part of an app can have services of its
  own.
- **`render(context)`** is there for a component that needs to do real work at
  render time (measuring, say); most only implement `build()`.

# Design notes

## Invariants

### Building Sub Components

A component is created either on the top level or as a child of another component. 

If a component is created by its creator the following needs to hold. 

1. Either the component is created in the creators build function. Then either a key is used, or pattern matching is used to create a stable object identity during rebuild. 

2. A component can be created in the creators initialization function, or using some other way by a reactive mechanism. Such a component could be kept track of using a property or an unobserveable property, and the creator is in charge of the lifecycle.  

WARNING: There is a danger in combining both these methods. If a component is created during the creatprs build call, it will be registered in the rebuild process, and even if the creator keeps track of a reference to the component, the rebuild system might depose it. 

### A dropped keyed child is gone forever

We do not keep keyed instances around indefinitely. If a build() call does not construct a given key on some run, that key's slot is gone - permanently, not just for that one run. If the same key is constructed again on some later run, there is nothing left to reconcile against: it is built as a brand new instance, with fresh `initializeState()` defaults, not the one that was there before. This is expected, not a bug - a build() that conditionally guards a child's construction with an `if` is choosing, deliberately, to let that child's identity (and state) lapse whenever the condition is false.

If a UI genuinely needs to keep a keyed child alive - visible or not - across such a toggle, there are two ways:

1. **Build the child in initialization and take full control of its own lifecycle** - the second pattern from "Building Sub Components" above: hold it on a property or an unobservable, own its own render/retract calls directly, and never let its construction be guarded by an `if` inside anyone's build().
2. **Keep it keyed, but hidden, using `.show()`.** Instead of guarding a keyed child's *construction* with an `if`, build it unconditionally every run and use `.show(condition)` on the result to control whether it's actually included in what build() returns:
   ```js
   buildMySubComponent().show(condition)
   ```
   Since it's constructed every run regardless of `condition`, its build identity is always present in `newBuildIdObjectMap` - it never drops out, so it's never gone. `.show(false)` only removes it from *this run's returned tree* (see `Component.show()`), which is a render-level decision, not a build-identity one.

This is also why `cascade.application/demo`'s own RecursiveDemo page loses a deeper level's local state when you decrease the level count and then increase it again past where it was - that level's own key genuinely dropped out of its parent's build() for at least one run. That's the correct, intended behavior for the pattern that demo uses (a plain `if` guarding construction), not something the demo works around.

### Component state and properties

The component properties are given by its context during construction, and could change during re-building. They are similar to the arguments of a function call. 

The component state howerver, is only initialized once upon component establishment, and is thereafter only changed by user interactions that directly manipulate the state, and in some cases indirect events that are also caused by user interaction.

### State declaration

It is important that state is not overwritten during re-creation. In Flow, there was a weak convention based idea that the constructor of a component should never touch the component state associated object properties. This led to the awkward idea that the constructor could not even add default values or declare them in some way. 

In cascade we will introduce a more robust mechanism. We will have a separate function called initializeState() that each component can override to define its state properties. This one will be run in the constructor after the call to "me.setProperties(properties)"; The function will return an object whose properties will determine the state properties of this component, containing names and default values (that could be based off other component properties).

The key point is that a state property should only ever be possible to write in initialization time. Writing it by some later pipeline repeater should result in error. For this purpose, we need a cascade.reactive mechanism for doing so. 

### State during rebuild

State handling during re-build is the most tricky. Because then a new object will be created, sometimes borrowing the object identity of the first object during rebuld (using the forward mechanism), and then at the end of rebuild the properties of the newly created object is copied to the existing object while giving back the object identity. It is important that state properties are NOT copied back to the existing object, as that would reset them to  a default value. 

So already in cascade.reactive there needs to be an awarance of state properties, that behaves differently than other properties. First during assignment in the pipeline, and also during property copying rebuild.  

### Implementation

- `Component.initializeState()` - override it to return `{name: default, ...}`. It runs in the constructor right after `setProperties()`, so a default may derive from a property. The constructor hands the result to cascade.reactive's `declareState(object, defaults)`, which marks the names as state on the object's meta and writes the defaults at the baseline position (time 0, no writer) - like construction data, not tied to whichever repeater happened to be constructing the component.
- Writing a state property from inside a repeater throws (`setHandlerObject` in cascade.reactive). Event handlers run outside any repeater and can just assign. From anywhere else, use `Component.setState({name: value})` - it wraps `accessInitialValues()`, so the write lands on the baseline writing the state already lives at, and it rejects names that were never declared.
- During rebuild, `mergeInto()` (cascade.reactive/src/lib/utility.js) skips state properties when copying the throwaway object's properties onto the established one. That is the only gate - the constructor never tries to detect a rebuild, it just writes its defaults (they go to the throwaway, and are not copied back).
- A dropped sub component (its key no longer constructed by the creator's build) is retracted immediately, in `Component.onDispose()` via `retractRepeater()`, so no already-queued stale rerun of it can run first. A component overriding `onDispose()` must call `super.onDispose()`.

Three kinds of fields, then: *properties* (re-set from the constructing context on every rebuild), *state* (established once, changed by the user, exempt from rebuild copying), and *unobservables* (`this.unobservable`, plain non-reactive bookkeeping).