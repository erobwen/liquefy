

/**
 * Primitive (Mostly data, can be generated from editor)
 */
const fencePost = (position) => (
  {position, offset, mesh: [{x: 0, y: 0}, {x: 0, y: 10}, {x: 10, y: 1}, {x: 0, y: 1}]} // Note: position given by parent, offset set locally. 
)

const fenceBeam = (position, length) => (
  {position, offset, mesh: [{x: 0, y: 0}, {x: length, y: 0}, {x: length, y: 1}, {x: 0, y: 1}]}
)


/**
 * Extension component (Mix of data and code)  
 */
const fence = (position, length, spacing, elevation=0) => {
  return {
    position, 
    children: [
      ...horizontalArray(  // layout function
        { x: 0, y: elevation }, 
        0, 
        length, 
        spacing,
        (position) => fencePost(position)
      ),
      fenceBeam({x: 0, y: 0}, length),
      fenceBeam({x: 0, y: 9}, length)
    ]
  }
}


/**
 * Layout component (mostly generative code)
 */
const horizontalArray = (position, start, stop, spacing, build) => {
  const result = {position, children: []}
  const x = start; 
  let count = Math.floor((stop-start) / spacing);
  while (count-- > 0) {
    result.children.push(build({x, y:0}));
    x += spacing;
  }
  result.children.push(build({x: stop, y: 0}))
  return result;
}
