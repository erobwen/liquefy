
import { toPropertiesWithChildren, Component } from "@liquefy/flow.core";

import { div, addDefaultStyle } from "@liquefy/flow.DOM";

import { centerMiddle, centerMiddleStyle, column, columnStyle, fitContainerStyle, row, zStack, zStackElementStyle } from "./Layout";
import { button, buttonIcon } from "./buttons"
import { wrapper, overflowVisibleStyle, filler } from "./Layout";
import { overlay } from "./overlay";
import { cardColumn, cardShadow4 } from "./card";



export const popover = (...parameters) => new Popover(...parameters)

class Popover extends Component {
  receive(properties) {
    const {children, reference, close, direction="top" } = properties; 
    this.children = children;
    this.reference = reference;
    this.close = close;
    this.direction = direction;
  } 

  initialize() {
    this.ensure(() => {
      if (this.isRendered()) {
        const background = this.getChild("background");
        if (background && background.domNode) {
          background.domNode.addEventListener("mousedown", () => { this.close() }, true);
        }
      }
    })
  }

  render() {
    const { children, reference } = this;

    if (children.length !== 1) throw new Error("Modal popover expects just one single child to get dimensions.");
    const popoverDimensions = children[0].getPrimitive().dimensions();
    console.log(popoverDimensions);
    // if (!["top", "bottom"].includes(direction)) throw new Error("This component only supports 'top' as direction so far.")
  
    const referenceRect = reference.getPrimitive().reactiveBoundingClientRect(); 
    const referenceRectMiddle = referenceRect.top + referenceRect.height / 2;
    const windowHeightMiddle = window.innerHeight / 2;
    const xSpace = window.innerWidth - referenceRect.width;
    const referenceXFraction = (xSpace - referenceRect.left) / xSpace; // 1 = to the right, 0 = to the left.
    const abstractReferenceXFraction = Math.round(referenceXFraction * 3)/3;  
    const menuBottom = {
      top:() => referenceRect.top, 
      bottom:() => referenceRect.bottom + popoverDimensions.height, 
    }[referenceRectMiddle < windowHeightMiddle ? "bottom" : "top"]();
    
    const menuLeft = referenceRect.left - (popoverDimensions.width - referenceRect.width) 
      + (popoverDimensions.width - referenceRect.width) * referenceXFraction;
  
    const background = div({
      key: "background", 
      // onClick: () => { close(); }, 
      style: {
        ...zStackElementStyle, 
        ...overflowVisibleStyle, 
        transition: "background-color 1000ms linear", 
        pointerEvents: "auto", 
        backgroundColor: "rgba(0, 0, 0, 0)"
      }});
  
    return overlay(
      zStack(
        background,
        div(
          wrapper(
            children, 
            {style: {pointerEvents: "auto", position: "absolute", top: menuBottom - popoverDimensions.height, left: menuLeft}
          }),
          {style: {...zStackElementStyle, ...overflowVisibleStyle, height: "100%"}}
        ),
        {style: fitContainerStyle, ...overflowVisibleStyle}
      )
    )
  }
}

const shadeColor = "rgba(0, 0, 0, 0.4)";

export const modal = (...parameters) => new Modal(...parameters);

export class Modal extends Component {
  receive({close, content, children, backgroundColor=shadeColor}) {
    this.close = close; 
    this.content = content; 
    this.children = children;
    this.backgroundColor = backgroundColor;
  }

  initialize() {}

  render() {
    return ( 
      overlay(
        zStack("zStack",
          div("background", {
            onClick: () => { this.close() }, 
            style: {
              ...zStackElementStyle, 
              ...overflowVisibleStyle, 
              transition: "background-color 1000ms linear", 
              pointerEvents: "auto", 
              backgroundColor: this.backgroundColor
            }
          }),
          centerMiddle("centerMiddle",
            wrapper("dialogueWrapper",              
              this.content,
              this.children,
            ),
            {style: {...zStackElementStyle, height: "100%"}}
          ),
          {style: fitContainerStyle}
        )
      )
    )
  }
}


export const dialogue = (...parameters) => {
  const properties = addDefaultStyle(
    toPropertiesWithChildren(parameters), 
    {padding: 0, pointerEvents: "auto"}
  )
  
  const {close, children, style, variant="filled"} = addDefaultStyle(properties, {
    boxShadow: cardShadow4
  }); 

  return (
    cardColumn("dialogue",
      row(
        filler(),
        buttonIcon({name: "close", onClick: () => close()})
      ),
      children,
      {
        variant,
        style
      }
    )
  );
}

const materialToFontAwesomeMap = {
  "home": "fa-home",
  "menu": "fa-bars",
  "search": "fa-search",
  "account_circle": "fa-user-circle",
  "settings": "fa-cog",
  "logout": "fa-sign-out-alt",
  "login": "fa-sign-in-alt",
  "person": "fa-user",
  "people": "fa-users",
  "email": "fa-envelope",
  "phone": "fa-phone",
  "favorite": "fa-heart",
  "star": "fa-star",
  "check": "fa-check",
  "close": "fa-times",
  "delete": "fa-trash",
  "edit": "fa-edit",
  "add": "fa-plus",
  "remove": "fa-minus",
  "arrow_back": "fa-arrow-left",
  "arrow_forward": "fa-arrow-right",
  "cloud": "fa-cloud",
  "cloud_upload": "fa-cloud-upload-alt",
  "cloud_download": "fa-cloud-download-alt",
  "camera_alt": "fa-camera",
  "photo": "fa-image",
  "lock": "fa-lock",
  "lock_open": "fa-lock-open",
  "visibility": "fa-eye",
  "visibility_off": "fa-eye-slash",
  "warning": "fa-exclamation-triangle",
  "info": "fa-info-circle",
  "help": "fa-question-circle",
  "shopping_cart": "fa-shopping-cart",
  "attach_money": "fa-dollar-sign",
  "event": "fa-calendar-alt",
  "notifications": "fa-bell",
  "language": "fa-globe",
  "play_arrow": "fa-play",
  "pause": "fa-pause",
  "stop": "fa-stop",
  "refresh": "fa-sync",
  "location_on": "fa-map-marker-alt",
  "directions_car": "fa-car",
  "directions_bike": "fa-bicycle",
  "directions_bus": "fa-bus",
  "map": "fa-map",
  "build": "fa-tools",
  "school": "fa-graduation-cap",
  "work": "fa-briefcase",
  "flight": "fa-plane",
  "print": "fa-print",
  "access_time": "fa-clock",
  "attach_file": "fa-paperclip",
  "folder": "fa-folder",
  "folder_open": "fa-folder-open",
  "file_copy": "fa-copy",
  "download": "fa-download",
  "upload": "fa-upload",
  "brightness_6": "fa-adjust",
  "check_circle": "fa-check-circle",
  "cancel": "fa-times-circle"
};