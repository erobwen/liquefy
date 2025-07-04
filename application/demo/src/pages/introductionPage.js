import { Component, toPropertiesWithChildren } from "@liquefy/flow.core";

import { div, text, h1, h2, h3, p, ul, li, b, br, i, span, addDefaultStyle } from "@liquefy/flow.DOM";

import { portalContents, middle, fitContainerStyle } from "@liquefy/basic-ui";

import file from './introductionPage?raw';
import { displayCodeButton } from "../components/information";


function blue(...parameters) {
  const properties = toPropertiesWithChildren(parameters)
  addDefaultStyle(properties, {color: "blue"})
  return b(properties)
}

export class IntroductionPage extends Component {
  
  receive({topBarPortal}) {
    this.topBarPortal = topBarPortal;
  } 

  render() {
    return (
      div(
        div(
          h1("Introduction to Flow"),
          p("Reactive front end framework, with an integrated state management system."),
          p(blue("Flow is radical, innovative and uses state of the art technology!")),
          p("The purpose of Flow is to make advanced user interface building so simple that anyone can do it!"),
          h2("Based on"),
          ul(
            li(blue("Programmatic approach."), " User interface is generated using javascript expressions."),
            li(blue("Reactive approach."), " Everything is reactive, from styling to state management."),
            li(blue("Auto Observation"), " that relieves you of any need to declare data dependencies (similar to MobX)"),
            li(blue("Mutability freedom"), " allows you to refer to and change any state or component from anywhere while maintaining safe and efficient updates."),
          ),
          h2("Notable features"),
          ul(
            li("Provides ", blue("Minimal DOM Updates"), " for fine grained change response and efficiency."),
            li(blue("Component lifecycle control"), " allows you to control when components are created or disposed allowing for off-screen components that maintain their state and DOM elements."),
            li(blue("DOM transition animations"), " allows you to animate DOM-elements that move to another place in the DOM as well as appear or dissapear."),
            li(blue("Component-time portals"), " allows you to populate portals instantly without having to render them first."),
          ),
          h2("Supports"),
          ul(
            li(blue("Javascript First Methodology"), ". No need for jsx-parsing. No need for .css files. "),
            li(blue("Programmatic responsive layout"), " making it possible to respond to container sizes on a component level."),
            li(blue("Reactive Styling"), " where both style and components can be swapped out reactivley."),
          ),
          h2("Bonus"),
          ul(
            li("Is built around a DOM agnostic core providing ", blue("Reactive Object Composition"), " that could be used for other purposes, such as back end rendering or building a word processor or any other document generator."),
          ),
          h2("This Demo"),
          p("Demonstrates the key features of flow, while showing how little code is needed to use them."),
          p("In addition, this demo also serves as a testbed for Flow. Right now there are no unit tests, so all features of this demo needs to be validated upon any changes to the framework."),
          portalContents(
            middle(text("by Robert Renbris ")),
            displayCodeButton({code: file}),
            {
              portal: this.topBarPortal
            }
          ), 
          {
            style: {
              // overflowWrap: "auto", 
              margin: 30,
            }
          }
        ),
        {
          style: {
            ...fitContainerStyle,
            overflowX: "hidden",
            overflowY: "auto",
            whiteSpace: "normal"
            // overflowWrap: "auto", 
          }
        }
      )
    )
  }
}

// middle()