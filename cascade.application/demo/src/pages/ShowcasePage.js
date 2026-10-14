import { Component, callback } from "@liquefy/cascade.component";
import { a, div, h1, h2, h3, p, img, span, text, elementVisibilityProvider } from "@liquefy/cascade.dom";
import { icon, themeColor } from "@liquefy/cascade.ui";
import { InformationButton } from "../components/pageActions.js";
import { CodeButton, HighlightedCode } from "../components/code.js";
import { Stage } from "../components/revealStage.js";
import { AnimatedLogotype } from "../components/animatedLogotype.js";
import source from "./ShowcasePage.js?raw";
import temporalSignalsBoard from "../../../../cascade/images/temporal-signals.svg";
import keyConcepts from "../../../../cascade/images/key-concepts.svg";
import onelinerAnimation from "../../../../cascade/images/oneliner-animation.png";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "The Introduction again - as a full-screen marketing page, revealing itself as you scroll:",
  points: [
    "Each section is on an elementVisibilityProvider() - elementBoundsProvider()'s sibling, in cascade.dom: the section reads this.fromTarget(\"seen\") as it would read its width, and is built again the moment it scrolls into view.",
    "What flies in is FlipAnimationContainer's ordinary animation. Until its section has been seen, a piece waits in a wing just outside the section's edge, clipped away. Seen, it's built in its slot instead - it moved to another parent, so the container makes it travel there.",
    "A section keeps the room it will need before it's revealed: each render, its pieces are put in their slots and the section is measured, then put back in their wings - within the render, before anything is drawn, the toolbar ellipsis' technique (see ../components/revealStage.js).",
    "Text, and the letters of the logotype, move with plain CSS transitions: in their place from the start, only invisible - so a prerendered page has every word in it.",
    "Sizes and columns follow the room the page has, measured - no media queries. Asked for less motion (prefers-reduced-motion), it's all simply there.",
    "Full screen: the app's frame shows it as an overlay, above its menu and top bar. A first visit to the app starts here.",
  ],
};

// Where the browser remembers that this page has been shown (see
// showcaseShown()).
const shownKey = "cascade.showcaseShown";

/**
 * Whether this browser has been shown this page before - so a first visit
 * to the app can start here, and only the first (see index.js). Where
 * nothing can be remembered (storage switched off), as if it had: never
 * shown again and again.
 */
export function showcaseShown() {
  try {
    return window.localStorage.getItem(shownKey) !== null;
  } catch (error) {
    return true;
  }
}

// Temporal signals in their smallest form - as on the Introduction page.
const temporalSignalsExample = `const heading = observable({ text: "hello world", size: 16 });

// Time 0: capitalizes the text - writing the very property it reads.
repeat(() => { heading.text = heading.text.toUpperCase(); }, { time: 0 });

// Time 1: headings are twice the size - the same, for the size.
repeat(() => { heading.size = heading.size * 2; }, { time: 1 });

// Time 2: sees the heading as times 0 and 1 left it.
repeat(() => console.log(heading.text, heading.size + "px"), { time: 2 });
// HELLO WORLD 32px`;

const features = [
  { icon: "timer", title: "Sub-frame precision", body: "Every component renders in a well-defined order, with the real DOM at hand: measure, lay out and set up animations within the same frame." },
  { icon: "timeline", title: "Temporal signals", body: "Ordered readers and writers of the same objects - implicit dependencies along the pipeline, no graph of intermediate signals." },
  { icon: "bolt", title: "Minimal DOM updates", body: "A rebuild touches only the nodes that actually changed. Fine-grained, targeted, and with no virtual DOM to diff." },
  { icon: "fingerprint", title: "Stable identity", body: "Keyed and pattern-matched components keep their state and their elements across rebuilds - even when they move elsewhere." },
  { icon: "dashboard", title: "Programmatic layout", body: "Responsive layout from real measurements, rebuilt as they change - not media queries. This page is laid out that way." },
  { icon: "palette", title: "Themes, all the way", body: "Every element is asked for through a service locator, so a theme can replace whole components at runtime." },
  { icon: "animation", title: "Transition animations", body: "Moving, resizing, appearing and leaving all animate - with no changes to the components animated." },
  { icon: "call_split", title: "Portals", body: "Put content anywhere in the tree - a page's buttons in the top bar, a cart in the status bar." },
  { icon: "travel_explore", title: "Prerendering", body: "Every page rendered in a real browser at build time, as plain HTML - for search engines, link previews and AI." },
];

