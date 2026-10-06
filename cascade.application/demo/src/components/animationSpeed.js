import { Component, callback, observable } from "@liquefy/cascade.component";
import { div, input, label, text, portalSource, FlipAnimationContainer } from "@liquefy/cascade.dom";

/**
 * A slider for how fast animations run - every FlipAnimationContainer in
 * the app (see cascade.dom's FlipAnimationContainer.speed), so it's one
 * setting, kept here, and shown by any page that wants it. Put
 * animationSpeed() anywhere in a page's build(): it renders nothing where
 * it stands, and shows the slider at the far end of the app's top bar (see
 * ApplicationMenuFrame, which provides that portal as `topBarEndPortal`).
 *
 * The speed is only read as frames are drawn, so changing it places nothing
 * again: an animation under way just goes on at the new pace.
 */
export function animationSpeed() {
  return new AnimationSpeed();
}

// The demo's speed, observable - so every slider shows it. It starts as
// whatever the app set (see index.js).
const setting = observable({ speed: null });

class AnimationSpeed extends Component {
  build() {
    const speed = setting.speed === null ? FlipAnimationContainer.speed : setting.speed;
    return portalSource(
      { portal: "topBarEndPortal" },
      label(
        { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", whiteSpace: "nowrap" }, title: "How fast animations run" },
        text("Animation speed"),
        input({
          type: "range",
          min: 0.05,
          max: 2,
          step: 0.05,
          value: speed,
          style: { width: "120px" },
          oninput: callback("slide", (event) => {
            setting.speed = Number(event.target.value);
            FlipAnimationContainer.speed = setting.speed;
          }),
        }),
        div({ style: { minWidth: "36px", fontVariantNumeric: "tabular-nums" } }, text("×" + speed.toFixed(2))),
      ),
    );
  }
}
