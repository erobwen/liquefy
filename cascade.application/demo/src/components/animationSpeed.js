import { Component, callback, observable } from "@liquefy/cascade.component";
import { div, input, label, text, portalSource, FlipAnimationContainer } from "@liquefy/cascade.dom";
import { iconButton } from "@liquefy/cascade.ui";

/**
 * Animation on or off, and a slider for how fast it runs - for every
 * FlipAnimationContainer in the app (see cascade.dom's
 * FlipAnimationContainer.enabled and .speed), so it's one setting, kept
 * here, and shown by any page that wants it. Put animationSpeed() anywhere
 * in a page's build(): it renders nothing where it stands, and shows the
 * controls at the far end of the app's top bar (see ApplicationMenuFrame,
 * which provides that portal as `topBarEndPortal`).
 *
 * Both are only read as frames are drawn, so changing them places nothing
 * again: an animation under way just goes on at the new pace - or, switched
 * off, is where it belongs by the next frame.
 */
export function animationSpeed() {
  return new AnimationSpeed();
}

// The demo's settings, observable - so every page's controls show them.
// They start as whatever the app set (see index.js).
const setting = observable({ speed: null, enabled: null });

class AnimationSpeed extends Component {
  build() {
    const speed = setting.speed === null ? FlipAnimationContainer.speed : setting.speed;
    const enabled = setting.enabled === null ? FlipAnimationContainer.enabled : setting.enabled;
    return portalSource(
      { portal: "topBarEndPortal" },
      iconButton({
        icon: enabled ? "animation" : "motion_photos_off",
        title: enabled ? "Switch animation off" : "Switch animation on",
        style: { color: "white" },
        onClick: callback("toggle", () => {
          setting.enabled = !enabled;
          FlipAnimationContainer.enabled = setting.enabled;
        }),
      }),
      label(
        {
          title: "How fast animations run",
          style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", whiteSpace: "nowrap", opacity: enabled ? 1 : 0.4 },
        },
        text("Animation speed"),
        input({
          type: "range",
          min: 0.05,
          max: 2,
          step: 0.05,
          value: speed,
          disabled: !enabled,
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
