
# Next

EPIC: Programmatic Reactive Layout demo (almoste done)
TODO: Warning when trying to animate inline divs. Need to be blocks!
TODO: Move attribute extraction to primtives + warning of unused property?
TODO: Make causality throw an error if same build id is used in the same build. 
TODO: Test fragmented flows.

# Needs examination
TODO: Move back some functionality from unobservable to state?  
CONSIDER What happens with a model built in the build function of a flow. Will it be re-created using shape analysis... it will be re-created and re set!... So you cant do it?
CONSIDER use setState on primitive?
INVESTIGATE: build repeater should not be dependent on parentPrimitive.
INVESTIGATE: parentPrimitive in general. Is the current solution good?
INVESTIGATE: is dispose really doing its job. Investigate why the new modal implementation failed. 
INVESTIGATE: Should we really dispose of a keyed component that is not used???... 

# After first release
TODO: Causality could check if objects are frozen, and then automatically do a deep comparison. 
EPIC: Alternative Flow RenderContext Demo, word-processor  
INVESTIGATE: Is there a way to avoid observation of temporary objects during rebuild? Is it a problem?
INVESTIGATE: Reconsider use of webpack now that we do not need jsx? Call webpack from within a script instead to avoid global install. 

# Random Notes
npm install -g webpack
npm install -g webpack-cli
npm install -g webpack-dev-server -->

# New / needs sorting
TODO We need some kind of warning when you reuse the same key within the same build. Right now it leads to an ugly crash. 