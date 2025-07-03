// import { library } from '@fortawesome/fontawesome-svg-core';
// import { faCross, faPlus, faSuitcase, faXmark, faXmarkCircle } from '@fortawesome/free-solid-svg-icons';
// import { DOMElementNode } from '@liquefy/flow';
// import { finalize, repeat, trace } from '@liquefy/flow';
import { extractProperty, toProperties } from "@liquefy/flow.core";
import { span, addDefaultStyle } from '@liquefy/flow.DOM';

import "./Icons.css";

// "@fortawesome/fontawesome-svg-core": "^6.4.0",
// "@fortawesome/free-regular-svg-icons": "^6.4.0",
// "@fortawesome/free-solid-svg-icons": "^6.4.0",

// import { aggregateToString } from '@liquefy/flow';
// library.add(faSuitcase);
// library.add(faPlus);
// library.add(faCross);
// library.add(faXmark);
// library.add(faXmarkCircle);


export function icon(...parameters) {
  const properties = toProperties(parameters);
  // addDefaultStyle(properties, {
  //   width: 24,
  //   height: 24,
  //   lineHeight: 24
  // })
  properties.name = materialToFontAwesomeMap[properties.name]
  return faIcon(properties); 
}

export function faIcon(...parameters) {
  const properties = toProperties(parameters);
  // console.log(properties);
  const name = extractProperty(properties, "name");
  // console.log(name);
  properties.class = "fa " + name;
  return span(properties)
  // return new DOMFaNode(properties);
}

const materialToFontAwesomeMap = {
  // Already covered
  "home": "fa-home",
  "menu": "fa-bars",
  "close": "fa-times",
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
  "favorite_border": "fa-heart-broken",
  "star": "fa-star",
  "star_half": "fa-star-half-alt",
  "check": "fa-check",
  "check_circle": "fa-check-circle",
  "close": "fa-times",
  "cancel": "fa-times-circle",
  "delete": "fa-trash",
  "edit": "fa-edit",
  "add": "fa-plus",
  "remove": "fa-minus",
  "arrow_back": "fa-arrow-left",
  "arrow_forward": "fa-arrow-right",
  "arrow_upward": "fa-arrow-up",
  "arrow_downward": "fa-arrow-down",
  "expand_more": "fa-chevron-down",
  "expand_less": "fa-chevron-up",
  "keyboard_arrow_down": "fa-angle-down",
  "keyboard_arrow_up": "fa-angle-up",
  "keyboard_arrow_left": "fa-angle-left",
  "keyboard_arrow_right": "fa-angle-right",
  "drag_handle": "fa-grip-lines",
  "open_in_new": "fa-external-link-alt",
  "refresh": "fa-sync",
  "file_copy": "fa-copy",
  "attach_file": "fa-paperclip",
  "download": "fa-download",
  "upload": "fa-upload",
  "photo": "fa-image",
  "camera_alt": "fa-camera",
  "lock": "fa-lock",
  "lock_open": "fa-lock-open",
  "visibility": "fa-eye",
  "visibility_off": "fa-eye-slash",
  "notifications": "fa-bell",
  "notifications_off": "fa-bell-slash",
  "warning": "fa-exclamation-triangle",
  "info": "fa-info-circle",
  "help": "fa-question-circle",
  "language": "fa-globe",
  "event": "fa-calendar-alt",
  "shopping_cart": "fa-shopping-cart",
  "payment": "fa-credit-card",
  "attach_money": "fa-dollar-sign",
  "folder": "fa-folder",
  "folder_open": "fa-folder-open",
  "insert_drive_file": "fa-file",
  "play_arrow": "fa-play",
  "pause": "fa-pause",
  "stop": "fa-stop",
  "volume_up": "fa-volume-up",
  "volume_off": "fa-volume-mute",
  "access_time": "fa-clock",
  "flight": "fa-plane",
  "flight_takeoff": "fa-plane-departure",
  "flight_land": "fa-plane-arrival",
  "luggage": "fa-suitcase-rolling",
  "directions_car": "fa-car",
  "directions_bus": "fa-bus",
  "directions_bike": "fa-bicycle",
  "train": "fa-train",
  "commute": "fa-subway",
  "hotel": "fa-hotel",
  "map": "fa-map",
  "location_on": "fa-map-marker-alt",
  "school": "fa-graduation-cap",
  "work": "fa-briefcase",
  "dashboard": "fa-th-large",
  "apps": "fa-th",
  "view_list": "fa-list",
  "view_module": "fa-th",
  "build": "fa-tools",
  "code": "fa-code",
  "bug_report": "fa-bug",
  "cloud": "fa-cloud",
  "cloud_upload": "fa-cloud-upload-alt",
  "cloud_download": "fa-cloud-download-alt",
  "wifi": "fa-wifi",
  "memory": "fa-microchip",
  "battery_full": "fa-battery-full",
  "battery_alert": "fa-battery-quarter",
  "brightness_6": "fa-adjust",
  "sync": "fa-sync",
  "chat": "fa-comment",
  "forum": "fa-comments",
  "receipt": "fa-receipt",
  "verified_user": "fa-shield-alt",
  "thumb_up": "fa-thumbs-up",
  "thumb_down": "fa-thumbs-down",
  "trending_up": "fa-chart-line",
  "trending_down": "fa-chart-line",
  "bar_chart": "fa-chart-bar",

  // Additional (your requested)
  "error": "fa-exclamation-circle",
  "info_outline": "fa-info-circle",
  "check_circle_outline": "fa-check-circle",
  "report_problem": "fa-exclamation-triangle",

  // Exact name matches to Font Awesome (extra convenience)
  "exclamation-triangle": "fa-exclamation-triangle",
  "exclamation-circle": "fa-exclamation-circle",
  "info-circle": "fa-info-circle",
  "check-circle": "fa-check-circle"
};