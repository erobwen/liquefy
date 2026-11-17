import { Component } from "@liquefy/cascade.component";
import { h1, h2, h3, p, ul, li, text } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import { article, emphasis, nextPage } from "../components/layout.js";
import { codeBlock, stage, name } from "../components/examples.js";
import { Reorder } from "./animation/Reorder.js";
import { AppearLeave } from "./animation/AppearLeave.js";
import { TwoLists } from "./animation/TwoLists.js";
import { Expand } from "./animation/Expand.js";
import { OwnBox } from "./animation/OwnBox.js";
import { Scrolling } from "./animation/Scrolling.js";
import { Options } from "./animation/Options.js";
import { Units } from "./animation/Units.js";
import { Custom } from "./animation/Custom.js";
import reorderSource from "./animation/Reorder.js?raw";
import appearLeaveSource from "./animation/AppearLeave.js?raw";
import twoListsSource from "./animation/TwoLists.js?raw";
import expandSource from "./animation/Expand.js?raw";
import ownBoxSource from "./animation/OwnBox.js?raw";
import scrollingSource from "./animation/Scrolling.js?raw";
import optionsSource from "./animation/Options.js?raw";
import unitsSource from "./animation/Units.js?raw";
import customSource from "./animation/Custom.js?raw";
import source from "./AnimationGuidePage.js?raw";

/**
 * Animation Guide - everything FlipAnimationContainer does, one thing at a
 * time: what it is, how to get it, an example of it running, and where it
 * ends. For whoever wonders whether it covers what they need - and what
 * to do when it doesn't. Every example is a file of its own in
 * ./animation/, shown as it is, and running right on the page.
 */

// Its pace, and switching it off - nothing to run: an excerpt.
const paceExcerpt = `import { FlipAnimationContainer, animationContainer } from "@liquefy/cascade.dom";

// Every container's pace, unless it says otherwise: 1 is the natural one.
FlipAnimationContainer.speed = 0.5;

// Whoever asked their system for less motion gets none.
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

animationContainer({ enabled: !calm, speed: 2 }, ...children);`;

// A list of points - each a string, or strings and names from the code.
const points = (...items) => ul(
  { style: { paddingLeft: "22px", margin: "8px 0 16px 0" } },
  items.map((item) => li(
    { style: { margin: "6px 0" } },
    ...(item instanceof Array ? item : [item]).map((part) => typeof(part) === "string" ? text(part) : part),
  )),
);

