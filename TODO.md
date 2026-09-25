# TODO (internal): 

* Investigate if reactivity cycles can be improved. How to deal with work on priority level etc. Can we do it automatically by treating repeaters different first time they are refreshed.

* Make the cascade demo a progressive web app (installable on a phone, working offline): a web app manifest (name, icons from cascade/images/favicon.png and favicon.svg, display: standalone, theme color #2c3e50) and a small service worker caching the built app. The routes (browserLocation) and the full-screen dialog mode are already in place.
