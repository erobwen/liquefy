# Upgrading to Cascade 4.0

Cascade 4.0.0 changes how metadata is kept beside observables, and renames a
component's non-reactive bookkeeping from "unobservable" to "untracked". Every
cascade package is 4.0.0 and expects the others at `^4.0.0`, so upgrade them
together:

```console
npm install @liquefy/cascade.reactive@4 @liquefy/cascade.component@4 @liquefy/cascade.dom@4 @liquefy/cascade.ui@4
```

(and `cascade.print`, `cascade.ui.material`, `cascade.prerender` if you use
them).

## Metadata: meta(), untrackedMeta() and innerMeta()

In 3.x, `meta(object)` returned cascade's own bookkeeping object, and
`metaData(object, name)` made a plain object under a name of your own in it.
In 4.0 your metadata and cascade's are kept apart:

| 4.0 | What it is |
|---|---|
| `meta(object)` | An **observable** record about the object |
| `meta(object, property)` | An observable record about one property (as in 3.x) |
| `untrackedMeta(object)` | An **untracked** record about the object: a plain object, never observed |
| `untrackedMeta(object, property)` | An untracked record about one property |
| `innerMeta(object)` | Cascade's own bookkeeping: `id`, `target`, `handler`, `proxy` ... For reading |

All records are empty until something is put in them, made the first time
they are asked for, and the same ever after. Cascade decides no field of
them, and no name in them is reserved - except on a component, where
`untrackedMeta(component)` is `this.untracked` (below), and the names Component
keeps there itself are taken.

What to change:

| 3.x | 4.0 |
|---|---|
| `meta(object).id` (keys, debugging) | `innerMeta(object).id` |
| `meta(object).handler`, `.target`, `.proxy` ... | `innerMeta(object).handler` ... |
| `meta(object).yourField = ...` (your own bookkeeping) | `untrackedMeta(object).yourField = ...` - or `meta(object)` if the UI should react to it |
| `metaData(object, name)` | `untrackedMeta(object)[name]` (create it if missing), or `meta(object)[name]` if observed |
| `metaData(object)` | `untrackedMeta(object)` |
| `object.causality` | `innerMeta(object)` |

`meta(object, property)` is unchanged.

Note that `meta(object)` still works without an error, but now returns an
empty observable record: an old `meta(object).id` silently gives `undefined`.
Search your code for `meta(` with one argument.

## The dedicated properties have new names

The two properties an observable answers itself, instead of passing them on to
its target, have new default names, long enough that application data is
unlikely to use them:

| Option | 3.x default | 4.0 default |
|---|---|---|
| `objectMetaProperty` | `"causality"` | `"cascadeMetadataObject"` |
| `objectTimelinesProperty` | `"timelines"` | `"cascadeTimelinesObject"` |

Your data can now have fields called `causality` and `timelines`. Code that
read `object.causality` directly should use `innerMeta(object)`, which works
whatever the property is called. Using cascade.reactive on its own, you can
keep the old names by passing them to `getWorld()`.

## Prototype members are observed once per object (since 3.0.7)

If you come from a version before 3.0.7, and use cascade.reactive on its own
(hooks or diagnostics, not just components):

- A read that finds a method or getter on the prototype no longer gives that
  name a timeline of its own. All such reads of an object are observed
  together, so `onRemovedLastObserver(description, key)` can now also be
  called with `("prototypeDependees", null)`, when the last reader of any
  prototype member leaves the object. Don't assume that `key` is always a
  property name.
- For the same reason, an observer's `sources` shows inherited getters and
  methods as one entry, `{ description: "prototypeDependees", key: null }`,
  not one entry per name.

`onRemovedLastObserver` is now also called without recording. Taking an
observer down from inside another repeater no longer makes that repeater
observe the object, so you no longer need to wrap `dispose()` or
`retractRepeater()` in `withoutRecording()` for that reason.

## Components: unobservable becomes untracked

| 3.x | 4.0 |
|---|---|
| `this.unobservable` | `this.untracked` |
| `initialUnobservables()` | `initialUntracked()` |

`this.untracked` is the component's `untrackedMeta(this)`. The reserved names
(`repeater`, `buildRepeater`, `renderTarget` ...) are the same as before.

A search and replace does it: `.unobservable` → `.untracked`, and
`initialUnobservables` → `initialUntracked`.

A component can't be given a property named `untracked`: the constructor
throws, saying so.
