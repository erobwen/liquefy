import { getWorld } from "../causality.js";
import assert from "assert";
const { observable } = getWorld({name: "array-splices", sendEventsToObjects: true});

//const log = console.log.bind(console);
// trace.nestedRepeater = false;

describe("array-splices", function(){
	// resetObjectIds();
  
	var result;
  const arrayRenderContext = ['a', 'b', 'c'];
  arrayRenderContext.onChange = (event) => {
		result = event;
  };
  // arrayRenderContext.onChange();
	var observedArray = observable(arrayRenderContext);

	it('should report changes', function(){
		observedArray[1] = 'z';
    const expected1 = { type: 'splice', index: 1, removed: ['b'], added: [ 'z' ], objectId: 1};
    expected1.object = observedArray;
		assert.deepEqual( result, expected1 );

    const expected2 = { type: 'splice', index: 3, removed: null, added: [ 'last' ], objectId: 1};
    expected2.object = observedArray;

		observedArray.push('last');
		assert.deepEqual( result, expected2 );

	})

  it('should report shrinked array', function(){
    observedArray.splice(2);
    const expected1 = { type: 'splice', index: 2, removed: ['c','last'], added: [], objectId: 1};
    expected1.object = observedArray;
		assert.deepEqual( result, expected1 );
  });

  // it('chained observers of large arrays', function(){
  //   observedArray.observe(
		//   function(event) {
  //       repeat(function(){
  //         if( observedArray.length > 20 ) return;
  //       });

  //     }
  //   );
    
    
  //   let result;
  //   repeat(function(){
  //     if( observedArray.length > 505  )
  //     {
  //       if( result ) return;
  //       result = [... observedArray];
        
  //       assert.equal( result[1], 505 );
  //       return;
  //     }

  //     repeat(function(){
  //       observedArray.splice(1,0,observedArray.length);
  //     });
  //   });
  // });

});
