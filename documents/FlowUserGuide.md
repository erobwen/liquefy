# Flow User Guide

Flow is a framework for reactive and recursive component composition. This document is intended to describe how to use Flow, and its core concepts. 

For more specific details on how to use Flow with HTML and UI-Basic, see [this](./HTMLAndUiThemedGuide.md) document.

## Table of Contents

1. [Hello World](#hello-world)
2. [Basic state example](#basic-state-example)
2. [Flow Core Concepts](#flow-core-concepts)
3. [Standardized flow parameters](#standardized-flow-parameters)

# Hello World

A simple hello world application is as follows: 

```js
class HelloWorld extends @liquefy/flow.core.Component {
    render() {
        return (
            div(
                h1("Hello World Flow"),
                span("by Robert Renbris", {style: {color: "green"}})
            )
        )
    }
}

const application = new HelloWorld();
new DOMRenderContext(document.getElementById("root")).render(application);
```

This showcases the HTML-in-JS approach of Flow. Your DOM/document is reactivley and programmatically created by Javascript functions. 

# Basic state example

To make it a little bit more interesting let us introduce state. This example shows both global state, and state within a component.

```js
const globalState = model(
    {
        value: 0
    }
)

class StateComponent extends @liquefy/flow.core.Component {
    initialize() {
        this.componentState = 0
    }

    render() {
        return (
            div(
                span(`Global state: ${globalState.value}`),
                br(),
                span(`Component state: ${this.componentState}`),
            )
        )
    }
}

const application = new StateComponent();
new DOMRenderContext(document.getElementById("root")).render(application);

setTimeout(() => {
    globalState.value = 42
}, 1000)

setTimeout(() => {
    application.componentState = 42
}, 2000)
```

Expected result is to see the two valeus change to 42 within 2 seconds. Normally, a component would manipulate its own state through callbacks, buttons etc. But this demonstrate an important feature of Flow, namley that a component can read any state, and that any state can be manipulated directly from any part of the code as long as there is a reference to the state object. This is at least what the framework allows for. 


# Flow Core Concepts

Important concepts to understand when using Flow are:

* **Auto observation**
* Reactive recursive component composition
    *   **Single render function** / **render merge**
    *   **Re-render component matching**, through **keys** and **pattern matching**
    *   **Resident components, allowing for custom component lifecycle**
* Component creation using **constructor** or **factory function**   
    * **Compact parameter lists**
    * **Standardized properties object**
    * Helper functions that creates properties objects out of compact parameter lists.


## Auto Observation
Flow is built on JS Proxies that are used to detect any change in your data, component or its state, as long as you have created your data with the `model()` function. 

```js
const myModel = model({
    myData: 1
    myDataObject: model(object) 
})
```

Given the data above, Flow will auto detect direct manipulations like: 

```js
myModel.myData = 42;
```

***Any component can detect changes in any such data on a global level, so there is no restriction on what component can read what data. For example a parent component could direct manipulate the data or state of a child component and vice versa. There is at least no technical limitation in doing so.***

Alternativley you can `model(object, true)` to recursivley create models out of a data structure, with just one model call. Auto observation is the nuclear option of state management. As long as the programmer remembers to use the `model()` function correctly to wrap all data, there is no possible way that cache and component invalidation can go wrong. 

### Avoiding auto obervation for large data analysis
The Flow auto invalidation works with surgical precision, and invalidates only what needs to be invalidated, no more no less. But this automated model comes with an overhead cost. If you have data models with object counts in the thousands, and components that reads hundreds of properties from such objects while rendering, the system will explicitly store hundreds of thousands data dependencies. So for large data analysis, you should avoid using model() for all data, but instead just read/write a version number of said data. I.e. 

```js
model({
    version: 1
    largeData: {...largeDataSet} 
})
```

For this solution to work, you can no longer direct manipulate data in the largeDataSet, without also updating the version number. But for the typical user interface that anyway displays at most a couple of hundred items, auto observation will give you good result.

## Recursive Reactive object composition
When dependencies change, a component will automatically rerender by running its ***single render function***. This process will create new uninitialized child components, some of which are recreations of child components from a previous render, some of which are new. After the render, Flow will then perform a ***rerender merge***, where the state and component identities of the previous render are preserved, but where changes from the new render are included. 

> Joke: How would a Javascript programmer re-paint a car from red to green? He would first build a totally new car that is already green from the start. He would then scrape the color from the green car, and use it to replace the color of the red car. Then he would simply throw away the new car that he just built, and keep the old car that contains all of his items.  

* The built data structures are compared to what was built when render was run last time, and objects from the previous render will be matched against objects in the current render, in a process called **Rerender object matching**.

* There are two ways for Flow to do rerender object matching. 
    * The most powerful way is to use ***keys***. When a child component is built, it is given a key, essentially a string, that is used for rerender object matching. ***With keys, a component can move anywhere in the component structure while maintaining its identity when its parent rerender***. (This is an important difference to React that only uses keys within one specific sequence).

    * Secondarily, Flow uses **data structure pattern matching**, starting from the return value of the render function, and any object built using key. So often, your app will work as intended even without keys. 

* Object properties from an object in the new render will be copied to the corresponding object of the old render, without overwriting the state properties of the object in the old render, thus preserving state of established objects. 

This is similar in spirit to React and the virtual DOM, but works for any data structure. But this also means that on every rerender, there will be a lot of throw-away components left for the garbage collector, for this reason expensive intitalization of any component, needs to take place in very specific lifecycle methods. If the rerender of one component, changes the properties of a child component, it will trigger that component to rerender as well, but only if those properties were actually read during its render. 

### onEstablish, onDispose and setState
The first time a child component is built, it will receive an `onEstablished` message that in turn will call `setState` that the application code can override to setup state. Conversley when the child component is not rebuilt anymore, it will receive an `onDispose` event. 

### Rerender merge and component properties
During rerender merge, Flow uses the equivalent to `Object.assign(establishedObject, newlyCreatedObject)`. So in order to maintain state of your established component, your state properties cannot be set during construction or the default value will overwrite the changed state! So make sure to initialize your state properties ONLY in `initialize()`

### Identity consistency when using keys
When you use a ***key*** to render a child component, Flow in actuality takes it a step further. At the moment such an object is created, it assumes the object identity that was previously associated with that key, but with a new temporary state, that reflects the current render. This means that inside your render function you could set a global variable refering to your component, and it would be the correct reference even after the render function finishes. This however does not work for components that are matched with a component in a previous render through pattern matching, for obvious reasons.   

### Resident components
A component typically renders all of its child components in its render function. But Flow also makes it possible to render components globally or during component initialization. Such components can be used in the render function of a component. Resident components have the following advantages:

* A resident component will not be rebuilt whenever its parent rerenders, saving resources.
* A resident component can maintain its state even if it is temporarily not a part of its parent render.

Resident components are excellent for making tab-panels, where each tab can maintain its state even when off-screen.

### Component Lifecycle Functions

To control rendering and rerendering of components it is important to know the lifecycle functions of a Flow component. They are as follows:

* **render**: The main function that reactivley renders the component and its child components based on parameters, state and data models. The render function will automatically re-run on any auto detected change. The render function should return whatever this component renders into, either other components or primitive components.

* **setProperties**: This is where the properties are set on a component. This is where you can set default values for properties. Note that this object might be thrown away, so don´t do any expensive initialization in the setProperties function! Also, **do not** set any default value for local state! The parameter list contains just one standardized properties object.

* **setState**: a lifecycle function where we know the component will actually become established. This is the place where you sould set default values for local state, and obtain external resources such as data requests. No parameter list. 

* **constructor**. Typically you should not override the constructor of a component. The constructor however will handle its parameters in a standardized way, so you can easily pick up the information you need in the other lifecycle functions.
  
### Custom Reactivity

Flow is a reactive framework based on causality (similar to MobX). If a component might want to do an expensive computation reactivley, you can use the `ensure` function to create a repeater that will continously evaluate something. 

```js
  initialize() {
    this.data = dataFromSomewhere;
    this.ensure(() => {
      this.computationResult = this.expensiveComputation(this.data);
    });
  }
```

Whenever any data read by expensiveComputation, or the lambda sent to ensure, the ensure lambda will run again, ensuring that computationResult will allways be updated correctly. By default, the ensure will be executed in `updateModelTime`, before any component starts to rerender. 

# Standardized component parameters

An important part of Flow is to keep syntax lean and efficient. We want to write as little code as possible for our apps, so here we shall discuss various ways in how to keep the code lean. 

### Constructor directly or factory function
Using "this" every time we create a component can clutter expressions like:

```js
new Div(new Span("one"), new Span("two"), new Span("thee"))
```

So we want a more sleek syntax like: 

```js
div(span("one"), span("two"), span("thee"))
```

So what we do is typically to create a factory function for each component.

```js
  const myComponent = (...parameters) => new MyComponent(toPropertiesWithChildren(parameters))
  class MyComponent extends @liquefy/flow.core.Component { ... }
```
 
A good convention could be to use factory functions for less significant layout components, and constructor for more substantial application components.

```js
div(
    row(
        new MyDataForm()
    )
)
```

### Compact parameter lists to standardized property object
A very important aspect of how to work with flow and Javascript first effectivley, is to be able to create ***compact parameter lists*** to the constructor and the factory functions. We want to be able to write really compact syntax like: 

```js
button("Click to activate", () =>  { this.active = true }, {style: {color: "green"}});
```
Such a parameter list will then be translated into a single standardized properties object that will be used for component initialization. 

```js
const properties = {
    key: "Click to activate",
    label: text("Click to activate"),
    onClick: () =>  { this.active = true },
    style: {color: "green"}
}
```

Using compact parameter lists however is allways optional, and it is always possible to just use a properties object instead, like `button(properties);`

### Compact parameter list standard forms

The compact parameter list follows a number of conventions.
* If the first argument is a string starting on a lower-case letter, it is the key. 
* The parameter list could contain at most one plain javascript object, which is then considered to be the ***properties object***.
* The parameter list could contain at most one plain Javascript Array, which is then considered to be the ***parameterContent***
* If there is no plain Javascript array in the parameter list, the **parameterContent** is instead made up by elements found directly in the parameter list of the type Component, strings, numbers and functions. 

The ***parameterContent*** is often but not allways the same as the ***children*** of a component.  

Here are a few examples of what a compact parameter list could look like: 

```js
  myComponent("key", {...properties}, [...content])
  myComponent("key", {...properties}, ...content)
  myComponent("key", "ContentA", 1, () => foo(), new MyComponent(), {...properties})
  myComponent("key", {...properties}, "ContentA", 1, () => foo(), new MyComponent())
  myComponent("ContentA", () => foo(), {...properties})
```

### Explicit properties objects

But remember you can allways just create a component using one single properties object. This makes your code less compact, but more explicit which could have its use.

```js
  myComponent({key: "key", componentContent: [...content], ...properties})
```

Or for components that consumes a children array, you can do similarly: 

```js
  myComponent({key: "key", children: [...childComponents], ...properties})
```

### Implicit keys

Normally, a key is detected by being lowercase and first in a parameter list. 

```js
someComponent("some-key", ...parameters)
```
It should be noted that some component uses a label as an implicit key if no key is given. For example: 

```js
textInputField("Name", traveler, "name") // "Name" is implicit key

//or 

textInputField("explicit-key", "Name", traveler, "name")
```

In the first case above, "Name" is the label, but it will also double as a key. The same won´t work for buttons however, since the text of buttons often change depending on state, thus a more explicit key is needed. 

```js
button("add-button", "Add", () => { this.counter++ })
```

### Compact parameter list helper functions

To deal with compact parameter lists, there are a number of available helper functions, and for specific purposes, new such functions can be implemented depending on the needs. These are commonly used by various components: 

 * `toProperties`
 * `toPropertiesWithChildren`,

Everything starts with **toProperties** that is applied to a parameter list. That will result in a properties object of the following structure: 

```js
{
   properties: Object, 
   componentContents: Array<number|string|Component|function>,
   key: string
}
```
**toPropertiesWithChildren** will analyze the contents one step further, and return a properties object with the following structure: 

```js
{
   properties: Object, 
   children: Array<Component>,
   key: string
}
```

If these helper functions encounter a parameter list with only one single properties object, it will simply return that properties object. This is important because it makes these helper functions chainable and you can apply them to argument lists that have already been processed. 



