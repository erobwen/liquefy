![Logotype](/application/demo/public/flow.svg?raw=true "Logotype")

By Robert Renbris

#### Overview

Flow is a generative front end framework based on Javascript-first principle and auto-observation state management (similar to MobX). Flow will allways do minimal updates to the actual DOM by the use of a synthetic dom. 


#### Hello World

```js
import { Component } from "@liquefy/flow.core";
import { DOMRenderContext, div, h1, b } from "@liquefy/flow.DOM";
import { button } from "@liquefy/ui-material"

// A simple Hello World component
class Hello extends Component {

  recieve({to}) {
    this.to = to;
  }

  initialize() {
    this.count = 1;
  }

  render() {
    const { to, count } = this;
    return div(
      h1(`Hello ${to}`),
      b("counter: " + count),
      button("Click me!", () => this.count++),       
      {
        style: {padding: "20px", boxSizing: "border-box"}
      }
    );
  }
}

// Create an instance, and set as content of a render context.
new DOMRenderContext(document.getElementById("root")).render(
  new Hello({to: "World"})
)
```


#### To run demo

There is a demo application that you can try out from this url: https://erobwen.github.io/liquefy/

![Alt text](/documents/images/screenshot.png?raw=true "Screenshot")

In the top right corner of the screen is a button that allows you to show the code of whatever you see in the demo.


#### Important!

This is a multi-repo, containing multiple interdependent npm packages. 


#### Coming soon

Next step is to build and deploy the pakcages in this repository on npm.  


#### Development (run demo in dev mode)

in the root directory: 

* npm install

in application/demo: 

* npm start

Demo is served at: http://localhost:5173/


#### Previous Repository

This repository is a more mature version of the experiments from this repository https://github.com/erobwen/reactive-flow . 

