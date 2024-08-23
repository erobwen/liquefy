
# Important!

This repository is currently a work in progress, to split up and make readily usable npm packages out of the front end framework worked on as a monolith in this repository: https://github.com/erobwen/reactive-flow . 

This is a multi-repo, containing multiple interdependent npm packages. 


# To run demo

in the root directory: 

* npm install

in application/demo: 

* npm start

Demo is served at: http://localhost:5173/


# Overview

Flow is a generative front end framework based on Javascript-first principle and auto-observation state management (similar to MobX). Flow will allways do minimal updates to the actual DOM by the use of a synthetic dom. 

Javascript first principle means that building DOM is done with Javascript functions instead of JSX/litteral templates/HTML:  

![Alt text](/documents/code.png?raw=true "Screenshot")

Although Flow is styling agnostic, it favours programmatic styling where styles are programmatically generated and applied to DOM elements. Future versions might support auto-stylesheet generation for better memmory usage. 

![Alt text](/documents/screenshot.png?raw=true "Screenshot")

Everything is generative, even themes and styling, and can be changed dynamically (checkbox bottom left).

It also features an DOM-transition animation system that can automatically animate changes in the DOM on a global level, when elements move from one place to another in the DOM. 


# Roadmap

I need to add material design input fields etc. I had started the work to build Material Design components native to Flow, but going forward I will try wrapping Material Web components to make faster progress.


# TODO (internal): 

* Investigate if reactivity cycles can be improved. How to deal with work on priority level etc. Can we do it automatically by treating repeaters different first time they are refreshed.  