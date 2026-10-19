import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer, portal, portalSource } from "@liquefy/cascade.dom";
import { button, card, icon, iconButton, row, themeColor } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { animationControls } from "../components/animationControls.js";
import { fullPage, pagePadding } from "../components/layout.js";
import source from "./FocusStorePage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "The web store again - with a product to look closer at:",
  points: [
    "Click a product to focus it: it grows out of the shelf into the middle, three times its size, with more to read - and the rest of the shelf greys out behind it.",
    "Add, on a product or in its close-up, sends it flying into the cart. Click the grey, or Close, to put a focused product back on its shelf.",
    "The close-up is the same element as the product on the shelf - the same icon, the same name and price, only bigger. One FlipAnimationContainer sees it move and grow, and animates it.",
    "The grey overlay is built only while a product is focused: it appears and leaves where it is, the same size all the time, so all it does is fade.",
    "The overlay covers everything but the focused product - the cart too. A product on its way into the cart, or back to the shelf, flies above it, and slips under it once it has arrived.",
  ],
};

const products = [
  { id: "coffee", name: "Coffee", icon: "local_cafe", price: 4.5, details: "Hot - 250 ml", description: "A double shot of espresso from beans roasted down the street, topped up with hot water - or milk, if you ask." },
  { id: "croissant", name: "Croissant", icon: "bakery_dining", price: 2.2, details: "Baked this morning", description: "Twenty-seven layers of butter and dough, crisp outside and soft inside. Best eaten before the flakes reach the floor." },
  { id: "icecream", name: "Ice cream", icon: "icecream", price: 3.1, details: "Two scoops", description: "Vanilla and dark chocolate in a waffle cone. Choose quickly: it doesn't wait for anyone." },
  { id: "pizza", name: "Pizza", icon: "local_pizza", price: 8.9, details: "12 inch - stone oven", description: "Tomato, mozzarella and basil on a thin crust, ninety seconds in a wood-fired oven." },
  { id: "ramen", name: "Ramen", icon: "ramen_dining", price: 9.5, details: "Large bowl", description: "Pork broth simmered for twelve hours, fresh noodles, a soft egg and spring onion." },
  { id: "burger", name: "Burger", icon: "lunch_dining", price: 7.4, details: "With fries", description: "A smashed beef patty with cheddar, pickles and onion, in a toasted brioche bun." },
  { id: "cake", name: "Cake", icon: "cake", price: 5.6, details: "One slice", description: "Three layers of chocolate sponge with raspberry between them. Candles on request." },
  { id: "cocktail", name: "Cocktail", icon: "local_bar", price: 6.8, details: "Ask for the menu", description: "Shaken, not stirred - whatever the bartender is proud of tonight." },
];

const price = (amount) => "$" + amount.toFixed(2);

// How large everything is: the page's, or a smaller store's (`compact` -
// on the Showcase page, say). The tile's size on the shelf is also the
// size of the empty spot a focused product leaves there.
const sizes = {
  full: {
    tileWidth: "140px", tileHeight: "184px", tilePadding: "16px", fontSize: null,
    icon: { shelf: "48px", focus: "160px", cart: "20px" }, name: { other: "16px", focus: "30px" }, price: { other: "16px", focus: "22px" },
    closeUp: { gap: "32px", padding: "32px", width: "min(560px, 100%)" }, statusBar: "64px",
  },
  compact: {
    tileWidth: "112px", tileHeight: "150px", tilePadding: "12px", fontSize: "14px",
    icon: { shelf: "40px", focus: "96px", cart: "18px" }, name: { other: "14px", focus: "22px" }, price: { other: "14px", focus: "17px" },
    closeUp: { gap: "20px", padding: "20px", width: "min(460px, 100%)" }, statusBar: "52px",
  },
};

// The store's own element: the overlay is positioned in it.
const storeStyle = { position: "relative", display: "flex", flexDirection: "column", gap: "16px", boxSizing: "border-box" };

