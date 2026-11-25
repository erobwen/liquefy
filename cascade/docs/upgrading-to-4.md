# Upgrading to Cascade 4.0

Cascade 4.0.0 changes how metadata is kept beside observables, and renames a
component's non-reactive bookkeeping from "unobservable" to "plain". Every
cascade package is 4.0.0 and expects the others at `^4.0.0`, so upgrade them
together:

```console
npm install @liquefy/cascade.reactive@4 @liquefy/cascade.component@4 @liquefy/cascade.dom@4 @liquefy/cascade.ui@4
```

(and `cascade.print`, `cascade.ui.material`, `cascade.prerender` if you use
them).

## Metadata: meta(), plainMeta() and innerMeta()

In 3.x, `meta(object)` returned cascade's own bookkeeping object, and
`metaData(object, name)` made a plain object under a name of your own in it.
In 4.0 your metadata and cascade's are kept apart:

| 4.0 | What it is |
|---|---|
| `meta(object)` | An **observable** record about the object |
| `meta(object, property)` | An observable record about one property (as in 3.x) |
| `plainMeta(object)` | A **plain** record about the object - not observed |
| `plainMeta(object, property)` | A plain record about one property |
| `innerMeta(object)` | Cascade's own bookkeeping: `id`, `target`, `handler`, `proxy` ... For reading |

All records are empty until something is put in them, made the first time
they are asked for, and the same ever after. Cascade decides no field of
them, and no name in them is reserved.

What to change:

| 3.x | 4.0 |
|---|---|
| `meta(object).id` (keys, debugging) | `innerMeta(object).id` |
| `meta(object).handler`, `.target`, `.proxy` ... | `innerMeta(object).handler` ... |
| `meta(object).yourField = ...` (your own bookkeeping) | `plainMeta(object).yourField = ...` - or `meta(object)` if the UI should react to it |
| `metaData(object, name)` | `plainMeta(object)[name]` (create it if missing), or `meta(object)[name]` if observed |
| `metaData(object)` | `plainMeta(object)` |
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

## Components: unobservable becomes plain

| 3.x | 4.0 |
|---|---|
| `this.unobservable` | `this.plain` |
| `initialUnobservables()` | `initialPlain()` |

`this.plain` is the component's `plainMeta(this)`. The reserved names
(`repeater`, `buildRepeater`, `renderTarget` ...) are the same as before.

A search and replace does it: `.unobservable` → `.plain`, and
`initialUnobservables` → `initialPlain`.
