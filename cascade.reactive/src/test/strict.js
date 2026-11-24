import { getWorld } from "../cascade.js";
import assert from "assert";
const { meta, temporal } = getWorld();

describe("Proxy object traps", function () {
  const box = temporal();

  it('rebuildTwin',  function () {
    meta(box).rebuildTwin = temporal({ name: "rebuildTwin"});
    box.other = null;
    meta(box).rebuildTwin = null;
  });

  it('nochange',  function () {
    box.x = 123;
    box.x = 123;
  });

  it('delete nonexisting', function(){
    delete box.y;
  });

  Object.defineProperty(box, "z", {
    configurable: false,
  });

  it('set nonconfigurable', function(){
    assert.throws( function(){box.z = false}, TypeError ); 
  });

  it('delete nonconfigurable', function(){
    assert.throws( function(){ delete box.z }, TypeError ); 
  });
});

describe("Array object traps", function () {
  const stack = temporal([]);

  it('rebuildTwin',  function () {
    meta(stack).rebuildTwin = temporal(['aa','bb']);
    stack[2] = false;
    meta(stack).rebuildTwin = null;
  });


  it('nochange',  function () {
    stack[1] = 123;
    stack[1] = 123;

    stack.splice(0, stack.length, 'a','b','c','d');
    stack.length = 4;
  });

  it('delete nonexisting', function(){
    delete stack[99];
  });
});
