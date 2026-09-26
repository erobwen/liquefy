import { Component, callback, deeplyObservable, postponeInvalidations, continueInvalidations } from "@liquefy/cascade.component";
import { div, span, text, flipAnimationContainer } from "@liquefy/cascade.dom";
import {
  button, card, icon, iconButton, alert, textField, checkbox,
  row, column, filler, fitContainerStyle,
} from "@liquefy/cascade.ui";
import { pageActions } from "../components/pageActions.js";
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
  initializeState() {
    // Whether Submit has been pressed (so errors are shown), whether to
    // animate, and the message after a successful submit.
    return { verifying: false, animate: true, sent: null };
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
    const wide = (this.renderContext.usableWidth || 1000) >= 820;
    const count = travelerCount(data);
    const form = [
      row(
        { key: "header", style: { alignItems: "center", gap: "16px", flexWrap: "wrap" } },
        div({ key: "title", style: { fontSize: "18px", fontWeight: "bold" } },
          text({ key: "titleText", text: "Traveler information" + (count === 1 ? "" : " (" + count + " people)") })),
        filler({ key: "headerFiller" }),
        new CostDisplay({ key: "cost" }),
        checkbox({ key: "animate", label: "Animate", checked: this.animate, onChange: callback("animate", (checked) => { this.animate = checked; }) }),
      ),

      // Traveler forms.
      new TravelerForm({ key: "traveler", traveler: data.traveler, verifying: this.verifying }),
      ...data.fellowTravellers.map((traveler) => new TravelerForm({
        key: "traveler" + traveler.id,
        traveler,
        verifying: this.verifying,
        onRemove: callback("remove" + traveler.id, () => this.removeTraveler(traveler)),
      })),

      row(
        { key: "addTravelerRow" },
        filler({ key: "addTravelerFiller" }),
        button(
          { key: "addTraveler", style: { display: "flex", alignItems: "center", gap: "6px" } },
          icon({ key: "addTravelerIcon", name: "add" }),
          text({ key: "addTravelerText", text: "Traveler" }),
          callback("addTraveler", () => this.addTraveler()),
        ),
      ),

      new ErrorSummary({ key: "errors", verifying: this.verifying }),
      alert(
        { key: "sent", severity: "success" },
        row(
          { key: "sentRow", style: { alignItems: "center", gap: "8px" } },
          filler({ key: "sentText" }, text({ key: "sentMessage", text: this.sent || "" })),
          iconButton({ key: "dismiss", icon: "close", title: "Dismiss", onClick: callback("dismiss", () => { this.sent = null; }) }),
        ),
      ).show(!!this.sent),

      button({ key: "submit" }, text({ key: "submitText", text: "Submit" }), callback("submit", () => this.submit())),
    ];

    const formStyle = { display: "flex", flexDirection: "column", gap: "20px", padding: "24px", maxWidth: "720px", boxSizing: "border-box" };
    return row(
      { key: "page", style: { ...fitContainerStyle } },
      pageActions({ information, source, fileName: "src/pages/ReactiveFormPage.js" }),
      div(
        { key: "scrollPanel", style: { flex: "1 1 0", minWidth: 0, height: "100%", overflowY: "auto", boxSizing: "border-box" } },
        this.animate
          ? flipAnimationContainer({ key: "form", style: formStyle }, form)
          : column({ key: "plainForm", style: formStyle }, form),
      ),
      new ModelDataDisplay({ key: "modelData" }).show(wide),
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

  initializeState() {
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
      { key: "card", variant: "filled", style: { display: "flex", flexDirection: "column", gap: "12px" } },
      row(
        { key: "cardHeader", style: { alignItems: "center", gap: "8px" } },
        icon({ key: "personIcon", name: fellow ? "group" : "person" }),
        div({ key: "cardTitle", style: { fontWeight: "bold" } }, text({ key: "cardTitleText", text: fellow ? "Fellow traveler" : "Traveler" })),
        filler({ key: "cardHeaderFiller" }),
        iconButton({ key: "remove", icon: "close", title: "Remove traveler", onClick: this.onRemove }).show(fellow),
      ),

      field(traveler, "name", "Name"),
      field(traveler, "passportNumber", "Passport"),

      // Child and age: fellow travelers only - the age only for a child.
      checkbox({
        key: "isChild",
        label: "Is child",
        checked: traveler.isChild,
        onChange: callback("isChild", (checked) => { traveler.isChild = checked; }),
      }).show(fellow),
      textField({
        key: "age",
        label: "Age",
        type: "number",
        unit: "years",
        value: traveler.age,
        onInput: callback("age", (value) => { if (value !== "") traveler.age = Number(value); }),
      }).show(fellow && traveler.isChild),

      // The address: the main traveler only.
      column(
        { key: "address", style: { gap: "12px" } },
        field(traveler.address, "address", "Address"),
        field(traveler.address, "zipCode", "Zip code"),
        field(traveler.address, "city", "City"),
      ).show(!fellow),

      new LuggageDrawer({
        key: "luggageDrawer",
        count: traveler.luggages.length,
        isOpen: this.showLuggage,
        toggleOpen: callback("toggleLuggage", () => { this.showLuggage = !this.showLuggage; }),
        content: traveler.luggages.map((luggage) => new LuggageForm({
          key: "luggage" + luggage.id,
          luggage,
          onRemove: callback("removeLuggage" + luggage.id, () => { traveler.luggages.splice(traveler.luggages.indexOf(luggage), 1); }),
        })),
      }).show(traveler.luggages.length > 0),

      row(
        { key: "addLuggageRow" },
        filler({ key: "addLuggageFiller" }),
        button(
          { key: "addLuggage", style: { display: "flex", alignItems: "center", gap: "6px" } },
          icon({ key: "addLuggageIcon", name: "add" }),
          text({ key: "addLuggageText", text: "Add luggage" }),
          callback("addLuggage", () => this.addLuggage()),
        ),
      ).show(traveler.luggages.length === 0 || this.showLuggage),
    );
  }
}

