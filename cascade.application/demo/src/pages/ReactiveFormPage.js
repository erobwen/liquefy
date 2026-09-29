import { Component, callback, deeplyObservable, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, span, text, input, button as htmlButton, flipAnimationContainer } from "@liquefy/cascade.dom";
import {
  button, card, controlPanel, icon, iconButton, alert, textField, checkbox,
  row, column, filler, fitContainerStyle, themeColor,
} from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
import { pageGap, pagePadding, sectionTitle } from "../components/layout.js";
import source from "./ReactiveFormPage.js?raw";

// What this page's information button shows (see ../components/pageActions.js).
const information = {
  summary: "A reactive form, with many interdependencies, cost calculation and validation - and every change animated:",
  points: [
    "Add fellow travelers and luggage, mark a traveler as a child, remove them again: the form makes room, and closes the gap, as it changes.",
    "The data is plain JavaScript made observable (deeplyObservable()): the form writes to it, and whatever reads it - the cost, the model data - follows.",
    "Press Submit with fields left empty, and they're marked: from then on, the marks follow what you type.",
    "One FlipAnimationContainer around the form, and nothing in the form knows about it: every card, field and message is measured where it really is, before and after each change, and glides between the two.",
  ],
};

/**
 * Reactive Form - ported from flow.application/demo's
 * reactiveFormApplication.js: a travel booking, with fellow travelers,
 * luggage, a cost that follows every change, validation, and the model's
 * data shown next to it.
 *
 * The data is plain JavaScript, made observable with deeplyObservable()
 * (Flow's model()), and changed directly by the form's fields. Each part
 * of the page reads only what it shows, so a keystroke rebuilds the one
 * form it's typed in - and the cost and the model data, which read it all.
 *
 * Validation is derived, not stored: once Submit has been pressed, each
 * traveler's form works out its own errors as it builds (Flow wrote them
 * into the model, from a repeater of its own).
 *
 * The animation - notoriously hard to get right in Flow for this form - is
 * a FlipAnimationContainer around the whole form, which can be switched
 * off (Animate): then it's a plain column, with the same forms in it. The
 * container expands the forms down to their elements, places them itself,
 * and measures each where it really is, before and after a change - no
 * copies measured off screen, no wrappers. A card growing to make room for
 * a new field glides to its new size, and everything below glides out of
 * the way.
 */
export class ReactiveFormPage extends Component {
  initialState() {
    // Whether Submit has been pressed (so errors are shown), whether to
    // animate - how fast, and whether what appears is confined to what it
    // appears in - and the message after a successful submit.
    return { verifying: false, animate: true, speed: 1, confine: false, sent: null };
  }

  addTraveler() {
    // Errors are marked from Submit on - until the form has none: a newly
    // added traveler's empty fields aren't marked straight away.
    if (!anyErrors(data)) this.verifying = false;
    this.sent = null;
    data.fellowTravellers.push(createTraveler(true));
  }

  removeTraveler(traveler) {
    data.fellowTravellers.splice(data.fellowTravellers.indexOf(traveler), 1);
  }

  submit() {
    if (anyErrors(data)) {
      this.verifying = true;
      this.sent = null;
    } else {
      transaction(() => {
        this.verifying = false;
        this.sent = "Sent! " + travelerCount(data) + (travelerCount(data) === 1 ? " traveler" : " travelers") + ", " + price(calculateCost(data)) + ".";
      });
    }
  }

