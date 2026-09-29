import { Component } from "@liquefy/cascade.component";
import { h1, h2, p } from "@liquefy/cascade.dom";
import { pageActions } from "../components/pageActions.js";
import { article, nextPage } from "../components/layout.js";
import { codeBlock, stage, name } from "../components/examples.js";
import { ShuffleList } from "./convenient/ShuffleList.js";
import { NoticeBoard } from "./convenient/NoticeBoard.js";
import { ConfirmDelete } from "./convenient/ConfirmDelete.js";
import shuffleSource from "./convenient/ShuffleList.js?raw";
import noticeBoardSource from "./convenient/NoticeBoard.js?raw";
import confirmSource from "./convenient/ConfirmDelete.js?raw";
import source from "./ConvenientUsagePage.js?raw";

/**
 * Convenient Usage - the continuation of Getting Started: things nearly
 * every app wants, each ready to use in a line or two. Every example is a
 * file of its own in ./convenient/, shown as it is, and running right on
 * the page, with this app's own services. Advanced Usage comes after.
 */
export class ConvenientUsagePage extends Component {
  build() {
    return article(
      { key: "convenientUsage" },
      pageActions({ source, fileName: "src/pages/ConvenientUsagePage.js" }),
      h1("Convenient Usage"),
      p(
        "Picking up where Getting Started left off: things nearly every app wants - animation, content shown ",
        "somewhere else, modal dialogs - each ready to use in a line or two.",
      ),

      h2("Animation, as a separate concern"),
      p(
        "Wrap anything in ", name("flip", "flipAnimationContainer()"), ", and every change in it animates: elements ",
        "moving, appearing, leaving and resizing. What's inside is entirely unaware of it - this list is just a list, ",
        "and the one line around it is all the animation there is.",
      ),
      stage("shuffleStage", new ShuffleList({ key: "shuffleList" })),
      p(
        "Note: CSS and transition animations can not by itself handle changes in the DOM tree shape, often leading to complicated FLIP animation setups, all which are automated here.",
      ),
      codeBlock("shuffleCode", shuffleSource),

      h2("Portals"),
      p(
        "A component can show content somewhere else entirely: ", name("portal", "portal()"), " is a place for it, ",
        name("portalSource", "portalSource()"), " puts content there, from anywhere - found by name, nothing ",
        "handed down. This demo's pages put their buttons in the top bar the same way.",
      ),
      stage("noticeStage", new NoticeBoard({ key: "noticeBoard" })),
      codeBlock("noticeCode", noticeBoardSource),

      h2("Modals"),
      p(
        name("overlay", "overlay()"), " shows its content over the whole app - on the overlay frame at the app's root ",
        "(", name("overlayFrame", "overlayFrame()"), ") - while it's built right where it belongs, next to the button ",
        "that opens it.",
      ),
      stage("confirmStage", new ConfirmDelete({ key: "confirmDelete" })),
      codeBlock("confirmCode", confirmSource),

      nextPage({ key: "advanced", path: "advanced-usage", label: "Ready for the hard parts? On to Advanced Usage →" }),
    );
  }
}