/**
 * Luggage drawer - a button opening and closing it, and the luggage in it.
 */
class LuggageDrawer extends Component {
  setProperties({ count, isOpen, toggleOpen, content }) {
    this.count = count;
    this.isOpen = !!isOpen;
    this.toggleOpen = toggleOpen;
    this.content = content || [];
  }

  build() {
    return column(
      { key: "drawer", style: { gap: "10px" } },
      button(
        { key: "toggle", style: { display: "flex", alignItems: "center", gap: "20px", justifyContent: "space-between" } },
        span({ key: "toggleLabel" }, text({ key: "toggleText", text: this.isOpen ? "Hide luggage" : "Show luggage (" + this.count + ")" })),
        icon({ key: "toggleIcon", name: this.isOpen ? "expand_less" : "expand_more" }),
        this.toggleOpen,
      ),
      column({ key: "luggageList", style: { gap: "10px" } }, this.content).show(this.isOpen),
    );
  }
}

/**
 * Luggage form - one piece of luggage: its weight.
 */
class LuggageForm extends Component {
  setProperties({ luggage, onRemove }) {
    this.luggage = luggage;
    this.onRemove = onRemove;
  }

  build() {
    const luggage = this.luggage;
    return row(
      { key: "luggage", style: { alignItems: "center", gap: "12px" } },
      icon({ key: "luggageIcon", name: "luggage", style: { flex: "none" } }),
      textField({
        key: "weight",
        label: "Weight",
        type: "number",
        unit: "kg",
        value: luggage.weight,
        onInput: callback("weight", (value) => { if (value !== "") luggage.weight = Number(value); }),
      }),
      filler({ key: "luggageFiller" }),
      iconButton({ key: "remove", icon: "close", title: "Remove luggage", onClick: this.onRemove }),
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
      .show(this.verifying && anyErrors(data));
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
    return column(
      {
        key: "modelData",
        style: {
          width: "40%", maxWidth: "420px", flex: "none", height: "100%", boxSizing: "border-box",
          borderLeft: "1px solid #dfe6e9", background: "#f4f6f7", color: "#2c3e50",
        },
      },
      div({ key: "modelDataTitle", style: { padding: "12px 16px", fontWeight: "bold", flex: "none" } }, text({ key: "modelDataTitleText", text: "Model data" })),
      div(
        { key: "json", style: { flex: "1 1 0", overflow: "auto", padding: "0 16px 16px", whiteSpace: "pre", fontFamily: "monospace", fontSize: "12px" } },
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
