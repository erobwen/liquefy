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
4. [Identity: keys and pattern matching](04-identity.md)
5. [Callbacks, view() and frozen()](05-callbacks-and-frozen.md)
6. [Context: provide(), inherit(), render target and render context](06-context.md)
7. [Services and hydration](07-services-and-hydration.md)
8. [Reactivity in depth](08-reactivity.md)
9. [DOM specifics and UI widgets](09-dom-and-ui.md)
10. [Pitfalls and rules](10-pitfalls-and-rules.md)
11. [API reference](11-api-reference.md)

---
