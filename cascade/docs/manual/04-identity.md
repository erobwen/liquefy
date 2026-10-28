# 4. Identity: keys and pattern matching

When a build runs again, it constructs all its children anew - `new Item(...)`
really does construct a new object. Then what it constructed is matched to
what it constructed the previous time, so that the same component stays the
same component - state, DOM elements, build repeater and all. The new
object is a throwaway: its properties are copied onto the established
component it was matched to, and the established one takes its place in
the result. Two mechanisms do the matching:

**Pattern matching** (no key): a component constructed in the same place as
before - the same property of the same parent, the same position among its
siblings - and of the same class (for a DOM element, the same tag) is the
one from before. Static structure needs no keys.

**Keys**: for what can **move, appear or disappear** among its siblings - the
items of a list. Among an array's children, unkeyed ones are paired in order,
skipping the keyed ones; an item inserted at the front would otherwise be
matched to what used to be first.

```js
build() {
  return ul(this.items.map((item) => li({ key: item.id }, text(item.name))));
}
```

Also key:

- a component built but not shown (`.showIf(false)` leaves nothing in the
  result to match against);
- two components of the same class taking turns in the same place (without
  keys, the second carries on as the first, with the first's state);
- a component referred to from outside the build result (a closure, an
  unobservable) - after a pattern match those references point to the
  discarded twin; a key makes the constructor return the established instance
  itself.

Everything else - the fixed layout of a page, a toolbar's buttons, the parts
of a card - should go without keys. Keys on static structure are noise, and
since they are unique across a whole build (4.1), they get in the way.

A child left out - `cond ? child : null`, or `.showIf(false)` - still holds
its place: the unkeyed siblings after it are matched as if it were there. So
the siblings of a conditional child need no keys. This works because the
`null` (or `false`) stays in the list. Leaving the child out in a way that
removes the slot - `[...(cond ? [child] : []), next]`, or
`.filter(Boolean)` - shifts `next` onto the left-out child's place, and it
takes over that one's state.

## What "the same place" means

A place is a path from what `build()` returned: a property of a component
this build constructed, and for an array, a position in it. Only components
this build constructed take part - what it was handed from outside (its own
`children`, a model, an owned component) keeps its identity anyway.

```js
// frame, toolbar, title, body, PageA, PageB: components of your own.
build() {
  return frame({
    header: toolbar(...),            // matched as frame's "header"
    content: this.page === "a"       // matched as frame's "content":
      ? new PageA()                  //   a different class is a new component
      : new PageB(),
    children: [title(), null, body()],  // matched by position; null holds one
  });
}
```

What goes wrong without a match, concretely:

- **A different class in the same place** is a new component. The old one is
  disposed (its state gone, its elements removed), and the new one starts
  from its `initialState()`. A key doesn't change that: a key constructed as
  another class is a replacement, not the same component.
- **Unkeyed items, one inserted at the front**: the new first item is
  matched to the old first, the old first to the old second, and so on. The
  text on screen is right (properties are copied over), but every item's
  state and element belong to the position, not the item - an expanded
  row stays expanded at that position while its content changes.
- **Same class taking turns, no keys**: `editing ? new Field({ value: a }) :
  new Field({ value: b })` is one `Field` with its properties switched; its
  state (what the user did with the first) stays.

## 4.1 Keys are unique across a whole build

Keys are unique across *everything one `build()` constructs*, not just among
siblings. That is what lets a keyed component move to another parent within
the build and stay the same component. A duplicate throws an error naming
both components. Consequence: a helper that builds keyed structure can't be
used twice in one build. Drop the inner keys (static structure is matched by
pattern anyway), or make the helper a component of its own - every
component's build has keys of its own, and `view()` makes one from the
function as it is (see [5.2](05-callbacks-and-frozen.md#52-viewname-build-methods)).
See also [10.7](10-pitfalls-and-rules.md#107-keys-are-unique-across-everything-one-build-constructs).

Keys are strings (a number given as the implicit key becomes one). Use
something stable from the data - an id, not the item's index, which moves
with insertions just as pattern matching does.

## 4.2 A dropped keyed child is gone for good

If a build does not construct a given key on some run, that key's component
is disposed - permanently. Constructed again later, it is a brand-new
instance with fresh `initialState()` defaults. Guarding construction with an
`if` is choosing to let identity and state lapse. The same goes for an
unkeyed child whose place is empty for a run.

To keep a child alive across such a toggle:

1. **Construct it every run, and hide it with `.showIf()`**:
   ```js
   new Tally({ key: "first", label: "First" }).showIf(this.tab === "first"),
   new Tally({ key: "second", label: "Second" }).showIf(this.tab === "second"),
   ```
   The hidden one is not rendered (its elements are removed), but it is
   still constructed, so its key keeps it alive, with its state and its own
   built children.
2. **Own it** (see [3.8](03-components.md#38-components-you-own-created-outside-build)).

## 4.3 What happens to a matched component

A matched component (by key or by pattern) is merged into the established
one: its properties copied over, its state never. A property that is the
same as before (identical, or equal `frozen()` data) changes nothing; one
that differs invalidates exactly what read it - the component's own build or
render, typically - so a matched child whose properties didn't change isn't
rebuilt or rendered again at all.

The matching reads the new build without recording dependencies and
compares it with a plain-data snapshot of the previous build. When a
component is constructed with a key that its creator's previous build also
constructed (as the same class), the constructor returns the established
instance itself; with pattern matching the constructor returns the
throwaway, and only references inside the build's result are replaced by the
established one afterwards. That is the reason for the third "also key"
case above.

If unkeyed children ever lose their state or elements across rebuilds,
check that the structure really is the same - same class, same tag, same
place, nothing shifted - before adding keys.
