
/**
 * Primitive
 */
const fencePost = (properties) => (
  new Model2D({...properties, mesh: [{x: 0, y: 0}, {x: 0, y: 10}, {x: 10, y: 1}, {x: 0, y: 1}]}) 
)

const fenceBeam = (properties) => (
  new Model2D({...properties, mesh: [{x: 0, y: 0}, {x: length, y: 0}, {x: length, y: 1}, {x: 0, y: 1}]})
)


/**
 * Parametric reactive
 */
class Fence extends Component {

  setProperties({position, length, spacing, elevation=0}) {
    this.position = position;
    this.length = length; 
    this.spacing = spacing; 
    this.elevation = elevation;
  }

  build() {
    const { position, length, spacing, elevation } = this;    

    return {
      position, 
      children: [
        new HorizontalArray({
          key: "posts",
          position: { x: 0, y: elevation }, 
          start: 0, 
          end: length, 
          spacing,
          generator: (properties) => fencePost(properties)
        }),
        fencePost({key: "topPost", position: {x: 0, y: 0}}),
        fencePost({key: "bottomPost", position: {x: 0, y: 9}})
      ]
    }    
  }
}

/**
 * Parametric reactive layout component
 */
class HorizontalArray extends Component {

  setProperties(properties) {
    Object.assign(this, properties); // no default values.
  }

  build() {
    const { start, stop, spacing, generator } = this;     
    
    const result = {position, children: []}
    const x = start; 
    const count = Math.floor((stop-start) / spacing);
    let index = 0
    while (index < count) {
      // Key, anchor to front, or anchor to back.
      const key = index < ((start + end) / 2) ? `item ${count}` : `item ${count - index}`; 
      result.children.push(generator({key, position: {x, y:0}}));
      x += spacing;
    }
    result.children.push(generator({key: "endPost"}));
    return result;
  }
}

// Create an instance of component.
const fence = new Fence({position: {x:0, y:0}, length: 100, spacing: 5, elevation: 1});

const target = new Engine2DTarget(); // This would be a connection to the actual 2D rendering engine

target.setContent(fence);  // Starts reactive process of rebuilding fence upon change, and

// If the Mesh2D and Engine2DTarget is implemented correctly, only minimal changes would be pushed to the rendering.  

fence.length = 200; //would instantly double the size of the fence.

