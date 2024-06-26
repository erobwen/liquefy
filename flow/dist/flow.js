var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function K(r) {
  return Array.prototype.slice.call(r);
}
function Z(r, n) {
  if (n instanceof Array) {
    it(r.causality.target, n.causality.target).forEach(function(b) {
      let y = [];
      y.push(b.index, b.removed.length), y.push.apply(y, b.added), r.splice.apply(r, y);
    });
    for (let b in n)
      isNaN(b) && (r[b] = n[b]);
  } else
    for (let s in n)
      r[s] = n[s];
  return r;
}
function it(r, n) {
  let s = false, b = [], y = 0, O = 0, I = 0;
  function g(d) {
    let h = {
      type: "splice",
      index: y + I,
      removed: [],
      added: d
    };
    I += d.length, b.push(h);
  }
  function l(d) {
    let h = {
      type: "splice",
      index: y + I,
      removed: d,
      added: []
    };
    I -= d.length, b.push(h);
  }
  function c(d, h) {
    let m = {
      type: "splice",
      index: y + I,
      removed: d,
      added: h
    };
    I -= d.length, I += h.length, b.push(m);
  }
  for (; !s; ) {
    for (; y < r.length && O < n.length && r[y] === n[O]; )
      y++, O++;
    if (y === r.length && O === n.length)
      s = true;
    else if (O === n.length) {
      const d = [];
      let h = y;
      for (; h < r.length; )
        d.push(r[h++]);
      l(d), s = true;
    } else if (y === r.length) {
      const d = [];
      for (; O < n.length; )
        d.push(n[O++]);
      g(d), s = true;
    } else {
      let d = y, h = O, m = false;
      for (; d < r.length && !m; ) {
        for (h = O; h < n.length && !m; )
          r[d] === n[h] && (m = true), m || h++;
        m || d++;
      }
      c(
        r.slice(y, d),
        n.slice(O, h)
      ), y = d, O = h;
    }
  }
  return b;
}
function rt(r) {
  return r.name ? r.name : (r = ge(r), JSON.stringify(r));
}
function ge(r) {
  if (typeof r == "object") {
    if (r === null) return "null";
    let n = Object.keys(r);
    n.sort(function(b, y) {
      return b < y ? -1 : b > y ? 1 : 0;
    });
    let s = {};
    return n.forEach(function(b) {
      let y = r[b];
      typeof y == "object" && (y = ge(y)), s[b] = y;
    }), s;
  } else
    return "[" + typeof r + "]";
}
const pe = {
  Reset: "\x1B[0m",
  Bright: "\x1B[1m",
  Dim: "\x1B[2m",
  Underscore: "\x1B[4m",
  Blink: "\x1B[5m",
  Reverse: "\x1B[7m",
  Hidden: "\x1B[8m",
  FgBlack: "\x1B[30m",
  FgRed: "\x1B[31m",
  FgGreen: "\x1B[32m",
  FgYellow: "\x1B[33m",
  FgBlue: "\x1B[34m",
  FgMagenta: "\x1B[35m",
  FgCyan: "\x1B[36m",
  FgWhite: "\x1B[37m",
  BgBlack: "\x1B[40m",
  BgRed: "\x1B[41m",
  BgGreen: "\x1B[42m",
  BgYellow: "\x1B[43m",
  BgBlue: "\x1B[44m",
  BgMagenta: "\x1B[45m",
  BgCyan: "\x1B[46m",
  BgWhite: "\x1B[47m"
};
let L = {
  // Count the number of chars that can fit horizontally in your buffer. Set to -1 for one line logging only. 
  bufferWidth: 83,
  // bufferWidth : 83
  // bufferWidth : 76
  indentToken: "  ",
  // Change to true in order to find all logs hidden in your code.
  findLogs: false,
  // Set to true in web browser that already has a good way to display objects with expandable trees.
  useConsoleDefault: false
}, H = 0;
function ot() {
  function r(n) {
    return n ? r(n.caller).concat([n.toString().split("(")[0].substring(9) + "(" + n.arguments.join(",") + ")"]) : [];
  }
  return r(arguments.callee.caller);
}
function k(r) {
  let n = "";
  for (; r-- > 0; )
    n = n + L.indentToken;
  return n;
}
function ee() {
  const r = {
    terminated: false,
    rootLevel: true,
    horizontal: false,
    indentLevel: H,
    unfinishedLine: false
  };
  return r.resetColor = () => {
    r.setColor("Reset");
  }, r;
}
function st() {
  let r = ee();
  return r.result = "", r.log = function(n) {
    this.unfinishedLine ? (this.result += n, this.unfinishedLine = true) : (this.result += k(this.indentLevel) + n, this.unfinishedLine = true);
  }, r.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (this.result += `
`, this.unfinishedLine = false);
  }, r.setColor = function() {
  }, r.jsonCompatible = true, r;
}
function U() {
  let r = ee();
  return r.lineMemory = "", r.log = function(n) {
    if (this.unfinishedLine)
      typeof process < "u" ? process.stdout.write(n) : r.lineMemory += n, this.unfinishedLine = true;
    else {
      let s = k(this.indentLevel);
      typeof process < "u" ? process.stdout.write(s + n) : r.lineMemory += s + n, this.unfinishedLine = true;
    }
  }, r.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (r.lineMemory !== "" ? (console.log(r.lineMemory), r.lineMemory = "") : console.log(), this.unfinishedLine = false);
  }, r.setColor = function(n) {
    pe[n] || (n = "Reset"), r.log(pe[n]);
  }, r.jsonCompatible = false, r;
}
function lt(r, n) {
  let s = ee();
  return s.horizontal = true, s.count = 0, s.limit = r, s.log = function(b) {
    if (this.unfinishedLine)
      this.count += b.length, this.terminated = this.count > this.limit, this.unfinishedLine = true;
    else {
      let y = k(this.indentLevel);
      this.count += (y + b).length, this.terminated = this.count > this.limit, this.unfinishedLine = true;
    }
  }, s.finishOpenLine = function() {
  }, s.setColor = function() {
  }, s.jsonCompatible = n.jsonCompatible, s;
}
function ye(r, n, s, b) {
  let y = lt(s, b);
  return M(r, n, y), !y.terminated;
}
function M(r, n, s) {
  const b = s.rootLevel, y = s.jsonCompatible;
  if (s.rootLevel = false, typeof n > "u" && (n = 1), typeof n == "function" && (r = n(r), n = -1), !s.terminated) {
    if (typeof r != "object")
      if (typeof r == "function")
        s.setColor("FgBlue"), s.log("function( ... ) { ... }"), s.resetColor();
      else if (typeof r == "string")
        if (b)
          s.log(r);
        else {
          s.setColor("FgGreen");
          const O = y ? '"' : "'";
          s.log(O + r + O), s.resetColor();
        }
      else
        s.setColor("FgYellow"), s.log(r + ""), s.resetColor();
    else if (r === null)
      s.log("null");
    else if (n === 0)
      r instanceof Array ? (s.log("["), s.setColor("FgCyan"), s.log("..."), s.resetColor(), s.log("]")) : (s.log("{"), s.setColor("FgCyan"), s.log("..."), s.resetColor(), s.log("}"));
    else {
      let O = r instanceof Array;
      const I = Object.keys(r).length;
      let g = false;
      if (!s.horizontal) {
        let c = L.bufferWidth - s.indentLevel * L.indentToken.length;
        s.horizontal = L.bufferWidth === -1 ? true : ye(r, n, c, s), g = s.horizontal;
      }
      O && s.finishOpenLine(), s.log(O ? "[" : "{"), s.horizontal && I && s.log(" "), s.finishOpenLine(), s.indentLevel++;
      let l = true;
      for (let c in r) {
        l || (s.log(", "), s.finishOpenLine()), (!O || isNaN(c)) && (y && s.log('"'), s.log(c), y && s.log('"'), s.log(": "));
        let d = null;
        typeof n == "object" ? d = n[c] : d = n === -1 ? -1 : n - 1, O || s.indentLevel++, M(r[c], d, s), O || s.indentLevel--, l = false;
      }
      s.indentLevel--, s.finishOpenLine(), s.horizontal && I && s.log(" "), s.log(O ? "]" : "}"), g && (s.horizontal = false);
    }
    b && s.finishOpenLine();
  }
}
const W = {
  // Configuration
  configuration: L,
  stacktrace: ot,
  log(r, n) {
    if (W.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.log(r) : M(r, n, U());
  },
  // If you need the output as a string.
  logToString(r, n) {
    let s = st();
    return M(r, n, s), s.result;
  },
  loge(r) {
    this.log("<<<" + r + ">>>");
  },
  logs() {
    this.log("---------------------------------------");
  },
  logss() {
    this.log("=======================================");
  },
  logsss() {
    this.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
  },
  logVar(r, n, s) {
    if (W.findLogs) throw new Error("No logs allowed!");
    if (L.useConsoleDefault)
      console.log(r + ":"), console.group(), console.log(n), console.groupEnd();
    else {
      context = U(), typeof s > "u" && (s = 1), context.log(r + ": ");
      let b = L.bufferWidth - context.indentLevel * L.indentToken.length - (r + ": ").length;
      context.horizontal = L.bufferWidth === -1 ? true : ye(n, s, b), context.horizontal ? M(n, s, context) : (context.indentLevel++, M(n, s, context), context.indentLevel--);
    }
  },
  group(r, n) {
    if (W.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.group(r) : (typeof r < "u" && M(r, n, U()), H++);
  },
  groupEnd(r, n) {
    if (W.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.groupEnd() : (H--, H < 0 && (H = 0), typeof r < "u" && M(r, n, U()));
  }
};
function at(r) {
  function n(c, d) {
    if (typeof c != typeof d)
      return false;
    if (c.length === d.length) {
      for (let h = 0; h < c.length; h++)
        if (c[h] !== d[h])
          return false;
      return true;
    } else
      return false;
  }
  function s(c, d) {
    if (c.length === 0)
      return false;
    for (let h = 0; h < c.length; h++)
      if (n(
        c[h].argumentList,
        d
      ))
        return true;
    return false;
  }
  function b(c, { signature: d, unique: h, argumentList: m }) {
    return h ? typeof c[d] < "u" : typeof c[d] > "u" ? false : s(c[d], m);
  }
  function y(c, { signature: d, unique: h, argumentList: m }) {
    if (h)
      return c[d];
    {
      let R = c[d];
      for (let C = 0; C < R.length; C++)
        if (n(R[C].argumentList, m))
          return R[C].value;
    }
  }
  function O(c, { signature: d, unique: h, argumentList: m }) {
    if (h) {
      delete c[d];
      return;
    } else {
      let R = c[d];
      for (let C = 0; C < R.length; C++)
        if (n(R[C].argumentList, functionArguments)) {
          R.splice(C, 1);
          return;
        }
    }
  }
  function I(c, { signature: d, unique: h, argumentList: m }, R) {
    if (h)
      c[d] = R;
    else {
      let C = c[d];
      C || (C = r([]), c[d] = C), C.push({ argumentList: m, value: R });
    }
  }
  function g(c) {
    let d = true, h = "";
    return c.forEach(function(m, R) {
      R > 0 && (h += ","), typeof m.causality < "u" ? h += "{id=" + m.causality.id + "}" : typeof m == "number" || typeof m == "string" ? h += m : (d = false, h += "{}");
    }), { signature: "(" + h + ")", unique: d, argumentList: c };
  }
  function l(c) {
    const d = r({});
    return () => {
      argumentsToArray(arguments);
      let h = g(argumentList);
      return b(d, h) || invalidateOnChange(
        () => {
          const m = c.apply(null, argumentList);
          I(d, h, m);
        },
        () => {
          O(d, h);
        }
      ), y(d, h);
    };
  }
  return l;
}
let he = 500;
function ft(r) {
  const n = r.state, s = r.invalidateObserver;
  function b(g, l, c) {
    return typeof l != "string" && (c = l, l = null), {
      description: g,
      key: l,
      handler: c,
      isRoot: true,
      contents: {},
      contentsCounter: 0,
      first: null,
      last: null
    };
  }
  function y(g, l, c) {
    let d = g.id;
    if (typeof l.contents[d] < "u" || l.contentsCounter === he && l.last !== null && (l = l.last, typeof l.contents[d] < "u"))
      return;
    if (l.contentsCounter === he) {
      let m = {
        isRoot: false,
        contents: {},
        contentsCounter: 0,
        next: null,
        previous: null,
        parent: null
      };
      l.isRoot ? (m.parent = l, l.first = m, l.last = m) : (l.next = m, m.previous = l, m.parent = l.parent, l.parent.last = m), l = m;
    }
    let h = l.contents;
    typeof h[d] > "u" && (l.contentsCounter = l.contentsCounter + 1, h[d] = g, g.sources.push(l));
  }
  function O(g, l, c) {
    if (n.postponeInvalidation++, n.blockInvalidation > 0)
      return;
    let d = g.contents;
    for (let h in d)
      s(d[h], l, c);
    if (typeof g.first < "u") {
      let h = g.first;
      for (; h !== null; ) {
        let m = h.contents;
        for (let R in m)
          s(m[R], l, c);
        h = h.next;
      }
    }
    n.postponeInvalidation--, r.proceedWithPostponedInvalidations();
  }
  function I(g, l) {
    let c = l.contents;
    delete c[g];
    let d = false;
    l.contentsCounter--, l.contentsCounter == 0 && (l.isRoot ? l.first === null && l.last === null && (d = true) : (l.parent.first === l && (l.parent.first, l.next), l.parent.last === l && (l.parent.last, l.previous), l.next !== null && (l.next.previous = l.previous), l.previous !== null && (l.previous.next = l.next), l.previous = null, l.next = null, l.parent.first === null && l.parent.last === null && (d = true)), d && typeof l.handler.proxy.onRemovedLastObserver == "function" && l.handler.proxy.onRemovedLastObserver(l.description, l.key));
  }
  return {
    recordDependencyOnArray: (g, l) => {
      l._arrayObservers === null && (l._arrayObservers = b("arrayDependees", l)), y(g, l._arrayObservers);
    },
    recordDependencyOnEnumeration: (g, l) => {
      typeof l._enumerateObservers > "u" && (l._enumerateObservers = b("enumerationDependees", l)), y(g, l._enumerateObservers);
    },
    recordDependencyOnProperty: (g, l, c) => {
      c !== "toString" && (typeof l._propertyObservers > "u" && (l._propertyObservers = {}), typeof l._propertyObservers[c] > "u" && (l._propertyObservers[c] = b("propertyDependees", c, l)), y(g, l._propertyObservers[c]));
    },
    invalidateArrayObservers: (g, l) => {
      g._arrayObservers !== null && O(g._arrayObservers, g.proxy, l);
    },
    invalidatePropertyObservers: (g, l) => {
      typeof g._propertyObservers < "u" && typeof g._propertyObservers[l] < "u" && O(g._propertyObservers[l], g.proxy, l);
    },
    invalidateEnumerateObservers: (g, l) => {
      typeof g._enumerateObservers < "u" && O(g._enumerateObservers, g.proxy, l);
    },
    removeAllSources: (g) => {
      const l = g.id;
      g.sources.forEach(function(c) {
        I(l, c);
      }), g.sources.length = 0;
    }
  };
}
const ut = W, dt = {
  requireRepeaterName: false,
  requireInvalidatorName: false,
  warnOnNestedRepeater: true,
  alwaysDependOnParentRepeater: false,
  priorityLevels: 4,
  objectMetaProperty: "causality",
  useNonObservablesAsValues: false,
  valueComparisonDepthLimit: 5,
  sendEventsToObjects: true,
  // Reserved properties that you can override on observables IF sendEventsToObjects is set to true. 
  // onChange
  // onBuildCreate
  // onBuildRemove
  onEventGlobal: null,
  emitReBuildEvents: false,
  // allowNonObservableReferences: true, // Allow observables to refer to non referables. TODO?
  onWriteGlobal: null,
  onReadGlobal: null,
  cannotReadPropertyValue: null,
  customObjectlog: null,
  customDependencyInterfaceCreator: null,
  //{recordDependencyOnArray, recordDependencyOnEnumeration, recordDependencyOnProperty, recordDependency}
  customCreateInvalidator: null,
  customCreateRepeater: null
};
function ct(r) {
  const n = {
    recordingPaused: 0,
    blockInvalidation: 0,
    postponeInvalidation: 0,
    postponeRefreshRepeaters: 0,
    // Object creation
    nextObjectId: 1,
    nextTempObjectId: 1,
    // Stack
    context: null,
    // Observers
    observerId: 0,
    inActiveRecording: false,
    nextObserverToInvalidate: null,
    lastObserverToInvalidate: null,
    // Repeaters
    inRepeater: null,
    dirtyRepeaters: [...Array(r.priorityLevels).keys()].map(() => ({ first: null, last: null })),
    refreshingAllDirtyRepeaters: false,
    workOnPriorityLevel: [...Array(r.priorityLevels).keys()].map(() => 0),
    revalidationLevelLock: -1
  }, s = {
    name: r.name,
    sameAsPreviousDeep: $,
    // Main API
    observable: z,
    deeplyObservable: re,
    isObservable: D,
    create: z,
    // observable alias
    invalidateOnChange: Ge,
    repeat: Je,
    finalize: Ye,
    // Modifiers
    withoutRecording: we,
    withoutReactions: Ce,
    // Transaction
    doWhileInvalidationsPostponed: ne,
    transaction: ne,
    postponeInvalidations: Re,
    continueInvalidations: Ie,
    // Debugging and testing
    clearRepeaterLists: Ze,
    // Logging (these log commands do automatic withoutRecording to avoid your logs destroying your test-setup) 
    log: ke,
    loge: (e) => {
      R.loge(e);
    },
    // "event"
    logs: () => {
      R.logs();
    },
    // "separator"
    logss: () => {
      R.logss();
    },
    logsss: () => {
      R.logss();
    },
    logGroup: et,
    logUngroup: tt,
    logToString: nt,
    // Advanced (only if you know what you are doing, typically used by plugins to causality)
    state: n,
    enterContext: F,
    leaveContext: _,
    invalidateObserver: ze,
    proceedWithPostponedInvalidations: J,
    nextObserverId: () => n.observerId++,
    // Libraries
    caching: at(z),
    // Priority levels 
    enterPriorityLevel: S,
    exitPriorityLevel: X,
    workOnPriorityLevel: Ae
  }, b = r.customCreateRepeater ? r.customCreateRepeater : Ke, y = r.customCreateInvalidator ? r.customCreateInvalidator : qe, O = r.customDependencyInterfaceCreator ? r.customDependencyInterfaceCreator(s) : ft(s), I = O.recordDependencyOnArray, g = O.recordDependencyOnEnumeration, l = O.recordDependencyOnProperty, c = O.invalidateArrayObservers, d = O.invalidateEnumerateObservers, h = O.invalidatePropertyObservers, m = O.removeAllSources, R = r.customObjectlog ? r.customObjectlog : ut, C = Te(), {
    requireRepeaterName: me,
    requireInvalidatorName: be,
    warnOnNestedRepeater: Oe,
    objectMetaProperty: f,
    sendEventsToObjects: te,
    onEventGlobal: Y,
    emitReBuildEvents: ve,
    onWriteGlobal: x,
    onReadGlobal: A,
    cannotReadPropertyValue: E
  } = r, T = !!Y || te;
  function we(e) {
    n.recordingPaused++, j(), e(), n.recordingPaused--, j();
  }
  function ne(e) {
    n.postponeInvalidation++, e(), n.postponeInvalidation--, J();
  }
  function Re() {
    n.postponeInvalidation++;
  }
  function Ie() {
    n.postponeInvalidation--, J();
  }
  function Ce(e) {
    n.blockInvalidation++, e(), n.blockInvalidation--;
  }
  function S(e) {
    if (typeof e != "number") {
      const t = e;
      e = typeof t.priority == "function" ? t.priority() : 0;
    }
    n.workOnPriorityLevel[e]++;
  }
  function X(e) {
    if (typeof e != "number") {
      const i = e;
      e = typeof i.priority == "function" ? i.priority() : 0;
    }
    n.workOnPriorityLevel[e]--;
    let t = true;
    for (; e < n.workOnPriorityLevel.length && n.workOnPriorityLevel[e] === 0; )
      typeof r.onFinishedPriorityLevel == "function" && r.onFinishedPriorityLevel(e, t), n.revalidationLevelLock = e, e++, t = false;
  }
  function Ae(e, t) {
    S(e), t(), X(e);
  }
  function j() {
    n.inActiveRecording = n.context !== null && n.context.isRecording && n.recordingPaused === 0, n.inRepeater = n.context && n.context.type === "repeater" ? n.context : null;
  }
  function F(e) {
    return e.parent = n.context, n.context = e, j(), S(e), e;
  }
  function _(e) {
    if (n.context && e === n.context)
      n.context = n.context.parent;
    else
      throw new Error("Context missmatch");
    j(), X(e);
  }
  function Te() {
    const e = {
      pop: function() {
        let t = this.target.length - 1, i = this.target.pop();
        return c(this, "pop"), T && P(this, t, [i], null), i;
      },
      push: function() {
        let t = this.target.length, i = K(arguments);
        return this.target.push.apply(this.target, i), c(this, "push"), T && P(this, t, null, i), this.target.length;
      },
      shift: function() {
        let t = this.target.shift();
        return c(this, "shift"), T && P(this, 0, [t], null), t;
      },
      unshift: function() {
        let t = K(arguments);
        return this.target.unshift.apply(this.target, t), c(this, "unshift"), T && P(this, 0, null, t), this.target.length;
      },
      splice: function() {
        let t = K(arguments), i = t[0], o = t[1];
        typeof t[1] > "u" && (o = this.target.length - i);
        let u = t.slice(2), a = this.target.slice(i, i + o), p = this.target.splice.apply(this.target, t);
        return c(this, "splice"), T && P(this, i, a, u), p;
      },
      copyWithin: function(t, i, o) {
        if (i || (i = 0), o || (o = this.target.length), t < 0 && (i = this.target.length - t), i < 0 && (i = this.target.length - i), o < 0 && (i = this.target.length - o), o = Math.min(o, this.target.length), i = Math.min(i, this.target.length), i >= o)
          return;
        let u = this.target.slice(t, t + o - i), a = this.target.slice(i, o), p = this.target.copyWithin(t, i, o);
        return c(this, "copyWithin"), T && P(this, t, a, u), p;
      }
    };
    return ["reverse", "sort", "fill"].forEach(function(t) {
      e[t] = function() {
        let i = K(arguments), o = this.target.slice(0), u = this.target[t].apply(this.target, i);
        return c(this, t), T && P(this, 0, o, this.target.slice(0)), u;
      };
    }), e;
  }
  function ie(e, t) {
    return r.useNonObservablesAsValues ? $(e, t, r.valueComparisonDepthLimit) : e === t || Number.isNaN(e) && Number.isNaN(t);
  }
  function $(e, t, i) {
    if (typeof i > "u" && (i = 8), e === null && t === null || e === t || Number.isNaN(e) && Number.isNaN(t)) return true;
    if (i === 0 || typeof e != typeof t || typeof e != "object" || e === null || t === null || D(e) || D(t) || Object.keys(e).length !== Object.keys(t).length) return false;
    for (let o in e)
      if (!$(e[o], t[o], i - 1))
        return false;
    return true;
  }
  function xe(e, t) {
    if (t === f)
      return this.meta;
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.get.apply(i, [i.target, t]);
    }
    return A && !A(this, e, t) ? E : C[t] ? C[t].bind(this) : (n.inActiveRecording && I(n.context, this), e[t]);
  }
  function Le(e, t, i) {
    if (t === f) throw new Error("Cannot set the dedicated meta property '" + f + "'");
    if (this.meta.forwardTo !== null) {
      let u = this.meta.forwardTo[f].handler;
      return u.set.apply(u, [u.target, t, i]);
    }
    if (x && !x(this, e, t))
      return;
    let o = e[t];
    return t in e && ie(o, i) ? true : (isNaN(t) ? (e[t] = i, (e[t] === i || Number.isNaN(e[t]) && Number.isNaN(i)) && (c(this, t), oe(this, t, i, o))) : (typeof t == "string" && (t = parseInt(t)), e[t] = i, (e[t] === i || Number.isNaN(e[t]) && Number.isNaN(i)) && (c(this, t), _e(this, t, i, o))), !(e[t] !== i && !(Number.isNaN(e[t]) && Number.isNaN(i))));
  }
  function je(e, t) {
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[f].handler;
      return o.deleteProperty.apply(
        o,
        [o.target, t]
      );
    }
    if (x && !x(this, e, t))
      return;
    if (!(t in e))
      return true;
    let i = e[t];
    return delete e[t], t in e || (c(this, "delete"), se(this, t, i)), !(t in e);
  }
  function De(e) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.ownKeys.apply(
        i,
        [i.target]
      );
    }
    if (A && !A(this, e))
      return E;
    n.inActiveRecording && I(n.context, this);
    let t = Object.keys(e);
    return t.push("length"), t;
  }
  function Ne(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.has.apply(i, [e, t]);
    }
    return A && !A(this, e, t) ? E : (n.inActiveRecording && I(n.context, this), t in e);
  }
  function Ee(e, t, i) {
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[f].handler;
      return o.defineProperty.apply(
        o,
        [o.target, t, i]
      );
    }
    if (!(x && !x(this, e, t)))
      return c(this, t), e;
  }
  function Me(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.getOwnPropertyDescriptor.apply(
        i,
        [i.target, t]
      );
    }
    return A && !A(this, e, t) ? E : (n.inActiveRecording && I(n.context, this), Object.getOwnPropertyDescriptor(e, t));
  }
  function Pe(e, t) {
    if (t = t.toString(), t === f)
      return this.meta;
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.get.apply(i, [i.target, t]);
    }
    if (A && !A(this, e, t))
      return E;
    if (typeof t < "u") {
      n.inActiveRecording && l(n.context, this, t);
      let i = e;
      for (; i !== null && typeof i < "u"; ) {
        let o = Object.getOwnPropertyDescriptor(i, t);
        if (typeof o < "u" && typeof o.get < "u")
          return o.get.bind(this.meta.proxy)();
        i = Object.getPrototypeOf(i);
      }
      return e[t];
    }
  }
  function Be(e, t, i) {
    if (t === f) throw new Error("Cannot set the dedicated meta property '" + f + "'");
    if (this.meta.forwardTo !== null) {
      let p = this.meta.forwardTo[f].handler;
      return p.set.apply(p, [p.target, t, i]);
    }
    if (x && !x(this, e, t))
      return;
    let o = e[t];
    if (t in e && ie(o, i))
      return true;
    let u = !(t in e);
    e[t] = i;
    let a = e[t];
    return (a === i || Number.isNaN(a) && Number.isNaN(i)) && (h(this, t), u && d(this, t)), oe(this, t, i, o), !(a !== i && !(Number.isNaN(a) && Number.isNaN(i)));
  }
  function Se(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.deleteProperty.apply(
        i,
        [i.target, t]
      ), true;
    }
    if (!(x && !x(this, e, t)))
      if (t in e) {
        let i = e[t];
        return delete e[t], t in e || (h(this, t), d(this, t), se(this, t, i)), !(t in e);
      } else
        return true;
  }
  function Xe(e, t) {
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[f].handler;
      return o.ownKeys.apply(
        o,
        [o.target, t]
      );
    }
    return A && !A(this, e, t) ? E : (n.inActiveRecording && g(n.context, this), Object.keys(e));
  }
  function He(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.has.apply(
        i,
        [i.target, t]
      );
    }
    return A && !A(this, e, t) ? E : (n.inActiveRecording && g(n.context, this), t in e);
  }
  function We(e, t, i) {
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[f].handler;
      return o.defineProperty.apply(
        o,
        [o.target, t]
      );
    }
    if (!(x && !x(this, e, t)))
      return d(this, "define property"), Reflect.defineProperty(e, t, i);
  }
  function Fe(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[f].handler;
      return i.getOwnPropertyDescriptor.apply(i, [i.target, t]);
    }
    return A && !A(this, e, t) ? E : (n.inActiveRecording && g(n.context, this), Object.getOwnPropertyDescriptor(e, t));
  }
  function D(e) {
    return e !== null && typeof e == "object" && typeof e[f] == "object" && e[f].world === s;
  }
  function z(e, t) {
    if (typeof e > "u" && (e = {}), typeof t > "u" && (t = null), D(e))
      throw new Error("Cannot observe an already observed object!");
    let i;
    e instanceof Array ? i = {
      _arrayObservers: null,
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: xe,
      set: Le,
      deleteProperty: je,
      ownKeys: De,
      has: Ne,
      defineProperty: Ee,
      getOwnPropertyDescriptor: Me
    } : i = {
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: Pe,
      set: Be,
      deleteProperty: Se,
      ownKeys: Xe,
      has: He,
      defineProperty: We,
      getOwnPropertyDescriptor: Fe
    };
    let o = new Proxy(e, i);
    if (i.target = e, i.proxy = o, i.meta = {
      world: s,
      id: "not yet",
      // Wait for rebuild analysis
      buildId: t,
      forwardTo: null,
      target: e,
      handler: i,
      proxy: o,
      // Here to avoid prevent events being sent to objects being rebuilt. 
      isBeingRebuilt: false
    }, n.inRepeater !== null) {
      const u = n.inRepeater;
      if (t !== null) {
        if (u.newBuildIdObjectMap || (u.newBuildIdObjectMap = {}), u.buildIdObjectMap && typeof u.buildIdObjectMap[t] < "u") {
          i.meta.isBeingRebuilt = true;
          let a = u.buildIdObjectMap[t];
          a[f].forwardTo = o, u.options.rebuildShapeAnalysis && (i.meta.copyTo = a), i.meta.id = "temp-" + n.nextTempObjectId++, u.newBuildIdObjectMap[t] = a, o = a, i = o[f].handler, le(a[f].handler);
        } else
          i.meta.id = n.nextObjectId++, i.meta.pendingOnEstablishCall = true, u.newBuildIdObjectMap[t] = o, q(i);
        u.options.rebuildShapeAnalysis && (u.newIdObjectShapeMap || (u.newIdObjectShapeMap = {}), u.newIdObjectShapeMap[i.meta.id] = o);
      } else u.options.rebuildShapeAnalysis ? (i.meta.id = n.nextObjectId++, i.meta.pendingCreationEvent = true, i.meta.pendingOnEstablishCall = true, u.newIdObjectShapeMap || (u.newIdObjectShapeMap = {}), u.newIdObjectShapeMap[i.meta.id] = o) : (i.meta.id = n.nextObjectId++, q(i));
    } else
      i.meta.id = n.nextObjectId++, q(i);
    return o;
  }
  function re(e, t) {
    if (D(e) || typeof e != "object") return e;
    let i;
    if (t) {
      const o = e instanceof Array ? [] : {};
      for (let u in e)
        o[u] = re(e[u], t);
      i = o;
    } else
      i = e;
    return z(i);
  }
  function P(e, t, i, o) {
    T && B(e, { type: "splice", index: t, removed: i, added: o });
  }
  function _e(e, t, i, o) {
    T && B(e, {
      type: "splice",
      index: t,
      removed: [o],
      added: [i]
    });
  }
  function oe(e, t, i, o) {
    T && B(e, {
      type: "set",
      property: t,
      newValue: i,
      oldValue: o
    });
  }
  function se(e, t, i) {
    T && B(e, {
      type: "delete",
      property: t,
      deletedValue: i
    });
  }
  function le(e) {
    T && B(e, { type: "reCreate" });
  }
  function q(e) {
    T && B(e, { type: "create" });
  }
  function ae(e) {
    T && B(e, { type: "dispose" });
  }
  function B(e, t) {
    t.object = e.meta.proxy, t.objectId = e.meta.id, !(!ve && e.meta.isBeingRebuilt) && (Y && Y(t), te && typeof e.target.onChange == "function" && e.target.onChange(t));
  }
  function J() {
    if (n.postponeInvalidation == 0) {
      for (n.postponeRefreshRepeaters++; n.nextObserverToInvalidate !== null; ) {
        let e = n.nextObserverToInvalidate;
        n.nextObserverToInvalidate = null;
        const t = e.nextToNotify;
        t ? (e.nextToNotify = null, n.nextObserverToInvalidate = t) : n.lastObserverToInvalidate = null, e.invalidateAction(), X(e);
      }
      n.postponeRefreshRepeaters--, ce();
    }
  }
  function ze(e, t, i) {
    let o = false, u = n.context;
    for (; u; ) {
      if (u === e) {
        o = true;
        break;
      }
      u = u.parent;
    }
    o || (e.invalidatedInContext = n.context, e.invalidatedByKey = i, e.invalidatedByObject = t, e.dispose(), n.postponeInvalidation > 0 ? (S(e), n.lastObserverToInvalidate !== null ? n.lastObserverToInvalidate.nextToNotify = e : n.nextObserverToInvalidate = e, n.lastObserverToInvalidate = e) : e.invalidateAction(i));
  }
  function qe(e, t) {
    return {
      createdCount: 0,
      createdTemporaryCount: 0,
      removedCount: 0,
      isRecording: true,
      type: "invalidator",
      id: n.observerId++,
      description: e,
      sources: [],
      nextToNotify: null,
      invalidateAction: t,
      dispose: function() {
        m(this);
      },
      record: function(i) {
        if (n.context == this || this.isRemoved) return i();
        const o = F(this), u = i();
        return _(o), u;
      },
      returnValue: null,
      causalityString() {
        return "<invalidator>" + this.invalidateAction;
      }
    };
  }
  function Ge() {
    let e, t, i = null;
    if (arguments.length > 2)
      i = arguments[0], e = arguments[1], t = arguments[2];
    else {
      if (be) throw new Error("Missing description for 'invalidateOnChange'");
      e = arguments[0], t = arguments[1];
    }
    const o = y(i, t);
    return F(o), o.returnValue = e(o), _(o), o;
  }
  function Ke(e, t, i, o, u) {
    return {
      createdCount: 0,
      createdTemporaryCount: 0,
      removedCount: 0,
      isRecording: true,
      type: "repeater",
      id: n.observerId++,
      firstTime: true,
      description: e,
      sources: [],
      nextToNotify: null,
      repeaterAction: $e(t, o),
      nonRecordedAction: i,
      options: o || {},
      finishRebuilding() {
        u(this);
      },
      priority() {
        return typeof this.options.priority < "u" ? this.options.priority : 0;
      },
      causalityString() {
        const a = this.invalidatedInContext, p = this.invalidatedByObject;
        if (!p) return "Repeater started: " + this.description;
        const v = this.invalidatedByKey, w = a ? a.description : "outside repeater/invalidator", N = "  " + p.toString() + "." + v, G = "" + this.description;
        return "(" + w + ")" + N + " --> " + G;
      },
      creationString() {
        let a = "{";
        return a += "created: " + this.createdCount + ", ", a += "createdTemporary:" + this.createdTemporaryCount + ", ", a += "removed:" + this.removedCount + "}", a;
      },
      sourcesString() {
        let a = "";
        for (let p of this.sources) {
          for (; p.parent; ) p = p.parent;
          a += p.handler.proxy.toString() + "." + p.key + `
`;
        }
        return a;
      },
      restart() {
        this.invalidateAction();
      },
      invalidateAction() {
        m(this), Qe(this), this.disposeChildren();
      },
      // disposeAllCreatedWithBuildId() {
      //   // Dispose all created objects? 
      //   if(this.buildIdObjectMap) {
      //     for (let key in this.buildIdObjectMap) {
      //       const object = this.buildIdObjectMap[key]; 
      //       if (typeof(object.onDispose) === "function") object.onDispose();
      //     }
      //   }
      // },
      dispose() {
        ue(this), m(this), this.disposeChildren();
      },
      notifyDisposeToCreatedObjects() {
        if (this.idObjectShapeMap)
          for (let a in this.idObjectShapeMap) {
            let p = this.idObjectShapeMap[a];
            typeof p[f].target.onDispose == "function" && p.onDispose();
          }
        else if (this.buildIdObjectMap)
          for (let a in this.buildIdObjectMap) {
            const p = this.buildIdObjectMap[a];
            typeof p.onDispose == "function" && p.onDispose();
          }
      },
      disposeChildren() {
        this.children && (this.children.forEach((a) => a.dispose()), this.children = null);
      },
      addChild(a) {
        this.children || (this.children = []), this.children.push(a);
      },
      nextDirty: null,
      previousDirty: null,
      lastRepeatTime: 0,
      waitOnNonRecordedAction: 0,
      children: null,
      refresh() {
        const a = this, p = a.options;
        p.onRefresh && p.onRefresh(a), a.finishedRebuilding = false, a.createdCount = 0, a.createdTemporaryCount = 0, a.removedCount = 0, a.isRecording = true;
        const v = F(a);
        a.returnValue = a.repeaterAction(a), a.isRecording = false, j();
        const { debounce: w = 0, fireImmediately: N = true } = p;
        if (a.nonRecordedAction !== null)
          w === 0 || this.firstTime ? (N || !this.firstTime) && a.nonRecordedAction(a.returnValue) : (a.waitOnNonRecordedAction && clearTimeout(a.waitOnNonRecordedAction), a.waitOnNonRecordedAction = setTimeout(() => {
            a.nonRecordedAction(a.returnValue), a.waitOnNonRecordedAction = null;
          }, w));
        else if (w > 0)
          throw new Error("Debounce has to be used together with a non-recorded action.");
        return u(this), this.firstTime = false, _(v), a;
      }
    };
  }
  function fe(e) {
    const t = e.options.rebuildShapeAnalysis;
    function i(a, p) {
      a[f].forwardTo = p, p[f].copyTo = a, p[f].pendingCreationEvent && (delete p[f].pendingCreationEvent, a[f].pendingReCreationEvent = true), delete p[f].pendingOnEstablishCall, delete e.newIdObjectShapeMap[p[f].id], e.newIdObjectShapeMap[a[f].id] = a;
    }
    function o(a, p) {
      if (a !== p) {
        const v = D(p), w = D(a);
        if (v !== w) return;
        if (v && w) {
          if (!e.newIdObjectShapeMap[p[f].id] || a[f].forwardTo === p || p[f].buildId || a[f].buildId) return;
          t.allowMatch && t.allowMatch(a, p) && (i(a, p), u(a[f].target, p[f].target));
        } else
          u(a, p);
      }
    }
    function u(a, p) {
      for (let [v, w] of t.slotsIterator(a, p, (N) => D(N) && N[f].buildId))
        o(v, w);
    }
    return { setAsMatch: i, matchChildrenInEquivalentSlot: u, matchInEquivalentSlot: o };
  }
  function Ue(e) {
    if (e.finishedRebuilding) return;
    const t = e.options;
    t.onStartBuildUpdate && t.onStartBuildUpdate();
    function i(o) {
      return o instanceof Array ? o.map((u) => i(u)) : D(o) && o[f].copyTo ? o[f].copyTo : o;
    }
    if (e.options.rebuildShapeAnalysis) {
      const { matchChildrenInEquivalentSlot: o, matchInEquivalentSlot: u } = fe(e), a = e.options.rebuildShapeAnalysis;
      if (e.establishedRoot instanceof Array || a.shapeRoot() instanceof Array) {
        let p = e.establishedRoot, v = a.shapeRoot();
        p instanceof Array || (p = [p]), v instanceof Array || (v = [v]), o(p, v);
      } else
        u(e.establishedShapeRoot, a.shapeRoot());
      for (let p in e.newIdObjectShapeMap) {
        const v = e.newIdObjectShapeMap[p], w = v[f].forwardTo;
        w && o(v[f].target, w[f].target);
      }
      for (let p in e.newIdObjectShapeMap) {
        let v = e.newIdObjectShapeMap[p], w;
        const N = v[f].forwardTo;
        if (N ? w = N[f].target : w = v[f].target, e.options.rebuildShapeAnalysis.translateReferences)
          e.options.rebuildShapeAnalysis.translateReferences(w, i);
        else
          for (let G in w)
            w[G] = i(w[G]);
      }
      e.establishedShapeRoot = i(e.options.rebuildShapeAnalysis.shapeRoot());
      for (let p in e.newIdObjectShapeMap) {
        let v = e.newIdObjectShapeMap[p];
        const w = v[f].forwardTo;
        w ? (w[f].copyTo = null, v[f].forwardTo = null, Z(v, w[f].target), v[f].pendingCreationEvent && (delete v[f].pendingCreationEvent, le(v[f].handler))) : (v[f].pendingCreationEvent && (delete v[f].pendingCreationEvent, q(v[f].handler)), Q(v));
      }
      if (e.idObjectShapeMap) {
        for (let p in e.idObjectShapeMap)
          if (typeof e.newIdObjectShapeMap[p] > "u") {
            const v = e.idObjectShapeMap[p], w = v[f].target;
            ae(v[f].handler), typeof w.onDispose == "function" && v.onDispose();
          }
      }
    } else {
      for (let o in e.newBuildIdObjectMap) {
        let u = e.newBuildIdObjectMap[o];
        const a = u[f].forwardTo;
        a !== null ? (u[f].forwardTo = null, a[f].isBeingRebuilt = false, Z(u, a[f].target)) : Q(u);
      }
      if (e.buildIdObjectMap) {
        for (let o in e.buildIdObjectMap)
          if (typeof e.newBuildIdObjectMap[o] > "u") {
            const u = e.buildIdObjectMap[o], a = u[f].target;
            ae(u[f].handler), typeof a.onDispose == "function" && a.onDispose();
          }
      }
    }
    e.buildIdObjectMap = e.newBuildIdObjectMap, e.newBuildIdObjectMap = {}, e.idObjectShapeMap = e.newIdObjectShapeMap, e.newIdObjectShapeMap = {}, e.finishedRebuilding = true, t.onEndBuildUpdate && t.onEndBuildUpdate();
  }
  function Q(e) {
    const t = e[f];
    (t.pendingOnEstablishCall || !t.established) && (delete t.pendingOnEstablishCall, t.established = true, typeof t.target.onEstablish == "function" && e.onEstablish());
  }
  function Ye(e) {
    const t = e[f].forwardTo;
    if (t !== null) {
      if (n.inRepeater) {
        const i = n.context;
        if (i.options.rebuildShapeAnalysis) {
          const { matchChildrenInEquivalentSlot: o } = fe(i);
          o(e[f].target, t[f].target);
        }
      }
      e[f].forwardTo = null, t[f].isBeingRebuilt = false, Z(e, t[f].target);
    } else
      Q(e);
    return e;
  }
  function $e(e, { throttle: t = 0 }) {
    return t > 0 ? function(i) {
      let o = Date.now();
      const u = o - i.lastRepeatTime;
      if (t > u) {
        const a = t - u;
        setTimeout(() => {
          i.restart();
        }, a);
      } else
        return i.lastRepeatTime = o, e();
    } : e;
  }
  function Je() {
    let e = "", t, i = null, o;
    const u = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
    if (typeof u[0] == "string")
      e = u.shift();
    else if (me)
      throw new Error("Every repeater has to be given a name as first argument. Note: This requirement can be removed in the configuration.");
    if (typeof u[0] == "function" && (t = u.shift()), (typeof u[0] == "function" || u[0] === null) && (i = u.shift()), typeof u[0] == "object" && (o = u.shift()), o || (o = {}), Oe && n.inActiveRecording) {
      let p = n.context.description;
      !p && n.context.parent && (p = n.context.parent.description), p || (p = "unnamed"), r.traceWarnings && console.warn(Error(`repeater ${e || "unnamed"} inside active recording ${p}`));
    }
    const a = b(e, t, i, o, Ue);
    return n.context && n.context.type === "repeater" && (o.dependentOnParent || r.alwaysDependOnParentRepeater) && n.context.addChild(a), a.refresh();
  }
  function Qe(e) {
    e.dispose();
    const t = e.priority();
    S(t);
    const o = n.dirtyRepeaters[t];
    o.last === null ? (o.last = e, o.first = e) : (o.last.nextDirty = e, e.previousDirty = o.last, o.last = e), ce();
  }
  function Ze() {
    n.observerId = 0, n.dirtyRepeaters.map((e) => {
      e.first = null, e.last = null;
    });
  }
  function ue(e) {
    const t = e.priority(), i = n.dirtyRepeaters[t];
    i.last === e && (i.last = e.previousDirty), i.first === e && (i.first = e.nextDirty), e.nextDirty && (e.nextDirty.previousDirty = e.previousDirty), e.previousDirty && (e.previousDirty.nextDirty = e.nextDirty), e.nextDirty = null, e.previousDirty = null;
  }
  function de(e = 0) {
    const t = n.dirtyRepeaters;
    let i = e;
    for (; i < t.length; ) {
      if (t[i].first !== null)
        return true;
      i++;
    }
    return false;
  }
  function Ve() {
    const e = n.dirtyRepeaters;
    let t = n.revalidationLevelLock + 1;
    for (; t < e.length; ) {
      if (e[t].first)
        return e[t].first;
      t++;
    }
    for (n.revalidationLevelLock = -1, t = n.revalidationLevelLock + 1; t < e.length; ) {
      if (e[t].first)
        return e[t].first;
      t++;
    }
    return null;
  }
  function ce() {
    if (n.postponeRefreshRepeaters === 0 && !n.refreshingAllDirtyRepeaters && de()) {
      for (n.refreshingAllDirtyRepeaters = true; de(); ) {
        let e = Ve();
        e.refresh(), ue(e), X(e.priority());
      }
      n.refreshingAllDirtyRepeaters = false;
    }
  }
  function ke(e, t) {
    n.recordingPaused++, j(), R.log(e, t), n.recordingPaused--, j();
  }
  function et(e, t) {
    n.recordingPaused++, j(), R.group(e, t), n.recordingPaused--, j();
  }
  function tt() {
    R.groupEnd();
  }
  function nt(e, t) {
    n.recordingPaused++, j();
    let i = R.logToString(e, t);
    return n.recordingPaused--, j(), i;
  }
  return s;
}
let V = {};
function pt(r) {
  r || (r = {}), r = { ...dt, ...r };
  const n = rt(r);
  return typeof V[n] > "u" && (V[n] = ct(r)), V[n];
}
const log$5 = console.log;
function deepFreeze(o) {
  Object.freeze(o);
  if (o === void 0) {
    return o;
  }
  Object.getOwnPropertyNames(o).forEach(function(prop) {
    if (o[prop] !== null && (typeof o[prop] === "object" || typeof o[prop] === "function") && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });
  return o;
}
function insertAfter(newNode, referenceNode) {
  if (referenceNode.nextSibling) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  } else {
    referenceNode.parentNode.appendChild(newNode);
  }
}
const animationFrameBackgroundColor = "rgba(150, 150, 255, 1)";
const animationFrameColor = "#000000";
const animationFrameSeparatorBackgroundColor = "rgba(170, 170, 255, 1)";
function logAnimationFrameGroup(counter2) {
  if (!traceAnimation) return;
  const text2 = "      Animation Frame " + counter2 + "      ";
  const colors = `background: ${animationFrameBackgroundColor}; color: ${animationFrameColor}`;
  console.group("%c" + text2, colors);
}
function logAnimationFrameEnd() {
  if (!traceAnimation) return;
  console.groupEnd();
}
function logAnimationSeparator(text2) {
  if (!traceAnimation) return;
  const colors = `background: ${animationFrameSeparatorBackgroundColor}; color: ${animationFrameColor}`;
  console.log("%c" + text2, colors);
}
function logMark(text2) {
  console.log("%c" + text2, "background: #222; color: #bada55");
}
function isUpperCase(string) {
  if (string.toUpperCase() === string) {
    return true;
  } else
    return false;
}
function draw(bounds, color = "black") {
}
const camelCased = (myString) => myString.replace(/-([a-z])/g, function(g) {
  return g[1].toUpperCase();
});
function addDefaultStyleToProperties(properties, defaultStyle) {
  properties.style = Object.assign({}, defaultStyle, properties.style);
}
function findKeyInProperties(properties) {
  if (!properties.stringsAndNumbers) return properties;
  if (properties.stringsAndNumbers.length) {
    properties.key = properties.stringsAndNumbers.pop();
  }
  if (properties.stringsAndNumbers.length) {
    throw new Error("Found too many loose strings in flow parameters");
  }
  delete properties.stringsAndNumbers;
  return properties;
}
function findTextAndKeyInProperties(properties) {
  if (!properties.stringsAndNumbers) return properties;
  if (properties.stringsAndNumbers.length) {
    properties.text = properties.stringsAndNumbers.pop() + "";
  }
  if (properties.stringsAndNumbers.length) {
    properties.key = properties.stringsAndNumbers.pop();
  }
  if (properties.stringsAndNumbers.length) {
    throw new Error("Found too many loose strings in flow parameters");
  }
  delete properties.stringsAndNumbers;
  return properties;
}
function findTextAndKeyInPropertiesUsingCase(properties) {
  if (!properties.stringsAndNumbers) return properties;
  while (properties.stringsAndNumbers.length) {
    const string = properties.stringsAndNumbers.pop();
    if (properties.text && !properties.key) {
      properties.key = string;
    } else if (properties.key && !properties.text) {
      properties.text = string;
    } else if (/[a-z0-9]/.test(string[0] + "") && !properties.key) {
      //!(/[A-Z]|\s/.test(string[0] + "")
      properties.key = string;
    } else if (!properties.text) {
      properties.text = string;
    } else {
      throw new Error("Could not match loose strings in flow parameters, add them to properties.");
    }
  }
  delete properties.stringsAndNumbers;
  return properties;
}
function findTextKeyAndOnClickInProperties(properties) {
  findTextAndKeyInPropertiesUsingCase(properties);
  if (!properties.functions) return properties;
  if (properties.functions.length) {
    properties.onClick = properties.functions.pop();
  }
  if (properties.functions.length) {
    throw new Error("Found too many loose functions in flow parameters");
  }
  delete properties.functions;
  return properties;
}
function findBuildInProperties(properties) {
  findKeyInProperties(properties);
  if (!properties.functions) return properties;
  if (properties.functions.length) {
    properties.buildFunction = properties.functions.pop();
  }
  if (properties.functions.length) {
    throw new Error("Found too many loose functions in flow parameters");
  }
  delete properties.functions;
  return properties;
}
function readFlowProperties$1(arglist) {
  if (!(arglist instanceof Array)) throw new Error("readFlowProperties expects an array");
  if (arglist[0] !== null && typeof arglist[0] === "object" && !(arglist[0] instanceof Array) && !isObservable(arglist[0]) && typeof arglist[1] === "undefined") {
    return arglist[0];
  }
  let properties = {};
  while (arglist.length > 0) {
    if (typeof arglist[0] === "function") {
      if (!properties.functions) {
        properties.functions = [];
      }
      properties.functions.push(arglist.shift());
    }
    if ((typeof arglist[0] === "string" || typeof arglist[0] === "number") && !arglist[0].causality) {
      if (!properties.stringsAndNumbers) {
        properties.stringsAndNumbers = [];
      }
      properties.stringsAndNumbers.push(arglist.shift());
    }
    if (!arglist[0]) {
      arglist.shift();
      continue;
    }
    if (arglist[0] === true) {
      throw new Error("Could not make sense of flow parameter 'true'");
    }
    if (typeof arglist[0] === "object" && !arglist[0].causality) {
      if (arglist[0] instanceof Array) {
        if (!properties.children) properties.children = [];
        for (let child of arglist.shift()) {
          properties.children.push(child);
        }
      } else {
        Object.assign(properties, arglist.shift());
      }
    }
    if (typeof arglist[0] === "object" && arglist[0].causality) {
      if (!properties.children) properties.children = [];
      properties.children.push(arglist.shift());
    }
  }
  return properties;
}
let creators = [];
function getCreator() {
  if (!creators.length) return null;
  return creators[creators.length - 1];
}
function getTarget() {
  const creator = getCreator();
  return creator ? creator.target : null;
}
function getTheme() {
  const creator = getCreator();
  return creator ? creator.theme : null;
}
const log$4 = console.log;
const world = pt({
  useNonObservablesAsValues: true,
  warnOnNestedRepeater: false,
  emitReBuildEvents: true,
  priorityLevels: 3,
  // onEventGlobal: event => collectEvent(event)
  onFinishedPriorityLevel
});
const {
  transaction,
  observable,
  deeplyObservable,
  isObservable,
  repeat,
  finalize,
  withoutRecording,
  sameAsPreviousDeep,
  workOnPriorityLevel,
  invalidateOnChange: invalidateOnChange$1,
  postponeInvalidations,
  continueInvalidations,
  state
} = world;
const model = deeplyObservable;
const configuration = {
  warnWhenNoKey: false,
  traceReactivity: false,
  traceAnimation: false,
  traceWarnings: false,
  autoAssignProperties: false,
  defaultTransitionAnimations: null,
  onFinishReBuildingFlowCallbacks: [],
  onFinishReBuildingDOMCallbacks: []
};
function setFlowConfiguration(newConfiguration) {
  Object.assign(configuration, newConfiguration);
  trace = configuration.traceReactivity;
  traceAnimation = configuration.traceAnimation;
  traceWarnings = configuration.traceWarnings;
}
let trace = false;
let traceAnimation = false;
let traceWarnings = false;
let activeTrace = false;
const activeTraceModel = model({
  on: false
});
window.activeTrace = activeTraceModel;
repeat(() => {
  activeTrace = activeTraceModel.on;
});
window.components = {};
window.idToComponent = {};
window.world = world;
window.model = model;
function onFinishedPriorityLevel(level, didActualWork) {
  if (trace) log$4("<<<finished priority: " + level + ">>>");
  if (level === 1 && didActualWork) {
    configuration.onFinishReBuildingFlowCallbacks.forEach((callback2) => callback2());
  }
  if (level === 2) {
    configuration.onFinishReBuildingDOMCallbacks.forEach((callback2) => callback2());
  }
}
class Component {
  constructor(...parameters) {
    __publicField(this, "theme");
    __publicField(this, "target");
    let properties = findKeyInProperties(readFlowProperties$1(parameters));
    if (properties.build) {
      properties.buildFunction = properties.build;
      delete properties.build;
    }
    this._ = null;
    if (!this.key) this.key = properties.key ? properties.key : null;
    delete properties.key;
    if (configuration.autoAssignProperties) {
      Object.assign(this, properties);
    }
    this.creator = getCreator();
    this.inheritFromCreator();
    let me = observable(this, this.key);
    me.setProperties(properties);
    me._ = me.toString();
    if (configuration.warnWhenNoKey && me.key === null && me.creator) {
      if (traceWarnings) console.warn(
        "Component " + me.toString() + " with no key, add key for better performance."
      );
    }
    return me;
  }
  get id() {
    return this.causality.id;
  }
  get get() {
    return this.causality.target;
  }
  get unobservable() {
    if (!this.causality.unobservable) this.causality.unobservable = this.initialUnobservables();
    return this.causality.unobservable;
  }
  initialUnobservables() {
    return {};
  }
  /**
   * Creator inheritance
   */
  setTheme(theme) {
    this.theme = theme;
  }
  setTarget(target) {
    this.target = target;
  }
  /**
   * Lifecycle methods
   */
  setProperties() {
  }
  setState() {
  }
  ensure() {
  }
  onDidDisplayFirstFrame() {
  }
  disposeState() {
  }
  /**
   * Inheritance 
   */
  inheritFromCreator() {
    if (this.creator) {
      this.setTarget(this.creator.target);
      this.setTheme(this.creator.theme);
    }
  }
  inherit(property) {
    const result = this.inheritCached(property);
    return result;
  }
  inheritCached(property) {
    const context2 = this.getContext();
    if (typeof context2[property] === "undefined") {
      invalidateOnChange$1(
        () => {
          context2[property] = this.inheritUncached(property);
          withoutRecording(() => {
          });
        },
        () => {
          delete context2[property];
        }
      );
    }
    return context2[property];
  }
  inheritUncached(property) {
    const context2 = this.getContext();
    if (typeof context2[property] !== "undefined") {
      return context2[property];
    } else if (this.equivalentCreator) {
      return this.equivalentCreator.inheritUncached(property);
    } else if (this.parentPrimitive) {
      return this.parentPrimitive.inheritUncached(property);
    } else if (this.creator) {
      return this.creator.inheritUncached(property);
    } else {
      if (traceWarnings) console.warn("Could not find inherited property: " + property);
    }
  }
  // inheritFromParentContainer(property) {
  //   if (this[property]) {
  //     return this[property];
  //   } else if (this.parentPrimitive) {
  //     const valueFromEquivalent = this.parentPrimitive.inheritFromEquivalentCreator(property);
  //     if (valueFromEquivalent) {
  //       return valueFromEquivalent;
  //     }
  //     return this.parentPrimitive.inheritFromParentContainer(property)
  //   } else {
  //     return null; 
  //   }
  // }
  inheritFromEquivalentCreator(property) {
    const propertyValue = this[property];
    if (typeof propertyValue !== "undefined") {
      return propertyValue;
    } else if (this.equivalentCreator) {
      return this.equivalentCreator.inheritFromEquivalentCreator(property);
    } else {
      return null;
    }
  }
  getContext() {
    return this;
  }
  build(repeater) {
    if (this.buildFunction) {
      return this.buildFunction(this);
    }
    throw new Error("Not implemented yet");
  }
  /**
   * Internal methods
   */
  derrive(action) {
    if (!this.derriveRepeaters) {
      this.derriveRepeaters = [];
    }
    this.derriveRepeaters.push(repeat(action));
  }
  derriveAtBuild(action) {
    if (!this.derriveRepeaters) {
      this.derriveRepeaters = [];
    }
    this.derriveRepeaters.push(repeat(action, { priority: 1 }));
  }
  ensureEstablished() {
    if (!this.unobservable.established) {
      this.onEstablish();
    }
  }
  onEstablish() {
    this.causality.established = true;
    this.unobservable.established = true;
    window.components[this.toString()] = this;
    window.idToComponent[this.id] = this;
    creators.push(this);
    this.setState();
    creators.pop();
    this.startGeneralEnsure();
    if (trace) log$4("Established:" + this.toString());
  }
  startGeneralEnsure() {
    const proto = Object.getPrototypeOf(this);
    if (!proto.hasOwnProperty("ensure")) return;
    if (!this.generalEnsureRepeater) {
      this.generalEnsureRepeater = repeat(
        this.toString() + ".generalRepeater",
        (repeater) => {
          this.ensure();
        }
      );
    }
  }
  onRemoveFromFlowTarget() {
    if (this.onClose) {
      this.onClose();
    }
  }
  onDispose() {
    delete window.components[this.toString()];
    delete window.idToComponent[this.id];
    if (trace) log$4("Disposed:" + this.toString());
    if (this.buildRepeater) {
      this.buildRepeater.notifyDisposeToCreatedObjects();
      this.buildRepeater.dispose();
      this.buildRepeater.repeaterAction = () => {
      };
    }
    if (this.derriveRepeaters) this.derriveRepeaters.map((repeater) => repeater.dispose());
    this.disposeState();
  }
  onVisibilityWillChange(visibility) {
  }
  className() {
    let result;
    withoutRecording(() => {
      result = this.constructor.name;
    });
    return result;
  }
  toString() {
    let classNameOverride;
    withoutRecording(() => {
      classNameOverride = this.classNameOverride;
    });
    let classDescription = classNameOverride ? classNameOverride : this.className();
    if (classDescription === "Flow" && this.description)
      classDescription = this.description;
    return classDescription + ":" + this.causality.id + this.buildUniqueName();
  }
  uniqueName() {
    let result;
    withoutRecording(() => {
      result = (this.key ? this.key + ":" : "") + this.causality.id;
    });
    return result;
  }
  buildUniqueName() {
    let result;
    withoutRecording(() => {
      result = this.key ? this.key : null;
    });
    if (!result) return "";
    return "(" + result + ")";
  }
  findKey(key) {
    if (this.key === key) return this;
    return this.findChild(key);
  }
  findChild(key) {
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) {
      for (let fragment of primitive) {
        const result = fragment.findKey();
        if (result) return result;
      }
      return null;
    } else {
      return primitive.findKey(key);
    }
  }
  getChild(keyOrPath) {
    if (typeof keyOrPath === "string") {
      const key = keyOrPath;
      if (typeof this.buildRepeater.buildIdObjectMap[key] === "undefined")
        return null;
      return this.buildRepeater.buildIdObjectMap[key];
    } else {
      const path = keyOrPath;
      const child = this.getChild(path.shift());
      if (path.length === 0) {
        return child;
      } else {
        return child.getChild(path);
      }
    }
  }
  getPath() {
    const tag = this.key ? this.key : "<no-tag>";
    let path;
    if (!this.creator) {
      return [];
    } else {
      path = this.creator.getPath();
      path.push(tag);
      return path;
    }
  }
  ensureBuiltRecursive(flowTarget, parentPrimitive) {
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive;
    }
    workOnPriorityLevel(1, () => this.getPrimitive().ensureBuiltRecursive(flowTarget, parentPrimitive));
    return this.getPrimitive(parentPrimitive);
  }
  getPrimitive(parentPrimitive) {
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive;
    }
    const me = this;
    this.toString();
    finalize(me);
    if (!me.buildRepeater) {
      me.buildRepeater = repeat(
        this.toString() + ".buildRepeater",
        (repeater) => {
          if (trace) console.group(repeater.causalityString());
          creators.push(me);
          me.newBuild = me.build(repeater);
          repeater.finishRebuilding();
          me.newBuild = repeater.establishedShapeRoot;
          if (me.newBuild !== null) {
            if (me.newBuild instanceof Array) {
              for (let fragment of me.newBuild) {
                fragment.equivalentCreator = me;
              }
            } else {
              me.newBuild.equivalentCreator = me;
            }
            me.equivalentChild = me.newBuild;
          }
          creators.pop();
          if (!me.newBuild) {
            me.primitive = null;
          } else if (!(me.newBuild instanceof Array)) {
            me.primitive = me.newBuild.getPrimitive(this.parentPrimitive);
          } else {
            me.primitive = me.newBuild.map((fragment) => fragment.getPrimitive(this.parentPrimitive)).reduce((result, childPrimitive) => {
              if (childPrimitive instanceof Array) {
                childPrimitive.forEach((fragment) => result.push(fragment));
              } else {
                result.push(childPrimitive);
              }
            }, []);
          }
          if (trace) console.groupEnd();
        },
        {
          priority: 1,
          rebuildShapeAnalysis: getShapeAnalysis(me)
        }
      );
    }
    return me.primitive;
  }
  *iterateChildren() {
    if (this.children instanceof Array) {
      for (let child of this.children) {
        if (child instanceof Component && child !== null) {
          yield child;
        }
      }
    } else if (this.children instanceof Component && this.children !== null) {
      yield this.children;
    }
  }
  dimensions(contextNode) {
    if (!this.key && traceWarnings) console.warn("It is considered unsafe to use dimensions on a flow without a key. The reason is that a call to dimensions from a parent build function will finalize the flow early, and without a key, causality cannot send proper onEstablish event to your flow component before it is built");
    const primitive = this.getPrimitive();
    if (primitive instanceof Array) throw new Error("Dimensions not supported for fragmented components.");
    return primitive ? primitive.dimensions(contextNode) : null;
  }
  getEquivalentRoot() {
    if (!this.equivalentCreator) return this;
    return this.equivalentCreator.getEquivalentRoot();
  }
  show(value) {
    return value ? this : null;
  }
}
function when(condition, operation) {
  return repeat(() => {
    const value = condition();
    if (value) {
      operation(value);
    }
  });
}
function callback(callback2, key) {
  return observable(callback2, key);
}
function component(descriptionOrBuildFunction, possibleBuildFunction) {
  if (traceWarnings) console.warn("Deprecated: dont use this function, build a macro component instead using flow parameter helper functions.");
  let description;
  let buildFunction;
  if (typeof descriptionOrBuildFunction === "string") {
    description = descriptionOrBuildFunction;
    buildFunction = possibleBuildFunction;
  } else {
    buildFunction = descriptionOrBuildFunction;
  }
  function flowBuilder(...parameters) {
    const properties = findKeyInProperties(readFlowProperties$1(parameters));
    properties.buildFunction = buildFunction;
    const flow = new Component(properties);
    if (description) flow.description = description;
    return flow;
  }
  return flowBuilder;
}
function getShapeAnalysis(flow) {
  return {
    allowMatch: (establishedFlow, newFlow) => {
      return establishedFlow instanceof Component && newFlow instanceof Component && (!newFlow.tagName || newFlow.tagName === establishedFlow.tagName) && newFlow.className() === establishedFlow.className() && newFlow.classNameOverride === establishedFlow.classNameOverride;
    },
    shapeRoot: () => flow.newBuild,
    slotsIterator: function* (establishedObject, newObject, hasKey, childrenProperty = false) {
      if (establishedObject instanceof Array && newObject instanceof Array) {
        let newIndex = 0;
        let establishedIndex = 0;
        while (newIndex < newObject.length) {
          while (hasKey(newObject[newIndex]) && newIndex < newObject.length) newIndex++;
          while (hasKey(establishedObject[establishedIndex]) && establishedIndex < establishedObject.length) establishedIndex++;
          const establishedChild = establishedObject[establishedIndex];
          const newChild = newObject[newIndex];
          if (isObservable(newChild) && isObservable(establishedChild)) {
            yield [establishedChild, newChild];
          }
          newIndex++;
          establishedIndex++;
        }
      } else if (establishedObject instanceof Component && newObject instanceof Component) {
        if (childrenProperty) yield [establishedObject, newObject];
        for (let property in newObject) {
          if (property === "children") {
            yield* this.slotsIterator(
              establishedObject[property],
              newObject[property],
              hasKey,
              true
            );
          } else {
            const establishedChild = establishedObject[property];
            const newChild = newObject[property];
            if (isObservable(newChild) && isObservable(establishedChild)) {
              yield [establishedChild, newChild];
            }
          }
        }
      }
    },
    translateReferences: (flow2, translateReference) => {
      for (let property in flow2) {
        flow2[property] = translateReference(flow2[property]);
      }
      const children = flow2.children;
      if (children instanceof Array) {
        let index = 0;
        while (index < children.length) {
          children[index] = translateReference(children[index]);
          index++;
        }
      } else if (children instanceof Component) {
        flow2.children = translateReference(children);
      }
    }
  };
}
class FlowPrimitive extends Component {
  findKey(key) {
    if (this.key === key) return this;
    return this.findChild(key);
  }
  findChild(key) {
    if (this.children) {
      for (let child of this.children) {
        if (child !== null) {
          let result = child.findKey(key);
          if (result !== null) return result;
        }
      }
    }
    return null;
  }
  getPrimitive(parentPrimitive) {
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
      }
      this.parentPrimitive = parentPrimitive;
    }
    return this;
  }
  ensureBuiltRecursive(flowTarget, parentPrimitive) {
    this.toString();
    if (flowTarget) this.visibleOnTarget = flowTarget;
    if (parentPrimitive && this.parentPrimitive !== parentPrimitive) {
      if (this.parentPrimitive) {
        if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
        if (parentPrimitive === this) throw new Error("What the fuck just happened. ");
      }
      this.parentPrimitive = parentPrimitive;
    }
    finalize(this);
    if (!this.expandRepeater) {
      this.expandRepeater = repeat(this.toString() + ".expandRepeater", (repeater) => {
        if (trace) console.group(repeater.causalityString());
        if (trace) console.log([...state.workOnPriorityLevel]);
        if (this.parentPrimitive) {
          if (this.parentPrimitive.childPrimitives && this.parentPrimitive.childPrimitives.includes(this)) {
            this.visibleOnTarget = this.parentPrimitive.visibleOnTarget;
          } else {
            this.visibleOnTarget = null;
            this.previousParentPrimitive = this.parentPrimitive;
            this.parentPrimitive = null;
          }
        }
        let scan = this.equivalentCreator;
        while (scan) {
          if (scan.visibleOnTarget === this.visibleOnTarget) {
            scan = null;
          } else {
            if (this.parentPrimitive && this.parentPrimitive !== scan.parentPrimitive) {
              if (this.parentPrimitive) {
                if (traceWarnings) console.warn("Changed parent primitive for " + this.toString() + ":" + this.parentPrimitive.toString() + " --> " + parentPrimitive.toString());
              }
              scan.parentPrimitive = this.parentPrimitive;
            }
            scan.parentPrimitive = this.parentPrimitive;
            scan.visibleOnTarget = this.visibleOnTarget;
            scan.isVisible = !!this.visibleOnTarget;
            scan.onVisibilityWillChange(scan.isVisible);
            scan = scan.equivalentCreator;
          }
        }
        this.childPrimitives = this.getPrimitiveChildren();
        for (let childPrimitive of this.childPrimitives) {
          childPrimitive.ensureBuiltRecursive(flowTarget, this);
        }
        if (trace) console.groupEnd();
      }, { priority: 1 });
    }
    return this;
  }
  onVisibilityWillChange() {
  }
  *iteratePrimitiveChildren() {
    for (let child of this.iterateChildren()) {
      let primitive = child.getPrimitive(this);
      if (primitive instanceof Array) {
        for (let fragment of primitive) {
          yield fragment;
        }
      } else {
        if (primitive) yield primitive;
      }
    }
  }
  getChildren() {
    return [...this.iterateChildren()];
  }
  getPrimitiveChildren() {
    return [...this.iteratePrimitiveChildren()];
  }
  inheritAnimation() {
    let result = this.inheritFromEquivalentCreator("animate");
    if (!result && this.parentPrimitive) {
      result = this.parentPrimitive.inheritFromEquivalentCreator("animateChildren");
    }
    if (!result && this.previousParentPrimitive) {
      result = this.previousParentPrimitive.inheritFromEquivalentCreator("animateChildren");
    }
    if (result === true) result = this.getStandardAnimation();
    return result;
  }
  getStandardAnimation() {
    throw new Error("Not implemented yet");
  }
  get animation() {
    if (!this.cachedAnimation) {
      invalidateOnChange$1(
        () => {
          this.cachedAnimation = this.inheritAnimation();
        },
        () => {
          delete this.cachedAnimation;
        }
      );
    }
    return this.cachedAnimation;
  }
}
class FlowTarget {
  // constructor() {
  //     super();
  //     flowTargets.push(this);
  // }
  dispose() {
  }
  setContent(flow) {
    if (!(flow instanceof Component)) throw new Error("Flow target content must be a flow Component!");
    this.flow = flow;
    flow.target = this;
    flow.ensureEstablished();
    workOnPriorityLevel(1, () => this.flow.ensureBuiltRecursive(this));
    if (flow.getPrimitive() instanceof Array) throw new Error("Cannot have fragments on the top level");
    this.ensureContentInPlace();
  }
  ensureContentInPlace() {
    throw new Error("Not implemented yet!");
  }
  // General creation method, this is similar to a service locator in the service locator pattern. 
  // The purpose of this method is to choose what FlowPrimitive to create, given the properties object.
  // This makes it possible to create total custom FlowTargets that reinterprets the properties in 
  // new ways. For example, a DOMFlowTarget may create FlowPrimitive objects that renders a DOM in a web browsser.
  // But the same flow could be sent to a FlowTarget that renders a native app, or create contents for a printout, 
  // or create a server rendered page. The possibilities are endless!      
  create(...parameters) {
    readFlowProperties(parameters);
    throw new Error("Not implemented yet!");
  }
  // dispose() {
  //     flowTargets.splice(flowTargets.indexOf(this), 1);
  // }
}
function extractAttributes(properties) {
  const attributes = {};
  if (!properties) return attributes;
  eventHandlerContentElementAttributes.forEach(
    (attribute) => {
      if (typeof properties[attribute.camelCase] !== "undefined") {
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase];
      }
    }
  );
  globalElementAttributes.forEach(
    (attribute) => {
      if (typeof properties[attribute.camelCase] !== "undefined") {
        attributes[attribute.lowerCase] = properties[attribute.camelCase];
        delete properties[attribute.camelCase];
      }
    }
  );
  if (properties.className) attributes["class"] = properties.className;
  properties.attributes = attributes;
  return attributes;
}
const eventHandlerContentElementAttributesCamelCase = [
  "onAuxClick",
  "onBeforeMatch",
  "onBlur",
  "onCancel",
  "onCanPlay",
  "onCanPlaythrough",
  "onChange",
  "onClick",
  "onClose",
  "onContextLost",
  "onContextMenu",
  "onContextRestored",
  "onCopy",
  "onCueChange",
  "onCut",
  "onDblClick",
  "onDrag",
  "onDragEnd",
  "onDragEnter",
  "onDragLeave",
  "onDragOver",
  "onDragStart",
  "onDrop",
  "onDurationChange",
  "onEmptied",
  "onEnded",
  "onError",
  "onFocus",
  "onFormData",
  "onInput",
  "onInvalid",
  "onKeyDown",
  "onKeyPress",
  "onKeyUp",
  "onLoad",
  "onLoadedData",
  "onLoadedMetaData",
  "onLoadStart",
  "onMouseDown",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseMove",
  "onMouseOut",
  "onMouseOver",
  "onMouseUp",
  "onPaste",
  "onPause",
  "onPlay",
  "onPlaying",
  "onProgress",
  "onRateChange",
  "onReset",
  "onResize",
  "onScroll",
  "onSecurityPolicyViolation",
  "onSeeked",
  "onSeeking",
  "onSelect",
  "onSlotChange",
  "onStalled",
  "onSubmit",
  "onSuspend",
  "onTimeUpdate",
  "onToggle",
  "onVolumeChange",
  "onWaiting",
  "onWheel"
];
const eventHandlerContentElementAttributes = eventHandlerContentElementAttributesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
const globalElementAttributesCamelCase = [
  "accessKey",
  "autoCapitalize",
  "autoFocus",
  "contentEditable",
  "dir",
  "draggable",
  "enterKeyHint",
  "hidden",
  "inert",
  "inputmode",
  "is",
  "itemId",
  "itemProp",
  "itemRef",
  "itemScope",
  "itemType",
  "lang",
  "nonce",
  "spellCheck",
  "style",
  "tabIndex",
  "title",
  "translate"
];
const globalElementAttributes = globalElementAttributesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
function extractChildStyles(style) {
  childStylePropertiesCamelCase.forEach((property) => {
    if (typeof style[property] !== "undefined") {
      style[property];
      delete style[property];
    }
  });
  return [childStyles, style];
}
const childStylePropertiesCamelCase = [
  "order",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "flex",
  // {
  //   compound: "flex", 
  //   partial: [
  //     "flex-grow",
  //     "flex-shrink",
  //     "flex-basis",
  //   ]
  // },
  "alignSelf"
];
childStylePropertiesCamelCase.map((camelCase2) => ({ camelCase: camelCase2, lowerCase: camelCase2.toLowerCase() }));
function extractProperty(object, property) {
  const result = object[property];
  delete object[property];
  return result;
}
function elemenNode(...parameters) {
  let properties = findKeyInProperties(readFlowProperties$1(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.elementNode", key: properties.key, attributes, children: properties.children });
}
function textNode(...parameters) {
  let properties = findTextAndKeyInProperties(readFlowProperties$1(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.textNode", text: properties.text, key: properties.key, attributes });
}
const text = textNode;
function span(...parameters) {
  let properties = findTextAndKeyInPropertiesUsingCase(readFlowProperties$1(parameters));
  const attributes = extractAttributes(properties);
  textToTextNode(properties);
  return getTarget().create({ type: "dom.elementNode", tagName: "span", key: properties.key, classNameOverride: "span", attributes, children: properties.children, animate: properties.animate });
}
function div(...parameters) {
  let properties = findKeyInProperties(readFlowProperties$1(parameters));
  const attributes = extractAttributes(properties);
  return getTarget().create({ type: "dom.elementNode", tagName: "div", key: properties.key, classNameOverride: "div", attributes, children: properties.children, animate: properties.animate });
}
function styledDiv(classNameOverride, style, parameters) {
  const properties = findKeyInProperties(readFlowProperties$1(parameters));
  const attributes = extractAttributes(properties);
  attributes.style = { ...style, ...attributes.style };
  return getTarget().create({ type: "dom.elementNode", key: properties.key, classNameOverride, tagName: "div", attributes, ...properties });
}
function textToTextNode(properties) {
  if (properties.text) {
    properties.children = // [
    getTarget().create({
      type: "dom.textNode",
      key: properties.key ? properties.key + ".text" : null,
      text: extractProperty(properties, "text")
    });
  }
}
const domNodeClassRegistry = {};
function getDomFlowTargets() {
  return domFlowTargets;
}
const domFlowTargets = [];
function addDOMFlowTarget(target) {
  domFlowTargets.push(target);
}
function removeDOMFlowTarget(target) {
  domFlowTargets.splice(domFlowTargets.indexOf(target), 1);
}
class DOMFlowTarget extends FlowTarget {
  constructor(rootElement, configuration2 = {}) {
    const { creator = null, fullWindow = true } = configuration2;
    super();
    if (!this.key) this.key = configuration2.key ? configuration2.key : null;
    this.animate = typeof configuration2.animate === "undefined" ? true : configuration2.animate;
    if (this.animate) addDOMFlowTarget(this);
    this.creator = creator;
    this.rootElement = rootElement;
    if (fullWindow) {
      document.body.style.margin = "0px";
      document.body.style.width = "100%";
      document.body.style.height = window.innerHeight + "px";
      this.rootElement.style.width = "100%";
      this.rootElement.style.height = "100%";
      this.rootElement.style.overflow = "hidden";
      window.addEventListener("resize", () => {
        if (document.body.style.height != window.innerHeight + "px")
          document.body.style.height = window.innerHeight + "px";
        transaction(() => {
          if (this.flow) {
            this.flow.bounds = { width: window.innerWidth, height: window.innerHeight };
          }
        });
      });
    }
    this.state = observable({
      modalDiv: null
    });
    return observable(this, this.key);
  }
  toString() {
    return "[target]" + (this.flow ? this.flow.toString() : "null");
  }
  setContent(flow) {
    flow.bounds = { width: window.innerWidth, height: window.innerHeight };
    super.setContent(flow);
  }
  ensureContentInPlace() {
    this.contentPlacementRepeater = repeat(this.toString() + ".contentPlacementRepeater", (repeater) => {
      if (trace) console.group(repeater.causalityString());
      this.flow.getPrimitive().givenDomNode = this.rootElement;
      workOnPriorityLevel(2, () => this.flow.getPrimitive().ensureDomNodeBuilt());
      if (trace) console.groupEnd();
    }, { priority: 2 });
  }
  dispose() {
    super.dispose();
    if (this.animate) removeDOMFlowTarget(this);
  }
  create(...parameters) {
    const properties = findKeyInProperties(readFlowProperties$1(parameters));
    const DOMNodeClass = domNodeClassRegistry[properties.type];
    if (!DOMNodeClass) throw Error("Unknown primitive type: " + properties.type);
    return new DOMNodeClass(properties);
  }
}
const log$3 = console.log;
function installDOMAnimation() {
  configuration.onFinishReBuildingFlowCallbacks.push(onFinishReBuildingFlow);
  configuration.onFinishReBuildingDOMCallbacks.push(onFinishReBuildingDOM);
}
function resetDOMAnimation() {
  Object.assign(flowChanges, newFlowChanges());
  previousFlowChanges = {};
  counter = 0;
  getDomFlowTargets().length = 0;
}
let count = 0;
function freezeFlowChanges() {
  count++;
  if (traceAnimation && traceWarnings) console.warn("Risky to use freeze " + count);
}
function unfreezeFlowChanges() {
  count--;
  if (traceAnimation && traceWarnings) console.warn("Unfreeze... " + count);
}
function logProperties(object, properties) {
  log$3(extractProperties(object, properties));
}
function extractProperties(object, properties) {
  const condensed = {};
  properties.forEach((property) => {
    if (typeof property !== "string") {
      property.partial.forEach((part) => {
        if (object[part]) {
          condensed[part] = object[part];
        }
      });
      if (object[property.compound]) {
        condensed[property.compound] = object[property.compound];
      }
    } else {
      if (object[property]) {
        condensed[property] = object[property];
      }
    }
  });
  return condensed;
}
const flowChanges = newFlowChanges();
function newFlowChanges() {
  return {
    number: 0,
    idPrimitiveMap: {},
    idParentIdMap: {},
    globallyAdded: {},
    globallyRemoved: {},
    globallyResident: {},
    globallyMoved: {},
    globallyAddedAnimated: {},
    globallyRemovedAnimated: {},
    globallyResidentAnimated: {},
    globallyMovedAnimated: {},
    *allAnimatedFlows() {
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAddedFlows() {
      for (let flow of Object.values(this.globallyAdded)) {
        yield flow;
      }
    },
    *allAnimatedAddedFlows() {
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedRemovedFlows() {
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedResidentFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedFlows() {
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedResidentAndRemovedFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedResidentFlows() {
      for (let flow of Object.values(this.globallyResidentAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
    },
    *allAnimatedMovedAddedAndRemovedFlows() {
      for (let flow of Object.values(this.globallyMovedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyAddedAnimated)) {
        yield flow;
      }
      for (let flow of Object.values(this.globallyRemovedAnimated)) {
        yield flow;
      }
    }
  };
}
let previousFlowChanges = {};
window.flowChanges = flowChanges;
let counter = 0;
const changeType = {
  resident: "resident",
  added: "added",
  removed: "removed",
  moved: "moved"
};
function onFinishReBuildingFlow() {
  counter++;
  if (traceAnimation) {
    logAnimationFrameGroup(counter);
    logAnimationSeparator("---------------------------------------- Flow rebuilt, DOM untouched, calculate changes... -------------------");
    console.groupCollapsed("Potentially start DOM building for new flows here ...");
  }
  Object.assign(previousFlowChanges, flowChanges);
  flowChanges.number++;
  flowChanges.idPrimitiveMap = {};
  flowChanges.idParentIdMap = {};
  flowChanges.globallyAdded = {};
  flowChanges.globallyResident = {};
  flowChanges.globallyMoved = {};
  flowChanges.globallyRemoved = {};
  const idPrimitiveMap = flowChanges.idPrimitiveMap;
  const idParentIdMap = flowChanges.idParentIdMap;
  function analyzePrimitives(idPrimitiveMap2, primitiveFlow) {
    idPrimitiveMap2[primitiveFlow.id] = primitiveFlow;
    idParentIdMap[primitiveFlow.id] = primitiveFlow.parentPrimitive;
    for (let child of primitiveFlow.iteratePrimitiveChildren()) {
      analyzePrimitives(idPrimitiveMap2, child);
    }
  }
  for (let target of getDomFlowTargets()) {
    analyzePrimitives(idPrimitiveMap, target.flow.getPrimitive());
  }
  for (let id in idPrimitiveMap) {
    const primitive = idPrimitiveMap[id];
    const inPreviousMap = previousFlowChanges ? !!previousFlowChanges.idPrimitiveMap[id] : false;
    if (inPreviousMap) {
      if (!previousFlowChanges.idParentIdMap || previousFlowChanges.idParentIdMap[id] === idParentIdMap[id]) {
        flowChanges.globallyResident[id] = primitive;
      } else {
        flowChanges.globallyMoved[id] = primitive;
      }
    } else {
      flowChanges.globallyAdded[id] = primitive;
    }
  }
  for (let id in previousFlowChanges.idPrimitiveMap) {
    const inPreviousMap = previousFlowChanges.idPrimitiveMap[id];
    if (typeof idPrimitiveMap[id] === "undefined" && !inPreviousMap.parentPrimitive) {
      flowChanges.globallyRemoved[id] = inPreviousMap;
    }
  }
  function filterAnimatedInMap(map) {
    return Object.values(map).reduce((result, flow) => {
      if (flow.animation) {
        let stableFoundation = true;
        let scan = flow.parentPrimitive;
        while (scan) {
          if (flowChanges.globallyAdded[scan.id] && (!scan.animation || !scan.animation.allwaysStableFoundationEvenWhenAdded())) {
            stableFoundation = false;
            break;
          }
          scan = scan.parentPrimitive;
        }
        if (stableFoundation || flow.animation.acceptUnstableFoundation(scan)) {
          result[flow.id] = flow;
        }
      }
      return result;
    }, {});
  }
  flowChanges.globallyAddedAnimated = filterAnimatedInMap(flowChanges.globallyAdded);
  flowChanges.globallyResidentAnimated = filterAnimatedInMap(flowChanges.globallyResident);
  flowChanges.globallyMovedAnimated = filterAnimatedInMap(flowChanges.globallyMoved);
  flowChanges.globallyRemovedAnimated = filterAnimatedInMap(flowChanges.globallyRemoved);
  function toStrings(changes) {
    return {
      addedIncludingNonAnimated: Object.values(changes.globallyAdded).map((flow) => flow.toString()),
      added: Object.values(changes.globallyAddedAnimated).map((flow) => flow.toString()),
      resident: Object.values(changes.globallyResidentAnimated).map((flow) => flow.toString()),
      moved: Object.values(changes.globallyMovedAnimated).map((flow) => flow.toString()),
      movedIncludingNonAnimated: Object.values(changes.globallyMoved).map((flow) => flow.toString()),
      removed: Object.values(changes.globallyRemovedAnimated).map((flow) => flow.toString()),
      removedIncludingNonAnimated: Object.values(changes.globallyRemoved).map((flow) => flow.toString())
    };
  }
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      const changes = {
        number: flowChanges.number,
        activated: false,
        type: changeType.resident,
        previous: flow.changes,
        transitioningProperties: flow.changes && flow.changes.transitioningProperties ? flow.changes.transitioningProperties : {}
      };
      flow.changes = changes;
      flow.domNode.changes = changes;
    }
  }
  for (let flow of flowChanges.allAnimatedMovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.moved;
    }
  }
  for (let flow of flowChanges.allAnimatedAddedFlows()) {
    if (flow.getDomNode()) {
      flow.domNode.changes.type = changeType.added;
    }
  }
  for (let flow of flowChanges.allAnimatedRemovedFlows()) {
    if (flow.domNode) {
      flow.domNode.changes.type = changeType.removed;
      flow.domNode.changes.targetDimensions = { width: flow.domNode.offsetWidth, height: flow.domNode.offsetHeight };
    }
  }
  if (traceAnimation) {
    console.groupEnd();
    console.log("New animated changes:");
    log$3(toStrings(flowChanges));
  }
  logAnimationSeparator("---------------------------------------- Measure original bounds... ------------------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.getDomNode()) {
      flow.animation.recordOriginalBoundsAndStyle(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Prepare for DOM building... -----------------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.prepareForDOMBuilding(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Rebuilding DOM... ----------------------------------------------------");
  if (traceAnimation) console.groupCollapsed("...");
  flowChanges.onFinishReBuildingFlowDone = true;
}
function onFinishReBuildingDOM() {
  if (!flowChanges.onFinishReBuildingFlowDone) return;
  delete flowChanges.onFinishReBuildingFlowDone;
  if (traceAnimation) console.groupEnd();
  logAnimationSeparator("---------------------------------------- DOM rebuilt, measure target sizes ... -------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.domJustRebuiltMeasureTargetSizes(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Emulate original footprints and styles ------------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalFootprintsAndFixateAnimatedStyle(flow);
    }
  }
  logAnimationSeparator("---------------------------------------- Emulate original bounds for FLIP animations -------------------------");
  for (let flow of flowChanges.allAnimatedFlows()) {
    if (flow.domNode) {
      flow.animation.emulateOriginalBounds(flow);
    }
  }
  activateAnimationAfterFirstRender({ ...flowChanges });
}
function activateAnimationAfterFirstRender(currentFlowChanges) {
  postponeInvalidations();
  requestAnimationFrame(() => {
    logAnimationSeparator("---------------------------------------- Rendered first frame, activate animations...  ---------------------");
    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        if (traceAnimation) {
          console.group();
          console.log(flow.domNode);
        }
        flow.animation.activateAnimation(flow, currentFlowChanges);
        if (traceAnimation) {
          console.groupEnd();
        }
      }
      flow.changes.activated = true;
    }
    logAnimationSeparator("---------------------------------------- Setup animation cleanup...  ---------------------");
    for (let flow of currentFlowChanges.allAnimatedFlows()) {
      if (flow.domNode) {
        flow.animation.setupAnimationCleanup(flow);
      }
    }
    logAnimationSeparator(counter + "------------------------------------------------------------------------------------------------------------");
    console.groupEnd();
    continueInvalidations();
  });
}
function sameBounds(b1, b2) {
  return b1.top === b2.top && b1.left === b2.left && b1.width === b2.width && b1.height === b2.height;
}
const camelCase = /* @__PURE__ */ function() {
  var DEFAULT_REGEX = /[-_]+(.)?/g;
  function toUpper(match, group1) {
    return group1 ? group1.toUpperCase() : "";
  }
  return function(str, delimiters) {
    return str.replace(delimiters ? new RegExp("[" + delimiters + "]+(.)?", "g") : DEFAULT_REGEX, toUpper);
  };
}();
function parseMatrix(matrix) {
  function extractScaleTranslate(matrix2) {
    return {
      scaleX: matrix2[0],
      scaleY: matrix2[3],
      translateX: matrix2[4],
      translateY: matrix2[5]
    };
  }
  let matrixPattern = /^\w*\((-?((\d+)|(\d*\.\d+)),\s*)*(-?(\d+)|(\d*\.\d+))\)/i;
  if (matrixPattern.test(matrix)) {
    let matrixCopy = matrix.replace(/^\w*\(/, "").replace(")", "");
    let matrixValue = matrixCopy.split(/\s*,\s*/).map((value) => parseFloat(value));
    return extractScaleTranslate(matrixValue);
  }
  return extractScaleTranslate([1, 0, 0, 1, 0, 0]);
}
class DOMNodeAnimation {
  /**
   * Foundation requirements
   */
  acceptUnstableFoundation(unstableAncestorFlow) {
    return false;
  }
  /**
   * Foundation requirements
   */
  allwaysStableFoundationEvenWhenAdded() {
    return false;
  }
  /**
   * Record original bounds, before anything in the dome has changed
   * Bounds do not include margin. See this:  
   * https://stackoverflow.com/questions/50657526/does-getboundingclientrect-width-and-height-includes-paddings-and-borders-of-e
   * Also offset width and height do not include margin. 
   */
  recordOriginalBoundsAndStyle(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * Prepare for DOM building. 
   */
  prepareForDOMBuilding(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * DOM just rebuilt, it could be a good idea to measure target sizes at this stage, 
   * since it is the closest we will be to the actual end result. 
   * However, removed nodes are still present at this point... maybe we should ensure added leaders for removed ones start out minimized?
   * Trailers should also be minimized at this point.
   */
  domJustRebuiltMeasureTargetSizes(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * Emulate the original styles and footprints of all animated
   * nodes. This is for a smooth transition from their original position. 
   */
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * Emulate original bounds
   */
  emulateOriginalBounds(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * Activate animation 
   */
  activateAnimation(flow) {
    throw new Error("Not implemented yet!");
  }
  /**
   * Setup animation cleanyp
   */
  setupAnimationCleanup(flow) {
    throw new Error("Not implemented yet!");
  }
}
let animationTime = 1;
function setAnimationTime(value) {
  animationTime = value;
}
const inheritedProperties = ["fontSize", "lineHeight", "margin", "padding", "color"];
class ZoomFlyDOMNodeAnimation extends DOMNodeAnimation {
  constructor() {
    super(...arguments);
    /**
     * Configuration
     */
    __publicField(this, "animateLeaderWidth", true);
    __publicField(this, "animateLeaderHeight", true);
    __publicField(this, "animatedProperties", [
      // "transform",
      // "maxHeight",
      // "maxWidth",
      { compound: "margin", partial: ["marginBottom", "marginBottom", "marginLeft", "marginRight"] },
      { compound: "padding", partial: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"] },
      "opacity",
      "color"
    ]);
    /**
     * -------------------------------------------------------------------------------------
     * 
     *                           Activate animations
     * 
     * -------------------------------------------------------------------------------------
     */
    __publicField(this, "typicalAnimatedProperties", [
      "opacity",
      "display",
      "position",
      "transition",
      "transform",
      "width",
      "height",
      "maxWidth",
      "maxHeight",
      "margin",
      "marginTop",
      "padding",
      "paddingTop"
    ]);
  }
  /**
   * Default transitions
   */
  defaultTransition() {
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`;
  }
  addedTransition() {
    return `transform ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(1, 0, 0.42, 0.93)`;
  }
  leaderTransition() {
    return `width ${animationTime}s ease-in-out, height ${animationTime}s ease-in-out`;
  }
  removeTransition() {
    return `all ${animationTime}s ease-in-out, opacity ${animationTime}s cubic-bezier(.08,.72,.15,1.01)`;
  }
  /**
   * Dimensions helper
   */
  getDimensionsIncludingMargin(node) {
    const bounds = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return this.calculateDimensionsIncludingMargin(bounds, style);
  }
  calculateDimensionsIncludingMargin(bounds, style) {
    const dimensions = {
      marginTop: parseInt(style.marginTop, 10),
      marginBottom: parseInt(style.marginBottom, 10),
      marginLeft: parseInt(style.marginLeft, 10),
      marginRight: parseInt(style.marginRight, 10),
      width: bounds.width,
      height: bounds.height
    };
    dimensions.widthWithoutMargin = dimensions.width;
    dimensions.heightWithoutMargin = dimensions.height;
    dimensions.heightIncludingMargin = dimensions.height + dimensions.marginTop + dimensions.marginBottom;
    dimensions.widthIncludingMargin = dimensions.width + dimensions.marginLeft + dimensions.marginRight;
    return dimensions;
  }
  /**
   * General helpers
   */
  fixateLeaderOrTrailer(leaderOrTrailer) {
    const bounds = leaderOrTrailer.getBoundingClientRect();
    leaderOrTrailer.style.width = bounds.width + "px";
    leaderOrTrailer.style.height = bounds.height + "px";
  }
  repurposeOwnLeaderAsTrailer(node) {
    const leader = node.leader;
    delete node.leader;
    leader.removeEventListener("transitionend", leader.hasCleanupEventListener);
    delete leader.hasCleanupEventListener;
    if (node.trailer) {
      delete node.trailer.owner;
      delete node.trailer;
    }
    const trailer = leader;
    if (trailer.owner !== node) throw new Error("unexpected owner");
    node.trailer = trailer;
    return trailer;
  }
  repurposeOwnTrailerAsLeader(node) {
    const trailer = node.trailer;
    delete node.trailer;
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
    }
    const leader = trailer;
    if (leader.owner !== node) throw new Error("unexpected owner");
    node.leader = leader;
    return leader;
  }
  repurposeTrailerAsLeader(trailer, node) {
    if (trailer.owner) {
      delete trailer.owner.trailer;
      delete trailer.owner;
    }
    trailer.removeEventListener("transitionend", trailer.hasCleanupEventListener);
    delete trailer.hasCleanupEventListener;
    if (node.leader) {
      delete node.leader.owner;
      delete node.leader;
    }
    const leader = trailer;
    node.leader = leader;
    leader.owner = node;
    return leader;
  }
  createNewTrailer(node) {
    const trailer = this.createNewTrailerOrLeader();
    trailer.id = "trailer";
    if (node.trailer) throw new Error("should not have a trailer!");
    node.trailer = trailer;
    trailer.owner = node;
    return trailer;
  }
  createNewLeader(node) {
    const leader = this.createNewTrailerOrLeader();
    leader.id = "leader";
    if (node.leader) throw new Error("should not have a leader!");
    node.leader = leader;
    leader.owner = node;
    return leader;
  }
  createNewTrailerOrLeader(id) {
    const trailerOrLeader = document.createElement("div");
    trailerOrLeader.isControlledByAnimation = true;
    trailerOrLeader.style.position = "relative";
    trailerOrLeader.style.overflow = "visible";
    return trailerOrLeader;
  }
  hide(node) {
    node.style.display = "none";
  }
  show(node) {
    node.style.display = "";
  }
  /**
   * Debugging
   */
  changesChain(flow) {
    let result = "";
    result += flow.domNode.ongoingAnimation ? "[ongoing] " : "";
    let changes = flow.changes;
    while (changes) {
      const separator = result === "" ? "" : ", ";
      result += separator + changes.type;
      changes = changes.previous;
    }
    return result;
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Animation chain
   * 
   * -------------------------------------------------------------------------------------
   */
  startAnimationChain(node) {
    node.ongoingAnimation = this;
    freezeFlowChanges();
  }
  endAnimationChain(node) {
    if (node.ongoingAnimation) {
      delete node.isControlledByAnimation;
      delete node.ongoingAnimation;
      if (node.changes) {
        node.changes.finished = true;
        const flow = node.equivalentCreator;
        flow.changes = null;
        node.changes = null;
      }
      requestAnimationFrame(() => {
        unfreezeFlowChanges();
      });
    }
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Record original bounds
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * Record original bounds, before anything in the dome has changed
   * Bounds do not include margin. See this:  
   * https://stackoverflow.com/questions/50657526/does-getboundingclientrect-width-and-height-includes-paddings-and-borders-of-e
   * Also offset width and height do not include margin. 
   */
  recordOriginalBoundsAndStyle(flow) {
    const node = flow.domNode;
    node.changes.originalBounds = node.getBoundingClientRect();
    node.changes.originalStyle = { ...node.style };
    node.changes.computedOriginalStyle = { ...getComputedStyle(node) };
    node.changes.originalDimensions = this.calculateDimensionsIncludingMargin(node.changes.originalBounds, node.changes.computedOriginalStyle);
    console.groupEnd();
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Prepare for DOM building
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * Prepare for DOM building. 
   */
  prepareForDOMBuilding(flow) {
    const node = flow.domNode;
    switch (flow.changes.type) {
      case changeType.moved:
      case changeType.removed:
        delete node.isControlledByAnimation;
        this.addTrailersForMovedAndRemovedBeforeDomBuilding(node);
        if (changeType.moved) node.trailer.canBeRepurposed = true;
        break;
    }
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        delete node.isControlledByAnimation;
        this.neutralizeTransformationsAndPosition(flow, node);
        flow.synchronizeDomNodeStyle(inheritedProperties);
        break;
    }
    if (flow.changes.type === changeType.resident) {
      if (node.leader) {
        node.isControlledByAnimation = true;
      }
    }
    console.groupEnd();
  }
  addTrailersForMovedAndRemovedBeforeDomBuilding(node) {
    let trailer;
    if (node.leader && node.leader === node.parentNode && node.parentNode.isControlledByAnimation) {
      trailer = this.repurposeOwnLeaderAsTrailer(node);
      this.fixateLeaderOrTrailer(trailer);
    } else {
      trailer = this.createNewTrailer(node);
      trailer.style.width = node.changes.originalDimensions.widthIncludingMargin + "px";
      trailer.style.height = node.changes.originalDimensions.heightIncludingMargin + "px";
      insertAfter(trailer, node);
    }
    this.hide(trailer);
  }
  neutralizeTransformationsAndPosition(flow) {
    flow.synchronizeDomNodeStyle(["position", "transform", "width", "height"]);
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                               Measure target sizes for leaders
   *                               (should include final size and margins)
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * DOM just rebuilt, it could be a good idea to measure target sizes at this stage, 
   * since it is the closest we will be to the actual end result. 
   * However, removed nodes are still present at this point... maybe we should ensure added leaders for removed ones start out minimized?
   * Trailers should also be minimized at this point.
   */
  domJustRebuiltMeasureTargetSizes(flow) {
    const node = flow.domNode;
    switch (flow.changes.type) {
      case changeType.added:
        if (flow.changes.previous && flow.changes.previous.type === changeType.removed) {
          const removeChange = flow.changes.previous;
          node.changes.targetBounds = removeChange.originalBounds;
          node.changes.targetStyle = removeChange.originalStyle;
          node.changes.computedTargetStyle = removeChange.computedOriginalStyle;
          node.changes.targetDimensions = removeChange.originalDimensions;
          break;
        }
      case changeType.resident:
      case changeType.moved:
        node.changes.targetBounds = node.getBoundingClientRect();
        node.changes.targetStyle = { ...node.style };
        node.changes.computedTargetStyle = { ...getComputedStyle(node) };
        node.changes.targetDimensions = this.calculateDimensionsIncludingMargin(node.changes.targetBounds, node.changes.computedTargetStyle);
    }
    console.groupEnd();
  }
  // Note: There could be resident nodes moving around and changing size. We cant do anything about it. Shoulw we try to emulate their end state?
  // But then again, their end state might occur at a different point in time from the end of this target. So... 
  // It might be impossible to get the correct target size for every situation. It just aims to be good enough.
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                  Emulate original footprints and fixate animated style
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * Emulate the original styles and footprints of all animated
   * nodes. This is for a smooth transition from their original position. 
   */
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    const node = flow.domNode;
    const trailer = node.trailer;
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break;
    }
    switch (flow.changes.type) {
      case changeType.removed:
        if (node.parentNode !== trailer) {
          trailer.appendChild(node);
        }
        if (trailer) this.show(trailer);
        break;
      case changeType.moved:
        if (trailer) this.show(trailer);
        break;
    }
    if (node.ongoingAnimation) {
      this.fixateOriginalInheritedStyles(node);
      switch (flow.changes.type) {
        case changeType.resident:
          break;
        case changeType.added:
          this.fixateOriginalTransformAndOpacity(node);
          break;
        case changeType.removed:
          this.fixateOriginalTransformAndOpacity(node);
          break;
        case changeType.moved:
          this.fixateOriginalTransformAndOpacity(node);
          break;
      }
    } else {
      switch (flow.changes.type) {
        case changeType.resident:
          break;
        case changeType.added:
          this.originalPositionForZoomIn(node);
          break;
        case changeType.removed:
          this.originalPositionForZoomOut(node);
          break;
        case changeType.moved:
          this.fixateOriginalInheritedStyles(node);
          this.originalPositionForMoveAndResize(node);
          break;
      }
    }
    console.groupEnd();
  }
  fixateOriginalInheritedStyles(node) {
    if ([changeType.added, changeType.removed, changeType.moved].includes(node.changes.type)) {
      node.style.transition = "";
      for (let property of inheritedProperties) {
        node.style[property] = node.changes.computedOriginalStyle[property];
      }
    }
  }
  setupALeaderForIncomingWithOriginalFootprint(node) {
    let leader = this.tryRepurposeTrailerAsLeader(node);
    if (!leader) {
      leader = this.createNewLeader(node);
      node.leader = leader;
      if (this.animateLeaderWidth) leader.style.width = "0.0001px";
      if (this.animateLeaderHeight) leader.style.height = "0.0001px";
      insertAfter(leader, node);
    }
    leader.appendChild(node);
    this.show(leader);
  }
  tryRepurposeTrailerAsLeader(node) {
    if (node.trailer && node.parentNode === node.trailer) {
      return this.repurposeOwnTrailerAsLeader(node);
    } else {
      return null;
    }
  }
  fixateOriginalTransformAndOpacity(node) {
    Object.assign(node.style, {
      transform: node.changes.computedOriginalStyle.transform,
      opacity: node.changes.computedOriginalStyle.opacity
    });
  }
  originalPositionForZoomIn(node) {
    Object.assign(node.style, {
      position: "absolute",
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  originalPositionForZoomOut(node) {
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      position: "absolute",
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.originalDimensions.widthWithoutMargin + "px",
      height: node.changes.originalDimensions.heightWithoutMargin + "px",
      opacity: "1"
    });
  }
  originalPositionForMoveAndResize(node) {
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      position: "absolute",
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.originalDimensions.widthWithoutMargin + "px",
      height: node.changes.originalDimensions.heightWithoutMargin + "px"
    });
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                            Emulate original bounds using transformations
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * Emulate original bounds
   */
  emulateOriginalBounds(flow) {
    flow.domNode;
    this.recordBoundsInNewStructure(flow.domNode);
    switch (flow.changes.type) {
      case changeType.moved:
      case changeType.resident:
        this.translateToOriginalBoundsIfNeeded(flow);
        break;
    }
    console.groupEnd();
  }
  recordBoundsInNewStructure(node) {
    node.newStructureBounds = node.getBoundingClientRect();
    draw(node.newStructureBounds, "red");
  }
  translateToOriginalBoundsIfNeeded(flow) {
    if (!sameBounds(flow.domNode.changes.originalBounds, flow.domNode.newStructureBounds)) {
      flow.outOfPosition = true;
      const computedStyle = getComputedStyle(flow.domNode);
      let currentTransform = getComputedStyle(flow.domNode).transform;
      if (!["none", "", " "].includes(currentTransform)) {
        Object.assign(flow.domNode.style, extractProperties(computedStyle, this.animatedProperties));
        flow.domNode.style.transition = "";
        flow.domNode.style.transform = "";
        currentTransform = getComputedStyle(flow.domNode).transform;
        this.recordBoundsInNewStructure(flow.domNode);
      }
      flow.animateInChanges = flowChanges.number;
      this.translateFromNewToOriginalPosition(flow.domNode);
      flow.domNode.getBoundingClientRect();
    }
  }
  translateFromNewToOriginalPosition(node) {
    node.style.transition = "";
    const originalBounds = node.changes.originalBounds;
    const newStructureBounds = node.newStructureBounds;
    const deltaX = newStructureBounds.left - originalBounds.left;
    const deltaY = newStructureBounds.top - originalBounds.top;
    const transform = "matrix(1, 0, 0, 1, " + -deltaX + ", " + -deltaY + ")";
    node.style.transform = transform;
  }
  /**
   * Activate animation 
   */
  activateAnimation(flow) {
    const node = flow.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    flow.changes;
    const trailer = node.trailer;
    node.leader;
    if (node.leader) ;
    if (node.trailer) ;
    if (ongoingAnimation) {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
          }
          break;
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          break;
        case changeType.removed:
          this.targetPositionForZoomOut(node);
          this.targetSizeForTrailer(node.trailer);
          break;
      }
    } else {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            this.startAnimationChain(node);
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
          }
          break;
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break;
        case changeType.removed:
          this.targetPositionForZoomOut(node);
          this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break;
      }
    }
    if (node.trailer) ;
    console.groupEnd();
  }
  targetSizeForLeader(node, leader) {
    leader.style.transition = this.leaderTransition();
    const style = {};
    if (this.animateLeaderHeight) style.height = node.changes.targetDimensions.heightIncludingMargin + "px";
    if (this.animateLeaderWidth) style.width = node.changes.targetDimensions.widthIncludingMargin + "px";
    Object.assign(leader.style, style);
  }
  targetSizeForTrailer(trailer) {
    trailer.style.transition = this.leaderTransition();
    Object.assign(trailer.style, {
      width: "0.0001px",
      height: "0.0001px"
    });
  }
  targetPositionForZoomIn(node) {
    node.style.transition = this.addedTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)",
      opacity: "1"
    });
  }
  targetPositionForMovingInsideContainer(node) {
    node.style.transition = this.defaultTransition(node);
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
  }
  targetPositionForMoved(node) {
    node.style.transition = this.defaultTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, 0)"
    });
    this.setInheritedTargetStyles(node);
  }
  targetPositionForZoomOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(0.0001, 0, 0, 0.0001, 0, 0)",
      opacity: "0.001"
    });
  }
  setInheritedTargetStyles(node) {
    for (let property of inheritedProperties) {
      node.style[property] = node.changes.computedTargetStyle[property];
    }
  }
  /**
   * -------------------------------------------------------------------------------------
   * 
   *                           Animation cleanup
   * 
   * -------------------------------------------------------------------------------------
   */
  /**
   * Setup animation cleanyp
   */
  setupAnimationCleanup(flow) {
    const node = flow.domNode;
    this.setupNodeAnimationCleanup(node, {
      purpose: "node",
      endingAction: (propertyName) => {
        const leader = node.leader;
        const trailer = node.trailer;
        node.equivalentCreator.synchronizeDomNodeStyle([propertyName, "transition", "transform", "width", "height", "position", "opacity", ...inheritedProperties]);
        if (node.parentNode.isControlledByAnimation) {
          switch (node.changes.type) {
            case changeType.removed:
              if (trailer) {
                if (node.parentNode !== trailer) throw new Error("Internal error: Wrong trailer!");
                node.equivalentCreator.synchronizeDomNodeStyle(["position", "width", "height", "transform"]);
                trailer.removeChild(node);
                if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
                delete trailer.owner;
                node.trailer.canBeRepurposed = true;
                delete node.trailer;
              }
              break;
            case changeType.added:
            case changeType.moved:
            case changeType.resident:
              if (leader) {
                if (node.parentNode !== leader) throw new Error("Internal error: Wrong leader!");
                node.equivalentCreator.synchronizeDomNodeStyle(["position", "width", "height", "transform"]);
                leader.removeChild(node);
                if (leader.parentNode) leader.parentNode.replaceChild(node, leader);
                delete leader.owner;
                delete node.leader;
              }
              if (trailer) {
                delete trailer.owner;
                node.trailer.canBeRepurposed = true;
                delete node.trailer;
              }
              break;
          }
        }
        this.endAnimationChain(node);
      }
    });
    if (node.trailer) {
      this.setupTrailerAnimationCleanup(node.trailer);
    }
  }
  setupTrailerAnimationCleanup(trailer) {
    this.setupNodeAnimationCleanup(trailer, {
      purpose: "trailer",
      endingProperties: ["width", "height"],
      endingAction: () => {
        delete trailer.isControlledByAnimation;
        if (trailer.parentNode) trailer.parentNode.removeChild(trailer);
        if (trailer.owner) {
          delete trailer.owner.trailer;
        }
        delete trailer.owner;
      }
    });
  }
  setupNodeAnimationCleanup(node, { endingProperties, endingAction, purpose }) {
    if (node.hasCleanupEventListener) return;
    function onTransitionEnd(event) {
      event.stopPropagation();
      event.preventDefault();
      if (!node.changes || !node.changes.activated) return;
      const propertyName = camelCase(event.propertyName);
      node.changes ? " in " + node.changes.type + " animation" : "";
      console.groupEnd();
      if (!endingProperties || endingProperties.includes(propertyName)) {
        endingAction(propertyName);
        node.removeEventListener("transitionend", onTransitionEnd);
        delete node.hasCleanupEventListener;
      }
    }
    node.addEventListener("transitionend", onTransitionEnd, true);
    node.hasCleanupEventListener = onTransitionEnd;
  }
}
const zoomFlyAnimation = new ZoomFlyDOMNodeAnimation();
const standardAnimation = zoomFlyAnimation;
const log$2 = console.log;
function mostAbstractFlow(flow) {
  while (flow.equivalentCreator) flow = flow.equivalentCreator;
  return flow;
}
function aggregateToString(flow) {
  let id = [];
  let scan = flow;
  while (scan) {
    id.unshift(scan.toString());
    scan = scan.equivalentCreator;
  }
  return id.join(" | ");
}
function clearNode(node, attributes) {
  while (node.childNodes.length > 0) {
    node.removeChild(node.lastChild);
  }
}
function getHeightIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles["marginTop"]) + parseFloat(styles["marginBottom"]);
  return Math.ceil(node.offsetHeight + margin);
}
function getWidthIncludingMargin(node) {
  var styles = window.getComputedStyle(node);
  var margin = parseFloat(styles["marginLeft"]) + parseFloat(styles["marginRight"]);
  return Math.ceil(node.offsetWidth + margin);
}
class DOMNode extends FlowPrimitive {
  dimensions(contextNode) {
    if (traceWarnings) console.warn("Calls to dimensions() could lead to performance issues as it forces a reflow to measure the size of a dom-node. Note that transition animations may use dimensions() for measuring the size of added nodes");
    let domNode = this.ensureDomNodeBuilt();
    let alreadyInContext;
    if (contextNode) {
      alreadyInContext = domNode.parentNode === contextNode;
      if (!alreadyInContext) {
        domNode = domNode.cloneNode(true);
        contextNode.appendChild(domNode);
      }
    } else {
      domNode = domNode.cloneNode(true);
      domNode.style.position = "absolute";
      domNode.style.top = "0";
      domNode.style.left = "0";
      if (domNode.style.width === "") {
        domNode.style.width = "auto";
      }
      if (domNode.style.height === "") {
        domNode.style.height = "auto";
      }
      document.body.appendChild(domNode);
    }
    const result = {
      width: getWidthIncludingMargin(domNode),
      height: getHeightIncludingMargin(domNode),
      widthIncludingMargin: getWidthIncludingMargin(domNode),
      heightIncludingMargin: getHeightIncludingMargin(domNode),
      widthWithoutMargin: domNode.offsetWidth,
      heightWithoutMargin: domNode.offsetHeight
    };
    if (contextNode) {
      if (!alreadyInContext) {
        contextNode.removeChild(domNode);
      }
    } else {
      document.body.removeChild(domNode);
    }
    return result;
  }
  getDomNode() {
    this.ensureDomNodeBuilt();
    return this.domNode;
  }
  ensureDomNodeBuilt() {
    finalize(this);
    if (!this.buildDOMRepeater) {
      this.buildDOMRepeater = repeat("[" + aggregateToString(this) + "].buildDOMRepeater", (repeater) => {
        if (trace) console.group(repeater.causalityString());
        this.ensureDomNodeExists();
        this.ensureDomNodeAttributesSet();
        this.ensureDomNodeChildrenInPlace();
        if (trace) console.groupEnd();
      }, { priority: 2 });
    }
    return this.domNode;
  }
  createEmptyDomNode() {
    throw new Error("Not implemented yet!");
  }
  ensureDomNodeChildrenInPlace() {
    const node = this.domNode;
    if (!(node instanceof Element)) return;
    const newChildren = this.getPrimitiveChildren(node);
    const newChildNodes = newChildren.map((child) => child.ensureDomNodeBuilt()).filter((child) => !!child);
    let index = 0;
    while (index < newChildNodes.length) {
      const child = newChildNodes[index];
      if (child.leader && child.parentNode === child.leader && child.leader.parentNode === node) {
        newChildNodes[index] = child.leader;
      }
      if (child.trailer && child.parentNode === child.trailer && child.trailer.parentNode === node) {
        newChildNodes[index] = child.trailer;
      }
      index++;
    }
    const recoveredNodes = [];
    for (let existingChildNode of node.childNodes) {
      if (existingChildNode.isControlledByAnimation) {
        recoveredNodes.push(existingChildNode);
      } else {
        if (newChildNodes.includes(existingChildNode)) {
          recoveredNodes.push(existingChildNode);
        }
      }
    }
    let anchor = null;
    recoveredNodes.forEach((node2) => {
      node2.anchor = anchor;
      anchor = node2;
    });
    function insertAfter2(array, reference, element) {
      array.splice(array.indexOf(reference) + 1, 0, element);
    }
    recoveredNodes.forEach((node2) => {
      if (!newChildNodes.includes(node2)) {
        let anchor2 = node2.anchor;
        while (!newChildNodes.includes(anchor2) && anchor2) anchor2 = anchor2.anchor;
        if (!anchor2) {
          newChildNodes.unshift(node2);
        } else {
          insertAfter2(newChildNodes, anchor2, node2);
        }
      }
    });
    index = node.childNodes.length - 1;
    while (index >= 0) {
      const existingChildNode = node.childNodes[index];
      if (existingChildNode instanceof Element && !newChildNodes.includes(existingChildNode)) {
        node.removeChild(existingChildNode);
      }
      index--;
    }
    index = 0;
    while (index < newChildNodes.length) {
      const newChildNode = newChildNodes[index];
      const existingChildNode = node.childNodes[index];
      if (existingChildNode) {
        const existingWrappedNode = node.childNodes[index];
        if (newChildNode !== existingWrappedNode) {
          node.insertBefore(newChildNode, existingChildNode);
        }
      } else {
        node.appendChild(newChildNode);
      }
      index++;
    }
  }
  getChildNodes() {
    return this.getPrimitiveChildren().map((child) => child.ensureDomNodeBuilt());
  }
  ensureDomNodeExists() {
    if (!this.createElementRepeater) {
      this.createElementRepeater = repeat(mostAbstractFlow(this).toString() + ".createElementRepeater", (repeater) => {
        if (trace) log$2(repeater.causalityString());
        if (this.givenDomNode) {
          clearNode(this.givenDomNode);
          this.domNode = this.givenDomNode;
          this.domNode.className = aggregateToString(this);
          this.domNode.equivalentCreator = this;
        } else {
          this.domNode = this.createEmptyDomNode();
          this.domNode.id = aggregateToString(this);
          this.domNode.equivalentCreator = this;
          let scanFlow = this.equivalentCreator;
          while (scanFlow != null) {
            scanFlow.domNode = this.domNode;
            scanFlow = scanFlow.equivalentCreator;
          }
        }
        if (trace) log$2(this.domNode);
      }, { priority: 2 });
    }
    return this.domNode;
  }
  ensureDomNodeAttributesSet() {
    throw new Error("Not implemented yet!");
  }
  synchronizeDomNodeStyle(properties) {
    throw new Error("Not implemented yet!");
  }
  getStandardAnimation() {
    return null;
  }
}
const log$1 = console.log;
class DOMElementNode extends DOMNode {
  initialUnobservables() {
    let result = super.initialUnobservables();
    result.previouslySetStyles = {};
    result.previouslySetAttributes = {};
    return result;
  }
  setProperties({ children, tagName, attributes }) {
    this.children = children;
    this.tagName = tagName ? tagName : "div";
    this.attributes = attributes ? attributes : {};
  }
  createEmptyDomNode() {
    const result = document.createElement(this.tagName);
    return result;
  }
  ensureDomNodeAttributesSet() {
    const element = this.domNode;
    const newAttributes = this.attributes;
    const newPreviouslySetAttributes = {};
    if (this.tagName.toUpperCase() !== element.tagName) {
      throw new Error("Too high expectations error. Cannot change tagName of existing HTML element. Please do not change the tagName property once set!");
    }
    for (let property in this.unobservable.previouslySetAttributes) {
      if (typeof newAttributes[property] === "undefined") {
        if (property === "style") {
          this.updateStyle(element, {});
        } else {
          element[property] = "";
        }
      }
    }
    for (let property in newAttributes) {
      const newValue = newAttributes[property];
      if (property === "style") {
        this.updateStyle(element, newValue);
      } else {
        if (this.unobservable.previouslySetAttributes[property] !== newValue) {
          if (property === "class") {
            element.setAttribute("class", newValue);
          } else {
            element[property] = newValue;
          }
        }
        newPreviouslySetAttributes[property] = newValue;
      }
    }
    this.unobservable.previouslySetAttributes = newPreviouslySetAttributes;
  }
  updateStyle(element, newStyle) {
    const elementStyle = element.style;
    const newPreviouslySetStyles = {};
    for (let property in this.unobservable.previouslySetStyles) {
      if (typeof newStyle[property] === "undefined") {
        elementStyle[property] = "";
      }
    }
    for (let property in newStyle) {
      const newValue = newStyle[property];
      if (this.unobservable.previouslySetStyles[property] !== newValue) {
        elementStyle[property] = newValue;
      }
      newPreviouslySetStyles[property] = newValue;
    }
    this.unobservable.previouslySetStyles = newPreviouslySetStyles;
  }
  // getAnimatedFinishStyles() {
  //   const style = (this.attributes && this.attributes.style) ? this.attributes.style : {};
  //   const animation = this.animation ? this.animation : this.getAnimation();
  //   return extractProperties(style, animation.animatedProperties);
  // }
  synchronizeDomNodeStyle(properties) {
    if (!properties) {
      properties = Object.keys(this.unobservable.previouslySetAttributes);
      log$1(properties);
    }
    if (!(properties instanceof Array)) properties = [properties];
    const style = this.attributes && this.attributes.style ? this.attributes.style : {};
    const same = (styleValueA, styleValueB) => typeof styleValueA === "undefined" && typeof styleValueB === "undefined" || styleValueA === styleValueB;
    for (let property of properties) {
      if (typeof property === "string") {
        if (!same(style[property], this.domNode.style[property])) {
          this.domNode.style[property] = style[property] ? style[property] : "";
        }
      } else {
        const propertyCompoundValue = style[property.compound];
        if (propertyCompoundValue) {
          if (!same(propertyCompoundValue, this.domNode.style[property.compound])) {
            this.domNode.style[property.compound] = propertyCompoundValue ? propertyCompoundValue : "";
          }
        } else {
          const propertyPartialValues = {};
          property.partial.forEach((property2) => {
            if (style[property2]) {
              propertyPartialValues[property2] = style[property2];
            }
          });
          if (Object.keys(propertyPartialValues).length > 0) {
            Object.assign(this.domNode.style, propertyPartialValues);
          } else {
            this.domNode.style[property.compound] = "";
          }
        }
      }
    }
  }
}
domNodeClassRegistry["dom.elementNode"] = DOMElementNode;
class DOMTextNode extends DOMNode {
  setProperties({ text: text2 }) {
    this.text = text2;
  }
  createEmptyDomNode() {
    return document.createTextNode("");
  }
  ensureDomNodeAttributesSet() {
    this.domNode.nodeValue = this.text;
  }
  synchronizeDomNodeStyle(properties) {
  }
}
domNodeClassRegistry["dom.textNode"] = DOMTextNode;
function fitTextWithinWidth(text2, targetWidth, fontWeight) {
  if (!fontWeight) fontWeight = 400;
  let lowerLimitFontSize = 0;
  let experimentalFactor = 0.324;
  let guessFontSize = targetWidth * experimentalFactor;
  let guessWidth;
  let upperLimitFontSize = guessFontSize * 2;
  let iterations = 10;
  while (iterations-- > 0) {
    guessWidth = uncachedTextWidth(text2, guessFontSize, fontWeight);
    if (guessWidth == targetWidth) {
      return guessFontSize;
    } else if (guessWidth > targetWidth) {
      upperLimitFontSize = guessFontSize;
      guessFontSize = (guessFontSize + lowerLimitFontSize) / 2;
    } else if (guessWidth < targetWidth) {
      lowerLimitFontSize = guessFontSize;
      guessFontSize = (guessFontSize + upperLimitFontSize) / 2;
    }
  }
  return guessFontSize;
}
function fitTextWithinCapHeight(targetHeight) {
  const fontSize = targetHeight / getFontSizeToCapHeightRatio();
  return fontSize;
}
const textMeasures = {};
function textWidth(text2, styleOrFontSize) {
  return textDimensions(text2, styleOrFontSize).width;
}
function textHeight(text2, styleOrFontSize) {
  return textDimensions(text2, styleOrFontSize).height;
}
function textDimensions(text2, styleOrFontSize) {
  if (typeof styleOrFontSize === "undefined") styleOrFontSize = 13;
  if (typeof styleOrFontSize === "number") styleOrFontSize = { fontSize: styleOrFontSize };
  const style = styleOrFontSize;
  const fontSize = style.fontSize ? style.fontSize : 13;
  const fontWeight = style.fontWeight ? style.fontWeight : 400;
  const styleKey = fontSize + ":" + fontWeight;
  if (typeof textMeasures[styleKey] === "undefined") {
    textMeasures[styleKey] = uncachedTextDimensions(text2, fontSize, fontWeight);
  }
  const styleBucket = textMeasures[styleKey];
  if (typeof styleBucket[text2] === "undefined") {
    styleBucket[text2] = uncachedTextDimensions(text2, fontSize, fontWeight);
  }
  return styleBucket[text2];
}
function uncachedTextWidth(text2, fontSize, fontWeight) {
  return uncachedTextDimensions(text2, fontSize, fontWeight).width;
}
function uncachedTextHeight(text2, fontSize, fontWeight) {
  return uncachedTextDimensions(text2, fontSize, fontWeight).height;
}
function uncachedTextDimensions(text2, fontSize, fontWeight) {
  const parentElement = document.body;
  let div2 = document.createElement("div");
  div2.style["font-weight"] = fontWeight;
  div2.style["font-size"] = fontSize + "px";
  div2.style["white-space"] = "pre";
  div2.style["position"] = "absolute";
  div2.style["margin"] = "0px";
  div2.style["padding"] = "0px";
  div2.innerHTML = text2;
  parentElement.appendChild(div2);
  let width = div2.clientWidth + 1;
  let height = div2.scrollHeight + 1;
  parentElement.removeChild(div2);
  return {
    width,
    height
  };
}
let fontSizeToCapHeightRatio = null;
function capHeight(fontSize) {
  return Math.ceil(getFontSizeToCapHeightRatio() * fontSize);
}
function getFontSizeToCapHeightRatio() {
  if (!fontSizeToCapHeightRatio) {
    const fontSize = 60;
    const metrics = getMetrics("Roboto", fontSize + "px");
    fontSizeToCapHeightRatio = metrics.px.ascent / fontSize;
  }
  return fontSizeToCapHeightRatio;
}
function getGoldenRatioTopPadding(wrapperHeight, contentHeight) {
  const gRatio = 1.618;
  const emptySpace = wrapperHeight - contentHeight;
  return emptySpace - emptySpace / gRatio;
}
function getMetrics(fontName, fontSize) {
  let myCanvas = document.createElement("canvas");
  myCanvas.style["width"] = "200px";
  myCanvas.style["height"] = "200px";
  document.body.appendChild(myCanvas);
  let testtext = "Sixty Handgloves ABC";
  if (!document.defaultView.getComputedStyle) {
    throw "ERROR: 'document.defaultView.getComputedStyle' not found. This library only works in browsers that can report computed CSS values.";
  }
  let getCSSValue = function(element, property) {
    return document.defaultView.getComputedStyle(element, null).getPropertyValue(property);
  };
  CanvasRenderingContext2D.prototype.measureTextNew = function(textstring) {
    let metrics2 = this.measureText(textstring), fontFamily = getCSSValue(this.canvas, "font-family"), fontSize2 = getCSSValue(this.canvas, "font-size").replace("px", ""), isSpace = !/\S/.test(textstring);
    metrics2.fontsize = fontSize2;
    let leadDiv = document.createElement("div");
    leadDiv.style.position = "absolute";
    leadDiv.style.margin = 0;
    leadDiv.style.padding = 0;
    leadDiv.style.opacity = 0;
    leadDiv.style.font = fontSize2 + "px " + fontFamily;
    leadDiv.innerHTML = textstring + "<br/>" + textstring;
    document.body.appendChild(leadDiv);
    metrics2.leading = 1.2 * fontSize2;
    let leadDivHeight = getCSSValue(leadDiv, "height");
    leadDivHeight = leadDivHeight.replace("px", "");
    if (leadDivHeight >= fontSize2 * 2) {
      metrics2.leading = leadDivHeight / 2 | 0;
    }
    document.body.removeChild(leadDiv);
    if (!isSpace) {
      let canvas2 = document.createElement("canvas");
      let padding = 100;
      canvas2.width = metrics2.width + padding;
      canvas2.height = 3 * fontSize2;
      canvas2.style.opacity = 1;
      canvas2.style.fontFamily = fontFamily;
      canvas2.style.fontSize = fontSize2;
      let ctx = canvas2.getContext("2d");
      ctx.font = fontSize2 + "px " + fontFamily;
      let w2 = canvas2.width, h2 = canvas2.height, baseline = h2 / 2;
      ctx.fillStyle = "white";
      ctx.fillRect(-1, -1, w2 + 2, h2 + 2);
      ctx.fillStyle = "black";
      ctx.fillText(textstring, padding / 2, baseline);
      let pixelData = ctx.getImageData(0, 0, w2, h2).data;
      let i = 0, w4 = w2 * 4, len = pixelData.length;
      while (++i < len && pixelData[i] === 255) {
      }
      let ascent = i / w4 | 0;
      i = len - 1;
      while (--i > 0 && pixelData[i] === 255) {
      }
      let descent = i / w4 | 0;
      for (i = 0; i < len && pixelData[i] === 255; ) {
        i += w4;
        if (i >= len) {
          i = i - len + 4;
        }
      }
      let minx = i % w4 / 4 | 0;
      let step = 1;
      for (i = len - 3; i >= 0 && pixelData[i] === 255; ) {
        i -= w4;
        if (i < 0) {
          i = len - 3 - step++ * 4;
        }
      }
      let maxx = i % w4 / 4 + 1 | 0;
      metrics2.ascent = baseline - ascent;
      metrics2.descent = descent - baseline;
      metrics2.bounds = {
        minx: minx - padding / 2,
        maxx: maxx - padding / 2,
        miny: 0,
        maxy: descent - ascent
      };
      metrics2.height = 1 + (descent - ascent);
    } else {
      metrics2.ascent = 0;
      metrics2.descent = 0;
      metrics2.bounds = {
        minx: 0,
        maxx: metrics2.width,
        // Best guess
        miny: 0,
        maxy: 0
      };
      metrics2.height = 0;
    }
    return metrics2;
  };
  let wf = document.createElement("script");
  wf.src = ("https:" == document.location.protocol ? "https" : "http") + "://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js";
  wf.type = "text/javascript";
  wf.async = "true";
  let s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(wf, s);
  document.body.style.fontFamily = ['"' + fontName + '"', "Arial sans"].join(" ");
  let canvas = myCanvas;
  let context2 = canvas.getContext("2d");
  let w = 220, h = 220;
  canvas.style.font = [fontSize, fontName].join(" ");
  context2.font = [fontSize, fontName].join(" ");
  context2.clearRect(0, 0, canvas.width, canvas.height);
  context2.measureTextNew("x").height;
  context2.measureTextNew("H").height;
  let metrics = context2.measureTextNew("Hxy");
  let xStart = (w - metrics.width) / 2;
  context2.fontFamily = fontName;
  context2.fillStyle = "#FFAF00";
  context2.fillRect(xStart, h / 2 - metrics.ascent, metrics.bounds.maxx - metrics.bounds.minx, 1 + metrics.bounds.maxy - metrics.bounds.miny);
  context2.fillStyle = "#333333";
  context2.fillText(testtext, xStart, h / 2);
  metrics.fontsize = parseInt(metrics.fontsize);
  metrics.offset = Math.ceil((metrics.leading - metrics.height) / 2);
  let myMetrics = {
    px: JSON.parse(JSON.stringify(metrics)),
    relative: {
      fontsize: 1,
      offset: metrics.offset / metrics.fontsize,
      height: metrics.height / metrics.fontsize,
      capHeight: metrics.capHeight / metrics.fontsize,
      ascender: metrics.ascender / metrics.fontsize,
      xHeight: metrics.xHeight / metrics.fontsize,
      descender: metrics.descender / metrics.fontsize
    },
    descriptions: {
      ascent: "distance above baseline",
      descent: "distance below baseline",
      height: "ascent + 1 for the baseline + descent",
      leading: "distance between consecutive baselines",
      bounds: {
        minx: "can be negative",
        miny: "can also be negative",
        maxx: "not necessarily the same as metrics.width",
        maxy: "not necessarily the same as metrics.height"
      },
      capHeight: "height of the letter H",
      ascender: "distance above the letter x",
      xHeight: "height of the letter x (1ex)",
      descender: "distance below the letter x"
    }
  };
  Array.prototype.slice.call(
    document.getElementsByTagName("canvas"),
    0
  ).forEach(function(c, i) {
    if (i > 0) document.body.removeChild(c);
  });
  document.body.removeChild(myCanvas);
  return myMetrics;
}
const log = console.log;
class FlyFromTopDOMNodeAnimation extends ZoomFlyDOMNodeAnimation {
  constructor() {
    super(...arguments);
    __publicField(this, "animateLeaderWidth", false);
    __publicField(this, "animateLeaderHeight", true);
  }
  emulateOriginalFootprintsAndFixateAnimatedStyle(flow) {
    console.group("Emulate original style and footprints for " + this.changesChain(flow) + ": " + flow.toString());
    const node = flow.domNode;
    const trailer = node.trailer;
    switch (flow.changes.type) {
      case changeType.added:
      case changeType.moved:
        this.setupALeaderForIncomingWithOriginalFootprint(node);
        break;
    }
    switch (flow.changes.type) {
      case changeType.removed:
        if (node.parentNode !== trailer) {
          trailer.appendChild(node);
        }
        if (trailer) this.show(trailer);
        break;
      case changeType.moved:
        if (trailer) this.show(trailer);
        break;
    }
    if (node.ongoingAnimation) {
      this.fixateOriginalInheritedStyles(node);
      switch (flow.changes.type) {
        case changeType.resident:
          break;
        case changeType.added:
          this.fixateOriginalTransformAndOpacity(node);
          break;
        case changeType.removed:
          this.fixateOriginalTransformAndOpacity(node);
          break;
        case changeType.moved:
          this.fixateOriginalTransformAndOpacity(node);
          break;
      }
    } else {
      switch (flow.changes.type) {
        case changeType.resident:
          break;
        case changeType.added:
          this.originalPositionForFlyIn(node);
          break;
        case changeType.removed:
          this.originalPositionForZoomOut(node);
          break;
        case changeType.moved:
          this.fixateOriginalInheritedStyles(node);
          this.originalPositionForMoveAndResize(node);
          break;
      }
    }
    console.groupEnd();
  }
  originalPositionForFlyIn(node) {
    Object.assign(node.style, {
      position: "absolute",
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.targetDimensions.heightWithoutMargin + ")",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  activateAnimation(flow) {
    const node = flow.domNode;
    const ongoingAnimation = node.ongoingAnimation;
    flow.changes;
    const trailer = node.trailer;
    const leader = node.leader;
    console.group("Activate for " + this.changesChain(flow) + ": " + flow.toString());
    log(extractProperties(node.style, this.typicalAnimatedProperties));
    if (node.leader) {
      log(extractProperties(node.leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    if (ongoingAnimation) {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
          }
          break;
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          break;
        case changeType.removed:
          this.targetPositionForFlyOut(node);
          this.targetSizeForTrailer(node.trailer);
          break;
      }
    } else {
      switch (flow.changes.type) {
        case changeType.added:
          this.targetPositionForZoomIn(node);
          this.targetSizeForLeader(node, node.leader);
          if (trailer) throw new Error("Internal error, should not happen!");
          this.startAnimationChain(node);
          break;
        case changeType.resident:
          if (flow.outOfPosition) {
            this.startAnimationChain(node);
            delete flow.outOfPosition;
            this.targetPositionForMovingInsideContainer(node);
          }
          break;
        case changeType.moved:
          this.targetPositionForMoved(node);
          this.targetSizeForLeader(node, node.leader);
          if (node.trailer) this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break;
        case changeType.removed:
          this.targetPositionForFlyOut(node);
          this.targetSizeForTrailer(node.trailer);
          this.startAnimationChain(node);
          break;
      }
    }
    log(extractProperties(flow.domNode.style, this.typicalAnimatedProperties));
    if (leader) {
      log(extractProperties(leader.style, this.typicalAnimatedProperties));
    }
    if (node.trailer) {
      log(extractProperties(node.trailer.style, this.typicalAnimatedProperties));
    }
    console.groupEnd();
  }
  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, 0, -" + node.changes.originalDimensions.heightWithoutMargin + ")",
      opacity: "1"
    });
  }
}
class FlyFromLeftDOMNodeAnimation extends FlyFromTopDOMNodeAnimation {
  constructor() {
    super(...arguments);
    __publicField(this, "animateLeaderWidth", true);
    __publicField(this, "animateLeaderHeight", false);
  }
  originalPositionForFlyIn(node) {
    Object.assign(node.style, {
      position: "absolute",
      transform: "matrix(1, 0, 0, 1, -" + node.changes.targetDimensions.widthWithoutMargin + ", 0)",
      //transform, //"matrix(1, 0, 0, 1, 0, 0)", //
      // This is to make the absolute positioned added node to have the right size.
      width: node.changes.targetDimensions.widthWithoutMargin + "px",
      height: node.changes.targetDimensions.heightWithoutMargin + "px",
      // Note: Added can have target dimensions at this stage, because it is transformed into a point. 
      opacity: "0.001"
    });
  }
  targetPositionForFlyOut(node) {
    node.style.transition = this.removeTransition();
    Object.assign(node.style, {
      transform: "matrix(1, 0, 0, 1, -" + node.changes.originalDimensions.widthWithoutMargin + ", 0)",
      opacity: "1"
    });
  }
}
const flyFromTopAnimation = new FlyFromTopDOMNodeAnimation();
const flyFromLeftAnimation = new FlyFromLeftDOMNodeAnimation();
export {
  Component,
  DOMElementNode,
  DOMFlowTarget,
  DOMNode,
  DOMNodeAnimation,
  DOMTextNode,
  FlowPrimitive,
  FlowTarget,
  ZoomFlyDOMNodeAnimation,
  activeTrace,
  activeTraceModel,
  addDefaultStyleToProperties,
  aggregateToString,
  callback,
  camelCase,
  camelCased,
  capHeight,
  changeType,
  clearNode,
  component,
  configuration,
  continueInvalidations,
  creators,
  deepFreeze,
  deeplyObservable,
  div,
  draw,
  elemenNode,
  eventHandlerContentElementAttributesCamelCase,
  extractAttributes,
  extractChildStyles,
  extractProperties,
  extractProperty,
  finalize,
  findBuildInProperties,
  findKeyInProperties,
  findTextAndKeyInProperties,
  findTextAndKeyInPropertiesUsingCase,
  findTextKeyAndOnClickInProperties,
  fitTextWithinCapHeight,
  fitTextWithinWidth,
  flowChanges,
  flyFromLeftAnimation,
  flyFromTopAnimation,
  freezeFlowChanges,
  getCreator,
  getFontSizeToCapHeightRatio,
  getGoldenRatioTopPadding,
  getHeightIncludingMargin,
  getTarget,
  getTheme,
  getWidthIncludingMargin,
  globalElementAttributesCamelCase,
  insertAfter,
  installDOMAnimation,
  invalidateOnChange$1 as invalidateOnChange,
  isObservable,
  isUpperCase,
  log$5 as log,
  logAnimationFrameEnd,
  logAnimationFrameGroup,
  logAnimationSeparator,
  logMark,
  logProperties,
  model,
  mostAbstractFlow,
  observable,
  onFinishReBuildingDOM,
  onFinishReBuildingFlow,
  parseMatrix,
  postponeInvalidations,
  previousFlowChanges,
  readFlowProperties$1 as readFlowProperties,
  repeat,
  resetDOMAnimation,
  sameAsPreviousDeep,
  sameBounds,
  setAnimationTime,
  setFlowConfiguration,
  span,
  standardAnimation,
  state,
  styledDiv,
  text,
  textDimensions,
  textHeight,
  textNode,
  textToTextNode,
  textWidth,
  trace,
  traceAnimation,
  traceWarnings,
  transaction,
  uncachedTextDimensions,
  uncachedTextHeight,
  uncachedTextWidth,
  unfreezeFlowChanges,
  when,
  withoutRecording,
  workOnPriorityLevel,
  world,
  zoomFlyAnimation
};