/**
 * Focus Store - the Web Store page, with a closer look. Each product on the
 * shelf has an Add button of its own; clicking anywhere else on it focuses
 * it: it leaves its spot on the shelf for a focus layer over the middle of
 * the shelf, three times as large, with a description beside its icon - and
 * a grey overlay fades in over the rest of the page.
 *
 * The close-up isn't a new element: the focused tile is the same keyed
 * component as on the shelf (and in the cart), and so are its icon, name,
 * price and button - keyed, since they move to other parents inside it. So
 * the page's one FlipAnimationContainer sees them all move and grow, and
 * animates it. What the close-up has more of - the description - fades in.
 *
 * The overlay is the other kind of animation: no movement at all. It's
 * built only while a product is focused, and an element that appears or
 * leaves is faded in or out exactly where it is, the same size all the
 * time - and, leaving, where it was among its siblings. Its z-index puts it
 * above everything but the focus layer; a product on its way - back to the
 * shelf, or into the cart - is drawn above it all the same, and under it
 * again once it has arrived (see Stacking in cascade.dom's
 * FlipAnimationContainer). The focus layer, on the other hand, is always
 * there (empty, and letting clicks through, when nothing is focused):
 * something appearing fades in with everything in it, and a product
 * flying into a layer that just appeared would fade in on its way.
 *
 * The store itself is a component of its own, FocusStore - so the Showcase
 * page shows a smaller one, too.
 */
export class FocusStorePage extends Component {
  // Whether the page animates, and how fast - its own, set from the
  // controls in the top bar (see ../components/animationControls.js).
  initialState() {
    return { animate: true, speed: 1.5 };
  }

  build() {
    return fullPage(
      { style: { overflow: "hidden", gap: 0, padding: 0 } },
      pageActions({ information, source, fileName: "src/pages/FocusStorePage.js" }),
      animationControls({
        animate: this.animate,
        speed: this.speed,
        onAnimate: callback("animate", (animate) => { this.animate = animate; }),
        onSpeed: callback("speed", (speed) => { this.speed = speed; }),
      }),
      // The page's padding is the store's, so the overlay - positioned in
      // it - reaches the page's edges.
      new FocusStore({ key: "store", animate: this.animate, speed: this.speed, style: { height: "100%", padding: pagePadding } }),
    );
  }
}

/**
 * Focus Store - the store: the shelf, the focus layer over it and the grey
 * overlay, and the status bar with the cart - its `products` (ids; all of
 * them by default), at full size or `compact`. Animated unless `animate`
 * is false, at `speed`.
 *
 * The rest is the Web Store's (see StorePage.js): the status bar with its
 * two portals, the cart and its summary, that ProductList fills.
 */
export class FocusStore extends Component {
  setProperties({ products: shown, compact, animate, speed, style }) {
    this.products = shown ? shown.map((id) => products.find((product) => product.id === id)) : products;
    this.size = compact ? sizes.compact : sizes.full;
    this.animate = animate !== false;
    this.speed = typeof(speed) === "number" ? speed : 1;
    this.style = style || {};
  }

  initialUnobservables() {
    return { statusBar: new StatusBar({ key: "statusBar", height: this.size.statusBar }).establish() };
  }

  onDispose() {
    this.unobservable.statusBar.dispose();
    super.onDispose();
  }

  // Provided for portalSource({ portal: "cartPortal" }) - see
  // Component.provide().
  provide() {
    const bar = this.unobservable.statusBar.unobservable;
    return { cartPortal: bar.cart, cartSummaryPortal: bar.summary };
  }

  // Everything in the store - the shelf, the close-up, the cart, the grey
  // overlay - animated by one line: a FlipAnimationContainer around it (the
  // Showcase page shows this method, that line marked). Or not: a plain
  // element in its place - keyed apart, so one takes over from the other.
  // The product list keyed, too: it goes from one to the other - and keeps
  // what's chosen and focused.
  //
  // Confined: what appears in the close-up - its description - is revealed
  // as the card grows, not drawn outside it meanwhile. Zooming along: and
  // grows with it - as what leaves the close-up shrinks with the card, on
  // its way back to the shelf.
  build() {
    const { products, size, speed } = this;
    const style = { ...storeStyle, fontSize: size.fontSize, ...this.style };
    const content = [new ProductList({ key: "products", products, size }), this.unobservable.statusBar];
    // One line animates it all:
    return this.animate
      ? flipAnimationContainer({ key: "animated", confine: true, zoomAlong: true, speed, style }, content)
      : div({ key: "still", style }, content);
  }
}