// Asked for less motion: everything is simply there, nothing animates.
const calm = typeof(window) !== "undefined" && typeof(window.matchMedia) === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

// Text rising into view: in its place all along - so it's in a prerendered
// page, and nothing moves under the reader - only invisible, and a little
// off, until its section has been seen. A CSS transition, of `translate`:
// a FlipAnimationContainer draws with `transform`, and the two add up.
function rise(shown, delay = 0, from = "below") {
  const offset = { below: "0 48px", left: "-64px 0", right: "64px 0" }[from];
  return {
    opacity: shown ? 1 : 0,
    translate: shown ? "none" : offset,
    transition: `opacity 900ms ${ease} ${delay}ms, translate 1100ms ${ease} ${delay}ms`,
  };
}

/**
 * Showcase - the Introduction page as a full-screen marketing page: a
 * hero filling the screen, the logotype flying in letter by letter at its
 * top, then one section after another, each revealing itself as it
 * scrolls into view - text rising, cards and pictures flying in from the
 * sides.
 *
 * Full screen: the app's frame shows it as an overlay, over its menu and
 * top bar alike (see ApplicationMenuFrame - a page with `fullScreen`) - so
 * the page has its own way back into the app, and its own information and
 * code buttons, at its top. Shown, it's remembered (see showcaseShown()):
 * a first visit to the app starts here, and only the first.
 *
 * The page lays itself out from the room it has - the overlay, measured:
 * font sizes, paddings and columns are computed, not media queries - and
 * the hero is exactly one screen high. It scrolls in a panel of its own.
 *
 * Each section is a component of its own, on an elementVisibilityProvider
 * (see cascade.dom) - so a section reads this.fromTarget("seen") as it
 * would read a measured size, and only that section is built again when it
 * scrolls into view. What it does with it: text rises with a CSS transition
 * (see rise()), and what flies in is moved from a wing to its slot, which
 * its own FlipAnimationContainer animates - with the room it will need
 * kept from the start (see ../components/revealStage.js).
 */
export class ShowcasePage extends Component {
  onShow() {
    try {
      window.localStorage.setItem(shownKey, new Date().toISOString());
    } catch (error) {
      // Nothing to remember it in: it's shown, all the same.
    }
  }

