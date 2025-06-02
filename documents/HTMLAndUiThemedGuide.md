# How to use

UI-themed is a dynamically themed ui module for Flow. It has the capability of changing theme while running the app, changing widgets etc. The theme change works on a component level, meaning it is not only styling that is influenced, but the behavior can be influenced also. For this to work, @liquefy/ui-themed defines a set of components and their corresponding compact parameter lists. 


# Text

To create a basic text node, for example to use inside a div or a button, you can use the text() funciton. 

```js
text("Some Text")
```

# Proper Callbacks

In Javascript every created function is unique, and a callback given to a child component will be a new function even if it is functionally the same. This will cause child components to rebuild unecessarily. To provide optimization for this, Flow provides a way to wrap a callback in an object with a key that can maintain its identity upon rebuild. This is an example of how it is used:

```js
callback("callback-key", () => action());
```

In properly optimized code, this should be used over using just `() => action()`, but in many examples throughout Flow, you will see the more simple kind as well for simplicity.


# Button

The `button()` factory function is used to create buttons. The properties object is of the following form: 

```js
export interface ButtonProperties {
    onClick: () => void
    children: Array<Component>;
    ...moreHTMLElementProperties
}
```

For example

```js
button({
  onClick: () => action(), 
  children: [text("Click Me")]}
);
```
## Compact parameter list for button

But for more sleek button creation, use its compact parameter list, such as:

```js
button("Click Me", () => action());
```

The onClick function can be anywhere in the component contents, either directly in the parameter list or in an explicit componentContent list.
To efficiently create a text node child of your button, simply place a text in the component content and it will automatically create a text node, **but make sure it is not lower case and at the first position, because then it will be interpreted as a key***. 

Examples: 
```js
button("Label", () => action()) // This button has no key!
button("button-key", "Label", () => action())
button("button-key", () => action(), "Label")
button("button-key", div() () => action(), "Label")
button(["lowercase button label"], () => action(), {key: "button-key"})
button("button-key", div(h1(text("some text node"))), () => action()) // Button with HTML content
button("button-key", new ButtonContent(), () => action()) // Custom component as content
```

Note: For textInputs we will use a single label as a standin for key if a key is not given. This trick do not work reliably for buttons, as it is common to have the text of buttons change depending on state. 