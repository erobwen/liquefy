Note: This is a compound repository where I experiment with Flow together with other tech, Flow will eventually move to a clean Flow repository with only Flow. 

# Flow - Reactive DOM Rendering and State Management


![Logotype](/resources/flow.PNG?raw=true "Flow Logotype")

* Composite component model. 
    * Allows you to build a user interface as a composite of components. Each component builds reactivley into a composite of other components or primitive components. 

* Minimal update dom rendering
    * Only render changes to the DOM (equivalent functionality to React).
    * Minimal component tree updated guaranteed, this means. 
        * No need to distinguish between pure and unpure components as in React. The component tree build mechanism of flow allways guarantees minimal updates even on the component level. 
    * Assignments that sets an object property to the same value as previously, do not cause updates, this is true for models, view models and components alike. 

* Integrated and automated state handling. 
    * Very simple, just call "model({...yourData})" to create model data. 
    * Based on ES6 Proxies that tracks all changes and dependencies (equivalent functionality to MobX). 
    * Safe model direct manipulation, your GUI will be automatically updated no matter how and when you update your model. This means: 
        * No need to notify flow of changes, as they will be detected automatically.
        * No need for observers, reducers, global data stores etc.  
    * Each model object can belong to a store, that gets notifications whenever objects in that store updates, and how they are uptaded. I.e. "model(yourData, store)"
    * Support for infered data that is automatically updated.
    * Data model transaction support. Changes done in a transaction will result in dom changes restricted to one single animation frame. 

* Sophisticated global transition animation support. 
    * Transition animations when components appear, dissapear or are moved accross your user interface. 
    * Easy to use, simply add property "animation: true" to your component. 
    * Fully configurable. 
    * Uses FLIP animation technique to make components move with animation to new locations anywhere on the screen.
    * Uses extra filler divs to make containers of animated objects animate their size as well when applicable.

* Javascript first principle.
    * Javascript code instead of configuration.
    * Javascript used for styling
    * Javascript code used for responsiveness. 
    * No dependency on template litterals, jsx, Typescript HTML files or CSS, just plain Javascript with direct DOM manipulation! 
    * Full reactive programmatic control over all aspects of your app. 

* Render to any medium using flow target independent flow components
    * With flow you typically build a structure of flow components, that typically render onto the DOM in a web browser.
    * However, your flow components are not hardly dependent on the DOM and the web browser.
        * A flow renders into flow primitives that in turn do the rendering onto the DOM.  
        * A flow renders into flow primitives made available by the flow target, but flows are not directly dependent on specific flow primitives.
        * The flow target acts as a service locator mechanism, or a dependency injector, creating a loose coupling between your flow components, and the flow primitives that perform the DOM rendering. 
        * You can build your custom flow target, with its own set of flow primitives that is provided to the flow rendered upon it. 
        * This means that you could theoretically render your flow components onto anything on any platform, as long as you have a flow target/flow-primitives that supports it.
    * You can use flow targets in recursive configurations as you wish. For example, inside a flow component, there can be a new flow target, that another flow component renders onto, etc. 
    * If you want to modify the existing dom rendering to support some missing feature? You can just overload DOMFlowTarget and related classes and do whatever changes you like. 

* Compliance with web component standards. 
    You can use Flow to use or to build webcomponents. For example, inside a web component definition, you can create a new flow target connected to the web component, that another inner flow component is rendered upon. The drawback of doing so is that the dom outside the web component needs to render and send new arguments to the web component, before any chage can happen to the flow inside the web component. This could potentially have consequences for frame and animation synchronization over the entire document as a whole. Flow component contexts will also not work within webcomponents. You can use webcomponents if you want to comply to modern web browser standards or integrate with other projects, or you can just use bare flow components if you want to have a better component intercommunication. The choice is yours!  

* Possibility for explicit component life cycle handling: 
    * Off-screen (dissconnected from the DOM), components is now a possibility. Allow components to live with a state off screen, disconnected from the document yet having all dom nodes ready, for example usable for fast tab-panel switching where all dom elements of the hidden tab component are never deallocated.
    * A component can move from one place in the DOM structure to another while maintaining its state. 
    * Three ways to persist and maintain the state of a sub component: 
        * Rendered components will be persisted implicitly using pattern matching of the build structure. 
        * Use keys while rendering to identify and persist the state of a sub component. 
        * Explicitly build and dispose a subcomponent in the setState/disposeState lifecycle functions of a parent component for full control.
  
