import { getWorld } from "../cascade.js";
import assert from "assert";

const { observable, repeat, withoutRecording } = getWorld();

describe("Pipeline observeable", function(){
  it('Main principle', function () {
    let reverseLog = [];
    function log(string) {
      reverseLog.unshift(string);
    }

    let model = observable({a: 42, b: 314})

    let stage1 = repeat(() => {
      log("running stage1")
      model.a += 10;
      console.log("1");
      withoutRecording(() => console.log(model));
    }, {time: 1});
    assert.equal(reverseLog[0], "running stage1");

    let stage2 = repeat(() => {
      log("running stage2")
      model.a += 20;
      console.log("2");
      withoutRecording(() => console.log(model));
    }, {time: 2});
    console.log(reverseLog);
    // assert.equal(reverseLog[0], "running stage2");

    // let stage3 = repeat(() => {
    //   log("running stage3")
    //   model.b += 20;
    //   console.log("3");
    //   withoutRecording(() => console.log(model));
    // }, {time: 3});
    // assert.equal(reverseLog[0], "running stage3");

    // let stage4 = repeat(() => {
    //   log("running stage4")
    //   model.c += model.a + model.b;
    //   console.log("4");
    //   withoutRecording(() => console.log(model));
    // }, {time: 4});
    // assert.equal(reverseLog[0], "running stage4");

    // Initial output
    // console.log(model);
    // assert.equal(model.a, 72);
    // assert.equal(model.b, 334);
    // assert.equal(model.c, 406);

    // Note: stage3 did not read a so it does not re-run.
    // model.a = 0;
    // assert.equal(reverseLog[2], "running stage1");
    // assert.equal(reverseLog[1], "running stage2");
    // assert.equal(reverseLog[0], "running stage4");

    // After change
    // assert.equal(model.a, 30);
    // assert.equal(model.b, 334);
    // assert.equal(model.c, 364);

    // Note: stage1 and stage2 did not read b so it does not re-run
    // model.b = 0;
    // assert.equal(reverseLog[2], "running stage3");
    // assert.equal(reverseLog[0], "running stage4");

    // After change
    // assert.equal(model.a, 30);
    // assert.equal(model.b, 20);
    // assert.equal(model.c, 50);
  });
});