  build() {
    const wide = (this.inherit("usableWidth") || 1000) >= 820;
    const count = travelerCount(data);
    const form = [
      controlPanel(
        { key: "header" },
        div({ key: "title", style: { fontSize: "18px", fontWeight: "bold" } },
          text({ key: "titleText", text: "Traveler information" + (count === 1 ? "" : " (" + count + " people)") })),
        filler({ key: "headerFiller" }),
        new CostDisplay({ key: "cost" }),
      ),

      // Traveler forms.
      new TravelerForm({ key: "traveler", traveler: data.traveler, verifying: this.verifying }),
      ...data.fellowTravellers.map((traveler) => new TravelerForm({
        key: "traveler" + traveler.id,
        traveler,
        verifying: this.verifying,
        onRemove: callback("remove" + traveler.id, () => this.removeTraveler(traveler)),
      })),

      // The whole width of the form - as high as the luggage's own add tile.
      htmlButton(
        {
          key: "addTraveler",
          title: "Add traveler",
          onclick: callback("addTraveler", () => this.addTraveler()),
          style: { ...addButtonStyle, flexDirection: "column", gap: "2px", alignSelf: "stretch", minHeight: addTileHeight, padding: "8px" },
        },
        icon({ key: "addTravelerIcon", name: "add", style: { fontSize: "40px" } }),
        text({ key: "addTravelerText", text: "Add traveler" }),
      ),

      new ErrorSummary({ key: "errors", verifying: this.verifying }),
      alert(
        { key: "sent", severity: "success" },
        row(
          { key: "sentRow", style: { alignItems: "center", gap: "8px" } },
          filler({ key: "sentText" }, text({ key: "sentMessage", text: this.sent || "" })),
          iconButton({ key: "dismiss", icon: "close", title: "Dismiss", onClick: callback("dismiss", () => { this.sent = null; }) }),
        ),
      ).showIf(!!this.sent),

      button({ key: "submit", variant: "filled" }, text({ key: "submitText", text: "Submit" }), callback("submit", () => this.submit())),
    ];

    // A little padding, for the cards' shadows: the scroll panel clips
    // at its edges.
    const formStyle = { display: "flex", flexDirection: "column", gap: pageGap, padding: "2px 4px 16px", maxWidth: "720px", boxSizing: "border-box" };
    return row(
      { key: "page", style: { ...fitContainerStyle, gap: pageGap, padding: pagePadding } },
      pageActions({ information, source, fileName: "src/pages/ReactiveFormPage.js" }),
      div(
        { key: "scrollPanel", style: { flex: "1 1 0", minWidth: 0, height: "100%", overflowY: "auto", boxSizing: "border-box" } },
        this.animate
          ? flipAnimationContainer({ key: "form", style: formStyle, speed: this.speed, confine: this.confine }, form)
          : column({ key: "plainForm", style: formStyle }, form),
      ),
      // Beside the form, not in it: how the demo is shown, and the model's
      // data - neither is part of the form's own UI.
      column(
        { key: "side", style: { gap: pageGap, flex: "none", width: wide ? "40%" : "auto", maxWidth: "420px", height: "100%", boxSizing: "border-box" } },
        card(
          { key: "demoControls", style: { margin: "2px 2px 0 0" } },
          row(
            { key: "demoControlsRow", style: { alignItems: "center", gap: "12px", flexWrap: "wrap" } },
            checkbox({ key: "animate", label: "Animate", checked: this.animate, onChange: callback("animate", (checked) => { this.animate = checked; }) }),
            // How fast the animation runs - 1 is its springs' natural pace.
            row(
              { key: "speed", style: { alignItems: "center", gap: "8px", flex: "1 1 160px", opacity: this.animate ? 1 : 0.5 } },
              span({ key: "speedLabel" }, text({ key: "speedLabelText", text: "Speed" })),
              input({
                key: "speedSlider",
                type: "range",
                min: 0.1,
                max: 2,
                step: 0.1,
                value: this.speed,
                disabled: !this.animate,
                title: "Animation speed",
                oninput: callback("speed", (event) => { this.speed = Number(event.target.value); }),
                style: { flex: "1 1 auto", minWidth: "80px", margin: 0, accentColor: themeColor.chrome },
              }),
              span({ key: "speedValue", style: { minWidth: "36px", textAlign: "right", fontVariantNumeric: "tabular-nums" } },
                text({ key: "speedValueText", text: this.speed.toFixed(1) + "×" })),
            ),
          ),
        ),
        new ModelDataDisplay({ key: "modelData" }).showIf(wide),
      ),
    );
  }
}

