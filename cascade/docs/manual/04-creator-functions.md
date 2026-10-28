# 4. Creator functions and argument lists

Almost everything in a `build()` is made by calling a function: `div()`,
`button()`, `row()`, `text()`, `flipAnimationContainer()` - or a constructor,
`new Card()`. These are *creator functions*, and they all read their
arguments the same way: **by type and position, not by name**. Pass a plain
object and it's the properties. Pass components, strings and numbers and
they're the children. Pass a lowercase word first and it's the key. Pass a
function to a button and it's what the button does.

```js
row(
  { style: { gap: "8px" } },
  "toolbar",                                   // the key
  button(text("Save"), () => this.save()),     // label, and what it does
  button("cancel", () => this.close()),        // key "cancel", labelled "Cancel"
  this.items.map((item) => listItem({ key: item.id }, text(item.name))),
)
```

Nothing in it is named that doesn't need to be. That is the point of the
convention: a build reads as the thing it makes, with no `children:`,
`onClick:` or `key:` clutter in the common cases - and every property still
available, by name, when you want it. This chapter is the whole set of
rules: the parsing every creator function shares (4.1-4.5), what each
family adds on top (4.6), and how to write your own (4.7).

The shared parsing is `toPropertiesWithChildren(argumentList)` in
cascade.component (`src/implicitProperties.js`). `Component`'s own
constructor runs it, so the rules hold for `new MyComponent(...)` as much as
for `div(...)`.

## 4.1 What each argument means

Each argument is sorted by what it is:

| Argument | Becomes |
|---|---|
| A plain object (`{ ... }`) | **The properties.** At most one, anywhere in the list. |
| A component (or any observable object) | A **child**. |
| A string or number | A **child** - or, as the first loose argument, possibly **the key** (4.4). |
| An array | Its elements, as **children**, flattened however deeply nested. |
| `null`, `undefined`, `false` | **Nothing** - but it holds its place among the children (4.3). |
| A function | Taken by a button-like creator as **`onClick`** (4.5); a child anywhere else - which throws. |
| `true` | Throws. |

```js
div({ style: { padding: "8px" } }, header, body)   // properties, two children
div(header, { style: { padding: "8px" } }, body)   // the same: the object may be anywhere
div(header, [body, footer])                        // three children
div(header, isOpen ? body : null, footer)          // body's place is held while closed
```

## 4.2 The properties object

- **One, anywhere.** A second plain object throws: *"Cannot have two
  properties objects in one argument list"*. A plain object is one that isn't
  an array and isn't observable: a component, or a model made with
  `observable()`, is a child, never the properties.
- **Copied, never used as is.** The creator takes things out of it (`key`,
  the children), so it works on a copy: you may pass the same object to
  several calls, keep it in a constant, or `frozen()` it.
- **Named versions of everything.** Whatever the loose arguments mean, the
  properties can say it by name: `key`, `children`, `onClick`. Giving one both
  ways throws - *"Cannot define key both explicitly and implicitly"*,
  *"Children both implicitly defined as loose arguments, but also explicitly in
  properties"*, *"onClick given both loosely and in properties"*.
- **Any key given is a key** - an id of `0` too, or `""`. Only `undefined`
  or `null` means no key. Keys are matched as strings: `0` and `"0"` are the
  same key.
- **A single properties object** is the fast path: `new Card({ key, title,
  children })` - copied, and that's all.

