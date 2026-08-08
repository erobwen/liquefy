import { Component } from "./Component";
import { buildComponentTime, repeat, workOnPriorityLevel } from "./Flow";

/**
 * Implement any render context that implements HTML Element Node and HTML Text Node. 
 * A render context could implement just a subset of all HTML tags and attributes, but could instead be an approxiomation 
 */
// export const renderTargets = [];

export class RenderContext {

	// constructor() {
	// 	this.component = null;
	// 	this.renderRepeater = repeat("RenderContext.renderRepeater", repeater => {
	// 		if (this.component) {
	// 			workOnPriorityLevel(buildComponentTime, () => {
	// 				this.component.ensureEstablished();
	// 			});
	// 			this.renderComponent();
	// 		}
	// 	});
	// }

	// renderComponent() {
	// 	throw Error("Not implemented yet");
	// }

	// dispose() {
	// 	if (this.renderRepeater) {
	// 		this.renderRepeater.dispose();
	// 		this.renderRepeater = null;
	// 	}
	// }

	// setContent(component) {
	// 	this.content = component;
	// }   
	
	dispose() {}

	setContent(component) {
		if (!(component instanceof Component)) throw new Error("Flow target content must be a flow Component!");
		component.renderOntoContext(this);
	}

	// General creation method, this is similar to a service locator in the service locator pattern. 
	// The purpose of this method is to choose what PrimitiveComponent to create, given the properties object.
	// This makes it possible to create total custom RenderContexts that reinterprets the properties in 
	// new ways. For example, a DOMRenderContext may create PrimitiveComponent objects that renders a DOM in a web browsser.
	// But the same component could be sent to a RenderContext that renders a native app, or create contents for a printout, 
	// or create a server rendered page. The possibilities are endless!
	primitive(properties) {
		throw new Error("Not implemented yet!");
	}
	
	// dispose() {
	//     renderTargets.splice(renderTargets.indexOf(this), 1);
	// }
}
  