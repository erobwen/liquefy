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
  initialState() {
    return { count: 0 };
  }

  // Reactive: runs again whenever anything it read changes - and only what
  // actually changed in what it returns is touched.
  build() {
    return div(
      text(this.label + ": " + this.count),
      button(text("More"), callback("more", () => { this.count++; })),
    );
  }
}
```

- **Stable identity**: built again in the same place, a component is the
  *same* component, its state and elements kept - matched by pattern (the
  same class in the same place), so static structure needs no keys. **Keys**
  are for what can move, appear or disappear: the items of a list (see "Keys
  and pattern matching" below).
- **`.showIf(condition)`** leaves a child out without dropping it.
- **`callback(key, fn)`** is a named, stable callback - passed as a property, it
  doesn't count as a change on every rebuild (a plain closure is fine for a
  quick prototype).
- **`provide()` / `this.inherit(name)`** - a component returns an object from
  `provide()` (null, the default, provides nothing); anything below it finds
  each of its fields by name with `inherit()` - the nearest provider above
  where it's placed.
- **Services** - every element and widget is asked for through the render
  context's service locator (`CompoundServiceLocator`,
  `ObservableCompoundServiceLocator`, `serviceProvider()`), so themes can
  replace whole components, and any part of an app can have services of its
  own.
- **`render(target, context)`** is there for a component that needs to do real
  work at render time (measuring, say); most only implement `build()`.

# Design notes

## Invariants

### Render target and render context

A component is rendered onto a *target* with a *context* - `renderOnto(target, context)` - and the two are kept apart:

- The **target** holds everything temporal: where things go, and what has been placed so far this pass (a DOM target's `lastChild`, space left after the siblings before). Only render repeaters read and write it, in pipeline order. A build never sees it - a component keeps its target as plain bookkeeping only - except for what the target holds that *is* timeless, on an object of its own (`target.timeless`): a build reads that with `this.fromTarget(name)`. cascade.dom's measured elements keep their layout size there, so a component placed in one reads the size of the element it's in.
- The **context** holds only non-temporal information - services, a location, an overlay frame, portals, a measured size: values with one value per render pass. A build repeater is a pipeline of its own, unrelated in time to rendering, and reads the latest writing of whatever it reads - for such values, the right one. So builds may read the context (`this.renderContext`, `inherit()`).

A context is a chain with one link per component that actually provides something (`provide()` returning an object - `null` by default). A component that provides nothing adds no link: its children get the context it was given. A component and its context are separate objects - `provide()` never returns the component itself - so nothing a component merely has is inherited by accident.

1. A context is created once, by its component, when it first enters the tree, and kept - its identity never changes. It is disposed of with its component (`onDispose()`), together with the lookups cached on it.
2. Its parent link can change: a provider removed or inserted upstream re-points the links below it during reconciliation. It's observable, so only the lookups that went through it follow.
3. Everything written to a context - the parent link, provided values, a component's own context pointer - is written at the baseline (`accessInitialValues()`), and only when it changes.
4. A component's own lookups see only the context it was given, never what it provides itself - that is for its children. A frame inside a frame finds the outer one.
5. `inherit()` is cached per context: the first lookup of a name starts a small, independent repeater that fetches it from the parent and keeps the result there, for every later lookup from that level or below. It fetches again when something it read changes, and only a different result invalidates the readers. A reader pulls it before reading.
6. Every shown component has one current target and context, given by the same step (`enterTree()`) whether it is rendered or expanded by a container that places its subtree itself - so the two can never differ.
7. What is shown elsewhere than where it comes from (portal contents, an overlay's dialog) enters with the context of where it came from - what its entrance hands its children - not the context where it ends up (`enteredContext()`, `contextScope()`).

### Building Sub Components

A component is created either on the top level or as a child of another component. 

If a component is created by its creator the following needs to hold. 

1. Either the component is created in the creators build function. Then either a key is used, or pattern matching is used to create a stable object identity during rebuild. 

2. A component can be created in the creators initialization function, or using some other way by a reactive mechanism. Such a component could be kept track of using a property or an unobserveable property, and the creator is in charge of the lifecycle.  

   Being in charge of the lifecycle means doing what the rebuild process does for components built in a build function: call `establish()` on the component where it is created (that calls its `onEstablish()`, where it can acquire external resources), and `dispose()` on it once the creator is done with it - typically in the creator's own `onDispose()`, before `super.onDispose()`. Disposing is not optional: a component that reads observable data that never changes again is never invalidated, so without `dispose()` its repeaters stay subscribed, and keep everything they built, for as long as that data lives. A component created on the top level, outside any component, is established by whoever creates it, and disposed by them if it doesn't live as long as the app does.

   Create such components in `initialUnobservables()`, not in `initialState()`: `initialState()` also runs for the throwaway object constructed during a rebuild, so a component created and established there would be thrown away without ever being disposed. `initialUnobservables()` runs lazily, the first time the unobservables are read - which, unless the constructor itself reads them, is on the established object.

WARNING: There is a danger in combining both these methods. If a component is created during the creator's build call, it will be registered in the rebuild process, and even if the creator keeps track of a reference to the component, the rebuild system might dispose of it. 

### Keys and pattern matching

When a build() runs again, what it constructs is matched to what it constructed the previous time, so that the same component stays the same component - its state, its DOM elements, everything it built itself. Two ways:

- **Pattern matching**, for anything without a key: a component constructed in the same place as before - the same property of the same parent, the same position among its siblings - and of the same class (for a DOM element, with the same tag) is the one from before. So static structure needs no keys at all.
- **A key**, for whatever can move, appear or disappear among its siblings - the items of a list. Among an array's children, those without a key are paired in order, skipping the keyed ones, so an item inserted at the front would otherwise be matched to what used to be first. Also for a component built but not shown (`.showIf(false)` - it's not in the result, so there's nothing to match it against), and for two components of the same class taking turns in the same place (without keys, the second would carry on as the first).

A matched component is merged into the established one exactly as a keyed one is (see "State during rebuild" below): its properties copied over, its state never. The matching reads the new build through its proxies, without recording any dependencies, and matches it against a plain-data snapshot of the previous build taken at the end of each run - the previous build's own properties are retracted once it's invalidated, so they can't be read back (see cascade.reactive's "Rebuild shape analysis").

One thing a key does that matching can't: references outside of what build() returns - a variable in a closure, an unobservable - still point to the new, discarded twin after a match. A component referred to like that wants a key.

### A dropped keyed child is gone forever

We do not keep keyed instances around indefinitely. If a build() call does not construct a given key on some run, that key's slot is gone - permanently, not just for that one run. If the same key is constructed again on some later run, there is nothing left to reconcile against: it is built as a brand new instance, with fresh `initialState()` defaults, not the one that was there before. This is expected, not a bug - a build() that conditionally guards a child's construction with an `if` is choosing, deliberately, to let that child's identity (and state) lapse whenever the condition is false.

If a UI genuinely needs to keep a keyed child alive - visible or not - across such a toggle, there are two ways:

1. **Build the child in initialization and take full control of its own lifecycle** - the second pattern from "Building Sub Components" above: create it in `initialUnobservables()`, call `establish()` on it there and `dispose()` on it in your own `onDispose()`, and let build() just place it, where and when it likes - never construct it inside a build() as well.
2. **Keep it keyed, but hidden, using `.showIf()`.** Instead of guarding a keyed child's *construction* with an `if`, build it unconditionally every run and use `.showIf(condition)` on the result to control whether it's actually included in what build() returns:
   ```js
   buildMySubComponent().showIf(condition)
   ```
   Since it's constructed every run regardless of `condition`, it's always among what the build constructed - it never drops out, so it's never gone. `.showIf(false)` only removes it from *this run's returned tree* (see `Component.showIf()`), which is a render-level decision, not a build-identity one.

This is also why `cascade.application/demo`'s own RecursiveDemo page loses a deeper level's local state when you decrease the level count and then increase it again past where it was - that level's own key genuinely dropped out of its parent's build() for at least one run. That's the correct, intended behavior for the pattern that demo uses (a plain `if` guarding construction), not something the demo works around.

### Component state and properties

The component properties are given by its context during construction, and could change during re-building. They are similar to the arguments of a function call. 

The component state, however, is only initialized once upon component establishment, and is thereafter only changed by user interactions that directly manipulate the state, and in some cases indirect events that are also caused by user interaction.

### State declaration

It is important that state is not overwritten during re-creation. In Flow, there was a weak, convention-based idea that the constructor of a component should never touch the object properties that held its state. This led to the awkward idea that the constructor could not even add default values or declare them in some way.

Cascade has a more robust mechanism: a separate function, `initialState()`, that each component can override to declare its state properties. It runs in the constructor, after `setProperties(properties)`, and returns an object whose properties are the component's state properties - their names and default values (which may be based on other component properties).

The key point is that a state property can only be written at initialization time, or from outside the pipeline (an event handler): writing it from a pipeline repeater is an error. cascade.reactive enforces this (see "Implementation" below).

### State during rebuild

State handling during re-build is the most tricky. Because then a new object will be created, sometimes borrowing the object identity of the first object during rebuild (using the forward mechanism), and then at the end of rebuild the properties of the newly created object is copied to the existing object while giving back the object identity. It is important that state properties are NOT copied back to the existing object, as that would reset them to  a default value. 

So cascade.reactive itself is aware of state properties, and treats them differently from other properties: when they're assigned in the pipeline, and when properties are copied during a rebuild.

### Implementation

- `Component.initialState()` - override it to return `{name: default, ...}`. It runs in the constructor right after `setProperties()`, so a default may derive from a property. The constructor hands the result to cascade.reactive's `declareState(object, defaults)`, which marks the names as state on the object's meta and writes the defaults at the baseline position (time 0, no writer) - like construction data, not tied to whichever repeater happened to be constructing the component.
- Writing a state property from inside a repeater throws (`setHandlerObject` in cascade.reactive). Event handlers run outside any repeater and can just assign. From anywhere else, use `Component.setState({name: value})` - it wraps `accessInitialValues()`, so the write lands on the baseline writing the state already lives at, and it rejects names that were never declared.
- During rebuild, `mergeInto()` (cascade.reactive/src/lib/utility.js) skips state properties when copying the throwaway object's properties onto the established one. That is the only gate - the constructor never tries to detect a rebuild, it just writes its defaults (they go to the throwaway, and are not copied back).
- A dropped sub component (no longer constructed by its creator's build - keyed or matched by pattern) is retracted immediately, in `Component.onDispose()` via `retractRepeater()`, so no already-queued stale rerun of it can run first. A component overriding `onDispose()` must call `super.onDispose()`.

Three kinds of fields, then: *properties* (re-set from the constructing context on every rebuild), *state* (established once, changed by the user, exempt from rebuild copying), and *unobservables* (`this.unobservable`, plain non-reactive bookkeeping).