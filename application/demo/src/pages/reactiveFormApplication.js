import { Component, transaction, model, callback, toProperties } from "@liquefy/flow.core";
import { DOMRenderContext, text, div, span, p, addDefaultStyleToProperties, zoomAnimation } from "@liquefy/flow.DOM";

import { columnStyle, naturalSizeStyle } from "@liquefy/basic-ui";
import { column, filler, fillerStyle, row } from "@liquefy/themed-ui";
import { checkboxInputField, numberInputField } from "@liquefy/themed-ui";
import { crossIcon, plusIcon, suitcaseIcon, icon } from "@liquefy/themed-ui";
import { button, paper, paperRow, paperColumn, textInputField, card } from "@liquefy/themed-ui";


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
  const buttonIcon = this.isOpen ? icon({name: "chevron-up"}) : icon({name: "chevron-down"});
  const buttonLabel = this.isOpen ? this.closeButtonLabel : this.openButtonLabel; 
  return column(
    button(row(span(buttonLabel), buttonIcon, {style: {justifyContent: "space-between"}}), () => this.toggleOpen(), {style: {margin: "5px"}, ripple: true}),
    column("contents", {children: [this.isOpen ? this.content : null], animateChildren: configuration.animation})
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
            p("Cost: " + calculateCost(data), {style: {marginBottom: "5px"}}),
            p("Traveler Information " + travelerString(), {style: {fontSize: "15px", paddingBottom: "10px"}}),

            // Traveler forms
            new TravelerForm({traveler, isFellowTraveller: false}),
            column({
              children: this.editData.fellowTravellers.map(traveler => new TravelerForm("id-" + traveler.causality.id, {traveler, isFellowTraveller: true})),
              style: { overflow: "visible" } 
            }),

            // Add traveler button
            row(
              filler(),
              button("+ Traveler", () => this.editData.fellowTravellers.push(createTraveler(true)), {ripple: true})
            ),

            // Submit button
            button("Submit", 
              () => {
                this.shouldVerifyData = true;
                if (!data.anyError) {
                  this.shouldVerifyData = false; 
                  alert("Sent form!\n" + JSON.stringify(this.editData, null, 4));
                }
              }, 
              {
                style: {marginTop: "30px"},
                disabled: data.anyError,
                ripple: true
              }),
            filler(),
            { style: {padding: "30px"}}
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
        button(icon({name: "xmark"}), () => {this.creator.editData.fellowTravellers.remove(this.traveler)}, {edge: false, square: true, ripple: true})
      ).show(traveler.isFellowTraveller),

      // Traveler inforation
      textInputField("Name", traveler, "name"),
      textInputField("Passport", traveler, "passportNumber"),
      div({style: {height: "10px"}}),

      // Child info
      checkboxInputField("Is Child", traveler, "isChild").show(this.isFellowTraveller),
      numberInputField("Age", traveler, "age", {unit: "years", animate: configuration.animation}).show(traveler.isChild),
      
      // Adress
      column(
        textInputField("Adress", traveler.adress, "adress"),
        textInputField("Zip code", traveler.adress, "zipCode"),
        textInputField("City", traveler.adress, "city"), 
        div({style: {height: "10px"}}),
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
            animateChildren: configuration.animation
          })
        ),
        animate: configuration.animation
      }).show(this.traveler.luggages.length),

      // Add luggages button
      row("add-luggage",
        filler(),
        button(
          icon({name: "suitcase-rolling", style: {marginRight: "10px"}}),
          "Add luggage",
          () => {
            transaction(() => {
              this.traveler.luggages.push(model({weight: 1, type: "bag"}));
              this.showLuggage = true;
            });
          },
          {
            ripple: true,
            edge: false 
          }
        ), { animate: configuration.animation }
      ).show(!this.traveler.luggages.length || this.showLuggage), 
      {
        style: {
          gap: "4px",
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
    return paperRow(
      suitcaseIcon({style: {padding: "14px"}}),
      numberInputField("Weight", this.luggage, "weight", {unit: "kg"}),
      filler(),
      button(icon({name: "xmark"}), () => {this.creator.traveler.luggages.remove(this.luggage)}, {edge: false, square: true, ripple: true})
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