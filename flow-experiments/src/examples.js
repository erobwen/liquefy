
/**
 * This is a Flow subclass with all possible lifecycle functions in use. 
  */  
export class ExmapleFlow extends Component {
  setProperties({one, two, three="default-value"}) {
    this.one = one;
    this.two = two + 2; 
    this.three = three;  
  }

  setState() {
    this.foo = 1;
    this.fie = 2; 
    this.derrive(() => {
      this.fooPlusFie = this.foo + this.fie;
    });
    this.expensiveResource = getExpensiveResource();
  }

  disposeState() {
    this.expensiveResource.dispose();
  }

  build() {
    return row(text(this.foo), text(this.bar));
  }
}



/**
 * This is how to package a class component in a way so that it can be used without "new".
 * One way is to do this to primitive flows only, so they are easy to distinguish from compound/stateful flows. 
 */
export const myComponent = (...parameters) => 
  new MyComponentFlow(readFlowProperties(parameters));

export class MyComponent extends Component {
  setProperties({count}) {
    this.count = count;
  }
  
  build() {
    return ( 
      row("list-row", {}, 
        button("a", {onClick: () => {log("a clicked")}}),
        button("b", {onClick: () => {log("b clicked")}})
      )
    );
  }
}