// The shelf, the focused product over it, and the chosen products - shown
// in the cart portal.
class ProductList extends Component {
  setProperties({ products, size }) {
    this.products = products;
    this.size = size;
  }

  initialState() {
    return { chosen: [], focused: null };
  }

  // Into the cart first: from then on it isn't focused (see build()), so a
  // focused one goes straight from its close-up to the cart - not by way
  // of the shelf, as it would with `focused` cleared first.
  add(id) {
    if (!this.chosen.includes(id)) this.chosen = [...this.chosen, id];
    if (this.focused === id) this.focused = null;
  }

  putBack(id) {
    this.chosen = this.chosen.filter((each) => each !== id);
  }

  // A product's tile - on the shelf, focused, or compact in the cart. The
  // same keyed component wherever it is, and so are its parts: what it
  // shows grows and shrinks with it, rather than being made anew.
  tile(product, place) {
    const id = product.id;
    const size = this.size;
    const productIcon = icon({ key: id + ".icon", name: product.icon, style: { fontSize: size.icon[place] } });
    const name = div({ key: id + ".name", style: { fontWeight: "bold", fontSize: place === "focus" ? size.name.focus : size.name.other } }, text(product.name));
    const cost = div({ key: id + ".price", style: { opacity: 0.7, fontSize: place === "focus" ? size.price.focus : size.price.other } }, text(price(product.price)));
    // Made only where it's shown: a component built but not placed would
    // still be updated - and leave, fading out, from wherever it was.
    const add = () => button(
      {
        key: id + ".add",
        variant: place === "focus" ? "filled" : undefined,
        style: place === "focus" ? {} : { marginTop: "auto" },
        // Not a click on the tile as well - that would focus it.
        onClick: callback(id + "Add", (event) => {
          if (event) event.stopPropagation();
          this.add(id);
        }),
      },
      text(place === "focus" ? "Add to cart" : "Add"),
    );
    const look = { userSelect: "none", color: themeColor.text };

    if (place === "cart") {
      return card(
        { key: id, onclick: callback(id + "PutBack", () => this.putBack(id)), title: "Put back", style: { ...look, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", flex: "none" } },
        productIcon, name, cost,
      );
    }
    if (place === "shelf") {
      return card(
        {
          key: id,
          onclick: callback(id + "Focus", () => { this.focused = id; }),
          title: "Take a closer look",
          style: { ...look, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: size.tilePadding, width: size.tileWidth, height: size.tileHeight, boxSizing: "border-box" },
        },
        productIcon, name, cost, add(),
      );
    }
    // Focused: three times the tile, the icon beside what there is to say
    // about it. It takes clicks again - its layer lets them through.
    return card(
      { key: id, style: { ...look, display: "flex", alignItems: "center", gap: size.closeUp.gap, padding: size.closeUp.padding, width: size.closeUp.width, boxSizing: "border-box", overflow: "hidden", pointerEvents: "auto" } },
      productIcon,
      div(
        { style: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 } },
        name,
        cost,
        div({ style: { opacity: 0.7, fontStyle: "italic" } }, text(product.details)),
        div({ style: { lineHeight: 1.5 } }, text(product.description)),
        row(
          { style: { gap: "8px", marginTop: "8px", flexWrap: "wrap" } },
          add(),
          button(
            {
              // Not on to the card: put back on the shelf by the time the
              // click gets there, the card would focus itself again.
              onClick: callback("close", (event) => {
                if (event) event.stopPropagation();
                this.focused = null;
              }),
            },
            text("Close"),
          ),
        ),
      ),
    );
  }

  build() {
    const chosen = this.chosen.map((id) => products.find((product) => product.id === id));
    // A product is in one place at a time: one in the cart isn't focused.
    const focused = this.chosen.includes(this.focused) ? undefined : products.find((product) => product.id === this.focused);
    const total = chosen.reduce((sum, product) => sum + product.price, 0);
    return [
      // The shelf, with the focus layer over it.
      div(
        { style: { position: "relative", flex: "1 1 auto", minHeight: 0 } },
        div(
          { style: { display: "flex", flexWrap: "wrap", gap: "16px", alignContent: "flex-start", height: "100%", overflow: "visible" } },
          this.products.filter((product) => !this.chosen.includes(product.id)).map((product) =>
            product === focused
              // Its spot, kept while it's away: the rest of the shelf stays put.
              ? div({ key: product.id + ".spot", style: { width: this.size.tileWidth, height: this.size.tileHeight, boxSizing: "border-box", borderRadius: "12px", border: "2px dashed " + themeColor.border } })
              : this.tile(product, "shelf")),
        ),
        div(
          { style: { position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", boxSizing: "border-box", pointerEvents: "none" } },
          focused ? this.tile(focused, "focus") : null,
        ),
      ),
      portalSource({ portal: "cartPortal" }, chosen.map((product) => this.tile(product, "cart"))),
      portalSource(
        { portal: "cartSummaryPortal" },
        chosen.length > 0 ? [
          text(chosen.length + (chosen.length === 1 ? " item, " : " items, ") + price(total)),
          button(text("Clear cart"), () => { this.chosen = []; }),
        ] : [],
      ),
      // The overlay: over the whole page, out to its edges - the status bar
      // too - below the focus layer. Last, so nothing before it is moved
      // along when it comes and goes. Above everything but the focus layer
      // by its z-index - not by where it happens to be: the cart comes
      // after it, and its cards are positioned.
      focused
        ? div({
          key: "overlay",
          onclick: callback("unfocus", () => { this.focused = null; }),
          title: "Back to the shelf",
          style: { position: "absolute", inset: 0, zIndex: 1, background: "rgba(40, 50, 65, 0.55)", cursor: "pointer" },
        })
        : null,
    ];
  }
}

// A status bar with a cart - the Web Store's (see StorePage.js): two
// portals of its own, the cart's items and its summary, filled by whoever
// has something to put there.
class StatusBar extends Component {
  setProperties({ height }) {
    this.height = height || "64px";
  }

  initialState() {
    return { cartShown: true };
  }

  initialUnobservables() {
    return {
      cart: portal(
        { key: "cart", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: "1 1 auto", minWidth: 0, overflow: "visible" } },
        text("Your cart is empty - add a product to it."),
      ).establish(),
      summary: portal({ key: "summary", style: { display: "flex", alignItems: "center", gap: "12px", flex: "none" } }).establish(),
    };
  }

  onDispose() {
    this.unobservable.cart.dispose();
    this.unobservable.summary.dispose();
    super.onDispose();
  }

  build() {
    return row(
      {
        style: {
          flex: "none", minHeight: this.height, gap: "12px", padding: "8px 16px", alignItems: "center", boxSizing: "border-box",
          overflow: "visible", background: themeColor.chromeDark, color: themeColor.onChrome, borderRadius: "8px",
        },
      },
      icon({ name: "shopping_cart", style: { fontSize: "28px", flex: "none" } }),
      iconButton(
        { icon: this.cartShown ? "visibility_off" : "visibility", title: this.cartShown ? "Hide the cart" : "Show the cart", style: { color: "white" } },
        () => { this.cartShown = !this.cartShown; },
      ),
      this.cartShown
        ? this.unobservable.cart
        : div(
          { style: { flex: "1 1 auto", fontStyle: "italic", opacity: 0.7 } },
          text("The cart is hidden - what you choose waits in it."),
        ),
      this.unobservable.summary,
    );
  }
}
