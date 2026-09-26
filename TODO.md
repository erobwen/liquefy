# TODO (internal): 

* Make the cascade demo a progressive web app (installable on a phone, working offline): a web app manifest (name, icons from cascade/images/favicon.png and favicon.svg, display: standalone, theme color #2c3e50) and a small service worker caching the built app. The routes (browserLocation) and the full-screen dialog mode are already in place.

* Create temporal signals for arrays as well. Cascade currently works only with temporal signal objects, but for full feature reactivity, we should have temporal arrays also. 

* Build a Word processor or XML editor prototype in the Demo using temporal signals. 

* Investigate jsx compatibility. Now that we have full Json representation of components, it is not that far off to have a jsx -> JS step that allow us to write Cascade builds with tags. I am not sure if that is better than the build functions, but it is an idea. 