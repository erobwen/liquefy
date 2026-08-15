/**
 * Reactive auto dependency pipeline
 */

// Input and output model. 
// Writing to the model sets initial values 
// Reading from the model reads pipeline output 
let model = observeable({a: 42, b: 314})

// Prints "running stage1" (initialization)
let stage1 = repeat(() => {
  model.a += 10;
  console.log("running stage1")
}, {stage: 1});

// Prints "running stage2" (initialization)
let stage2 = repeat(() => {
  model.a += 20;
  console.log("running stage2")
}, {stage: 2});

// Prints "running stage3" (initialization)
let stage3 = repeat(() => {
  model.b += 20;
  console.log("running stage3")
}, {stage: 3});

// Prints "running stage4" (initialization)
let stage3 = repeat(() => {
  model.c += model.a + model.b;
  console.log("running stage4")
}, {stage: 4});

// Initial output
// Prints {a:72, b: 334, c: 406}
console.log(model);

// Prints (update): 
// running stage1
// running stage2 
// running stage4
// Note: stage3 did not read a so it does not re-run.
model.a = 0;

// Prints {a:30, b: 334, c: 364}
console.log(model);

// Prints (update):
// running stage3
// running stage4
// Note: stage1 and stage2 did not read b so it does not re-run
model.b = 0;

// Prints {a:30, b: 20, c: 50}
console.log(model);