  build() {
    const width = this.fromTarget("width");
    const height = this.fromTarget("height");
    const room = {
      width: typeof(width) === "number" ? width : 1200,
      height: typeof(height) === "number" ? height : 800,
    };
    // How large everything is: full size from 1200 pixels, down to 60% of it.
    room.scale = Math.min(1, Math.max(0.6, room.width / 1200));
    room.narrow = room.width < 820;
    const revealing = (section) => elementVisibilityProvider({ child: section });
    return div(
      // Clicks taken: it's on an overlay, which lets them through where
      // nothing is shown.
      { style: { position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", pointerEvents: "auto", background: themeColor.page, color: themeColor.text } },
      revealing(new Hero({ room })),
      revealing(new TemporalSignals({ room })),
      revealing(new OneLiner({ room })),
      revealing(new Features({ room })),
      revealing(new KeyConcepts({ room })),
      revealing(new ForReactDevelopers({ room })),
      revealing(new Finale({ room })),
    );
  }
}

// A section, revealing itself: whether it has been seen yet - see
// elementVisibilityProvider() - and the stage it's built on.
class Section extends Component {
  setProperties({ room }) {
    this.room = room;
  }

  get shown() {
    return calm || !!this.fromTarget("seen");
  }

  // Its content, as wide as is comfortable to read - with room around it.
  inner(...children) {
    const { scale, narrow } = this.room;
    return div(
      { style: { maxWidth: "1120px", margin: "0 auto", padding: `${Math.round(120 * scale)}px ${narrow ? 20 : 40}px`, boxSizing: "border-box" } },
      ...children,
    );
  }

  // Two columns, side by side - one under the other, when narrow.
  columns(template, ...children) {
    return div(
      { style: { display: "grid", gridTemplateColumns: this.room.narrow ? "1fr" : template, gap: `${Math.round(56 * this.room.scale)}px`, alignItems: "center" } },
      ...children,
    );
  }

  eyebrow(label, delay = 0, onDark = false) {
    return div(
      {
        style: {
          display: "inline-block", padding: "6px 14px", borderRadius: "999px", fontSize: "13px", fontWeight: 700,
          letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "20px",
          color: onDark ? "white" : themeColor.accentDark,
          background: onDark ? "rgba(255, 255, 255, 0.12)" : themeColor.accentFaint,
          border: "1px solid " + (onDark ? "rgba(255, 255, 255, 0.25)" : themeColor.accentSoft),
          ...rise(this.shown, delay),
        },
      },
      text(label),
    );
  }

  title(content, delay = 0, style = {}) {
    return h2(
      { style: { fontSize: Math.round(54 * this.room.scale) + "px", lineHeight: 1.08, letterSpacing: "-0.02em", fontWeight: 800, margin: "0 0 24px 0", ...rise(this.shown, delay), ...style } },
      ...content,
    );
  }

  lead(content, delay = 0, style = {}) {
    return p(
      { style: { fontSize: Math.round(21 * Math.max(this.room.scale, 0.85)) + "px", lineHeight: 1.6, opacity: 0.85, margin: "0 0 20px 0", ...rise(this.shown, delay), ...style } },
      ...content,
    );
  }

  // A picture on a card of its own - to fly in.
  // Its aspect ratio given: it has its size before it's loaded - measured
  // with it, before it's revealed (see ../components/revealStage.js).
  picture(key, src, alt, ratio, style = {}) {
    return div(
      { key, style: { borderRadius: "20px", overflow: "hidden", background: themeColor.chrome, boxShadow: "0 30px 60px -20px rgba(0, 0, 0, 0.45)", ...style } },
      img({ src, alt, style: { display: "block", width: "100%", aspectRatio: ratio } }),
    );
  }
}

// Words in the accent's gradient - the flashy part.
function shine(words, onDark = false) {
  return span(
    {
      style: {
        background: onDark
          ? `linear-gradient(100deg, ${themeColor.accentLight}, white 60%, ${themeColor.accentLight})`
          : `linear-gradient(100deg, ${themeColor.accentDark}, ${themeColor.accent})`,
        WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
      },
    },
    text(words),
  );
}

// The first screen: what Cascade is, in big letters, and the way in.
class Hero extends Section {
  build() {
    const { scale, narrow, height } = this.room;
    const stage = new Stage(this.shown, { animate: !calm });
    const stat = (key, figure, label) => stage.fly("right", div(
      {
        key,
        style: {
          padding: "20px 24px", borderRadius: "18px", color: "white",
          background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.18)",
          boxShadow: "0 20px 40px -20px rgba(0, 0, 0, 0.6)", backdropFilter: "blur(12px)",
        },
      },
      div({ style: { fontSize: Math.round(40 * scale) + "px", fontWeight: 800, lineHeight: 1.1 } }, shine(figure, true)),
      div({ style: { opacity: 0.8, marginTop: "4px" } }, text(label)),
    ));
    const stats = [
      stat("statPass", "1 pass", "rendered straight onto the real DOM"),
      stat("statLine", "1 line", "to animate an entire form"),
      stat("statCss", "0 CSS files", "plain JavaScript, top to bottom"),
    ];
    // Its own top bar: full screen, the app's is under it. The logotype,
    // flying in letter by letter - and the way into the app.
    const topBar = div(
      { style: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: "8px", padding: narrow ? "20px" : "28px 40px", zIndex: 1 } },
      new AnimatedLogotype({ shown: this.shown, style: { width: Math.round(280 * scale) + "px", flex: "none" } }),
      div({ style: { flex: "1 1 auto" } }),
      new InformationButton({ key: "information", ...information }),
      new CodeButton({ source, fileName: "src/pages/ShowcasePage.js" }),
      div(
        { style: { marginLeft: narrow ? "4px" : "12px", ...rise(this.shown, 600) } },
        new Cta({ key: "heroDocumentation", path: "", label: narrow ? "Docs" : "Documentation", onDark: true, small: true }),
      ),
    );
    return stage.build(
      {
        minHeight: height + "px", paddingTop: narrow ? "56px" : "72px", display: "flex", flexDirection: "column", justifyContent: "center", color: "white",
        background: `radial-gradient(circle at 15% 20%, ${themeColor.accent} 0%, transparent 45%), radial-gradient(circle at 90% 85%, ${themeColor.accentDark} 0%, transparent 55%), ${themeColor.chromeDark}`,
      },
      topBar,
      this.inner(this.columns(
        "1.35fr 1fr",
        div(
          this.eyebrow("Reactive front end framework", 0, true),
          h1(
            { style: { fontSize: Math.round(84 * scale) + "px", lineHeight: 1.02, letterSpacing: "-0.03em", fontWeight: 800, margin: "0 0 28px 0", ...rise(this.shown, 120) } },
            text("What if everything was "), shine("reactive?", true),
          ),
          this.lead([text("Cascade makes it simple and fast to build user interfaces that are data driven, generative and reactive - rendered directly onto the real DOM, in one pass, with minimal changes.")], 260),
          div(
            { style: { display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "36px", ...rise(this.shown, 400) } },
            new Cta({ key: "heroStart", path: "getting-started", label: "Get started", primary: true }),
            new Cta({ key: "heroForm", path: "reactive-form", label: "See a form animate", onDark: true }),
          ),
        ),
        div({ style: { display: "flex", flexDirection: "column", gap: "18px" } }, stats),
      )),
      narrow ? null : div(
        { style: { position: "absolute", bottom: "28px", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: this.shown ? 0.7 : 0, transition: `opacity 1200ms ${ease} 900ms`, fontSize: "13px", letterSpacing: "0.14em", textTransform: "uppercase" } },
        text("Scroll to explore"),
        icon({ name: "keyboard_arrow_down", style: { fontSize: "28px" } }),
      ),
    );
  }
}

