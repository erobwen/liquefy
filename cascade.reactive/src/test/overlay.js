import { getWorld } from "../cascade.js";
import assert from "assert";
const causality = getWorld();

describe("Overlays", function(){

  it('testing', function () {
    // Simple object
    // console.log(" Simple object ===========================")
    let x = causality.observable({name: "original"});
    x.foo = 1;
    assert.equal(x.foo, 1);

    // Create rebuildTwin
    // console.log(" Create rebuildTwin ===========================")
    let xOverlay = causality.observable({ name: "rebuildTwin"});
    x.causality.rebuildTwin = xOverlay;
    // console.log(x.causality.handler);
    // console.log(x.causality.handler.causality);
    // console.log(x);
    // console.log(x.causality.rebuildTwin);
    // console.log(x.causality.handler);
    // console.log(x.foo);
    assert.equal(typeof(x.foo), 'undefined');

    // Make changes in rebuildTwin
    // console.log(" Make changes in rebuildTwin ===========================")
    x.foo = 42;
    x.fie = 32;
    assert.equal(x.foo, 42);
    assert.equal(x.fie, 32);

    // Remove rebuildTwin
    x.causality.rebuildTwin = null;
    assert.equal(x.foo, 1);
    assert.equal(typeof(x.fie), 'undefined');
  });
});
