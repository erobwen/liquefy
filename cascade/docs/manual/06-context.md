# 6. Context: provide(), inherit(), render target and render context

Every component is rendered with two things: a **target** (where its output
goes) and a **context** (what it inherits from). This chapter is about the
context and the strict line between the two. Services, the most important
thing a context carries, have a chapter of their own
([7](07-services-and-hydration.md)).

## 6.1 provide() and inherit()

A component provides values to its subtree by returning an object from
`provide()` (default `null`: provides nothing). Anything below finds a field
by name with `this.inherit(name)` - the nearest provider above where it is
placed:

```js
class NoticeBoard extends Component {
  initialUnobservables() {
    return { board: portal({ style: { minHeight: "150px" } }).establish() };
  }
  onDispose() {
    this.unobservable.board.dispose();
    super.onDispose();
  }
  provide() {
    return { noticeBoard: this.unobservable.board };
  }
  build() { /* ... */ }
}

// Anywhere below:
const board = this.inherit("noticeBoard");
```

- `provide()` is called **once**, when the component first enters the tree
  (unrecorded). Whether it provides, and which object, is fixed for the
  component's life; only what that object holds may change. Returning
  `null` the first time means the component never provides anything.
- The returned object's fields may be:
  - plain values - fixed;
  - getters - read afresh at each lookup, so a getter over the component's
    own properties follows them (the usual choice):
    ```js
    provide() {
      const frame = this;
      return {
        get location() { return frame.location; },
        get topBarPortal() { return frame.topBarPortal; },
      };
    }
    ```
  - fields of an observable object the component keeps and rewrites. Write
    them **at the baseline, and only when they change** (see
    [8.8](08-reactivity.md#88-accessinitialvalues)), because whatever
    rewrites them usually runs inside a repeater:
    ```js
    provide() {
      const u = this.unobservable;
      if (!u.provided) u.provided = observable({ modalPresentation: this.presentation() });
      return u.provided;
    }
    build() {
      const provided = this.provide();
      const presentation = this.presentation();
      if (withoutRecording(() => provided.modalPresentation) !== presentation) {
        accessInitialValues(() => { provided.modalPresentation = presentation; });
      }
      // ...
    }
    ```
    (cascade.ui's `Modal` does this. cascade.dom's `providingElement({ context, child })`
    gives you the same thing without writing a component.)
- `provide()` never returns the component itself. The component and its
  context are kept apart, so nothing it merely has (a style, a label) is
  inherited by accident.
- A component never inherits what it provides itself - that is for its
  children. A frame inside a frame finds the outer one.
- `inherit()` is a tracked read, from `build()`, `render()`, an event handler
  or anywhere else. Placed somewhere else, or the provided value changing,
  a component that inherited something follows.
- `inherit()` **throws** if the component has not entered the tree yet. A
  component inherits from where it is *placed*, so there is nothing to
  inherit from in the constructor, `setProperties()`, `initialState()` or
  `initialUnobservables()`. Read inherited values in `build()` or later.
- `undefined` means nothing provides it. To *block* a value for a subtree,
  provide it as `null`: the lookup stops there and returns `null`. (The demo
  takes the ability to switch theme away from a subtree this way, by
  providing `rootServiceLocator: null`.)
- Lookups are cached per context: the first lookup of a name starts a small
  independent repeater that fetches it from above and keeps it, for every
  later lookup from that level or below. When something it read changes (a
  parent link, a provided getter's source), it fetches again, and **only a
  different result** invalidates the readers. Deliberately speed over
  memory: the cache lives as long as its context.

### Placed, not created

What a component inherits depends on where it is **placed** (rendered), not
on which build constructed it. A component built by A but handed to B as a
property inherits from wherever B renders it. (Service lookups are the
opposite: they happen when a component is constructed, in the constructing
build's context - see [7.1](07-services-and-hydration.md#71-locators-and-queries).)

### The root context

`renderOnto(target, context)` defaults `context` to `RenderContext.empty`,
which provides nothing. The application's root gives it a context of its own,
normally with the root service locator in it:

```js
import { RenderContext } from "@liquefy/cascade.component";

new App().establish().renderOnto(target, new RenderContext({ serviceLocator: basicTheme }));
```

`new RenderContext(provided = null, parent = null)` - `provided` is read like
a component's `provide()` result. You rarely build one yourself except at the
root.

### Reading the context directly

`this.renderContext` is the context a component was given (an observable
property, set when it enters the tree). `context.inherit(name)` is the same
lookup as `this.inherit(name)`; `context.serviceLocators()` yields every
`serviceLocator` on the way up, nearest first; `context.provided` is what its
own provider returned. Use `inherit()` in application code - provided values
are not fields of the context object.

## 6.2 Render target vs render context

A component is rendered onto a *target* with a *context* -
`renderOnto(target, context)` - and the two are kept strictly apart:

- **The target holds everything temporal**: where things go and what has
  been placed so far this pass (a `DOMElementTarget`'s `lastChild`, space
  left after the siblings before). Only render repeaters read and write it,
  in pipeline order. A component keeps its target as plain, non-reactive
  bookkeeping; a build never sees it - except values that are timeless,
  kept on `target.timeless`, which a build reads with `this.fromTarget(name)`.
  cascade.dom's measured elements keep their layout size there.
- **The context holds only non-temporal information**: services, a location,
  an overlay frame, portals - values with one value per render pass.

**Why it matters.** A component's build runs in an *independent* repeater -
a pipeline of its own, unrelated in time to the render pipeline (see
[8.4](08-reactivity.md#84-repeat)). A read from it sees the *latest* writing
of whatever it reads. For a value with one value per pass, the latest writing
is the right one. For a temporal value - "the last node placed so far", "the
height left after the toolbar" - the latest writing is whatever the *last*
renderer of the pass left there, which is wrong for almost every reader. Read
deep down, a measured size means nothing there anyway. That is why the
target, the temporal side, is only touched by `render()`, in order, and the
context, the timeless side, is safe from anywhere.

Invariants (from cascade.component's design notes):

1. A context is created once by its component, when it first enters the tree,
   and kept - its identity never changes. It is disposed with the component,
   together with the lookups cached on it.
2. Its parent link can change (a provider removed or inserted upstream
   re-points the links below it). It is observable, so only the lookups that
   went through it follow.
3. Everything written to a context - the parent link, provided values, a
   component's own context pointer - is written at the baseline
   (`accessInitialValues()`), and only when it changes.
4. A component's own lookups see only the context it was given, never what it
   provides itself.
5. `inherit()` is cached per context.
6. Every shown component has one current target and context, set by the same
   step (`enterTree()`) whether it is rendered or expanded by a container that
   places its subtree itself (a `FlipAnimationContainer`) - so the two can
   never differ. Visibility (`onShow()`) is told after this step, so
   `onShow()` can already inherit.
7. What is shown elsewhere than where it comes from (portal contents, an
   overlay's dialog) enters with the context of where it came from
   (`enteredContext()`, `ContextScope`).

**Rule:** never put a temporal value - a measured size, a position - in the
context. Read timeless target values with `this.fromTarget()`, or hand a
measurement to a direct child as a property. See [10.13](10-pitfalls-and-rules.md#1013-never-put-a-temporal-value-in-the-render-context).

```js
class Profile extends Component {
  build() {
    const width = this.fromTarget("width") || 0; // the element it's placed in, measured
    return div({ style: { display: "flex", flexDirection: width >= 420 ? "row" : "column" } }, /* ... */);
  }
}

elementBoundsProvider({ style: { width: "100%", contain: "inline-size layout" }, child: new Profile() })
```

`fromTarget(name)` is a tracked read: undefined when the target has no
timeless side (it is not measured), and followed when the value changes or
the component is placed on another target. It reads the target the component
itself is placed on: the measured element's target holds the size for the
provider's child and for whatever that child's builds return, down to the
next element. What is rendered into an element of its own is placed on that
element's target, which knows nothing of the size - pass the value down as a
property if a deeper component needs it.

## 6.3 ContextScope

`contextScope({ context, children })` renders its children with the given
context instead of the one where it stands (no `context`: the one where it
stands). It is build-only, so a container that expands its subtree expands
right through it. It is how portals and overlays show content with the
context of its origin: a `portalSource` hands the portal its own child
context, and the portal shows the contents inside a `contextScope` with it -
unless the source says `inheritFrom: "portal"` (see
[9.5](09-dom-and-ui.md#95-portals-providing-elements-routing-head)).

For the same effect in a component of your own, override
`enteredContext(given)`: it receives the context the component was given and
returns the one it enters the tree with. It is read each time the component
enters the tree, so a change in what it returns places the component again.
