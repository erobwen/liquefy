
/**
 * Primitive
 */
const fencePost = (properties) => (
  new Model2D({...properties, mesh: [{x: 0, y: 0}, {x: 0, y: 10}, {x: 10, y: 1}, {x: 0, y: 1}]}) 
)

const fenceBeam = (properties) => (
  new Model2D({...properties, mesh: [{x: 0, y: 0}, {x: length, y: 0}, {x: length, y: 1}, {x: 0, y: 1}]})
)

// Note: if we need manual editing of meshes, they need both position given by their parent, but also an offset that can be changed in editing. These two should then be added together.

/**
 * Parametric reactive
 */
class Fence extends Component {

  receive({position, ...defaultStateValues}) {
    this.position = position;
    this.defaultStateValues = Object.assign({elevation: 1}, defaultStateValues);
  }

  initialize() {
    Object.assign(this, this.defaultStateValues);
  }

  build() {
    const { position, length, spacing, count, elevation } = this;    

    return Model2D({
      position, 
      children: [
        new HorizontalArray({
          key: "posts",
          position: { x: 0, y: elevation }, 
          start: 0, 
          end: length, 
          spacing,
          count,
          generator: (properties) => fencePost(properties)
        }),
        fenceBeam({key: "topBeam", position: {x: 0, y: 0}}),
        fenceBeam({key: "bottomBeam", position: {x: 0, y: 9}})
      ]
    })
  }
} 

const distributions = {
  useSpacingFromStart: "usingSpacingFromStart",
  spaceBetween: "spaceBetween",
  spaceAround: "spaceAround",
  spaceEvenly: "spaceEvenly"
}

/**
 * Parametric reactive layout component
 */
class HorizontalArray extends Component {

  receive({children, ...defaultStateValues}) {
    this.defaultStateValues = Object.assign({
      type: distributions.usingSpacingFromStart
    }, defaultStateValues);
    this.children = children;
  }

  initialize() {
    // type is now a state, and can be direct manipulated in editor, and will maintain state even if parent is rebuilt.
    Object.assign(this, this.defaultStateValues);
  }

  build() {
    const { type } = this; 

    switch(type) {
      case (distributions.useSpacingFromStart):
        return this.buildUsingSpacingFromStart();

      case (distributions.spaceBetween):
        return this.buildSpaceBetween();

      case (distributions.spaceAround):
        return this.buildSpaceAround();

      case (distributions.spaceEvenly):
        return this.buildSpaceEvenly();
    }
  }

  buildUsingSpacingFromStart() {
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
    return Model2D(result);
  }

  buildUsingSpaceBetween() {
    const { start, stop, count, generator } = this;

    const first = generator({key: "first", position: {x: 0, y: 0}});
    const width = stop - start; 
    const widthItem = first.width();
    const spacesWidth = width - widthItem*count;
    const result = [first];
    let index = 1;
    let position = widthItem;
    while (index++ < count) {
      position += spacesWidth;
      const key = index < ((start + end) / 2) ? `item ${count}` : `item ${count - index}`; 
      result.push(generator({key, position: {x: position, y: 0}}));
    }
    return Model2D(result); 
  }

  buildSpaceAround() {
    throw new Error("Not implemented yet!");
  }

  buildSpaceEvenly() {
    throw new Error("Not implemented yet!");
  }
}




// Create an instance of component.
const fence = new Fence({position: {x:0, y:0}, length: 100, spacing: 5, elevation: 1});

const target = new Engine2DRenderContext(); // This would be a connection to the actual 2D rendering engine

target.render(fence);  // Starts reactive process of rebuilding fence upon change, and

// If the Mesh2D and Engine2DRenderContext is implemented correctly, only minimal changes would be pushed to the rendering.  

fence.length = 200; //would instantly double the size of the fence.