/**
 * Traveler form - a traveler's own fields: name and passport for everyone,
 * the address for the main traveler, child and age for fellow travelers,
 * and luggage, in a drawer of its own.
 */
class TravelerForm extends Component {
  setProperties({ traveler, verifying, onRemove }) {
    this.traveler = traveler;
    this.verifying = !!verifying;
    this.onRemove = onRemove || null;
  }

  initialState() {
    return { showLuggage: true };
  }

  addLuggage() {
    transaction(() => {
      this.traveler.luggages.push(createLuggage());
      this.showLuggage = true;
    });
  }

  build() {
    const traveler = this.traveler;
    const errors = this.verifying ? travelerErrors(traveler) : {};
    const fellow = traveler.isFellowTraveller;
    const field = (object, property, label) => textField({
      key: property,
      label,
      value: object[property],
      error: errors[property],
      onInput: callback(property, (value) => { object[property] = value; }),
    });

    return card(
      { key: "card", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      row(
        { key: "cardHeader", style: { alignItems: "center", gap: "8px" } },
        icon({ key: "personIcon", name: fellow ? "group" : "person" }),
        div({ key: "cardTitle", style: { fontWeight: "bold" } }, text({ key: "cardTitleText", text: fellow ? "Fellow traveler" : "Traveler" })),
        filler({ key: "cardHeaderFiller" }),
        iconButton({ key: "remove", icon: "close", title: "Remove traveler", onClick: this.onRemove }).showIf(fellow),
      ),

      field(traveler, "name", "Name"),
      field(traveler, "passportNumber", "Passport"),

      // Child and age: fellow travelers only - the age only for a child.
      checkbox({
        key: "isChild",
        label: "Is child",
        checked: traveler.isChild,
        onChange: callback("isChild", (checked) => { traveler.isChild = checked; }),
      }).showIf(fellow),
      textField({
        key: "age",
        label: "Age",
        type: "number",
        unit: "years",
        value: traveler.age,
        onInput: callback("age", (value) => { if (value !== "") traveler.age = Number(value); }),
      }).showIf(fellow && traveler.isChild),

      // The address: the main traveler only.
      column(
        { key: "addressFields", style: { gap: "12px" } },
        field(traveler.address, "address", "Address"),
        field(traveler.address, "zipCode", "Zip code"),
        field(traveler.address, "city", "City"),
      ).showIf(!fellow),

      new LuggageDrawer({
        key: "luggageDrawer",
        count: traveler.luggages.length,
        isOpen: this.showLuggage,
        toggleOpen: callback("toggleLuggage", () => { this.showLuggage = !this.showLuggage; }),
        onAdd: callback("addLuggage", () => this.addLuggage()),
        content: traveler.luggages.map((luggage, index) => new LuggageForm({
          key: "luggage" + luggage.id,
          luggage,
          number: index + 1,
          onRemove: callback("removeLuggage" + luggage.id, () => { traveler.luggages.splice(traveler.luggages.indexOf(luggage), 1); }),
        })),
      }),
    );
  }
}

const luggageCardWidth = "150px";

// The look of what adds something to the form - a traveler, a piece of
// luggage: a dashed frame around a plus, standing apart from the cards
// holding what's already there.
const addButtonStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  boxSizing: "border-box", margin: 0, font: "inherit", fontSize: "13px", color: themeColor.textSoft, background: "transparent",
  border: "2px dashed " + themeColor.borderStrong, borderRadius: "8px", cursor: "pointer",
};
const addTileHeight = "96px";

/**
 * Luggage drawer - a header opening and closing it (a title and a count on
 * the left, a chevron on the right, the whole header clickable), and the
 * luggage in it: a card each, side by side until they wrap, and a tile
 * adding another at the end.
 *
 * With no luggage there's nothing to open: the header just says so, and
 * the add button takes the chevron's place, small. It's one and the same
 * button in both places (built here, by key), so adding the first piece
 * of luggage moves it - and grows it - into the list, rather than
 * replacing it.
 */