class TemporalSignals extends Section {
  build() {
    const stage = new Stage(this.shown, { animate: !calm });
    const board = stage.fly("right", this.picture("temporalBoard", temporalSignalsBoard, "Temporal signals: components - temporal observers - read (R) and write (W) the properties of data objects, along time. A change written to one property reaches only the readers after it in the pipeline.", "370.41666 / 234.37019"));
    const code = stage.fly("below", div(
      { key: "temporalCode", style: { borderRadius: "20px", overflow: "hidden", background: themeColor.surface, border: "1px solid " + themeColor.border, boxShadow: "0 30px 60px -30px rgba(0, 0, 0, 0.35)" } },
      new HighlightedCode({ source: temporalSignalsExample, style: { padding: "24px", overflow: "auto", lineHeight: "1.5", fontSize: "14px" } }),
    ));
    return stage.build(
      { background: themeColor.page },
      this.inner(
        this.columns(
          "1fr 1fr",
          div(
            this.eyebrow("World's first"),
            this.title([text("Temporal "), shine("signals")], 100),
            this.lead([text("Signals come with one value per property. Temporal signals add the time dimension: a pipeline of readers and writers of the very same objects, each in its own time frame, invalidating only those downstream.")], 200),
            this.lead([text("No explicit dependency graph. No intermediate signals. Just the rendering pipeline, as it really is.")], 300),
          ),
          board,
        ),
        div({ style: { marginTop: Math.round(64 * this.room.scale) + "px" } }, code),
      ),
    );
  }
}

class OneLiner extends Section {
  build() {
    const stage = new Stage(this.shown, { animate: !calm });
    const picture = stage.fly("left", this.picture("oneliner", onelinerAnimation, "The Reactive Form page's source: the whole form is animated by wrapping it in flipAnimationContainer().", "1004 / 733"));
    return stage.build(
      { color: "white", background: `linear-gradient(160deg, ${themeColor.chromeDark}, ${themeColor.accentDark})` },
      this.inner(this.columns(
        "1.1fr 1fr",
        picture,
        div(
          this.eyebrow("Standout feature", 0, true),
          this.title([text("Animate an entire form. "), shine("With one line.", true)], 100),
          this.lead([text("Wrap it in flipAnimationContainer(), and everything in it moves, grows, appears and leaves smoothly - with no changes to the components animated. Sub-frame render precision makes the FLIP setup possible in the middle of a render.")], 200),
          div({ style: { marginTop: "28px", ...rise(this.shown, 300) } }, new Cta({ key: "onelinerForm", path: "reactive-form", label: "See it in action", primary: true })),
        ),
      )),
    );
  }
}

