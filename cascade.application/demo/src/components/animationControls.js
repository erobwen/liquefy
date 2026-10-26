import { callback } from "@liquefy/cascade.component";
import { div, input, label, text, portalSource } from "@liquefy/cascade.dom";
import { iconButton } from "@liquefy/cascade.ui";

/**
 * Animation on or off, and a slider for how fast it runs - in the far end
 * of the app's top bar (see ApplicationMenuFrame, which provides that
 * portal as `topBarEndPortal`). Put it anywhere in a page's build(): it
 * renders nothing where it stands.
 *
 * It owns nothing: the page does - whether it animates, and how fast - and
 * gives that to its FlipAnimationContainer (its `speed`), or builds none at
 * all. The controls only show the page's state, and tell it what the user
 * changed:
 *
 *  - animate, speed: the page's state.
 *  - onAnimate(animate), onSpeed(speed): the user changed it.
 *
 * Its own handlers are named callbacks (see cascade.component's
 * callback()), kept by the page whose build() this is called from.
 */
export function animationControls({ animate, speed, onAnimate, onSpeed }) {
  return portalSource(
    { portal: "topBarEndPortal" },
    animationControlsHere({ animate, speed, onAnimate, onSpeed, color: "white" }),
  );
}

/**
 * The same controls, right where they're built - an example in a card of
 * its own, say (see the Showcase page) - in `color` (the text's own, by
 * default), with `label` before the slider ("Animation speed", by
 * default). An array: put it in whatever row it goes in.
 */
export function animationControlsHere({ animate, speed, onAnimate, onSpeed, color, label: words }) {
  return [
    iconButton({
      icon: animate ? "animation" : "motion_photos_off",
      title: animate ? "Switch animation off" : "Switch animation on",
      style: color ? { color } : {},
      onClick: callback("animationControlsToggle", () => onAnimate(!animate)),
    }),
    label(
      {
        title: "How fast animations run",
        style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", whiteSpace: "nowrap", opacity: animate ? 1 : 0.4, ...(color ? { color } : {}) },
      },
      text(words || "Animation speed"),
      input({
        type: "range",
        min: 0.05,
        max: 2,
        step: 0.05,
        value: speed,
        disabled: !animate,
        style: { width: "120px" },
        oninput: callback("animationControlsSpeed", (event) => onSpeed(Number(event.target.value))),
      }),
      div({ style: { minWidth: "36px", fontVariantNumeric: "tabular-nums" } }, text("×" + speed.toFixed(2))),
    ),
  ];
}
