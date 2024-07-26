import { Component, transaction, model, getFlowProperties } from "@liquefy/flow.core";
import { DOMFlowTarget, text, div, span, p, addDefaultStyleToProperties } from "@liquefy/flow.DOM";

import { column, filler, fillerStyle, row } from "@liquefy/themed-ui";
import { checkboxInputField, numberInputField } from "@liquefy/themed-ui";
import { crossIcon, plusIcon, suitcaseIcon, icon } from "@liquefy/themed-ui";
import { button, textInputField } from "@liquefy/themed-ui";


const log = console.log;

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
    object[property + "Error"] = "Please enter " + requestedDataMessage + ".";
    return true;
  } else {
    delete object[property + "Error"];
    return false;
  }
}


/**
 * Reusable components. Flow component definitions.
 */

const panel = (...parameters) =>
  div(
    addDefaultStyleToProperties(
      getFlowProperties(parameters),
      {
        margin: "4px", 
        borderRadius: "5px", 
        backgroundColor: "#eeeeee", 
        borderColor: "#cccccc", 
        borderStyle: "solid", 
        borderWidth: "1px", 
        padding: "10px", 
        boxSizing: "border-box"
      }
  )
);

export class SimpleDrawer extends Component {
 setProperties({openButtonLabel = "Open", closeButtonLabel = "Close", isOpen, toggleOpen, content}) {
    this.openButtonLabel = openButtonLabel;
    this.closeButtonLabel = closeButtonLabel;
    this.isOpen = isOpen;
    this.toggleOpen = toggleOpen;
    this.content = content;
 }
 build() {
  const buttonIcon = this.isOpen ? icon({name: "chevron-up"}) : icon({name: "chevron-down"});
  const buttonLabel = this.isOpen ? this.closeButtonLabel : this.openButtonLabel; 
  return column(
    button(row(span(buttonLabel), buttonIcon, {style: {justifyContent: "space-between"}}), () => this.toggleOpen(), {style: {margin: "5px"}, ripple: true}),
    column("contents", {children: [this.isOpen ? this.content : null], /*animateChildren: true*/ })
  );
 }
}


/**
 * Components. Flow component definitions.
 */

export class ComplexForm extends Component {

  setProperties({initialData}) {
    this.name = "Complex Form";
    this.editData = initialData;
  }
  
  setState() {
    this.shouldVerifyData = false;
    this.derrive(() => {
      if (this.shouldVerifyData) {
        verifyData(this.editData);
        if (!this.editData.anyError) {
          this.shouldVerifyData = false;
        }
      }
    });
  }

  build() {
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
              // animateChildren: true,  
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
          text(JSON.stringify(this.editData, null, 4)),
          {style: {borderLeft: "1px", borderLeftStyle: "solid", borderLeftColor: "lightgray", backgroundColor: "#eeeeee"}}
        ),
        {style: fillerStyle}
      )
    );
  }
}


export class TravelerForm extends Component {
  setProperties({traveler, isFellowTraveller}) {
    this.traveler = traveler; 
    this.isFellowTraveller = isFellowTraveller;
  }  

  setState() {
    this.showLuggage = true; 
  }
  
  build() {
    const traveler = this.traveler;
    return panel(
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
      numberInputField("Age", traveler, "age", {unit: "years" /*, animate: true*/}).show(traveler.isChild),
      
      // Adress
      column(
        textInputField("Adress", traveler.adress, "adress"),
        textInputField("Zip code", traveler.adress, "zipCode"),
        textInputField("City", traveler.adress, "city"), 
        div({style: {height: "10px"}}),
      ).show(!traveler.isFellowTraveller),

      // Luggages 
      new SimpleDrawer("luggages-drawer", {
        // animate: true,
        closeButtonLabel: "Hide luggage",
        openButtonLabel: "Show luggage (" + this.traveler.luggages.length + ")",
        toggleOpen: () => { this.showLuggage = !this.showLuggage },
        isOpen: this.showLuggage,
        content: column("luggage-panel",
          column("luggage-list", {
            children: this.traveler.luggages.map(luggage => new LuggageForm("id-" + luggage.causality.id, {luggage})),
            // animateChildren: true
          })
        )
      }).show(this.traveler.luggages.length),

      // div({style: {height: "48px", backgroundColor: "green"}, animate: true}).show(this.traveler.luggages.length),

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
        ),
        // {
        //   animate: true
        // }
      ).show(!this.traveler.luggages.length || this.showLuggage)
    );
  }
}

export class LuggageForm extends Component {
  setProperties({luggage}) {
    this.luggage = luggage;
  }

  build() {
    // return div({style: {height: "48px", backgroundColor: "green"}})
    return panel(
      row(
        suitcaseIcon({style: {padding: "14px"}}),
        numberInputField("Weight", this.luggage, "weight", {unit: "kg"}),
        filler(),
        button(icon({name: "xmark"}), () => {this.creator.traveler.luggages.remove(this.luggage)}, {edge: false, square: true, ripple: true})
      )
    );
  }
}


/**
 * This is what you would typically do in index.js to start this app. 
 */

export function startComplexFormApplication() {
  new DOMFlowTarget(document.getElementById("root")).setContent(
    new ComplexForm({initialData})
  );
}