class Features extends Section {
  build() {
    const { narrow, scale } = this.room;
    const stage = new Stage(this.shown, { animate: !calm });
    const columns = narrow ? 1 : 3;
    // Each column flies in from its own side - the middle one from below.
    // One column: they take turns.
    const side = (index) => narrow
      ? (index % 2 === 0 ? "left" : "right")
      : ["left", "below", "right"][index % 3];
    const cards = features.map((feature, index) => stage.fly(side(index), div(
      {
        key: "feature" + index,
        style: {
          padding: "28px", borderRadius: "20px", background: themeColor.surface, border: "1px solid " + themeColor.border,
          boxShadow: "0 24px 48px -28px rgba(0, 0, 0, 0.35)",
        },
      },
      div(
        { style: { width: "52px", height: "52px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "18px", color: "white", background: `linear-gradient(135deg, ${themeColor.accent}, ${themeColor.accentDark})` } },
        icon({ name: feature.icon, style: { fontSize: "28px" } }),
      ),
      h3({ style: { margin: "0 0 8px 0", fontSize: "20px" } }, text(feature.title)),
      p({ style: { margin: 0, lineHeight: 1.55, opacity: 0.8 } }, text(feature.body)),
    )));
    return stage.build(
      { background: `linear-gradient(180deg, ${themeColor.page}, ${themeColor.accentFaint})` },
      this.inner(
        div(
          { style: { textAlign: "center", maxWidth: "760px", margin: "0 auto " + Math.round(56 * scale) + "px" } },
          this.eyebrow("Technical features"),
          this.title([text("Built for "), shine("precision")], 100),
          this.lead([text("Everything a modern front end needs - and a few things no other framework has.")], 200),
        ),
        div({ style: { display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "24px" } }, cards),
        p(
          { style: { textAlign: "center", marginTop: "40px", opacity: 0.7, ...rise(this.shown, 300) } },
          text("And more: JS Proxies for transparent dependency tracking, hydration, JSX support, component inheritance, JavaScript first - no CSS files, no compile step."),
        ),
      ),
    );
  }
}

class KeyConcepts extends Section {
  build() {
    const stage = new Stage(this.shown, { animate: !calm });
    const picture = stage.fly("below", this.picture("keyConcepts", keyConcepts, "Key concepts", "529.16663 / 304.27081"));
    return stage.build(
      { background: themeColor.page },
      this.inner(this.columns(
        "1fr 1.2fr",
        div(
          this.eyebrow("Key concepts"),
          this.title([text("Build, or "), shine("render.")], 100),
          this.lead([text("Build components compose children and let them do the work. Render components take the render target in their own hands. App components build; library components render.")], 200),
          this.lead([text("Both see the render context - timeless values only - so a build always sees the final value of every property.")], 300),
        ),
        picture,
      )),
    );
  }
}

class ForReactDevelopers extends Section {
  build() {
    const { scale } = this.room;
    const stage = new Stage(this.shown, { animate: !calm });
    const list = (key, heading, points, accent) => div(
      {
        key,
        style: {
          padding: "32px", borderRadius: "20px", background: themeColor.surface, boxShadow: "0 24px 48px -28px rgba(0, 0, 0, 0.35)",
          border: "1px solid " + themeColor.border, borderTop: "4px solid " + (accent ? themeColor.accent : themeColor.borderStrong),
        },
      },
      h3({ style: { margin: "0 0 16px 0", fontSize: "22px" } }, text(heading)),
      points.map((point) => div(
        { style: { display: "flex", gap: "12px", alignItems: "flex-start", margin: "0 0 14px 0", lineHeight: 1.55 } },
        icon({ name: accent ? "bolt" : "check", style: { fontSize: "20px", color: themeColor.accent, flex: "none", marginTop: "2px" } }),
        span(text(point)),
      )),
    );
    const similar = stage.fly("left", list("similar", "Feels familiar", [
      "Render functions, with keys for a stable identity across rebuilds - unique per build, so children can move anywhere.",
      "Pattern matching keeps static children without keys.",
      "JSX, for those who prefer it.",
    ], false));
    const different = stage.fly("right", list("different", "Goes further", [
      "No black-box render cycle: your code reads and changes the DOM during the render - what takes React several frames, takes one.",
      "State management built in, on JS Proxies.",
      "Object oriented: changes are detected in any object, no immutability required.",
    ], true));
    return stage.build(
      { background: `linear-gradient(180deg, ${themeColor.page}, ${themeColor.accentFaint})` },
      this.inner(
        div(
          { style: { textAlign: "center", maxWidth: "760px", margin: "0 auto " + Math.round(56 * scale) + "px" } },
          this.eyebrow("Coming from React?"),
          this.title([text("All of React and MobX. "), shine("Then some.")], 100),
        ),
        this.columns("1fr 1fr", similar, different),
        p(
          { style: { textAlign: "center", fontSize: Math.round(24 * Math.max(scale, 0.8)) + "px", fontWeight: 600, lineHeight: 1.45, maxWidth: "820px", margin: Math.round(64 * scale) + "px auto 0", ...rise(this.shown, 300) } },
          text("Take every capability of React and MobX, add temporal signals and sub-frame precision, and mix it all together. That's Cascade."),
        ),
      ),
    );
  }
}

// The last screen: the way on.
class Finale extends Section {
  build() {
    const { height } = this.room;
    return new Stage(this.shown, { animate: !calm }).build(
      {
        minHeight: Math.round(height * 0.8) + "px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", color: "white",
        background: `radial-gradient(circle at 50% 120%, ${themeColor.accent} 0%, transparent 60%), ${themeColor.chromeDark}`,
      },
      this.inner(
        this.title([text("Ready to "), shine("cascade?", true)], 0, { fontSize: Math.round(72 * this.room.scale) + "px" }),
        this.lead([text("Start with the basics, or jump straight into the examples.")], 120),
        div(
          { style: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px", marginTop: "36px", ...rise(this.shown, 240) } },
          new Cta({ key: "finaleStart", path: "getting-started", label: "Get started", primary: true }),
          new Cta({ key: "finaleStore", path: "focus-store", label: "Browse the examples", onDark: true }),
          new Cta({ key: "finaleRepository", href: "https://github.com/erobwen/liquefy", label: "GitHub", onDark: true }),
        ),
        p({ style: { marginTop: "48px", color: "rgba(255, 255, 255, 0.55)", fontSize: "14px", ...rise(this.shown, 360) } }, text("This demo is a work in progress.")),
      ),
    );
  }
}

/**
 * A call to action: a real link - to another page of the app (`path`),
 * which a plain click goes to without loading the app anew, or out of it
 * (`href`) - the app's own first page is the empty path, "". Primary:
 * filled with the accent; otherwise outlined, light on a dark section
 * (`onDark`). Small: for a top bar.
 */
class Cta extends Component {
  setProperties({ path, href, label, primary, onDark, small }) {
    this.path = typeof(path) === "string" ? path : null;
    this.href = href || null;
    this.label = label;
    this.primary = !!primary;
    this.onDark = !!onDark;
    this.small = !!small;
  }

  build() {
    const location = this.inherit("location");
    const look = this.primary
      ? { color: "white", background: `linear-gradient(135deg, ${themeColor.accent}, ${themeColor.accentDark})`, boxShadow: "0 14px 30px -12px rgba(0, 0, 0, 0.6)" }
      : this.onDark
        ? { color: "white", background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.35)" }
        : { color: themeColor.text, border: "1px solid " + themeColor.borderStrong };
    return a(
      {
        href: this.href || location.href(this.path),
        onclick: this.href ? null : callback("go", (event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          location.navigate(this.path);
        }),
        style: {
          display: "inline-flex", alignItems: "center", gap: "8px", padding: this.small ? "9px 18px" : "15px 28px", borderRadius: "999px",
          fontWeight: 700, fontSize: this.small ? "15px" : "17px", textDecoration: "none", boxSizing: "border-box", ...look,
        },
      },
      text(this.label),
      icon({ name: this.href ? "open_in_new" : "arrow_forward", style: { fontSize: this.small ? "18px" : "20px" } }),
    );
  }
}
