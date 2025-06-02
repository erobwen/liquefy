import { Component, transaction, model, callback, toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, span, p, addDefaultStyleToProperties, zoomAnimation } from "@liquefy/flow.DOM";

import { centerMiddle, columnStyle, middle, naturalSizeStyle } from "@liquefy/basic-ui";
import { column, filler, fillerStyle, row } from "@liquefy/themed-ui";
import { checkboxInputField, numberInputField } from "@liquefy/themed-ui";
import { crossIcon, plusIcon, suitcaseIcon, icon } from "@liquefy/themed-ui";
import { button, paper, paperRow, paperColumn, textInputField, card } from "@liquefy/themed-ui";
import { buttonIcon } from "@liquefy/ui-material";


const log = console.log;

/**
 * Configuration 
 */
const configuration = model({animation: zoomAnimation}) 

/**
 * Data model. 
 * Plain Javascript except call to "model()"
 */

export const initialData = model({
  traveler: createInitialTraveler(),
  fellowTravellers: [
    // createTraveler(true, true)
  ]
}, true);

function createInitialTraveler() {
  return {
    name: "", 
    passportNumber: "",
    adress: {
      adress: "",
      zipCode: "", 
      city: ""
    },
    isFellowTraveller: false,
    isChild: false,
    age: 1,
    luggages: []
  };
}

function createTraveler(isFellowTraveller, luggage) {
  const result = model(createInitialTraveler(), true);
  if (luggage) result.luggages.push(model({weight: 1, type: "bag"}))
  result.isFellowTraveller = isFellowTraveller;
  return result; 
}


/**
 * Cost calculator. Plain Javascript. Cost calculator. 
 */
function calculateCost(data) {
  let cost = 0;
  function addLuggageCost(luggage) {
    cost += (luggage.weight <= 1) ? 20 : 40; 
  }

  function addTravelerCost(traveler) {
    cost += traveler.isChild ? 100 : 200;
    traveler.luggages.forEach(luggage => addLuggageCost(luggage));
  }

  addTravelerCost(data.traveler);
  data.fellowTravellers.forEach(traveler => addTravelerCost(traveler));
  return cost; 
}


/**
 * Travlers verifier. Plain Javascript, model verification. 
 */

function verifyData(editData) {
  transaction(() => {
    let anyError = false; 
    anyError = verifyTraveler(editData.traveler, false) || anyError;
    editData.fellowTravellers.forEach(traveler => {anyError = verifyTraveler(traveler, true) || anyError});
    editData.anyError = anyError;
  });
}

function verifyTraveler(traveler, fellowTraveler) {
  let anyError = false; 
  if (!fellowTraveler) {
    anyError = verifyAdress(traveler.adress) || anyError;
  }
  anyError = verifyFieldNotEmpty(traveler, "name", "name") || anyError;
  anyError = verifyFieldNotEmpty(traveler, "passportNumber", "passport number") || anyError;
  return anyError; 
}

function verifyAdress(adress) {
  let anyError = false; 
  anyError = verifyFieldNotEmpty(adress, "adress", "adress") || anyError;
  anyError = verifyFieldNotEmpty(adress, "zipCode", "zip code") || anyError;
  anyError = verifyFieldNotEmpty(adress, "city", "city") || anyError;
  return anyError; 
}

function verifyFieldNotEmpty(object, property, requestedDataMessage) {
  if (object[property] === "") {
    if (typeof(object.errors) === "undefined") {
      object.errors = model({});
    }
    object.errors[property] = "Please enter " + requestedDataMessage + ".";
    return true;
  } else if (object.errors && object.errors[property]) {
    delete object.errors[property];
    if (Object.keys(object.errors).length === 0) delete object.errors; 
    return false;
  } else {
    return false; 
  }
}

export class SimpleDrawer extends Component {
  receive(properties) {
    Object.assign(this, properties)
    const {openButtonLabel = "Open", closeButtonLabel = "Close", isOpen, toggleOpen, content} = properties
    this.openButtonLabel = openButtonLabel;
    this.closeButtonLabel = closeButtonLabel;
    this.isOpen = isOpen;
    this.toggleOpen = toggleOpen;
    this.content = content;
 }
 render() {
  const buttonIcon = this.isOpen ? icon({name: "keyboard_arrow_up"}) : icon({name: "keyboard_arrow_down"});
  const buttonLabel = this.isOpen ? this.closeButtonLabel : this.openButtonLabel; 
  return column(
    button(row(
      span(buttonLabel, {style: {lineHeight: "24px", marginRight: "20px"}}), 
      buttonIcon, 
      {style: {justifyContent: "space-between"}}), 
      () => this.toggleOpen(), 
    ),
    column("contents", {
      children: [this.isOpen ? this.content : null], animateChildren: configuration.animation,
      style: {gap: "10px"}
    }), 
    {style: {gap: "10px"}}
  );
 }
}


/**
 * Components. Flow component definitions.
 */

export class ReactiveForm extends Component {

  receive(properties) {
    Object.assign(this, properties)
    const {initialData} = properties;
    this.name = "Reactive Form";
    this.editData = initialData;
  }
  
  initialize() {
    this.shouldVerifyData = false;
    this.ensure(() => {
      if (this.shouldVerifyData) {
        verifyData(this.editData);
        if (!this.editData.anyError) {
          this.shouldVerifyData = false;
        }
      }
    });
  }