* Bottom up rendering capabilities: 
    * Finalize and force reflow of a child before a parent is rendered to take measures and do fine control layout. Can be used for advanced responsive UI-behaviors.  
    * Support for Modular, Data Driven, Reactive and Programmatic Responsiveness. The combination of all at the same time. 
    * More powerful than anything that can be done with CSS. 

* Basic features: 
    * Property inheritance for making it simple to pass down properties in the component hierarchy. (fullfills same role as Contexts in React)  
    * Component key-paths, for convenient programmatic manipulation of components, UI test automation and debugging.
    * Component stage portals, typically used for modals and side panel data. Since portals works on the component level, the content of a portal can be in place before the portal has mounted. This is an improvement over React that needs to get hold of a node with a ref on mounting, before that node can be used as a portal, this forces React to populate the portal in a second redering pass. With Flow, the content of a portal work more in line with the contents of any other container, allowing a more smooth user experience.  

* Technical features: 
    * Based on causalityjs (similar to MobX).  
    * Lightweight < 100 kb.
    * Open source 
    * DOM independent component model, this would make it easier to make support other platforms besides Web, or perhaps develop a system for server side rendering. 

# Generality of flow.core

flow.core together with flow.DOM is Reactive DOM rendering. But if you just take flow.core, it is a general engine for Reactive Recursive Object Composition and State Management. Reactive Recursive Object Composition is a reactive generative process where a Recursive Object Composition of any kind is created. On each level, a build function is called, that builds the children of a component, depending on state. It can be a word-processor document, a spread-sheet or a native mobile UI. Since it is a reactive process, minimal changes are guaranteed. Through given keys and pattern matching, the identities and state of child components can be stable, despite the build function apparently rebuilding its child on any change.    


# Video introduction

[Introduction to Flow. A new front end framework.](https://www.youtube.com/watch?v=eNdQrf7WLWU)

# Running the demo

```console
npm install
npm start
```
To see the demo application code, look at the file /src/application.js.


# Example

This example showcases some basic principles of Flow. It shows two ways of defining flow components, either by inheriting from "Flow" or using the "flow" function. It also showcases how you can direct manipulate flow properties from outside the flow, and how the flow can deeply observe data strutures and have the built UI reflect changes in them. 


```js
import { observable, Flow, flow, repeat } from "../flow/Flow";
import { text, row as basicRow } from "../components/BasicFlowComponents";
import { DOMFlowTarget } from "../flow.DOM/DOMFlowTarget.js";

const log = console.log;

/**
 * Flow definitions
 */
export class HelloWorld extends Flow {
 ...

 // Update example
```

## Flow objects
As you can see, it is all just Javascript objects, inheriting from Flow. These Flow objects will build to other Flow objects, that eventually will build to PrimitiveFlow components that are then rendered by the DOM renderer. An application would typically define their own set of Flow components, such as buttons and widgets, that correspond to the prefered style and behavior of that application. So instead of .css classes, you build flow components. And if you need to modularize things even further, then you just use plain Javascript modules as style components. The benefit of doing this, is that everything becomes reactive, even the styles!

## State handling
To handle the state of a javascript object, just call the function "observable(object)" to make any javascript object observable, including arrays. If you do this to all of your model objects, then your user interface will respond to changes in them! The Flow objects themselves are also observables in the same way, so you can change their state at any time, and the user interface will update accordingly!  

## Render engine and build function
When build is run for a component, child objects are created, but in the case where they use the same key as a child object from a previous run of build, the new object will assume the identity of the previously created object. This way, even if build is run many times, re-creating the same child components identified by key, the established object identities for these children will always be maintained, so that children can maintain their state even if the parent is running build.  

## Programmatic Reactive Layout Theory

The following slide shows the theory and philosopy behind Flow, in particular the idea behind Programmatic Reactive Layout and the No CSS principles.
 
https://docs.google.com/presentation/d/13E7E8TzRBoGBJ5BhVV78-s73AnYHnI4MrQ233xihZdY/edit?usp=sharing


## Argument lists explained

The arguments to any given flow component follow a standard pattern. 

myComponent([key],[Component|model|string|number]*,[properties])

The argument list contains: 
 * At most one plain JS object that is the properties object, this object can contain whatever the component needs. 
 * At most one plain JS Array, that is the childrens list. corresponding to properties.children

 * At most one funciton, that are implicitly used as an onClick callback for some components.
   If there is both a function and properties.onClick, there will be an error. 

 * Component|string|number in any order, these are the childrens arguments array. If the childrens arguments array contains at least  items and the first is a string starting with a lowercase or a number, it is assumed to be the key of the  

The childrens list can be defined in tree ways. Either as an array, defining properties.children and adding loose Component|string|number in the argument list. Any 