export class AnimationGuidePage extends Component {
  build() {
    return article(
      pageActions({ source, fileName: "src/pages/AnimationGuidePage.js" }),
      h1("Animation Guide"),
      p(
        "Everything ", name("animationContainer()"), " does, one thing at a time - each with an example running ",
        "on the page, how to get it, and where it ends. Read it through as a tutorial, or look up the one thing you ",
        "need to know is covered.",
      ),
      p(
        name("animationContainer()"), " makes a ", name("FlipAnimationContainer"), " - the class, named for how it works. ",
        name("flipAnimationContainer()"), " is the same function by its original name: either will do.",
      ),

      h2("How it works, in a paragraph"),
      p(
        "The container places everything in it itself. Every time something in it changes, it first notes where, ",
        "and how large, each element is drawn right now. Then it lets the change happen, and reads where the browser's ",
        "layout puts everything. Each element is then drawn where it was - with a ", name("transform"), " - and a spring ",
        "takes it to where it now belongs. This is known as FLIP: first, last, invert, play.",
      ),
      p(
        "So there's nothing to describe: no durations, no from and to, no enter and exit states. ",
        emphasis("You change what's shown; the container animates the difference."), " What's inside it are ordinary ",
        "components, laid out by ordinary CSS, knowing nothing about any of it.",
      ),

      h2("1. Moving within a parent"),
      p(
        "The simplest case: the same items, in another order. Give each a ", name("key"), " - that's what makes it the ",
        "same item in a new place, rather than one item gone and another one there. It's the only thing the container ",
        "asks of what's in it.",
      ),
      stage(new Reorder()),
      codeBlock(reorderSource),
      points(
        "Any layout works - a wrapping row here, but a grid, a column or absolute positions just the same. The container only looks at where things end up.",
        "Click twice, fast. An item already on its way isn't sent back to start again, and doesn't jump: it goes on from where it's drawn, at the speed it has, and curves off to its new place.",
        "What's inside a moving element moves with it - not twice as far.",
      ),

      h2("2. Appearing and leaving"),
      p(
        "An element with nothing to move from fades in where it lies. One that's removed is put back for a moment - ",
        "as a ghost: exactly where and how it was drawn, taking no room - and fades out, while the rest close the gap.",
      ),
      stage(new AppearLeave()),
      codeBlock(appearLeaveSource),
      points(
        "Nothing fades in when the container is first shown: what's there from the start is just there.",
        "Only the outermost new element fades in - what's in it comes along. What appears in something that's itself on its way somewhere goes along with that.",
        "A ghost keeps the font and color it had, and can't be clicked. One that's only a box around other things - no background, border or text of its own - fades out as what's in it instead, each part where it was.",
        "Bring an element back while its ghost is still fading, and it's restored and moves on from there.",
        "While it fades in, a newcomer is drawn above what's around it, and isn't cut off by what it's in - which may well still be growing to make room for it. See confine, under Options, for the opposite.",
      ),

      h2("3. Moving to another parent"),
      p(
        "With both places inside the same container, an element that goes from one to the other flies there. It's ",
        "drawn above everything else in the container on its way, and lands looking the way things look over there.",
      ),
      stage(new TwoLists()),
      codeBlock(twoListsSource),
      points(
        ["It takes on how it looks where it lands - its color, background, border color, shadow, how bold its text is - gradually, on the way. Its text is scaled from the size it had to the size it gets."],
        "While it flies, it's raised into a layer above everything in the container - above an overlay with a z-index of its own too - and an invisible placeholder keeps its place in the layout. Once there, it's back in its place, stacked as your own DOM order and z-indexes say.",
        "One with text and a visible box of its own - a button, say - grows or shrinks to its new size, its text laid out anew rather than squashed. If its text says something else where it lands, the old text fades out as the new fades in.",
        [emphasis("Change both places at once."), " Take an element out of one list, let the app rebuild, and then put it in the other, and it's gone in between - what arrives is a new element, fading in. Keep both in one piece of state, as here, or write them between ", name("postponeInvalidations()"), " and ", name("continueInvalidations()"), "."],
      ),

      h2("4. Changing size"),
      p(
        "An element that gets more in it, or less, has another size in the new layout - and grows or shrinks to it. ",
        "What comes after it glides out of the way. There are no wrappers to add, and no heights to work out.",
      ),
      stage(new Expand()),
      codeBlock(expandSource),
      points(
        "A box is scaled to its new size - and what's in it is scaled back, so nothing in it is stretched along.",
        ["Text can't be scaled back, so ", emphasis("an element with text directly in it isn't scaled"), ": its box takes its new size at once, and only moves. That's why the panels here hold their text in elements of their own - the panel is a box, and is scaled; the title and the details are text, and aren't. If something of yours snaps to its new size, this is why: put its text in an element inside it."],
        "Rounded corners stay as round as they are, however the box is scaled on the way (see keepCorners, under Options).",
      ),

      h2("5. The container's own box"),
      p(
        "The container itself changes size too, as what's in it does - and grows or shrinks to it like everything in ",
        "it, so what's around it makes room gradually. Otherwise it would snap shut as the last item left it: a ghost ",
        "takes no room.",
      ),
      stage(new OwnBox()),
      codeBlock(ownBoxSource),
      points(
        "However its size places it - centered as here, held by its right or bottom edge, stretched by a flex parent - what's in it is drawn where it was when a change starts, and goes from there.",
        ["While it's on its way, the container has a ", name("width"), " or ", name("height"), " of its own, in its inline style - only the one that changes, and only meanwhile."],
        "What's in it that follows its size - an item stretching to its height, something held at its bottom edge - follows it all the way.",
      ),

      h2("6. Scrolling"),
      p(
        "The container can be in something that scrolls, and things that scroll can be in the container.",
      ),
      stage(new Scrolling()),
      codeBlock(scrollingSource),
      points(
        "Scroll down, then add at the top: what you're looking at stays put. The browser keeps the view where it was, and the container sees that nothing in view moved.",
        "Remove something at the bottom, scrolled all the way down: the rest glides down as the view follows.",
        "A ghost fades out where it was - scrolled along with everything else, and cut off where what scrolls ends.",
        "Something that scrolls, inside the container, keeps scrolling while things appear in it: only what clips without scrolling is opened up meanwhile.",
        [name("scrollArea()"), " is optional - a plain element with ", name("overflow: auto"), " works the same. It's there for when a scroll bar coming and going would move things."],
      ),

      h2("7. Options"),
      p("Each is a property of the container - and each can be changed while things are moving."),
      stage(new Options()),
      codeBlock(optionsSource),
      points(
        [name("enabled"), " (on by default) - off, the container only places things: whatever was on its way is where it belongs at once. For a setting of your app's, or for whoever asked for less motion."],
        [name("speed"), " - a factor: 1 is the natural pace, 0.5 half of it. ", name("FlipAnimationContainer.speed"), " is the same for every container that doesn't say."],
        [name("confine"), " (off by default) - what appears stays within what it's in, as that's drawn on its way: revealed as it grows, with a crisp edge. Add an item to the square box with it on, and off. Use it where a newcomer reaching out over an edge would look wrong - a drawer, a clipped panel."],
        [name("zoomAlong"), " (off by default) - what fades in or out in something growing or shrinking grows or shrinks with it, rather than keeping its own size."],
        [name("keepCorners"), " (on by default) - rounded corners stay round while what they're on is scaled. Switch it off and add to the rounded box, slowly: its corners are squashed, then stretched back. Off, nothing but transforms and opacity change while things move, which is the cheapest there is."],
        [name("isUnit"), " - what to take as one piece: see below."],
        [name("style"), " - the container's own element. It's a plain block ", name("div"), " until you say otherwise."],
      ),
      codeBlock(paceExcerpt),

      h2("8. Units and islands"),
      p(
        "The container sees through the components in it, down to every element, and places each one. That's what ",
        "lets a title leave one card and land in another. Sometimes it's more than you want.",
      ),
      stage(new Units()),
      codeBlock(unitsSource),
      points(
        [name("isUnit"), " is given each component on the way down, and answers true for those to take whole: placed, and animated, as one element. Nothing in a unit animates on its own."],
        "A unit lives its own life. A change inside one is its own business, and as fast as anywhere else - where any change of what's shown in the rest of the container makes the container go through all of it again. In a large container, make its large, busy parts units.",
        ["Give it one function, the same every time - a constant, or a ", name("callback()"), ". A new function every build is a changed property every build."],
        "A component that can only be rendered - one that draws its own DOM, or measures its element - is taken whole without being asked: an island.",
        ["Units and islands are in a block ", name("div"), " of the container's own, which is what's laid out. Where that matters - a flex item that should grow, say - style what's around it."],
      ),

      h2("9. Stacking"),
      p(
        "At rest, what's drawn above what is yours alone: your DOM order, and your z-indexes. The container adds ",
        "nothing. Only while something animates is it drawn otherwise:",
      ),
      points(
        "what flies to another parent is above everything in the container, until it lands;",
        "what appears, and each element it's in, is above its siblings while it fades in;",
        "a ghost stays where it was among its siblings.",
      ),
      p(
        "So an overlay that should cover everything says so with a z-index of its own, rather than by being last. ",
        "The Web Store example does exactly that: a product flies from the greyed-out shelf, over the overlay, into the cart.",
      ),

      h2("Pitfalls and limitations"),
      h3("Things to get right"),
      points(
        [emphasis("No identity, no move."), " The container animates an element from where it was to where it is - so it has to be the same element. An item that changes place without keeping its identity is just one item changing what it says: nothing moves. A ", name("key"), " is the usual way to keep it, but not the only one: a component you create once and keep - in state, say - and put wherever it goes in each build is the same one everywhere, and what stays in the same place is the same by pattern matching, with no key at all. However you do it, whatever can move, appear or leave has to stay itself."],
        [emphasis("One change, not two."), " What goes from one place to another has to be in the new one in the same rebuild it leaves the old (see 3)."],
        [emphasis("One container."), " A move is only a move inside one container. From one container to another, an element leaves the first and appears in the second - put the container around both."],
        [emphasis("Its transform and opacity are the container's."), " It draws with the inline ", name("transform"), " and ", name("opacity"), " of every element it places, and clears them when it's done - yours with them. To move or turn something yourself, use ", name("translate"), ", ", name("rotate"), " and ", name("scale"), ", which are properties of their own - or do it inside a unit, where the container doesn't reach."],
        [emphasis("No CSS transitions on size or position."), " The container reads the new layout right after a change. With a transition on ", name("width"), ", ", name("height"), " or ", name("margin"), ", that layout isn't there yet, and the two animations fight. Transitions on colors are fine."],
        [emphasis("Text in a box of its own."), " An element with text directly in it takes its new size at once (see 4)."],
      ),
      h3("What it doesn't do"),
      points(
        "It animates what changes when the app changes. What changes by itself - the window resized, an image loading, a hover style - is the browser's, and happens at once.",
        "It animates where things are and how large, appearing and leaving. A color changing in place isn't its business - a CSS transition does that, and gets along with it. Only what flies to another parent takes on its new look gradually.",
        ["Nothing animates while the container isn't in the page - hidden, it just places."],
        "Rounded corners given in percent aren't kept round: they follow the box as it's scaled.",
        "While the container's own box is on its way, what's in it is taken to follow its size evenly. A row that wraps at some width doesn't - its items start from the right place and end in the right place, but may be a little off on the way.",
        "It measures every element it places, every time something in it changes. That's fast - one pass of the browser's layout - but it isn't free: thousands of elements in one container, changing all the time, is where to reach for units, or a container around less.",
      ),
      h3("What it leaves behind"),
      points(
        ["A container that isn't positioned becomes ", name("position: relative"), " the first time something fades out in it, or flies - and stays so. Elements appearing, and elements with ghosts in them, are too, meanwhile."],
        ["While things move, elements have an inline ", name("transform"), ", some an ", name("opacity"), " or a ", name("z-index"), ", and there are ghosts and placeholders among them. All of it is gone at rest: then the DOM is exactly what it would be without the container."],
      ),

      h2("When it isn't enough"),
      p(
        "The container is general: it has to do something reasonable for any layout, with nothing said about ",
        "intent. Sooner or later there's something it does that you'd want otherwise - items sliding in from the side ",
        "rather than fading, a bounce, a stagger. ", emphasis("It's meant to be taken apart."),
      ),
      points(
        [emphasis("Change one step."), " Every step of what it does is a method of its own - what leaves becoming ghosts, what's lifted, what's raised, how each element is drawn. Extend the class, and replace one. Below, what leaves is struck through as it fades."],
        [emphasis("Copy it."), " It's one file, ", name("FlipAnimationContainer.js"), " in cascade.dom, with every decision in it explained where it's made. Copy it into your app, give it a name of its own, and make it do exactly what your app needs. Nothing else depends on how it works inside."],
        [emphasis("Build on what's under it."), " ", name("DOMPlacingContainer"), " is the part that sees the whole subtree as elements and places them - with no animation at all. A container with an entirely different idea of animation starts there."],
        [emphasis("Or go around it."), " A component can animate itself: CSS transitions and animations work as anywhere, and a render component (see Advanced Usage) owns its DOM outright, for the Web Animations API or a library of your choice."],
      ),
      stage(new Custom()),
      codeBlock(customSource),

      nextPage({ path: "animation", label: "See it at work: the Animation Basics example →" }),
    );
  }
}