class LuggageDrawer extends Component {
  setProperties({ count, isOpen, toggleOpen, onAdd, content }) {
    this.count = count;
    this.isOpen = !!isOpen;
    this.toggleOpen = toggleOpen;
    this.onAdd = onAdd;
    this.content = content || [];
  }

  build() {
    const empty = this.count === 0;
    // Its click mustn't reach the header: adding the first piece rebuilds
    // straight away, while the click is still on its way up - and by then
    // the header toggles, and would close the drawer just opened.
    const onAdd = callback("add", (event) => {
      event.stopPropagation();
      this.onAdd();
    });
    const add = htmlButton(
      {
        key: "add",
        title: "Add luggage",
        onclick: onAdd,
        style: {
          ...addButtonStyle,
          flexDirection: empty ? "row" : "column", gap: empty ? "4px" : "2px",
          ...(empty ? { height: "32px", padding: "0 12px 0 8px" } : { width: luggageCardWidth, minHeight: addTileHeight, padding: "8px" }),
        },
      },
      icon({ key: "addIcon", name: "add", style: { fontSize: empty ? "20px" : "40px" } }),
      text({ key: "addText", text: "Add luggage" }),
    );

    return column(
      { key: "drawer", style: { gap: "10px", paddingTop: "8px", borderTop: "1px solid " + themeColor.border } },
      // A click on the chevron reaches the header too: one toggle, and the
      // chevron is what the keyboard focuses.
      row(
        {
          key: "header",
          onclick: empty ? null : this.toggleOpen,
          style: { alignItems: "center", gap: "8px", minHeight: "36px", cursor: empty ? "default" : "pointer", userSelect: "none" },
        },
        icon({ key: "headerIcon", name: empty ? "no_luggage" : "luggage", style: { color: themeColor.textSoft } }),
        div(
          { key: "headerTitle", style: { fontWeight: 500, color: empty ? themeColor.textSoft : "inherit" } },
          text({ key: "headerTitleText", text: empty ? "No luggage" : "Luggage" }),
        ),
        div(
          {
            key: "count",
            style: {
              minWidth: "20px", padding: "1px 7px", borderRadius: "10px", boxSizing: "border-box", textAlign: "center",
              fontSize: "12px", fontWeight: "bold", background: themeColor.accentSoft, color: themeColor.accentDark,
            },
          },
          text({ key: "countText", text: String(this.count) }),
        ).showIf(!empty),
        filler({ key: "headerFiller" }),
        empty
          ? add
          : iconButton({ key: "toggle", icon: this.isOpen ? "expand_less" : "expand_more", title: this.isOpen ? "Hide luggage" : "Show luggage" }),
      ),
      div(
        { key: "luggageList", style: { display: "flex", flexWrap: "wrap", gap: "10px" } },
        ...this.content,
        empty ? null : add,
      ).showIf(this.isOpen && !empty),
    );
  }
}

/**
 * Luggage form - one piece of luggage, on a card of its own: its weight,
 * and a button removing it at the top right.
 */
class LuggageForm extends Component {
  setProperties({ luggage, number, onRemove }) {
    this.luggage = luggage;
    this.number = number;
    this.onRemove = onRemove;
  }

