import { Component, callback } from "@liquefy/cascade.component";
import { div, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import { button, card, icon, iconButton, row, portal, portalContents } from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { fullPage } from "../components/layout.js";
import source from "./StorePage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A web store - portals and animation together:",
  points: [
    "Click a product: it flies down into the cart in the status bar. Click it in the cart to put it back, or clear the cart.",
    "The status bar is a component of its own, knowing nothing about products: it has two portals, and the product list puts the chosen products - and the cart's summary - into them.",
    "A chosen product is the same element in the cart as on the shelf - one FlipAnimationContainer around the whole page sees it move, and animates it.",
    "Hide the cart, and its portal is gone from the page: a product you choose goes into it all the same, but there's nowhere to fly to - it just fades out. Show the cart again, and they're waiting for you there.",
  ],
};

const products = [
  { id: "coffee", name: "Coffee", icon: "local_cafe", price: 4.5 },
  { id: "croissant", name: "Croissant", icon: "bakery_dining", price: 2.2 },
  { id: "icecream", name: "Ice cream", icon: "icecream", price: 3.1 },
  { id: "pizza", name: "Pizza", icon: "local_pizza", price: 8.9 },
  { id: "ramen", name: "Ramen", icon: "ramen_dining", price: 9.5 },
  { id: "burger", name: "Burger", icon: "lunch_dining", price: 7.4 },
  { id: "cake", name: "Cake", icon: "cake", price: 5.6 },
  { id: "cocktail", name: "Cocktail", icon: "local_bar", price: 6.8 },
];

const price = (amount) => "$" + amount.toFixed(2);

/**
 * Web Store - the cascade take on flow.application/demo's portal demo: a
 * shelf of products in the middle, and a status bar at the bottom with the
 * cart in it. Choosing a product sends it flying into the cart.
 *
 * Three components, none knowing more than it needs to:
 *  - StatusBar: a bar with two portals of its own (see cascade.ui's
 *    Portal.js) - the cart, and the cart's summary - and nothing else. It
 *    knows nothing about products.
 *  - ProductList: owns which products are chosen. The ones that aren't are
 *    on its shelf; the chosen ones, and the summary, it puts into the
 *    status bar's portals with portalContents().
 *  - StorePage: puts them together, owns the status bar (created in
 *    initialization, placed as a plain child reference - see
 *    cascade.component/README.md), and provides its portals by name for
 *    portalContents() to find: `cartPortal`, `cartSummaryPortal`.
 *
 * The animation: one FlipAnimationContainer around it all. A product is a
 * keyed tile built by ProductList - the same component, and so the same
 * element, whether it's on the shelf or in the cart (a portal's contents
 * are placed like anything else inside the container), so the container
 * sees it move from one parent to another, and animates it: out of the
 * shelf, shrinking into its compact cart look on the way.
 *
 * The cart can be hidden (StatusBar's own state): its portal is then not
 * in the page at all, while ProductList keeps filling it just the same. A
 * product chosen then leaves the shelf for somewhere the container can't
 * see - it fades out where it was, like any element removed - and shows
 * up, fading in, when the cart is shown again.
 */
export class StorePage extends Component {
  initialUnobservables() {
    return { statusBar: new StatusBar({ key: "statusBar" }) };
  }

  // Provided for portalContents({ portal: "cartPortal" }) - see
  // Component.inherit().
  get cartPortal() {
    return this.unobservable.statusBar.unobservable.cart;
  }

  get cartSummaryPortal() {
    return this.unobservable.statusBar.unobservable.summary;
  }

  build() {
    // Clipped here, at the page: whatever animates inside it - a product
    // flying down, the cart's summary growing out of the bar's right edge
    // - stays within it, rather than reaching the work area around it and
    // giving it scroll bars for the moment. (Not at the status bar: a
    // product flying into the cart is drawn inside it, up by the shelf.)
    return fullPage(
      { key: "page", style: { overflow: "hidden", gap: 0 } },
      pageActions({ information, source, fileName: "src/pages/StorePage.js" }),
      flipAnimationContainer(
        {
          key: "flip",
          style: { display: "flex", flexDirection: "column", gap: "16px", height: "100%", boxSizing: "border-box" },
        },
        new ProductList({ key: "products" }),
        this.unobservable.statusBar,
      ),
    );
  }
}

