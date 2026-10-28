# Cascade: User Guide and Reference Manual

This manual is for developers who know JavaScript and a reactive UI framework
(React, MobX, signals) and want to build applications with Cascade. It covers
the four core packages:

| Package | What it is |
|---|---|
| `@liquefy/cascade.reactive` | Temporal signals: observables, repeaters, pipelines, retraction |
| `@liquefy/cascade.component` | Components: build(), state, properties, keys, context, services |
| `@liquefy/cascade.dom` | Rendering onto the real DOM, HTML tag functions, measurement, animation, portals, routing |
| `@liquefy/cascade.ui` | Themed widgets, layout, overlays, modals, drawers, popovers, color schemes |

```console
npm install @liquefy/cascade.ui @liquefy/cascade.dom @liquefy/cascade.component @liquefy/cascade.reactive
```

Contents:

1. [Concepts](01-concepts.md)
2. [Setting up a project](02-project-setup.md)
3. [Components](03-components.md)
4. [Creator functions and argument lists](04-creator-functions.md)
5. [Identity: keys and pattern matching](05-identity.md)
6. [Callbacks, view() and frozen()](06-callbacks-and-frozen.md)
7. [Context: provide(), inherit(), render target and render context](07-context.md)
8. [Services and hydration](08-services-and-hydration.md)
9. [Reactivity in depth](09-reactivity.md)
10. [DOM specifics and UI widgets](10-dom-and-ui.md)
11. [Pitfalls and rules](11-pitfalls-and-rules.md)
12. [API reference](12-api-reference.md)

---