  build() {
    const luggage = this.luggage;
    return card(
      {
        key: "luggage",
        variant: "filled",
        style: { display: "flex", flexDirection: "column", gap: "4px", width: luggageCardWidth, padding: "4px 4px 12px 12px" },
      },
      row(
        { key: "luggageHeader", style: { alignItems: "center", gap: "6px" } },
        icon({ key: "luggageIcon", name: "luggage", style: { fontSize: "20px", color: themeColor.textSoft } }),
        filler({ key: "luggageTitle", style: { fontSize: "13px", fontWeight: 500 } }, text({ key: "luggageTitleText", text: "Bag " + this.number })),
        iconButton({ key: "remove", icon: "close", title: "Remove luggage", onClick: this.onRemove }),
      ),
      textField({
        key: "weight",
        label: "Weight",
        type: "number",
        unit: "kg",
        value: luggage.weight,
        onInput: callback("weight", (value) => { if (value !== "") luggage.weight = Number(value); }),
      }),
    );
  }
}

// Once Submit has been pressed: whether anything is still missing. Reads
// all the data, so, like the cost, a component of its own.
class ErrorSummary extends Component {
  setProperties({ verifying }) {
    this.verifying = verifying;
  }

  build() {
    return alert({ key: "errors", severity: "error" }, text({ key: "errorsText", text: "Some fields need filling in - see the marked ones above." }))
      .showIf(this.verifying && anyErrors(data));
  }
}

// The cost - reading all the data, so it's a component of its own: typing
// rebuilds it, not the page.
class CostDisplay extends Component {
  build() {
    return div({ key: "cost", style: { fontWeight: "bold" } }, text({ key: "costText", text: "Cost: " + price(calculateCost(data)) }));
  }
}

// The model's data, as it is right now.
class ModelDataDisplay extends Component {
  build() {
    return card(
      {
        key: "modelData",
        style: { flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column", gap: "8px", margin: "0 2px 2px 0" },
      },
      sectionTitle("modelDataTitle", "Model data"),
      div(
        { key: "json", style: { flex: "1 1 0", overflow: "auto", whiteSpace: "pre", fontFamily: "monospace", fontSize: "12px" } },
        text({ key: "jsonText", text: JSON.stringify(data, null, 2) }),
      ),
    );
  }
}

/**
 * Data model - plain JavaScript, made observable.
 */
let nextId = 1;

function createTraveler(isFellowTraveller) {
  return deeplyObservable({
    id: nextId++,
    name: "",
    passportNumber: "",
    address: { address: "", zipCode: "", city: "" },
    isFellowTraveller,
    isChild: false,
    age: 1,
    luggages: [],
  });
}

function createLuggage() {
  return deeplyObservable({ id: nextId++, weight: 1, type: "bag" });
}

// Kept for as long as the app runs - come back to the page, and it's as
// you left it.
const data = deeplyObservable({
  traveler: createTraveler(false),
  fellowTravellers: [],
});

/**
 * Cost calculation - plain JavaScript.
 */
function calculateCost(data) {
  let cost = 0;
  const addTravelerCost = (traveler) => {
    cost += traveler.isChild ? 100 : 200;
    traveler.luggages.forEach((luggage) => { cost += luggage.weight <= 1 ? 20 : 40; });
  };
  addTravelerCost(data.traveler);
  data.fellowTravellers.forEach(addTravelerCost);
  return cost;
}

const price = (amount) => "$" + amount;
const travelerCount = (data) => data.fellowTravellers.length + 1;

/**
 * Validation - plain JavaScript: what's missing, per field.
 */
function travelerErrors(traveler) {
  const errors = {};
  const required = (object, property, what) => {
    if (String(object[property]).trim() === "") errors[property] = "Please enter " + what + ".";
  };
  required(traveler, "name", "a name");
  required(traveler, "passportNumber", "a passport number");
  if (!traveler.isFellowTraveller) {
    required(traveler.address, "address", "an address");
    required(traveler.address, "zipCode", "a zip code");
    required(traveler.address, "city", "a city");
  }
  return errors;
}

function anyErrors(data) {
  return [data.traveler, ...data.fellowTravellers].some((traveler) => Object.keys(travelerErrors(traveler)).length > 0);
}

// Several writes as one change - rebuilt once, after all of them.
function transaction(action) {
  postponeInvalidations();
  try {
    action();
  } finally {
    continueInvalidations();
  }
}
