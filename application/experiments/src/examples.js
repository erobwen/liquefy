
/**
 * This is a Flow subclass with all possible lifecycle functions in use. 
  */  
export class ExmapleFlow extends Component {
  receive({one, two, three="default-value"}) {
    this.one = one;
    this.two = two + 2; 
    this.three = three;  
  }

  initialize() {
    this.foo = 1;
    this.fie = 2; 
    this.ensure(() => {
      this.fooPlusFie = this.foo + this.fie;
    });
    this.expensiveResource = getExpensiveResource();
  }

  terminate() {
    this.expensiveResource.dispose();
  }

  render() {
    return row(text(this.foo), text(this.bar));
  }
}



/**
 * This is how to package a class component in a way so that it can be used without "new".
 * One way is to do this to primitive flows only, so they are easy to distinguish from compound/stateful flows. 
 */
export const myComponent = (...parameters) => 
  new MyComponentFlow(toProperties(parameters));

export class MyComponent extends Component {
  receive({count}) {
    this.count = count;
  }
  
  render() {
    return ( 
      row("list-row", {}, 
        button("a", {onClick: () => {log("a clicked")}}),
        button("b", {onClick: () => {log("b clicked")}})
      )
    );
  }
}