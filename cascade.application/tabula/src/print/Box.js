import { Component } from "@liquefy/cascade.component";

/**
 * Box - what everything laid out onto a paper sequence is, as a Node is in
 * the DOM: the base class of the layout's components (Section, Paragraph,
 * and whatever a model builds of them), and the word for what they leave on
 * the papers.
 *
 * The boxes there are, so far:
 *
 *  - A line box: a placed line (see Paragraph.js) - the one kind of box the
 *    paper sequence holds itself.
 *  - A margin box: a paper's text area, inside its margins.
 *  - Around a laid-out flow of a model - a section, a paragraph - boxes
 *    worked out from its line boxes: its content box, the bounding box of
 *    everything actually in it; its marker box, the content box and every
 *    marker of the flow's (where a caret can be between text) besides; and
 *    its delimiter boxes, what opens and closes it apart from what it holds
 *    - mostly none, a section's title opening it (Tabula's
 *    ../paper/markers.js works these out).
 *
 * Nothing more, yet: what boxes do in common will be found as Tabula grows.
 */
export class Box extends Component {}
