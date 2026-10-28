# 11. Pitfalls and rules

Each rule: what to do, why, and a short example. The first five come from
real debugging sessions and are the ones most likely to bite. Rules 11.18
and on were added later, from the framework's tests, the demo and Tabula.

## 11.1 Write shared state at the baseline when a repeater might be running

**Rule.** Shared observable state (an app-level model, a "who has the focus"
object) that may be written from code a rebuild can call - a `build()`, a
`render()`, an `onDispose()` or `onEstablish()` run by a rebuild - must be
written with `accessInitialValues(() => ...)`. Compare first with
`withoutRecording()` so an unchanged value writes nothing.

**Why.** A write made from inside a repeater is *that repeater's writing, at
its position in the tree*. Readers after that position keep seeing it. A
later write from an event handler lands at the baseline, which is *before*
that position - so for those readers it does not override the repeater's
writing. Their value is stuck until the repeater reruns or is retracted.
An `onDispose()` called because a rebuild dropped a component runs inside
the rebuilding build repeater, so it counts. (A write from a build can also
throw outright - see [11.18](#1118-one-property-one-writing-pipeline-dont-write-shared-state-from-build).)

**Real case.** In Tabula, a `contextMenus` object held the current focus
`owner`. When the mode switched, the old editor's `onDispose()` released the
focus (`owner = null`) - inside the rebuild. A click in the new editor then
set `owner` from an event handler, at the baseline - and the layout, reading
after the rebuild's position, went on seeing `null`: no menus.

```js
// Wrong: from onDispose() during a rebuild, this is the rebuild's writing.
release(owner) {
  if (this.owner === owner) this.owner = null;
}

// Right: always at the baseline, and only when it changes.
focus(owner) {
  if (withoutRecording(() => this.owner) !== owner) accessInitialValues(() => { this.owner = owner; });
}
release(owner) {
  if (withoutRecording(() => this.owner) === owner) accessInitialValues(() => { this.owner = null; });
}
```

`Component.setState()` does exactly this for declared state. Plain writes
from event handlers already land at the baseline; the rule is about code
that *might* run inside a pipeline. If the change must also be processed in
the same wave (something earlier in the tree has already rendered), wrap it
in `flush()` as well (see [11.21](#1121-writing-back-to-something-already-rendered-setstate-and-flush-and-make-it-converge)).

## 11.2 State is written by the user, or with setState()

**Rule.** Write state properties only from event handlers, or with
`this.setState({ ... })`.

**Why.** A plain write to a state property from inside any repeater throws
("Cannot write state property '...' from inside a repeater"). State is
established once and changed by the user; a pipeline writing it would be a
side effect of recomputation. `setState()` only takes names declared in
`initialState()` - anything else throws ("... is not a state property of
this component"), because a *property* written back in time would be a bug
hiding, not a feature.

```js
render(target, context) {
  // this.selected = fallback;            // throws
  this.setState({ selected: fallback });  // lands at the baseline
}
```

## 11.3 Components created in a build are the build's

**Rule.** A component constructed in a `build()` is established and disposed
by that build: when a rebuild doesn't construct it again, it is disposed.
Anything a component owns outside its build - created in
`initialUnobservables()` - must be established and disposed by the component
itself. Never both build a component and keep it by reference.

**Why.** The rebuild only knows what it constructed. Something it didn't
construct is never established or disposed by it; something it did construct
is disposed when it stops constructing it, references or not - and when its
creator is disposed, everything the creator's build constructed goes too,
shown or not. A component that's never disposed keeps its repeaters
subscribed and everything they built alive (if it reads data that never
changes again, nothing ever invalidates it).

```js
// Wrong: built here AND kept - the first build without it disposes it
// out from under the reference.
build() {
  this.unobservable.board = this.unobservable.board || portal({ key: "board" });
  return div(this.showBoard ? this.unobservable.board : null);
}

// Right: owned - created, established and disposed by the owner.
initialUnobservables() {
  return { board: portal({ key: "board" }).establish() };
}
onDispose() {
  this.unobservable.board.dispose();
  super.onDispose();
}
```

A component created outside any component (a module-level page, the app
root) is established by whoever creates it, and disposed by them if it
doesn't live as long as the app.

## 11.4 Content components passed as properties: fine, but state belongs to the component

**Rule.** A parent may keep components (in unobservables, owned as in 11.3)
and pass them as properties - "content" components handed to layout
components - and the layout places them. The content component's state
lives in the content component, not in the layout. A component of a
*different class* in the same place is a *new* component.

**Why.** Identity is by key, or by class and place - and even under the same
key, a different class is a replacement: a fresh object, the old one
disposed. Swap a `PlainTextEditor` for a `SpreadsheetEditor` in the same
slot and the first is dropped (and disposed, if it was built there);
nothing carries over. If state must survive a swap, keep it in the owner or
a model the components read.

```js
// The owner keeps both editors (owned as in 10.3), and hands one to the
// layout - `layout` here stands for a layout component of your own:
build() {
  return layout({ content: this.mode === "text" ? this.unobservable.textEditor : this.unobservable.sheetEditor });
}
```

## 11.5 Event handlers must be element properties

**Rule.** Use event handler names that exist as element properties: `onclick`,
`oninput`, `onchange`, `onkeydown`, `onmousedown`, `onfocus`, `onblur`, ...
Case doesn't matter (`onClick` works: every property name given to an
element is lowercased). Put `onfocus` on the focusable element itself rather
than reaching for an event without a handler property, such as `onfocusin`.

**Why.** cascade.dom assigns a property as an element property only if the
element has a writable property by that name (`element.onclick = fn`).
Otherwise it sets an attribute, with `String(value)`. For `onfocusin` that
is the function's source text as an inline handler, which the browser tries
to compile - "Function statements require a function name" or a similar
syntax error - and the handler never runs.

```js
input({ onfocus: callback("focus", () => this.takeFocus()) })   // works
div({ onfocusin: () => this.takeFocus() })                      // attribute string: broken
```

**Events with no handler property** (`focusin`/`focusout`, the composition
events, `beforeinput` in some browsers, a listener with `{ passive: true }`
or `capture`): cascade.dom has no helper for `addEventListener` - none in
its exports, and nothing in its elements uses it. Add the listener yourself,
from a component that owns the element: a `DOMNodeComponent` of your own
(see [11.24](#1124-what-element-properties-cant-do-a-domnodecomponent-of-your-own)), or, for
the document or window, `onEstablish()`/`onDispose()` (see
[11.25](#1125-external-resources-acquire-in-onestablish-release-in-ondispose)).

## 11.6 A leading lowercase string is a key, not text

**Rule.** Wrap text in `text("...")`. Give keys explicitly when in doubt.

**Why.** The first loose argument, if it is a number or a string starting
with a lowercase letter, is the implicit key. `li("first")` is an empty `li`
keyed `"first"`; `p(42)` is an empty `p` keyed `"42"`; cascade.ui's
`button("save", onClick)` is a button keyed `"save"` (shown with the label
"Save" by the themes). Text that comes from data can turn into a key
depending on its first letter. A key containing whitespace triggers a
warning (`"..." became a key ..., not text`), once per key - a key without
whitespace gives no warning at all.

```js
p(this.message)              // "hello there" becomes a key (with a warning)
p(text(this.message))        // text
```

Only the first loose argument can be a key, and only if it isn't inside an
array: `p(text("Total: "), count)` is fine. The exact rules are in
[4.4](04-creator-functions.md#44-the-implicit-key).

## 11.7 Keys are unique across everything one build() constructs

**Rule.** Don't key static structure inside a helper that may be called more
than once per build. Drop the inner keys (static structure is matched by
pattern), or make the helper a component (`view()`), whose build has keys of
its own.

**Why.** Keys are unique across the whole build, so that a keyed component
can move to another parent and stay itself. Calling a keyed helper twice -
or keying static list buttons by name when other keys in the build have the
same names - is a duplicate key error (`Duplicate key "label" in
Form.build() (...)`).

```js
const field = (key, labelText, control) => div({ key }, div({ key: "label" }, text(labelText)), control);
// Two fields in one build: "label" twice - duplicate key error.

const field = view("Field", ({ labelText, control }) => div(div({ key: "label" }, text(labelText)), control));
// Each Field has its own key namespace.
```

Named callbacks have the same rule among themselves: two `callback()`s with
one key in one build share one function - the second silently takes over
(there is a console warning).

## 11.8 Key only what can move, appear or disappear

**Rule.** Static structure needs no keys. Key list items, things shown
conditionally whose state matters, things built but not shown (11.9), and
two components of the same class taking turns in one place. Key a dependent
piece by what it belongs to, so it comes and goes with it - e.g. a separator
that belongs to the list item before it is keyed by that item.

**Why.** Unkeyed children are paired in order, skipping keyed ones, and
`null` holds a place - so the siblings *of* a conditional child need no
keys. A keyed item with an unkeyed separator after it would leave the
separator matched by position - to a different item's separator - when
items are inserted or removed. And without keys, two same-class components
taking turns are one component: the second carries on with the first's
state. Keys on static structure are just noise.

```js
this.items.flatMap((item, index) => [
  index > 0 ? hr({ key: "separator-" + item.id }) : null,
  row({ key: item.id }, text(item.title)),
]);

// Taking turns: keys, or the second inherits the first's state.
this.signedIn ? new ProfileForm({ key: "profile" }) : new ProfileForm({ key: "signup" })
```

## 11.9 A dropped keyed child is gone for good

**Rule.** Use `.showIf(condition)` (constructed every run) or ownership to
keep a child's state across a toggle; an `if` around its construction forgets
it. A child kept alive with `.showIf()` needs a key.

**Why.** A key not constructed on one run is disposed. Built again, it is new,
with fresh defaults. `.showIf(false)` keeps it constructed but leaves it out
of the build's result - and since pattern matching only sees the result,
an unkeyed child built-but-hidden has nothing to be matched against: it is a
new one each build.

```js
// Forgets:   this.tab === "first" ? new Tally({ key: "first" }) : new Tally({ key: "second" })
// Remembers:
new Tally({ key: "first" }).showIf(this.tab === "first"),
new Tally({ key: "second" }).showIf(this.tab === "second"),
```

A component merely not rendered for a while (its page switched away from)
keeps its build and its keyed children; only its builder dropping it
disposes it.

## 11.10 Create owned components in initialUnobservables(), not initialState()

**Rule.** A component you own (11.3) is created in `initialUnobservables()`
- not in `initialState()`, the constructor or `setProperties()`.

**Why.** `initialState()` (like the constructor and `setProperties()`) runs
for the throwaway twin of every rebuild too; a component created and
established there is thrown away without being disposed.
`initialUnobservables()` runs lazily, on the established object (unless the
constructor itself reads `this.unobservable`), and at the baseline.

## 11.11 Override hooks call super

**Rule.** An override of `onDispose()` must call `super.onDispose()`;
`onEstablish()` calls `super.onEstablish()`; `onRetract()`/`onReattach()`
call super to keep `onHide()`/`onShow()`.

**Why.** `Component.onDispose()` retracts the component's repeaters, disposes
its context and disposes everything its build constructed. Without it,
everything below stays subscribed. In a `DOMNodeComponent`, `onRetract()`
also removes the element and `onReattach()` puts it back: an override
without super leaves an orphaned element on the page, or never shows it
again.

## 11.12 Stable properties: callback() and frozen()

**Rule.** Pass `callback(key, fn)` rather than a fresh closure, and
`frozen()` plain-data properties (style objects, option lists, `children`)
in `setProperties()`.

**Why.** A fresh closure or a fresh object literal is a different value every
build, so the child sees a changed property and rebuilds every time its
creator does. That's the whole cost - nothing breaks - so plain closures are
fine in a quick prototype. And a function a child *calls while it builds*
(a frame building its content into the space left) must stay a plain
closure: there, a new function is a real change.

Details that bite:

- `callback()` only works inside a `build()` - it's kept by the component
  whose build is running. Called anywhere else (an event handler,
  `initialUnobservables()`, `render()`) it just returns `fn`.
- A component with the default `setProperties()` compares every property by
  identity - `view()` components included. A `style: { ... }` literal
  passed to one rebuilds it every time. Override `setProperties()` and
  `frozen()` the plain data (the DOM tag functions already do this for their
  own attributes, style and children).

## 11.13 Never put a temporal value in the render context

**Rule.** The context holds values with one value per render pass (services,
location, frames, portals). A measured size, a position, the space left -
read them with `this.fromTarget()`, or pass them to a direct child as a
property.

**Why.** Builds read the latest writing of the context. For a value that
changes part-way through a pass, the latest writing is the wrong one for
almost every reader. And a measured size read deep down means nothing
there.

## 11.14 References outside the build result want a key

**Rule.** If you keep a reference to a component you construct in a build (in
a closure or an unobservable), key it.

**Why.** On a pattern match, only references in what the build returned are
redirected to the established component. Others still point to the
discarded twin.

## 11.15 Retraction notifies readers outside the retracted tree

**Rule.** Expect readers outside a retracted subtree to rerun when it is
retracted - immediately, if you retract from outside any pipeline (an event
handler, a timer); queued, if inside a running pipeline.

**Why.** Retraction undoes the subtree's writings; readers of them must see
what is underneath. Inside the subtree nothing reruns (see 11.16 (d)).

## 11.16 Behaviour guarantees (fixed framework bugs)

These used to be bugs and are now fixed in cascade.component's `renderOnto()`
and `onDispose()`, and cascade.reactive's `refresh()`, `dispose()` and
`retractRepeater()`. You can rely on them - and needn't work around them:

- **(a) Pending relinked children render in tree order.** A child that is
  relinked (rendered again in its place) with work pending is rendered on
  the spot, so the siblings after it are placed after it, not where it used to
  be. (Previously: a keyed child inserted before a sibling whose own build
  changed in the same pass left unkeyed siblings out of DOM order.)
- **(b) A component dropped by its creator's catch-up build stops
  rendering.** A component's render first brings its creator's build up to
  date (`refreshCreatorBuild()`); if that build no longer constructs it, the
  component is retracted and does not render. (Previously it rendered with
  retracted - undefined - properties.)
- **(c) Retracted during its own run stays retracted.** A repeater retracted
  while it runs finishes as retracted; anything it created after the
  retraction is retracted too.
- **(d) retractRepeater() is two-phase.** The whole tree is disposed and
  marked retracted first; then writings are undone and `onRetract()` fires.
  Nothing inside the tree reruns against undone writings. (Previously:
  retracting a paper layout from outside a pipeline re-ran paragraphs that
  read where the previous section had left off - from null.) Readers outside
  the tree are still notified.
- **(e) A first build() or render() that throws leaves nothing behind.** Its
  repeater is retracted; once the cause is gone, the next `renderOnto()`
  starts afresh. (Previously the half-made repeater stayed subscribed, and a
  second one writing the same properties crashed the scheduler on the next
  change.) An error thrown later is just an error: fix it.
- **(f) A dropped component takes everything its build constructed with
  it** - also what it built but wasn't showing (a closed drawer's
  contents). (Previously such a child, inside a FlipAnimationContainer,
  built once more after its creator was gone, with undefined properties.)

## 11.17 What initialUnobservables() returns is copied

**Rule.** In closures made in `initialUnobservables()`, read through
`this.unobservable`, not the object you return. Don't use the names
Component keeps there itself.

**Why.** `this.unobservable` is a copy of the object `initialUnobservables()`
returns (`Object.assign({ repeater: null }, own)`), not that object. A
closure that captures the returned object never sees what's written to
`this.unobservable` later - by `build()`, say.

```js
initialUnobservables() {
  const u = { settings: null };
  // Wrong: reads the original object - build()'s write never reaches it.
  // u.isWide = () => u.settings.wide;
  u.isWide = () => this.unobservable.settings.wide;
  return u;
}

build() {
  this.unobservable.settings = settingsFor("editor", { wide: false });
  ...
}
```

Found in Tabula: an editor's editing functions, made in
`initialUnobservables()`, read settings the build put on `this.unobservable`
- and found `null`, throwing on the first Enter.

Reserved names (`repeater`, `buildRepeater`, `renderTarget`,
`renderContext`, `renderParent`, `ownContext`, `childContext`,
`renderTimeless`, `pullingComponent`, `callbacks`, `callbackBuild`,
`hydrated`, `hydratedInBuild`) throw when returned from
`initialUnobservables()`. Writing one later, directly on
`this.unobservable`, isn't caught - and breaks the component.

## 11.18 One property, one writing pipeline: don't write shared state from build()

**Rule.** A `build()` computes what to show from what it reads; it doesn't
write observables that anything else writes too. Write shared models from
event handlers, or at the baseline (11.1).

**Why.** Each component's build repeater is a pipeline of its own, separate
from the render pipeline and from every other build. Two pipelines may read
each other's writings, but a property may be written by only one pipeline
at a time level - a second one writing it throws:

```
Property 'count' is already written at time level 0 by repeater '...'s pipeline;
repeater '...' belongs to a different pipeline at the same time level and cannot write it too.
```

So two components whose builds both write `model.count`, or a build and a
render writing the same property, crash on the second write.

```js
// Wrong: every Row's build writes the same property.
build() {
  model.lastShown = this.item.id;
  return row(text(this.item.title));
}

// Right: derive in the reader, or write from the event that causes it.
onclick: callback("show", () => { model.lastShown = this.item.id; })
```

Writes to the component's *own* bookkeeping go in `this.unobservable`,
which isn't observable and has no such rule.

## 11.19 A write in an event handler re-renders before the handler returns

**Rule.** Do everything that depends on the *old* state first, and stop
the event (`event.stopPropagation()`) when a handler further up would act
on the new state.

**Why.** Outside a batch (11.20), a write outside any repeater runs every
repeater it invalidates right away: by the next line of your handler, the
DOM is rebuilt. The event, though, goes on bubbling up the path it started
with - to ancestors' handlers that now see the new state, and an element
that may no longer be on the page.

**Real cases.** In the demo's reactive form, an "add" button in a drawer's
header added the first piece - the drawer rebuilt at once, and the click,
reaching the header, toggled the drawer that had just opened, closing it.
In the focus store, closing a card put it back on the shelf; the click then
reached the card, which focused itself again.

```js
// The header toggles; the add button inside it mustn't also toggle it.
const onAdd = callback("add", (event) => {
  event.stopPropagation();
  this.addPiece();
});
```

## 11.20 Changes that belong together: one batch

**Rule.** Several writes that make one change - moving an item from one
list to another, replacing a document's content - go between
`postponeInvalidations()` and `continueInvalidations()`, in a
`try`/`finally`.

**Why.** Each write otherwise re-renders on its own (11.19). In between, the
model is half-changed - and a build that runs then sees it. An item moved
by `remove` then `add` is, for one rebuild, in neither list: its key isn't
constructed, so it is disposed (11.9), and comes back as a new one - its
state lost, its element replaced, its animation a fade-in instead of a
move. It's also slower: laid out once per write instead of once.

```js
function transaction(action) {
  postponeInvalidations();
  try {
    action();
  } finally {
    continueInvalidations();
  }
}

transaction(() => {
  left.splice(left.indexOf(item), 1);
  right.push(item);
});
```

Don't read derived values inside the batch: what reacts to the writes
hasn't run yet.

## 11.21 Writing back to something already rendered: setState() and flush(), and make it converge

**Rule.** A component may write state of one that has already rendered
earlier in the pass - a portal source filling its portal, a toolbar told
how many of its items overflowed. Do it with `setState()` (at the baseline),
wrapped in `flush()` so it settles within the current wave, and only when
the value changes.

**Why.** Without `setState()`, the write lands at the writer's own place in
time, after the earlier component - which never sees it. Without `flush()`,
the earlier component still catches up before the outermost write returns
(so not a frame late), but in a later wave: everything after it in the pass
has already run with the old value, and whatever depends on it runs again
(see [9.7](09-reactivity.md#97-flush)). Without the comparison, every
render writes again.
And it's your responsibility that the correction converges: if the earlier
component's new render changes what the later one measures, and that writes
back again, the two can ping-pong for ever.

```js
// Reported from the bar's own rendering, back to the toolbar that built it.
onOverflow: callback("overflow", (count) => {
  if (withoutRecording(() => this.overflowCount) !== count) flush(() => this.setState({ overflowCount: count }));
}),
```

## 11.22 provide() is called once: provide getters or observables, not copies

**Rule.** Return from `provide()` an object of getters (or an observable
object) - not values copied from properties - and never `this`.

**Why.** `provide()` is called once, when the component first enters the
tree; the object it returns is its context for its whole life. A value
copied into it is that value for good, however the property changes later.
A getter is read afresh at every lookup, and over observable properties it
is followed. Returning `this` would make everything the component has
inheritable by accident - a `style`, a `label`.

```js
// Wrong: the theme as it was when first rendered.
provide() { return { theme: this.theme }; }

// Right: follows this.theme.
provide() {
  const component = this;
  return { get theme() { return component.theme; } };
}
```

Also: `inherit()` never sees what the component provides itself - only its
children do. A frame inside a frame finds the outer one.

## 11.23 Build UI with the factory functions, inside a build()

**Rule.** Application code makes platform and widget components with the
factory functions - `div()`, `text()`, `button()`, `portal()`,
`flipAnimationContainer()`, `elementBoundsProvider()` - never
`new DOMElementComponent(...)` and the like. And it calls them inside a
`build()`.

**Why.** A factory function asks the service locators in the render context
of the component whose build is running. That's what lets a theme restyle a
`button`, a theme switch rebuild exactly what used it, and another platform
(prerendering) supply its own elements. Constructed directly, a component
bypasses all of that. Called outside any build - at module level, in an
event handler, in `initialUnobservables()` read from a render - a factory
has no context to look in (or another component's): an HTML tag falls back
to the plain DOM element, and a themed widget to the debug placeholder (a
visible warning box), whatever theme the app has. To make something
outside a build, make a component whose build makes it.

Inside cascade.dom itself, components construct each other directly; this
rule is for code that uses the platform.

## 11.24 What element properties can't do: a DOMNodeComponent of your own

**Rule.** For anything the tag functions can't express - a listener only
`addEventListener` can add, HTML from a string, SVG, a reference to the
real element - write a `DOMNodeComponent` that creates its own node in
`ensureNode()`, and cleans up in `onDispose()`.

**Why.** Every property given to a tag function is lowercased, then set as
an element property only if one by that name exists - otherwise as an
attribute (11.5). So `innerHTML`, `textContent`, `scrollTop`,
`valueAsNumber` - anything with a capital letter - silently become
meaningless attributes. `svg()` and `math()` create HTML elements named
`svg`/`math` (`document.createElement`, not the SVG namespace), and there
are no tags for their children: SVG drawn that way shows nothing. And a
build never gets at the elements its tags create.

```js
export class Gauge extends DOMNodeComponent {
  setProperties({ value }) {
    this.value = value;
  }
  ensureNode() {
    const u = this.unobservable;
    if (!u.node) {
      u.node = document.createElement("div");
      u.listening = new AbortController();
      u.node.addEventListener("wheel", (event) => this.onWheel(event), { passive: true, signal: u.listening.signal });
    }
    u.node.innerHTML = gaugeSvg(this.value);   // rerun when this.value changes
    return u.node;
  }
  onDispose() {
    if (this.unobservable.listening) this.unobservable.listening.abort();
    super.onDispose();
  }
}
```

Tabula's `TextInput` (a hidden textarea with composition listeners) and
the demo's `HighlightedCode` (innerHTML from highlight.js) are built this
way.

## 11.25 External resources: acquire in onEstablish(), release in onDispose()

**Rule.** Document- or window-level listeners, observers, timers,
subscriptions - acquire them in `onEstablish()` and release them in
`onDispose()`. Not in the constructor, `setProperties()`, `build()` or
`render()`.

**Why.** The constructor and `setProperties()` run for every rebuild's
throwaway twin; `build()` and `render()` rerun whenever their inputs change
- each would add another listener, never removed. `onEstablish()` runs once
for the established component (built for the first time, or `establish()`d
by its owner), and `onDispose()` once when it's dropped for good. For what
should only be active while the component is on screen, use `onShow()`/
`onHide()` - a page switched away from is hidden, not disposed.

```js
onEstablish() {
  super.onEstablish();
  const keys = (event) => { if ((event.ctrlKey || event.metaKey) && event.key === "s") { event.preventDefault(); this.save(); } };
  document.addEventListener("keydown", keys, true);
  this.unobservable.removeKeys = () => document.removeEventListener("keydown", keys, true);
}
onDispose() {
  if (this.unobservable.removeKeys) this.unobservable.removeKeys();
  super.onDispose();
}
```

## 11.26 Smaller rules

- `inherit()` only works once the component has entered the tree - not in a
  constructor, `setProperties()` or `initialState()` (it throws "not in the
  tree yet").
- In `onShow()`/`onHide()`, wrap reads in `withoutRecording()`: they run
  inside whoever is rendering, and would become that render's dependencies.
- Use `observable` from `@liquefy/cascade.component` for app models, so they
  live in the components' world (see [9.1](09-reactivity.md#91-worlds)).
  An object from another world is invisible to it: changing it rerenders
  nothing.
- `frozen()` freezes in place: mutating frozen data later throws - also the
  copy of it that lives in your store. Hand a component a copy, or replace
  data instead of changing it.
- The default `setProperties()` assigns every property onto the component:
  a property named like a method or a field Component uses (`build`,
  `render`, `provide`, `key`, `creator`, `currentBuild`, `renderContext`)
  overwrites it. Rename it, or override `setProperties()`.
- cascade.dom's `button` (the HTML tag) and cascade.ui's `button` (the
  themed widget) are different things. The tag takes no loose function -
  `button("Save", fn)` throws ("Don't know what to do with a child that is a
  function"); give it `onclick`. Import the tag under another name
  (`button as htmlButton`) when you use both.
- Raw content shown on an overlay frame (`overlayContent`) needs
  `pointerEvents: "auto"`: the frame's modal sub-frame sets
  `pointerEvents: "none"` on itself so clicks pass through what nothing
  uses, and that is inherited. cascade.ui's `modal`, `modalBackdrop` and
  `dialog` already set it.
- `flush()` can oscillate; make sure corrections converge (11.21).
- What must look right at first paint - layout across screen sizes - belongs
  in CSS (media queries, flex wrapping). Layout decided from measurements
  happens only once the app runs: a prerendered page shows the desktop
  layout first, then jumps.
- An error thrown from `build()` or `render()` is annotated with the
  component path (`"in Editor.build() (App › Workspace › Editor)"`); DOM
  elements carry a debug `id` naming the components that produced them.