  render() {
    const data = this.editData;
    const traveler = data.traveler;

    function travelerString() {
      const count = data.fellowTravellers.length + 1;
      return (count === 1) ? "" : ("(" + count + " people)");
    }

    return (
      row(
        div("scrollPanel",
          column(
            // Header       
            div("Cost: " + calculateCost(data)),
            div("Traveler Information " + travelerString(), {style: {fontSize: "15px"}}),

            // Traveler forms
            // column(
            new TravelerForm({traveler, isFellowTraveller: false}),

            column({
              children: this.editData.fellowTravellers.map(traveler => new TravelerForm("id-" + traveler.causality.id, {traveler, isFellowTraveller: true})),
              style: { overflow: "visible", gap: "20px" } 
            }),
            // ),

            // Add traveler button
            row(
              filler(),
              button(
                middle(icon({name: "add"})),
                span("Traveler", {style: {lineHeight: "46px"}}), 
                () => this.editData.fellowTravellers.push(createTraveler(true))
              )
            ),

            // Submit button
            button("Submit", 
              () => {
                this.shouldVerifyData = true;
                if (!data.anyError) {
                  this.shouldVerifyData = false; 
                  alert("Sent form!\n" + JSON.stringify(this.editData, null, 4));
                }
              }
            ),
            filler(),
            { style: {gap: "20px", padding: "30px"}}
          ),
          { style: {boxSizing: "border-box", height: "100%", overflowY: "scroll"}}
        ),

        filler(),

        // Model Data Display 
        column(
          checkboxInputField("Animate", () => configuration.animation, (checked) => configuration.animation = checked ? zoomAnimation : null, 
            {style: naturalSizeStyle}),
          div(
            text(JSON.stringify(this.editData, null, 4)),
            {style: fillerStyle}
          ),
          {style: {borderLeft: "1px", borderLeftStyle: "solid", borderLeftColor: "lightgray", backgroundColor: "#eeeeee"}}
        ),
        { style: this.style }
      )
    );
  }
}

export class TravelerForm extends Component {
  receive(properties) {
    Object.assign(this, {
      traveler: null,
      isFellowTraveller: null,
      animate: configuration.animation
    }, properties)
  }  

  initialize() {
    this.showLuggage = true; 
  }
  
  render() {
    const traveler = this.traveler;
    return card(
      // Recommendation: Do ineritance first, to avoid diabling caches further down. Nooo... wait... setting the same value twice will not trigger anything! 

      // Remove button
      row(
        filler(),
        buttonIcon(
          {icon: "close"}, 
          () => {this.creator.editData.fellowTravellers.remove(this.traveler)}, 
        )
      ).show(traveler.isFellowTraveller),

      // Traveler inforation
      column(
        textInputField("Name", traveler, "name"),
        textInputField("Passport", traveler, "passportNumber"),
        {style: { gap: "5px" }}
      ),

      // Child info
      checkboxInputField("Is Child", traveler, "isChild").show(this.isFellowTraveller),
      numberInputField("Age", traveler, "age", {unit: "years", animate: configuration.animation}).show(traveler.isChild),
      
      // Adress
      column(
        textInputField("Adress", traveler.adress, "adress"),
        textInputField("Zip code", traveler.adress, "zipCode"),
        textInputField("City", traveler.adress, "city"), 
        {style: { gap: "5px" }}
      ).show(!traveler.isFellowTraveller),

      // Luggages 
      new SimpleDrawer("luggages-drawer", {
        closeButtonLabel: "Hide luggage",
        openButtonLabel: "Show luggage (" + this.traveler.luggages.length + ")",
        toggleOpen: () => { this.showLuggage = !this.showLuggage },
        isOpen: this.showLuggage,
        content: column("luggage-panel",
          column("luggage-list", {
            children: this.traveler.luggages.map(luggage => new LuggageForm("id-" + luggage.causality.id, {luggage})),
            animateChildren: configuration.animation,
            style: {gap: "10px"}
          }),
          {style: {gap: "10px"}}
        ),
        animate: configuration.animation
      }).show(this.traveler.luggages.length),

      // Add luggages button
      row("add-luggage",
        filler(),
        button(
          icon({name: "add", style: {marginRight: "10px"}}),
          span("Add luggage", {style: {lineHeight: "24px"}}),
          () => {
            transaction(() => {
              this.traveler.luggages.push(model({weight: 1, type: "bag"}));
              this.showLuggage = true;
            });
          }, 
        ), 
        { 
          animate: configuration.animation 
        }
      ).show(!this.traveler.luggages.length || this.showLuggage), 
      {
        style: {
          gap: "10px",
          ...columnStyle
        }
      }
    );
  }
}

export class LuggageForm extends Component {
  receive({luggage}) {
    this.luggage = luggage;
  }

  render() {
    // return div({style: {height: "48px", backgroundColor: "green"}})
    return row(
      centerMiddle(icon({name: "luggage"}), {style: {width: "40px"}}),
      numberInputField("Weight", this.luggage, "weight", {unit: "kg", style: {width: "150px"}}),
      filler(),
      middle(
        buttonIcon(
          {icon: "close"}, 
          () => {this.creator.traveler.luggages.remove(this.luggage)}, 
        )
      )
    );
  }
}


/**
 * This is what you would typically do in index.js to start this app. 
 */

export function startReactiveFormApplication() {
  new DOMRenderContext(document.getElementById("root")).render(
    new ReactiveForm({initialData})
  );
}