// The shelf, and the chosen products - shown in the cart portal.
class ProductList extends Component {
  initializeState() {
    return { chosen: [] };
  }

  toggle(id) {
    this.chosen = this.chosen.includes(id) ? this.chosen.filter((each) => each !== id) : [...this.chosen, id];
  }

  // A product's tile - on the shelf, or compact in the cart. The same keyed
  // component either way, so it's the same element wherever it is. Its own
  // text color: in the cart, it sits in the dark status bar.
  tile(product, inCart) {
    const common = { cursor: "pointer", userSelect: "none", color: "#1f2d3a" };
    return card(
      {
        key: product.id,
        onclick: callback(product.id + "Toggle", () => this.toggle(product.id)),
        title: inCart ? "Put back" : "Add to cart",
        style: inCart
          ? { ...common, display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", flex: "none" }
          : { ...common, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "16px", width: "120px" },
      },
      icon({ key: product.id + "Icon", name: product.icon, style: { fontSize: inCart ? "20px" : "48px" } }),
      div({ key: product.id + "Name", style: { fontWeight: "bold" } }, text({ key: product.id + "NameText", text: product.name })),
      div({ key: product.id + "Price", style: { opacity: 0.7 } }, text({ key: product.id + "PriceText", text: price(product.price) })),
    );
  }

  build() {
    const chosen = this.chosen.map((id) => products.find((product) => product.id === id));
    const total = chosen.reduce((sum, product) => sum + product.price, 0);
    return [
      div(
        { key: "shelf", style: { display: "flex", flexWrap: "wrap", gap: "16px", alignContent: "flex-start", flex: "1 1 auto", overflow: "visible" } },
        products.filter((product) => !this.chosen.includes(product.id)).map((product) => this.tile(product, false)),
      ),
      portalContents({ key: "cartContents", portal: "cartPortal" }, chosen.map((product) => this.tile(product, true))),
      portalContents(
        { key: "summaryContents", portal: "cartSummaryPortal" },
        chosen.length > 0 ? [
          text({ key: "summaryText", text: chosen.length + (chosen.length === 1 ? " item, " : " items, ") + price(total) }),
          button({ key: "clear" }, text({ key: "clearText", text: "Clear cart" }), () => { this.chosen = []; }),
        ] : [],
      ),
    ];
  }
}

// A status bar with a cart: two portals of its own - the cart's items and
// its summary - filled by whoever has something to put there. The cart can
// be hidden; whatever is put into it waits there.
class StatusBar extends Component {
  initializeState() {
    return { cartShown: true };
  }

  initialUnobservables() {
    return {
      cart: portal(
        { key: "cart", style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: "1 1 auto", minWidth: 0, overflow: "visible" } },
        text({ key: "emptyText", text: "Your cart is empty - click a product to add it." }),
      ),
      summary: portal({ key: "summary", style: { display: "flex", alignItems: "center", gap: "12px", flex: "none" } }),
    };
  }

  build() {
    return row(
      {
        key: "statusBar",
        style: {
          flex: "none", minHeight: "64px", gap: "12px", padding: "8px 16px", alignItems: "center", boxSizing: "border-box",
          overflow: "visible", background: "#2c3e50", color: "white", borderRadius: "8px",
        },
      },
      icon({ key: "cartIcon", name: "shopping_cart", style: { fontSize: "28px", flex: "none" } }),
      iconButton(
        { key: "toggleCart", icon: this.cartShown ? "visibility_off" : "visibility", title: this.cartShown ? "Hide the cart" : "Show the cart", style: { color: "white" } },
        () => { this.cartShown = !this.cartShown; },
      ),
      this.cartShown
        ? this.unobservable.cart
        : div(
          { key: "hidden", style: { flex: "1 1 auto", fontStyle: "italic", opacity: 0.7 } },
          text({ key: "hiddenText", text: "The cart is hidden - what you choose waits in it." }),
        ),
      this.unobservable.summary,
    );
  }
}