What a property *means* is up to whoever receives it: an HTML element turns
its properties into attributes, element properties and styles (4.6); a
component of your own gets them in `setProperties()`
([3.2](03-components.md#32-properties)).

## 4.3 Children

Everything loose that isn't the properties, the key or a button's function
is a child, in the order given.

- **Arrays are flattened**, however deeply: `ul(header, items.map(row))` is
  one flat list of children, and so is a helper's `...children` handed on as
  one array. Nothing is meant by the nesting.
- **`null`, `undefined` and `false` hold a place.** They render nothing, but
  they keep the children after them where they are: `div(a, open ? b : null,
  c)` has `c` third whether `b` is there or not. That matters because unkeyed
  children are matched to last build's by position
  ([5](05-identity.md#5-identity-keys-and-pattern-matching)) - if `c` moved up
  a place when `b` disappeared, it would be matched with what `b` was, and
  take over its state and element. Trailing ones hold nothing for anyone and
  are dropped. This is what `component.showIf(condition)` relies on: it
  returns the component, or `null`.
- **A string or number child** is passed on as it is. An HTML element turns
  it into a text node; a component of your own gets the string in its
  `children` and decides what it means.
- **Anything else throws**, naming the build it happened in: *"Don't know what
  to do with a child that is boolean true"*, *"... that is a function"*. Watch
  for values that only look like booleans: `count && badge()` with `count`
  being `0` passes the number `0` - a child "0", or, first in the list, the
  key `"0"`. Write `count > 0 ? badge() : null`.

## 4.4 The implicit key

**The first loose argument is the key if it is a number, or a string that
starts with a lowercase letter `a`-`z`.** It is taken out of the children and
becomes `properties.key`, as a string.

| Call | Key | Children |
|---|---|---|
| `div("header", a, "Hello")` | `"header"` | `a`, `"Hello"` |
| `div("Hello", a)` | none | `"Hello"`, `a` |
| `div(42)` | `"42"` | none |
| `div(0, a)` | `"0"` | `a` |
| `div("_private", a)` | none | `"_private"`, `a` |
| `div("4th of July")` | none | `"4th of July"` |
| `div(null, "header", a)` | `"header"` | `null`, `a` |
| `div(a, "later")` | none | `a`, `"later"` |
| `div([a], "header")` | none | `a`, `"header"` |

Read precisely:

- **First loose argument** - the first child-like argument given loosely.
  The properties object doesn't count, and neither does a leading `null` or
  `undefined` (so `cond ? x : null` in front doesn't change the key). A
  component, a function, a `false` or an array that comes first means there
  is no implicit key: `div(a, "later")` and `div([a], "header")` take the
  string as text.
- **Starts with a lowercase letter** - `/[a-z]/` on the first character.
  Uppercase, digits, `_`, `$`, spaces and anything else first make it text.
  So `div("Save")` is a div saying "Save", and `div("save")` an empty div keyed
  "save".
- **A number is always a key** when first - `0` included.
- **A key with whitespace in it warns**, once per key: *"... became a key ...,
  not text: a leading lowercase string is a key. Wrap text in text(...)."* It
  was almost certainly meant as text. A key without whitespace gives no
  warning at all.

This is the convention's sharpest edge, and it is deliberate - carried over
from Flow - because keys are what lists need, and lists are everywhere.
The danger is **text that comes from data**: `li(item.name)` is fine for
"Apple" and a key for "apple"; `td(row.count)` is an empty cell keyed by the
count. The rule is simple:

- **Text from data, or any text you aren't writing out literally: wrap it in
  `text()`.** `text()` is a component, so it is never a key:
  `li(text(item.name))`, `td(text(row.count))`.
- **A literal label in your own code** may be loose if it starts with a
  capital: `div("Total")`. Wrapping it in `text()` anyway is never wrong.
- **Keys from data: give them by name** when they aren't lowercase words:
  `li({ key: item.id }, text(item.name))`.

When a component needs a key at all is chapter
[5](05-identity.md#5-identity-keys-and-pattern-matching)'s subject: only what
can move, appear or disappear among its siblings.

## 4.5 Functions: what a button does

Button-like widgets take **a loose function, anywhere in the list, as their
`onClick`**. That's why a button never needs its handler named:

```js
button(text("Save"), () => this.save())
button(() => this.save(), text("Save"))          // the same
button({ variant: "filled" }, text("Save"), callback("save", () => this.save()))
```

- It applies to cascade.ui's `button()`, `iconButton()` and `listItem()`
  (all three parse with `toButtonProperties()`).
- **One function only.** Two throw (*"only one loose onClick function
  allowed"*), and so does a loose one alongside `onClick` in the properties.
- Pass a `callback(key, fn)` rather than a fresh closure where it matters -
  a fresh closure is a new value every build, so the button's properties
  change every build ([6.1](06-callbacks-and-frozen.md#61-callbackkey-fn)). A
  plain closure is fine in a quick prototype.
- **A button with a key and nothing to show labels itself** with its key, as
  words: `button("save", fn)` says "Save", `button("openDialog", fn)` "Open
  dialog", `button("add-item", fn)` "Add item" (`keyAsLabel()` in cascade.ui).
  So the shortest button is a word and a function. (`button()` only -
  not `iconButton()` or `listItem()`.)
- Mind the order: the key is only the *first* loose argument. In
  `button(() => go(), "next")` the function comes first, so `"next"` is a
  child - the label "next", in lowercase.

Everywhere else a function is a child, and throws. HTML elements take their
handlers as properties, by their DOM names - `onclick`, `oninput`,
`onkeydown` (any case: `onClick` is lowercased to `onclick`) - and so do the
other widgets: `textField({ onInput })`, `checkbox({ onChange })`,
`tabBar({ onSelect })`. cascade.dom's own HTML `button()` (often imported as
`htmlButton`) is an HTML tag like any other: `htmlButton({ onclick }, ...)`,
no loose function.

## 4.6 The families of creator functions

All of them parse their arguments as above; each family then adds a little.

**HTML tags** (cascade.dom) - `div()`, `span()`, `input()`, ... and
`element(tagName, ...)` for any other tag. The properties become the
element's attributes, element properties and style; loose strings and
numbers become text nodes; `br()` takes no children. All of it is in
[10.1](10-dom-and-ui.md#101-html-tag-functions). Each tag function asks the
service locator for its element, so a theme can decide what a `div` is
([8.1](08-services-and-hydration.md#81-locators-and-queries)).

**`text()`** (cascade.dom) has a small convention of its own, since what it
holds *is* a string: the first argument, if a string or number, is always the
text - never a key, whatever its first letter - and an object gives the rest.

```js
text("apple")                      // the text "apple"
text(42)                           // "42"
text("Total", { key: "total" })    // keyed - the same node patched when its text changes
text({ key: "total", text: "Total" })
```

**Layout helpers** (cascade.ui) - `row()`, `column()`, `center()`,
`middle()`, `centerMiddle()`, `filler()`, `wrapper()` - are `div()`s with a
default style. The style you give is merged over the default, so
`row({ style: { gap: "8px" } }, ...)` is a flex row with a gap, and
`row({ style: { flexDirection: "column" } })` would be a column.

**Widgets** (cascade.ui) fall into three groups:

| Widgets | Arguments |
|---|---|
| `button`, `iconButton`, `listItem` | As a button: a loose function is `onClick` (4.5); `button` labels itself with its key. |
| `card`, `controlPanel`, `alert`, `dialog` | Properties and children, as an element. |
| `icon`, `textField`, `checkbox`, `colorField`, `tabBar` | Properties only - given by name. |

The last group has no children to speak of, and nothing positional but the
key. So `icon("info")` is an icon *keyed* "info", with no name - write
`icon({ name: "info" })`. Each widget's properties are listed in
[10.7](10-dom-and-ui.md#107-cascadeui-widgets).

**DOM components** (cascade.dom) - `flipAnimationContainer()`, `portal()`,
`portalSource()`, `elementBoundsProvider()`, `providingElement()`, ... -
parse as an element does: `flipAnimationContainer({ confine: true },
...items)`.

**Your own components** - `new Card(...)` - parse the same way, in
`Component`'s constructor, before `setProperties()` gets the result. So do the
classes `view()` makes ([6.2](06-callbacks-and-frozen.md#62-viewname-build-methods)).

## 4.7 Writing your own creator function

A creator function for a component of your own is one line:

```js
export const card = (...parameters) => new Card(...parameters);
```

It gets the whole convention for free: `card("summary", text("Total"))`,
`card({ title: "Summary" }, body)`.

For a function that makes something itself - a styled element, say - parse the
list first, with `toPropertiesWithChildren()` (cascade.component), and
complete the properties:

```js
import { toPropertiesWithChildren } from "@liquefy/cascade.component";

const panelStyle = { padding: "16px", borderRadius: "8px" };

export function panel(...parameters) {
  const properties = toPropertiesWithChildren(parameters);
  properties.style = { ...panelStyle, ...properties.style };   // the caller's style wins
  return div(properties);
}
```

For one that takes a loose function as its handler, use cascade.ui's
`toButtonProperties(parameters)` instead - it moves a loose function to
`onClick` before sorting out the children.

Keep to the convention, so your functions read like everyone else's:
properties in one object, children loose, a handler loose only where there
is one obvious thing to do. And call creator functions inside a `build()`:
that's where the component they make gets its creator, and its theme
([11.23](11-pitfalls-and-rules.md#1123-build-ui-with-the-factory-functions-inside-a-build)).
