import { Component } from "./Component";
import { buildComponentTime, workOnPriorityLevel } from "./Flow";

/**
 * Implement any flow target that implements HTML Element Node and HTML Text Node. 
 * A flow target could implement just a subset of all HTML tags and attributes, but could instead be an approxiomation 
 */
// export const flowTargets = [];

export class Target {
	// constructor() {
	//     super();
	//     flowTargets.push(this);
	// }
	dispose() {}

	setContent(flow) {
		if (!(flow instanceof Component)) throw new Error("Flow target content must be a flow Component!");
		this.flow = flow;
		flow.target = this;
		workOnPriorityLevel(buildComponentTime, () => {
			flow.ensureEstablished()
			this.flow.ensureBuiltRecursive(this)
		});
		if (flow.getPrimitive() instanceof Array) throw new Error("Cannot have fragments on the top level");
		this.ensureContentInPlace();
	}
    
	ensureContentInPlace() {
		throw new Error("Not implemented yet!");
	}

	// General creation method, this is similar to a service locator in the service locator pattern. 
	// The purpose of this method is to choose what FlowPrimitive to create, given the properties object.
	// This makes it possible to create total custom Targets that reinterprets the properties in 
	// new ways. For example, a DOMTarget may create FlowPrimitive objects that renders a DOM in a web browsser.
	// But the same flow could be sent to a Target that renders a native app, or create contents for a printout, 
	// or create a server rendered page. The possibilities are endless!      
	create(properties) {
		throw new Error("Not implemented yet!");
	}
	
	// dispose() {
	//     flowTargets.splice(flowTargets.indexOf(this), 1);
	// }
}
  