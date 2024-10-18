
/**
 * Reducer pattern
 */

const getInitialState = () => ({
  doneA: false, 
  doneB: false, 
  doneC: false,
  showNextStep: false, // Should show when (state.doneA && state.doneB && state.doneC)
  doneNextStep: false,
  showLastStep: false
})

const reducer = (state, action) => {
  switch (action.type) {
    case "doneA": 
      return {...state, doneA: true}
    case "doneB":
      return {...state, doneB: true}
    case "doneC":
      return {...state, doneB: true}
    case "doneNextStep":
      return {...state, doneNextStep: true}
    }
}

const nextReducer = (state, action) => {
  const state = reducer(state, action); 
  return {
    showNextStep: state.doneA && state.doneB && state.doneC, 
    ...state
  }
}

const lastReducer = (state, action) => {
  const state = nextReducer(state, action); 
  return {
    showLastStep: state.doneLastStep, 
    ...state
  }
}

const actions = {
  doneA: "SHOW_A",
  doneA: "SHOW_B",
  doneA: "SHOW_C"
}


// So how to set showNextStep? In every branch in the first reducer, or an actual reducer: 


/**
 * With MobX 
 */
import { action, computed, makeObservable, observable } from "mobx";
import { Store } from "../../../general/util-mobx-react";

export class ComponentWithStoreStore extends Store {
  constructor() {
    super();
    this.doneA = false;
    this.doneB = false; 
    this.doneC = false;
    this.doneNextStep = false; 

    makeObservable(this, {
      doneA: observable,
      doneB: observable, 
      doneC: observable, 
      showNextStep: computed,
      showLastStep: computed,
      onShowA: action.bound,
      onShowB: action.bound,
      ondoneC: action.bound
    })
  }

  get showNextStep() {
    // This will only be reevaluated if either doneA, doneB or doneC change. 
    return this.doneA && this.doneB && this.doneC;
  }

  get showLastStep() {
    // This will only be reevaluated if either doneA, doneB or doneC change. 
    return this.doneNextStep;
  }

  onShowA() {
    this.doneA = true;
  }

  onShowB() {
    this.doneB = true;
  }

  ondoneC() {
    this.doneC = true;
  }
};  



/**
 * Fixing state reducer pattern with fixed point semantics. 
 */
const fixedPointReducer = (actionReducer, consequenceReducer) => {
  return (
    (state, action) => {
      let state = actionReducer(state, action);

      let nextState = consequenceReducer(state);
      while (nextState !== state) {
        nextState = state;
        nextState = consequenceReducer(state);
      }

      return state; 
    }
  )
  const state = action
}

const consequenceReducer(state) => {
  if (state.doneNextStep_doneA !== state.doneA || state.doneNextStep_doneB !== state.doneB || state.doneNextStep_doneB !== state.doneB) {
    return {
      ...state,
      doneA_for_doneNextStep_doneA: doneA, 
      doneNextStep_doneB: doneB, 
      doneNextStep_doneC: doneC, 
      doneNextStep: doneA && doneB && doneC
    }
  }

  if (state.doneLastStep_doneLastStep !== state.doneLastStep) {
    return {
      ...state,
      doneLastStep_doneLastStep: state.doneLastStep,
      showLastStep: state.doneLastStep
    }
  }
} 
