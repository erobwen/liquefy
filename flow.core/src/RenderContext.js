import { Component } from "./Component";
import { buildComponentTime, workOnPriorityLevel } from "./Flow";

/**
 * Implement any flow target that implements HTML Element Node and HTML Text Node. 
 * A flow target could implement just a subset of all HTML tags and attributes, but could instead be an approxiomation 
 */
// export const flowRenderContexts = [];

export class RenderContext {
	// constructor() {
	//     super();
	//     flowRenderContexts.push(this);
	// }
	dispose() {}

	setContent(component) {
		if (!(component instanceof Component)) throw new Error("Flow target content must be a flow Component!");
		this.flow = component;
		component.renderContext = this;
		workOnPriorityLevel(buildComponentTime, () => {
			component.ensureEstablished()
			this.flow.ensureBuiltRecursive(this)
		});
		if (component.getPrimitive() instanceof Array) throw new Error("Cannot have fragments on the top level");
		this.ensureContentInPlace();
	}
    
	ensureContentInPlace() {
		throw new Error("Not implemented yet!");
	}

	// General creation method, this is similar to a service locator in the service locator pattern. 
	// The purpose of this method is to choose what PrimitiveComponent to create, given the properties object.
	// This makes it possible to create total custom RenderContexts that reinterprets the properties in 
	// new ways. For example, a DOMRenderContext may create PrimitiveComponent objects that renders a DOM in a web browsser.
	// But the same flow could be sent to a RenderContext that renders a native app, or create contents for a printout, 
	// or create a server rendered page. The possibilities are endless!      
	create(properties) {
		throw new Error("Not implemented yet!");
	}
	
	// dispose() {
	//     flowRenderContexts.splice(flowRenderContexts.indexOf(this), 1);
	// }
}
  