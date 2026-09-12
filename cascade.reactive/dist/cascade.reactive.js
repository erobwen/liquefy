function oe(o) {
  return Array.prototype.slice.call(o);
}
function ve(o, r) {
  if (r instanceof Array) {
    tn(o.causality.target, r.causality.target).forEach(function(O) {
      let b = [];
      b.push(O.index, O.removed.length), b.push.apply(b, O.added), o.splice.apply(o, b);
    });
    for (let O in r)
      isNaN(O) && (o[O] = r[O]);
  } else
    for (let u in r)
      o[u] = r[u];
  return o;
}
function tn(o, r) {
  let u = !1, O = [], b = 0, w = 0, T = 0;
  function m(d) {
    let h = {
      type: "splice",
      index: b + T,
      removed: [],
      added: d
    };
    T += d.length, O.push(h);
  }
  function a(d) {
    let h = {
      type: "splice",
      index: b + T,
      removed: d,
      added: []
    };
    T -= d.length, O.push(h);
  }
  function p(d, h) {
    let y = {
      type: "splice",
      index: b + T,
      removed: d,
      added: h
    };
    T -= d.length, T += h.length, O.push(y);
  }
  for (; !u; ) {
    for (; b < o.length && w < r.length && o[b] === r[w]; )
      b++, w++;
    if (b === o.length && w === r.length)
      u = !0;
    else if (w === r.length) {
      const d = [];
      let h = b;
      for (; h < o.length; )
        d.push(o[h++]);
      a(d), u = !0;
    } else if (b === o.length) {
      const d = [];
      for (; w < r.length; )
        d.push(r[w++]);
      m(d), u = !0;
    } else {
      let d = b, h = w, y = !1;
      for (; d < o.length && !y; ) {
        for (h = w; h < r.length && !y; )
          o[d] === r[h] && (y = !0), y || h++;
        y || d++;
      }
      p(
        o.slice(b, d),
        r.slice(w, h)
      ), b = d, w = h;
    }
  }
  return O;
}
function nn(o) {
  return o.name ? o.name : (o = Qe(o), JSON.stringify(o));
}
function Qe(o) {
  if (typeof o == "object") {
    if (o === null) return "null";
    let r = Object.keys(o);
    r.sort(function(O, b) {
      return O < b ? -1 : O > b ? 1 : 0;
    });
    let u = {};
    return r.forEach(function(O) {
      let b = o[O];
      typeof b == "object" && (b = Qe(b)), u[O] = b;
    }), u;
  } else
    return "[" + typeof o + "]";
}
const Je = {
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
let P = {
  // Count the number of chars that can fit horizontally in your buffer. Set to -1 for one line logging only. 
  bufferWidth: 83,
  // bufferWidth : 83
  // bufferWidth : 76
  indentToken: "  ",
  // Change to true in order to find all logs hidden in your code.
  findLogs: !1,
  // Set to true in web browser that already has a good way to display objects with expandable trees.
  useConsoleDefault: !1
}, $ = 0;
function rn() {
  function o(r) {
    return r ? o(r.caller).concat([r.toString().split("(")[0].substring(9) + "(" + r.arguments.join(",") + ")"]) : [];
  }
  return o(arguments.callee.caller);
}
function xe(o) {
  let r = "";
  for (; o-- > 0; )
    r = r + P.indentToken;
  return r;
}
function we() {
  const o = {
    terminated: !1,
    rootLevel: !0,
    horizontal: !1,
    indentLevel: $,
    unfinishedLine: !1
  };
  return o.resetColor = () => {
    o.setColor("Reset");
  }, o;
}
function on() {
  let o = we();
  return o.result = "", o.log = function(r) {
    this.unfinishedLine ? (this.result += r, this.unfinishedLine = !0) : (this.result += xe(this.indentLevel) + r, this.unfinishedLine = !0);
  }, o.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (this.result += `
`, this.unfinishedLine = !1);
  }, o.setColor = function() {
  }, o.jsonCompatible = !0, o;
}
function le() {
  let o = we();
  return o.lineMemory = "", o.log = function(r) {
    if (this.unfinishedLine)
      typeof process < "u" ? process.stdout.write(r) : o.lineMemory += r, this.unfinishedLine = !0;
    else {
      let u = xe(this.indentLevel);
      typeof process < "u" ? process.stdout.write(u + r) : o.lineMemory += u + r, this.unfinishedLine = !0;
    }
  }, o.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (o.lineMemory !== "" ? (console.log(o.lineMemory), o.lineMemory = "") : console.log(), this.unfinishedLine = !1);
  }, o.setColor = function(r) {
    Je[r] || (r = "Reset"), o.log(Je[r]);
  }, o.jsonCompatible = !1, o;
}
function ln(o, r) {
  let u = we();
  return u.horizontal = !0, u.count = 0, u.limit = o, u.log = function(O) {
    if (this.unfinishedLine)
      this.count += O.length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    else {
      let b = xe(this.indentLevel);
      this.count += (b + O).length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    }
  }, u.finishOpenLine = function() {
  }, u.setColor = function() {
  }, u.jsonCompatible = r.jsonCompatible, u;
}
function Ze(o, r, u, O) {
  let b = ln(u, O);
  return H(o, r, b), !b.terminated;
}
function H(o, r, u) {
  const O = u.rootLevel, b = u.jsonCompatible;
  if (u.rootLevel = !1, typeof r > "u" && (r = 1), typeof r == "function" && (o = r(o), r = -1), !u.terminated) {
    if (typeof o != "object")
      if (typeof o == "function")
        u.setColor("FgBlue"), u.log("function( ... ) { ... }"), u.resetColor();
      else if (typeof o == "string")
        if (O)
          u.log(o);
        else {
          u.setColor("FgGreen");
          const w = b ? '"' : "'";
          u.log(w + o + w), u.resetColor();
        }
      else
        u.setColor("FgYellow"), u.log(o + ""), u.resetColor();
    else if (o === null)
      u.log("null");
    else if (r === 0)
      o instanceof Array ? (u.log("["), u.setColor("FgCyan"), u.log("..."), u.resetColor(), u.log("]")) : (u.log("{"), u.setColor("FgCyan"), u.log("..."), u.resetColor(), u.log("}"));
    else {
      let w = o instanceof Array;
      const T = Object.keys(o).length;
      let m = !1;
      if (!u.horizontal) {
        let p = P.bufferWidth - u.indentLevel * P.indentToken.length;
        u.horizontal = P.bufferWidth === -1 ? !0 : Ze(o, r, p, u), m = u.horizontal;
      }
      w && u.finishOpenLine(), u.log(w ? "[" : "{"), u.horizontal && T && u.log(" "), u.finishOpenLine(), u.indentLevel++;
      let a = !0;
      for (let p in o) {
        a || (u.log(", "), u.finishOpenLine()), (!w || isNaN(p)) && (b && u.log('"'), u.log(p), b && u.log('"'), u.log(": "));
        let d = null;
        typeof r == "object" ? d = r[p] : d = r === -1 ? -1 : r - 1, w || u.indentLevel++, H(o[p], d, u), w || u.indentLevel--, a = !1;
      }
      u.indentLevel--, u.finishOpenLine(), u.horizontal && T && u.log(" "), u.log(w ? "]" : "}"), m && (u.horizontal = !1);
    }
    O && u.finishOpenLine();
  }
}
const J = {
  // Configuration
  configuration: P,
  stacktrace: rn,
  log(o, r) {
    if (J.findLogs) throw new Error("No logs allowed!");
    P.useConsoleDefault ? console.log(o) : H(o, r, le());
  },
  // If you need the output as a string.
  logToString(o, r) {
    let u = on();
    return H(o, r, u), u.result;
  },
  loge(o) {
    this.log("<<<" + o + ">>>");
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
  logVar(o, r, u) {
    if (J.findLogs) throw new Error("No logs allowed!");
    if (P.useConsoleDefault)
      console.log(o + ":"), console.group(), console.log(r), console.groupEnd();
    else {
      context = le(), typeof u > "u" && (u = 1), context.log(o + ": ");
      let O = P.bufferWidth - context.indentLevel * P.indentToken.length - (o + ": ").length;
      context.horizontal = P.bufferWidth === -1 ? !0 : Ze(r, u, O), context.horizontal ? H(r, u, context) : (context.indentLevel++, H(r, u, context), context.indentLevel--);
    }
  },
  group(o, r) {
    if (J.findLogs) throw new Error("No logs allowed!");
    P.useConsoleDefault ? console.group(o) : (typeof o < "u" && H(o, r, le()), $++);
  },
  groupEnd(o, r) {
    if (J.findLogs) throw new Error("No logs allowed!");
    P.useConsoleDefault ? console.groupEnd() : ($--, $ < 0 && ($ = 0), typeof o < "u" && H(o, r, le()));
  }
};
function sn(o) {
  function r(p, d) {
    if (typeof p != typeof d)
      return !1;
    if (p.length === d.length) {
      for (let h = 0; h < p.length; h++)
        if (p[h] !== d[h])
          return !1;
      return !0;
    } else
      return !1;
  }
  function u(p, d) {
    if (p.length === 0)
      return !1;
    for (let h = 0; h < p.length; h++)
      if (r(
        p[h].argumentList,
        d
      ))
        return !0;
    return !1;
  }
  function O(p, { signature: d, unique: h, argumentList: y }) {
    return h ? typeof p[d] < "u" : typeof p[d] > "u" ? !1 : u(p[d], y);
  }
  function b(p, { signature: d, unique: h, argumentList: y }) {
    if (h)
      return p[d];
    {
      let C = p[d];
      for (let R = 0; R < C.length; R++)
        if (r(C[R].argumentList, y))
          return C[R].value;
    }
  }
  function w(p, { signature: d, unique: h, argumentList: y }) {
    if (h) {
      delete p[d];
      return;
    } else {
      let C = p[d];
      for (let R = 0; R < C.length; R++)
        if (r(C[R].argumentList, functionArguments)) {
          C.splice(R, 1);
          return;
        }
    }
  }
  function T(p, { signature: d, unique: h, argumentList: y }, C) {
    if (h)
      p[d] = C;
    else {
      let R = p[d];
      R || (R = o([]), p[d] = R), R.push({ argumentList: y, value: C });
    }
  }
  function m(p) {
    let d = !0, h = "";
    return p.forEach(function(y, C) {
      C > 0 && (h += ","), typeof y.causality < "u" ? h += "{id=" + y.causality.id + "}" : typeof y == "number" || typeof y == "string" ? h += y : (d = !1, h += "{}");
    }), { signature: "(" + h + ")", unique: d, argumentList: p };
  }
  function a(p) {
    const d = o({});
    return () => {
      argumentsToArray(arguments);
      let h = m(argumentList);
      return O(d, h) || invalidateOnChange(
        () => {
          const y = p.apply(null, argumentList);
          T(d, h, y);
        },
        () => {
          w(d, h);
        }
      ), b(d, h);
    };
  }
  return a;
}
let Ve = 500;
function un(o) {
  const r = o.state, u = o.invalidateObserver;
  function O(m, a, p) {
    return typeof a != "string" && (p = a, a = null), {
      description: m,
      key: a,
      handler: p,
      isRoot: !0,
      contents: {},
      contentsCounter: 0,
      first: null,
      last: null
    };
  }
  function b(m, a, p) {
    let d = m.id;
    if (typeof a.contents[d] < "u" || a.contentsCounter === Ve && a.last !== null && (a = a.last, typeof a.contents[d] < "u"))
      return;
    if (a.contentsCounter === Ve) {
      let y = {
        isRoot: !1,
        contents: {},
        contentsCounter: 0,
        next: null,
        previous: null,
        parent: null
      };
      a.isRoot ? (y.parent = a, a.first = y, a.last = y) : (a.next = y, y.previous = a, y.parent = a.parent, a.parent.last = y), a = y;
    }
    let h = a.contents;
    typeof h[d] > "u" && (a.contentsCounter = a.contentsCounter + 1, h[d] = m, m.sources.push(a));
  }
  function w(m, a, p) {
    if (r.postponeInvalidation++, r.blockInvalidation > 0)
      return;
    let d = m.contents;
    for (let h in d)
      u(d[h], a, p);
    if (typeof m.first < "u") {
      let h = m.first;
      for (; h !== null; ) {
        let y = h.contents;
        for (let C in y)
          u(y[C], a, p);
        h = h.next;
      }
    }
    r.postponeInvalidation--, o.proceedWithPostponedInvalidations();
  }
  function T(m, a) {
    let p = a.contents;
    delete p[m];
    let d = !1;
    a.contentsCounter--, a.contentsCounter == 0 && (a.isRoot ? a.first === null && a.last === null && (d = !0) : (a.parent.first === a && (a.parent.first, a.next), a.parent.last === a && (a.parent.last, a.previous), a.next !== null && (a.next.previous = a.previous), a.previous !== null && (a.previous.next = a.next), a.previous = null, a.next = null, a.parent.first === null && a.parent.last === null && (d = !0)), d && typeof a.handler.proxy.onRemovedLastObserver == "function" && a.handler.proxy.onRemovedLastObserver(a.description, a.key));
  }
  return {
    recordDependencyOnArray: (m, a) => {
      a._arrayObservers === null && (a._arrayObservers = O("arrayDependees", a)), b(m, a._arrayObservers);
    },
    recordDependencyOnEnumeration: (m, a) => {
      const p = o.getOrCreateEnumerationTimelineWriting(a);
      p.observers === null && (p.observers = O("enumerationDependees", a)), b(m, p.observers);
    },
    recordDependencyOnProperty: (m, a, p, d, h) => {
      if (p === "toString") return;
      const y = o.getOrCreateTimelineWriting(a, p, d, h);
      y.observers === null && (y.observers = O("propertyDependees", p, a)), b(m, y.observers);
    },
    invalidateArrayObservers: (m, a) => {
      m._arrayObservers !== null && w(m._arrayObservers, m.proxy, a);
    },
    invalidatePropertyObservers: (m, a, p, d) => {
      const h = m.timelines[a];
      if (typeof h > "u") return;
      const y = o.seekTimelineWriting(h, p, d);
      y.observers !== null && w(y.observers, m.proxy, a);
    },
    invalidateWritingObservers: (m, a, p) => {
      m.observers !== null && w(m.observers, a, p);
    },
    invalidateEnumerateObservers: (m, a) => {
      const p = m.timelines[o.enumerationTimelineKey];
      typeof p < "u" && p.first.observers !== null && w(p.first.observers, m.proxy, a);
    },
    removeAllSources: (m) => {
      const a = m.id;
      m.sources.forEach(function(p) {
        T(a, p);
      }), m.sources.length = 0;
    }
  };
}
const an = J, fn = {
  requireRepeaterName: !1,
  requireInvalidatorName: !1,
  warnOnNestedRepeater: !0,
  alwaysDependOnParentRepeater: !1,
  timeLevels: 4,
  // How many neighbors a partial-chain pressure-release blast will visit
  // (see releaseChainPressure() / docs/plan-partial-repeaters.md) before
  // giving up on reaching the ideal density and just redistributing
  // whatever it's collected so far.
  chainBlastRadius: 10,
  objectMetaProperty: "causality",
  objectTimelinesProperty: "timelines",
  useNonObservablesAsValues: !1,
  valueComparisonDepthLimit: 5,
  sendEventsToObjects: !0,
  // Reserved properties that you can override on observables IF sendEventsToObjects is set to true. 
  // onChange
  // onBuildCreate
  // onBuildRemove
  onEventGlobal: null,
  emitReBuildEvents: !1,
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
function dn(o) {
  const r = {
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
    inActiveRecording: !1,
    nextObserverToInvalidate: null,
    lastObserverToInvalidate: null,
    // Repeaters
    inRepeater: null,
    dirtyRepeaters: [...Array(o.timeLevels).keys()].map(() => ({ first: null, last: null })),
    refreshingAllDirtyRepeaters: !1,
    workOnTimeLevel: [...Array(o.timeLevels).keys()].map(() => 0),
    revalidationTimeLock: -1
  }, u = Symbol("timelines.enumeration"), O = {
    name: o.name,
    sameAsPreviousDeep: ae,
    // Main API
    observable: te,
    deeplyObservable: he,
    isObservable: D,
    create: te,
    // observable alias
    invalidateOnChange: Bt,
    repeat: Gt,
    linkRepeater: Kt,
    finalize: zt,
    // Modifiers
    withoutRecording: Ce,
    withoutReactions: ot,
    // Transaction
    doWhileInvalidationsPostponed: Ie,
    transaction: Ie,
    postponeInvalidations: it,
    continueInvalidations: rt,
    // Debugging and testing
    clearRepeaterLists: Ut,
    // Logging (these log commands do automatic withoutRecording to avoid your logs destroying your test-setup) 
    log: Jt,
    loge: (e) => {
      W.loge(e);
    },
    // "event"
    logs: () => {
      W.logs();
    },
    // "separator"
    logss: () => {
      W.logss();
    },
    logsss: () => {
      W.logss();
    },
    logGroup: Vt,
    logUngroup: Qt,
    logToString: Zt,
    // Advanced (only if you know what you are doing, typically used by plugins to causality)
    state: r,
    enterContext: _,
    leaveContext: U,
    invalidateObserver: St,
    getOrCreateTimelineWriting: de,
    getOrCreateEnumerationTimelineWriting: Rt,
    seekTimelineWriting: X,
    enumerationTimelineKey: u,
    proceedWithPostponedInvalidations: ge,
    nextObserverId: () => r.observerId++,
    // Libraries
    caching: sn(te),
    // Time levels 
    enterTimeLevel: G,
    exitTimeLevel: K,
    workOnTimeLevel: lt
  }, b = o.customCreateRepeater ? o.customCreateRepeater : Ht, w = o.customCreateInvalidator ? o.customCreateInvalidator : Wt, T = o.customDependencyInterfaceCreator ? o.customDependencyInterfaceCreator(O) : un(O), m = T.recordDependencyOnArray, a = T.recordDependencyOnEnumeration, p = T.recordDependencyOnProperty, d = T.invalidateArrayObservers, h = T.invalidateEnumerateObservers, y = T.invalidatePropertyObservers, C = T.invalidateWritingObservers, R = T.removeAllSources, W = o.customObjectlog ? o.customObjectlog : an, Te = st(), {
    requireRepeaterName: ke,
    requireInvalidatorName: et,
    warnOnNestedRepeater: tt,
    objectMetaProperty: c,
    objectTimelinesProperty: se,
    sendEventsToObjects: Re,
    onEventGlobal: ue,
    emitReBuildEvents: nt,
    onWriteGlobal: L,
    onReadGlobal: I,
    cannotReadPropertyValue: B
  } = o, N = !!ue || Re;
  function Ce(e) {
    r.recordingPaused++, M();
    const t = e();
    return r.recordingPaused--, M(), t;
  }
  function Ie(e) {
    r.postponeInvalidation++, e(), r.postponeInvalidation--, ge();
  }
  function it() {
    r.postponeInvalidation++;
  }
  function rt() {
    r.postponeInvalidation--, ge();
  }
  function ot(e) {
    r.blockInvalidation++, e(), r.blockInvalidation--;
  }
  function G(e) {
    if (typeof e != "number") {
      const t = e;
      e = typeof t.time == "function" ? t.time() : 0;
    }
    r.workOnTimeLevel[e]++;
  }
  function K(e) {
    if (typeof e != "number") {
      const n = e;
      e = typeof n.time == "function" ? n.time() : 0;
    }
    r.workOnTimeLevel[e]--;
    let t = !0;
    for (; e < r.workOnTimeLevel.length && r.workOnTimeLevel[e] === 0; )
      typeof o.onFinishedTimeLevel == "function" && o.onFinishedTimeLevel(e, t), r.revalidationTimeLock = e, e++, t = !1;
  }
  function lt(e, t) {
    G(e), t(), K(e);
  }
  function M() {
    r.inActiveRecording = r.context !== null && r.context.isRecording && r.recordingPaused === 0, r.inRepeater = r.context && r.context.type === "partial" ? r.context.repeater : null;
  }
  function _(e) {
    return e.parent = r.context, r.context = e, M(), G(e), e;
  }
  function U(e) {
    if (r.context && e === r.context)
      r.context = r.context.parent;
    else
      throw new Error("Context missmatch");
    M(), K(e);
  }
  function st() {
    const e = {
      pop: function() {
        let t = this.target.length - 1, n = this.target.pop();
        return d(this, "pop"), N && z(this, t, [n], null), n;
      },
      push: function() {
        let t = this.target.length, n = oe(arguments);
        return this.target.push.apply(this.target, n), d(this, "push"), N && z(this, t, null, n), this.target.length;
      },
      shift: function() {
        let t = this.target.shift();
        return d(this, "shift"), N && z(this, 0, [t], null), t;
      },
      unshift: function() {
        let t = oe(arguments);
        return this.target.unshift.apply(this.target, t), d(this, "unshift"), N && z(this, 0, null, t), this.target.length;
      },
      splice: function() {
        let t = oe(arguments), n = t[0], i = t[1];
        typeof t[1] > "u" && (i = this.target.length - n);
        let s = t.slice(2), l = this.target.slice(n, n + i), f = this.target.splice.apply(this.target, t);
        return d(this, "splice"), N && z(this, n, l, s), f;
      },
      copyWithin: function(t, n, i) {
        if (n || (n = 0), i || (i = this.target.length), t < 0 && (n = this.target.length - t), n < 0 && (n = this.target.length - n), i < 0 && (n = this.target.length - i), i = Math.min(i, this.target.length), n = Math.min(n, this.target.length), n >= i)
          return;
        let s = this.target.slice(t, t + i - n), l = this.target.slice(n, i), f = this.target.copyWithin(t, n, i);
        return d(this, "copyWithin"), N && z(this, t, l, s), f;
      }
    };
    return ["reverse", "sort", "fill"].forEach(function(t) {
      e[t] = function() {
        let n = oe(arguments), i = this.target.slice(0), s = this.target[t].apply(this.target, n);
        return d(this, t), N && z(this, 0, i, this.target.slice(0)), s;
      };
    }), e;
  }
  function Ae(e, t) {
    return o.useNonObservablesAsValues ? ae(e, t, o.valueComparisonDepthLimit) : e === t || Number.isNaN(e) && Number.isNaN(t);
  }
  function ae(e, t, n) {
    if (typeof n > "u" && (n = 8), e === null && t === null || e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
    if (n === 0 || typeof e != typeof t || typeof e != "object" || e === null || t === null || D(e) || D(t) || Object.keys(e).length !== Object.keys(t).length) return !1;
    for (let i in e)
      if (!ae(e[i], t[i], n - 1))
        return !1;
    return !0;
  }
  function ut(e, t) {
    if (t === c)
      return this.meta;
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[c].handler;
      return n.get.apply(n, [n.target, t]);
    }
    return I && !I(this, e, t) ? B : Te[t] ? Te[t].bind(this) : (r.inActiveRecording && m(r.context, this), e[t]);
  }
  function at(e, t, n) {
    if (t === c) throw new Error("Cannot set the dedicated meta property '" + c + "'");
    if (this.meta.forwardTo !== null) {
      let s = this.meta.forwardTo[c].handler;
      return s.set.apply(s, [s.target, t, n]);
    }
    if (L && !L(this, e, t))
      return;
    let i = e[t];
    return t in e && Ae(i, n) ? !0 : (isNaN(t) ? (e[t] = n, (e[t] === n || Number.isNaN(e[t]) && Number.isNaN(n)) && (d(this, t), We(this, t, n, i))) : (typeof t == "string" && (t = parseInt(t)), e[t] = n, (e[t] === n || Number.isNaN(e[t]) && Number.isNaN(n)) && (d(this, t), Dt(this, t, n, i))), !(e[t] !== n && !(Number.isNaN(e[t]) && Number.isNaN(n))));
  }
  function ft(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[c].handler;
      return i.deleteProperty.apply(
        i,
        [i.target, t]
      );
    }
    if (L && !L(this, e, t))
      return;
    if (!(t in e))
      return !0;
    let n = e[t];
    return delete e[t], t in e || (d(this, "delete"), Be(this, t, n)), !(t in e);
  }
  function dt(e) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[c].handler;
      return n.ownKeys.apply(
        n,
        [n.target]
      );
    }
    if (I && !I(this, e))
      return B;
    r.inActiveRecording && m(r.context, this);
    let t = Object.keys(e);
    return t.push("length"), t;
  }
  function ct(e, t) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[c].handler;
      return n.has.apply(n, [e, t]);
    }
    return I && !I(this, e, t) ? B : (r.inActiveRecording && m(r.context, this), t in e);
  }
  function pt(e, t, n) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[c].handler;
      return i.defineProperty.apply(
        i,
        [i.target, t, n]
      );
    }
    if (!(L && !L(this, e, t)))
      return d(this, t), e;
  }
  function ht(e, t) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[c].handler;
      return n.getOwnPropertyDescriptor.apply(
        n,
        [n.target, t]
      );
    }
    return I && !I(this, e, t) ? B : (r.inActiveRecording && m(r.context, this), Object.getOwnPropertyDescriptor(e, t));
  }
  function fe(e, t) {
    return {
      time: e,
      // Which partial (or null, for external code) actually made this
      // writing - the tie-breaker when two writings share the same
      // declared `time` number (a parent and child defaulting to the same
      // level, most commonly) - see comparePositions()/compareWriterOrder()
      // below.
      writer: typeof t > "u" ? null : t,
      value: void 0,
      set: !1,
      observers: null,
      timeline: null,
      next: null,
      previous: null
    };
  }
  function gt(e, t) {
    const n = fe(0, null), i = {
      key: t,
      handler: e,
      first: n,
      last: n,
      // Cache pointer at the writing a reader/writer should start seeking
      // from - amortizes the common case where reads/writes at nearby
      // times cluster together, instead of always walking from `first`.
      currentWriting: n
    };
    return n.timeline = i, i;
  }
  function Ne(e) {
    const t = fe(0, null);
    t.timeline = e, e.first = t, e.last = t, e.currentWriting = t;
  }
  function V(e, t) {
    let n = e.timelines[t];
    return typeof n > "u" ? n = e.timelines[t] = gt(e, t) : n.first === null && Ne(n), n;
  }
  function mt() {
    return {
      id: r.observerId++,
      count: 0,
      // live partials currently occupying a chain slot
      first: null,
      // lowest orderNumber
      last: null,
      // highest orderNumber
      // The most recently activated partial anywhere in this chain - an
      // O(1) predecessor for the next brand-new insertion, valid because
      // execution within one root tree is always synchronous and
      // depth-first (see createNextPartial()/attachToCurrentParent()).
      executionCursor: null
    };
  }
  const Q = Number.MAX_SAFE_INTEGER, Ee = Math.floor((Q - 1) / 2);
  function je(e) {
    const t = e.count / Q;
    return t < 0.25 ? 65536 : t < 0.75 ? 256 : 1;
  }
  function yt(e, t) {
    if (e.count >= Ee)
      throw new Error("Partial chain exhausted its order-number space (" + Ee + " live partials)");
    const n = e.executionCursor, i = n !== null ? n.orderNext : null;
    let s;
    if (n === null)
      s = 0;
    else if (i === null)
      s = n.orderNumber + je(e);
    else {
      const l = je(e), f = n.orderNumber + l;
      s = f < i.orderNumber ? f : Math.floor((n.orderNumber + i.orderNumber) / 2);
    }
    t.orderNumber = s, t.orderPrevious = n, t.orderNext = i, n !== null ? n.orderNext = t : e.first = t, i !== null ? i.orderPrevious = t : e.last = t, e.count++, e.executionCursor = t, i !== null && (s - n.orderNumber <= 1 || i.orderNumber - s <= 1) && bt(e, t);
  }
  function bt(e, t) {
    const n = t.orderNumber, i = o.chainBlastRadius;
    let s = t, l = t, f = 0, g = 0, v = 1, x = !1, E = !1;
    function j() {
      if (l.orderNext === null) {
        g = Q - n, x = !0;
        return;
      }
      l = l.orderNext, g = l.orderNumber - n, v++;
    }
    function A() {
      if (s.orderPrevious === null) {
        E = !0;
        return;
      }
      s = s.orderPrevious, f = n - s.orderNumber, v++;
    }
    for (j(); !(x && E) && v < i && v / (g + f) > 0.5; )
      E ? j() : x || g > f ? A() : j();
    const Y = s.orderNumber, kt = x ? Q : l.orderNumber, re = [];
    for (let S = s; re.push(S), S !== l; S = S.orderNext)
      ;
    const $e = re.length - 1;
    if ($e <= 0) return;
    const en = (kt - Y) / $e;
    for (let S = 0; S < re.length; S++)
      re[S].orderNumber = Math.round(Y + S * en);
  }
  function vt(e, t, n) {
    t.orderNumber = n.orderNumber, t.orderPrevious = n.orderPrevious, t.orderNext = n.orderNext, t.orderPrevious !== null ? t.orderPrevious.orderNext = t : e.first = t, t.orderNext !== null ? t.orderNext.orderPrevious = t : e.last = t, e.executionCursor = t;
  }
  function Ot(e, t) {
    t.orderPrevious !== null ? t.orderPrevious.orderNext = t.orderNext : e.first = t.orderNext, t.orderNext !== null ? t.orderNext.orderPrevious = t.orderPrevious : e.last = t.orderPrevious, e.executionCursor === t && (e.executionCursor = t.orderPrevious || t.orderNext || null), t.orderPrevious = null, t.orderNext = null, e.count--;
  }
  function xt(e, t) {
    if (e === t) return 0;
    if (e === null) return -1;
    if (t === null) return 1;
    const n = e.repeater.chainHead, i = t.repeater.chainHead;
    return n === i ? e.orderNumber - t.orderNumber : n.id - i.id;
  }
  function Z(e, t, n, i) {
    return e !== n ? e - n : xt(t, i);
  }
  function X(e, t, n) {
    if (typeof n > "u" && (n = null), e.currentWriting === null && Ne(e), t === 1 / 0)
      return e.currentWriting = e.last;
    let i = e.currentWriting;
    if (Z(i.time, i.writer, t, n) <= 0)
      for (; i.next !== null && Z(i.next.time, i.next.writer, t, n) <= 0; )
        i = i.next;
    else
      for (; Z(i.time, i.writer, t, n) > 0; )
        i = i.previous;
    return e.currentWriting = i, i;
  }
  function Le(e, t, n) {
    const i = X(e, t, n);
    return Z(i.time, i.writer, t, n) === 0 ? i : null;
  }
  function Pe(e, t) {
    const n = X(e, t.time, t.writer), i = n.next;
    t.previous = n, t.next = i, n.next = t, i !== null ? i.previous = t : e.last = t, e.currentWriting = t;
  }
  function Me(e, t, n) {
    const i = fe(t, n);
    return i.timeline = e, Pe(e, i), i;
  }
  function De(e) {
    Pe(e.timeline, e);
  }
  function wt(e, t, n, i) {
    const s = V(e, t);
    return Le(s, n, i) || Me(s, n, i);
  }
  function Tt(e) {
    const t = e.timeline;
    e.previous !== null ? e.previous.next = e.next : t.first = e.next, e.next !== null ? e.next.previous = e.previous : t.last = e.previous, t.currentWriting === e && (t.currentWriting = e.previous || e.next || null), e.previous = null, e.next = null;
  }
  function de(e, t, n, i) {
    return X(V(e, t), n, i);
  }
  function Rt(e) {
    return X(V(e, u), 0, null);
  }
  function Ct(e, t) {
    Object.keys(t).forEach(function(n) {
      const i = Object.getOwnPropertyDescriptor(t, n);
      if (typeof i.get == "function" || typeof i.set == "function" || typeof i.value == "function")
        return;
      delete t[n];
      const s = de(e, n, 0, null);
      s.value = i.value, s.set = !0;
    });
  }
  function k(e, t, n, i) {
    const s = e.timelines[t];
    return typeof s < "u" && X(s, n, i).set;
  }
  function ce(e, t, n, i) {
    const s = e.timelines[t];
    if (typeof s > "u") return;
    const l = X(s, n, i);
    return l.set ? l.value : void 0;
  }
  function It(e, t, n, i, s) {
    const l = wt(e, t, i, s);
    l.value = n, l.set = !0;
  }
  function Se(e, t, n) {
    const i = [];
    for (let s in e.timelines)
      X(e.timelines[s], t, n).set && i.push(s);
    return i;
  }
  function pe() {
    const e = r.context;
    return e && typeof e.time == "function" ? e.time() : 0;
  }
  function ee() {
    const e = r.context;
    return e && typeof e.time == "function" ? e.time() : 1 / 0;
  }
  function F() {
    const e = r.context;
    return e && e.type === "partial" ? e : null;
  }
  function At(e, t) {
    if (t = t.toString(), t === c)
      return this.meta;
    if (t === se)
      return this.timelines;
    if (this.meta.forwardTo !== null) {
      let l = this.meta.forwardTo[c].handler;
      return l.get.apply(l, [l.target, t]);
    }
    if (I && !I(this, e, t))
      return B;
    const n = ee(), i = F();
    r.inActiveRecording && p(r.context, this, t, n, i);
    let s = e;
    for (; s !== null && typeof s < "u"; ) {
      let l = Object.getOwnPropertyDescriptor(s, t);
      if (typeof l < "u" && typeof l.get < "u")
        return l.get.bind(this.meta.proxy)();
      s = Object.getPrototypeOf(s);
    }
    return k(this, t, n, i) ? ce(this, t, n, i) : e[t];
  }
  function Nt(e, t, n) {
    if (t === c) throw new Error("Cannot set the dedicated meta property '" + c + "'");
    if (t === se) throw new Error("Cannot set the dedicated timelines property '" + se + "'");
    if (this.meta.forwardTo !== null) {
      let A = this.meta.forwardTo[c].handler;
      return A.set.apply(A, [A.target, t, n]);
    }
    if (L && !L(this, e, t))
      return;
    let i = e;
    for (; i !== null && typeof i < "u"; ) {
      let A = Object.getOwnPropertyDescriptor(i, t);
      if (typeof A < "u" && typeof A.set == "function")
        return A.set.call(this.meta.proxy, n), !0;
      if (typeof A < "u" && typeof A.get < "u")
        return !1;
      i = Object.getPrototypeOf(i);
    }
    const s = pe(), l = F(), f = V(this, t), g = r.context, v = !!(g && g.pendingWritings && g.pendingWritings.has(f));
    let x;
    v ? x = g.pendingWritings.get(f) : x = Le(f, s, l) || Me(f, s, l);
    const E = !x.set, j = x.value;
    return x.set && Ae(j, n) ? (v && (x.writer = l, De(x), g.pendingWritings.delete(f), g.writings.set(f, x)), !0) : (x.value = n, x.set = !0, v && (x.writer = l, De(x), g.pendingWritings.delete(f)), g && g.writings && g.writings.set(f, x), C(x, this.proxy, t), E && h(this, t), We(this, t, n, j), !0);
  }
  function Et(e, t) {
    if (this.meta.forwardTo !== null) {
      let f = this.meta.forwardTo[c].handler;
      return f.deleteProperty.apply(
        f,
        [f.target, t]
      ), !0;
    }
    if (L && !L(this, e, t))
      return;
    const n = pe(), i = F(), s = k(this, t, n, i);
    if (!s && !(t in e))
      return !0;
    let l;
    if (s) {
      const f = de(this, t, n, i);
      l = f.value, f.value = void 0, f.set = !1;
    } else
      l = e[t], delete e[t];
    return y(this, t, n, i), h(this, t), Be(this, t, l), !0;
  }
  function jt(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[c].handler;
      return i.ownKeys.apply(
        i,
        [i.target, t]
      );
    }
    if (I && !I(this, e, t))
      return B;
    r.inActiveRecording && a(r.context, this);
    let n = Object.keys(e);
    return Se(this, ee(), F()).forEach(function(i) {
      n.indexOf(i) === -1 && n.push(i);
    }), n;
  }
  function Lt(e, t) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[c].handler;
      return n.has.apply(
        n,
        [n.target, t]
      );
    }
    return I && !I(this, e, t) ? B : (r.inActiveRecording && a(r.context, this), k(this, t, ee(), F()) ? !0 : t in e);
  }
  function Pt(e, t, n) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[c].handler;
      return i.defineProperty.apply(
        i,
        [i.target, t]
      );
    }
    if (!(L && !L(this, e, t)))
      return h(this, "define property"), Reflect.defineProperty(e, t, n);
  }
  function Mt(e, t) {
    if (this.meta.forwardTo !== null) {
      let l = this.meta.forwardTo[c].handler;
      return l.getOwnPropertyDescriptor.apply(l, [l.target, t]);
    }
    if (I && !I(this, e, t))
      return B;
    r.inActiveRecording && a(r.context, this);
    const n = Object.getOwnPropertyDescriptor(e, t);
    if (typeof n < "u") return n;
    const i = ee(), s = F();
    if (k(this, t, i, s))
      return {
        value: ce(this, t, i, s),
        writable: !0,
        enumerable: !0,
        configurable: !0
      };
  }
  function D(e) {
    return e !== null && typeof e == "object" && typeof e[c] == "object" && e[c].world === O;
  }
  function te(e, t) {
    if (typeof e > "u" && (e = {}), typeof e != "object") return e;
    if (typeof t > "u" && (t = null), D(e))
      throw new Error("Cannot observe an already observed object!");
    let n;
    e instanceof Array ? n = {
      _arrayObservers: null,
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: ut,
      set: at,
      deleteProperty: ft,
      ownKeys: dt,
      has: ct,
      defineProperty: pt,
      getOwnPropertyDescriptor: ht
    } : n = {
      timelines: {},
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: At,
      set: Nt,
      deleteProperty: Et,
      ownKeys: jt,
      has: Lt,
      defineProperty: Pt,
      getOwnPropertyDescriptor: Mt
    };
    let i = new Proxy(e, n);
    if (n.target = e, n.proxy = i, n.meta = {
      world: O,
      id: "not yet",
      // Wait for rebuild analysis
      buildId: t,
      forwardTo: null,
      target: e,
      handler: n,
      proxy: i,
      // Here to avoid prevent events being sent to objects being rebuilt.
      isBeingRebuilt: !1
    }, e instanceof Array || Ct(n, e), r.inRepeater !== null) {
      const s = r.inRepeater;
      if (t !== null) {
        if (s.newBuildIdObjectMap || (s.newBuildIdObjectMap = {}), s.buildIdObjectMap && typeof s.buildIdObjectMap[t] < "u" && (!s.options.rebuildShapeAnalysis || !s.options.rebuildShapeAnalysis.allowMatch || Ce(
          () => s.options.rebuildShapeAnalysis.allowMatch(s.buildIdObjectMap[t], i)
        ))) {
          n.meta.isBeingRebuilt = !0;
          let l = s.buildIdObjectMap[t];
          l[c].forwardTo = i, s.options.rebuildShapeAnalysis && (n.meta.copyTo = l), n.meta.id = "temp-" + r.nextTempObjectId++, s.newBuildIdObjectMap[t] = l, i = l, n = i[c].handler, Xe(l[c].handler);
        } else
          n.meta.id = r.nextObjectId++, n.meta.pendingOnEstablishCall = !0, s.newBuildIdObjectMap[t] = i, ne(n);
        s.options.rebuildShapeAnalysis && (s.newIdObjectShapeMap || (s.newIdObjectShapeMap = {}), s.newIdObjectShapeMap[n.meta.id] = i);
      } else s.options.rebuildShapeAnalysis ? (n.meta.id = r.nextObjectId++, n.meta.pendingCreationEvent = !0, n.meta.pendingOnEstablishCall = !0, s.newIdObjectShapeMap || (s.newIdObjectShapeMap = {}), s.newIdObjectShapeMap[n.meta.id] = i) : (n.meta.id = r.nextObjectId++, ne(n));
    } else
      n.meta.id = r.nextObjectId++, ne(n);
    return i;
  }
  function he(e, t) {
    if (D(e) || typeof e != "object" || e === null) return e;
    let n;
    if (t) {
      const i = e instanceof Array ? [] : {};
      for (let s in e)
        i[s] = he(e[s], t);
      n = i;
    } else {
      n = e;
      for (let i in e)
        n[i] = he(n[i], t);
    }
    return te(n);
  }
  function z(e, t, n, i) {
    N && q(e, { type: "splice", index: t, removed: n, added: i });
  }
  function Dt(e, t, n, i) {
    N && q(e, {
      type: "splice",
      index: t,
      removed: [i],
      added: [n]
    });
  }
  function We(e, t, n, i) {
    N && q(e, {
      type: "set",
      property: t,
      newValue: n,
      oldValue: i
    });
  }
  function Be(e, t, n) {
    N && q(e, {
      type: "delete",
      property: t,
      deletedValue: n
    });
  }
  function Xe(e) {
    N && q(e, { type: "reCreate" });
  }
  function ne(e) {
    N && q(e, { type: "create" });
  }
  function He(e) {
    N && q(e, { type: "dispose" });
  }
  function q(e, t) {
    t.object = e.meta.proxy, t.objectId = e.meta.id, !(!nt && e.meta.isBeingRebuilt) && (ue && ue(t), Re && typeof e.target.onChange == "function" && e.proxy.onChange(t));
  }
  function ge() {
    if (r.postponeInvalidation == 0) {
      for (r.postponeRefreshRepeaters++; r.nextObserverToInvalidate !== null; ) {
        let e = r.nextObserverToInvalidate;
        r.nextObserverToInvalidate = null;
        const t = e.nextToNotify;
        t ? (e.nextToNotify = null, r.nextObserverToInvalidate = t) : r.lastObserverToInvalidate = null, e.invalidateAction(), K(e);
      }
      r.postponeRefreshRepeaters--, Ye();
    }
  }
  function St(e, t, n) {
    let i = !1, s = r.context;
    for (; s; ) {
      if (s === e) {
        i = !0;
        break;
      }
      s = s.parent;
    }
    i || (e.invalidatedInContext = r.context, e.invalidatedByKey = n, e.invalidatedByObject = t, e.dispose(), r.postponeInvalidation > 0 ? (G(e), r.lastObserverToInvalidate !== null ? r.lastObserverToInvalidate.nextToNotify = e : r.nextObserverToInvalidate = e, r.lastObserverToInvalidate = e) : e.invalidateAction(n));
  }
  function Wt(e, t) {
    return {
      createdCount: 0,
      createdTemporaryCount: 0,
      removedCount: 0,
      isRecording: !0,
      type: "invalidator",
      id: r.observerId++,
      description: e,
      sources: [],
      nextToNotify: null,
      invalidateAction: t,
      dispose: function() {
        R(this);
      },
      record: function(n) {
        if (r.context == this || this.isRemoved) return n();
        const i = _(this), s = n();
        return U(i), s;
      },
      returnValue: null,
      causalityString() {
        return "<invalidator>" + this.invalidateAction;
      }
    };
  }
  function Bt() {
    let e, t, n = null;
    if (arguments.length > 2)
      n = arguments[0], e = arguments[1], t = arguments[2];
    else {
      if (et) throw new Error("Missing description for 'invalidateOnChange'");
      e = arguments[0], t = arguments[1];
    }
    const i = w(n, t);
    return _(i), i.returnValue = e(i), U(i), i;
  }
  function Xt(e) {
    return {
      type: "partial",
      id: r.observerId++,
      description: e.description,
      repeater: e,
      sources: [],
      writings: /* @__PURE__ */ new Map(),
      pendingWritings: /* @__PURE__ */ new Map(),
      // Sibling pointers within the owning repeater's children/
      // pendingChildren list (partials and real child repeaters share one
      // list) - see createChildList()/attachToCurrentParent() below.
      nextSibling: null,
      previousSibling: null,
      // This partial's position in its root repeater's partial chain (see
      // "Time as tree position" above) - orderNumber compares in O(1);
      // orderNext/orderPrevious are this chain's own linked-list pointers,
      // distinct from nextSibling/previousSibling above (which are purely
      // structural, per-parent creation order, used for reconciliation).
      orderNumber: null,
      orderNext: null,
      orderPrevious: null,
      get isRecording() {
        return this.repeater.isRecording;
      },
      time() {
        return this.repeater.time();
      },
      dispose() {
        R(this);
      },
      invalidateAction() {
        this.repeater.invalidateAction();
      },
      causalityString() {
        return "<partial of> " + this.repeater.causalityString();
      }
    };
  }
  function ie() {
    return { first: null, last: null };
  }
  function Fe(e, t) {
    t.previousSibling = e.last, t.nextSibling = null, e.last !== null ? e.last.nextSibling = t : e.first = t, e.last = t;
  }
  function me(e, t) {
    t.previousSibling !== null ? t.previousSibling.nextSibling = t.nextSibling : e.first = t.nextSibling, t.nextSibling !== null ? t.nextSibling.previousSibling = t.previousSibling : e.last = t.previousSibling, t.previousSibling = null, t.nextSibling = null;
  }
  function ze(e) {
    const t = Xt(e);
    let n = !1;
    if (e.reconciling) {
      const i = e.pendingChildren.first;
      i !== null && i.type === "partial" ? (me(e.pendingChildren, i), R(i), t.pendingWritings = i.writings, vt(e.chainHead, t, i), n = !0) : e.reconciling = !1;
    }
    return n || yt(e.chainHead, t), e.rightmostPartial = t, t.parentRepeater = e, t.listMembership = "confirmed", e.currentPartial = t, Fe(e.children, t), t;
  }
  function qe(e) {
    const t = r.context;
    if (!t || t.type !== "partial")
      return;
    const n = t.repeater;
    n.reconciling && n.pendingChildren.first === e ? me(n.pendingChildren, e) : (e.parentRepeater === n && e.listMembership === "pending" && me(n.pendingChildren, e), n.reconciling = !1), e.parentRepeater = n, e.listMembership = "confirmed", typeof e.retracted < "u" && (e.retracted = !1), Fe(n.children, e), n.chainHead.executionCursor = e.rightmostPartial, be(t), U(t);
    const i = ze(n);
    _(i);
  }
  function Ge(e) {
    let t = e.pendingChildren.first;
    for (; t !== null; ) {
      const n = t.nextSibling;
      t.previousSibling = null, t.nextSibling = null, t.listMembership = null, t.type === "partial" ? (R(t), Yt(t)) : (t.dispose(), Ge(t), t.retracted = !0, t.options.onRetract && t.options.onRetract(t)), t = n;
    }
    e.pendingChildren = ie();
  }
  function Ht(e, t, n, i, s) {
    return {
      createdCount: 0,
      createdTemporaryCount: 0,
      removedCount: 0,
      isRecording: !0,
      type: "repeater",
      id: r.observerId++,
      firstTime: !0,
      description: e,
      // The partial currently holding this repeater's reads/writes - see
      // createPartial() above and refresh() below. Nulled by dispose() at
      // the start of every rerun (see there for why).
      currentPartial: null,
      // Same idea, but never nulled - always this repeater's own most
      // recent partial, even mid-dispose/mid-rerun. By construction it's
      // also the rightmost partial in this repeater's *entire* subtree
      // (a repeater's own final partial is always the last thing anywhere
      // below it), so attachToCurrentParent() uses it, unconditionally, to
      // advance the parent's chain cursor past a child it's attaching -
      // whether or not that child actually reran just now.
      rightmostPartial: null,
      // Which root repeater's partial chain this repeater's own partials
      // get their orderNumber from - see "Time as tree position" above.
      // Set once, at creation (repeat()), from the parent active at that
      // moment (or a fresh chain if there is none); never reassigned after.
      chainHead: null,
      // This run's confirmed children (real child repeaters interleaved
      // with the partials between them) and, transiently between dispose()
      // and the end of the next refresh(), the previous run's sequence
      // awaiting reconciliation - see attachToCurrentParent()/
      // finalizeChildren() above.
      children: ie(),
      pendingChildren: ie(),
      // Sibling pointers within a *parent's* children/pendingChildren list
      // (unused while this repeater is top-level).
      nextSibling: null,
      previousSibling: null,
      parentRepeater: null,
      listMembership: null,
      // "confirmed" | "pending" | null (top-level)
      // Retracted: this repeater's writings are gone and it's sitting
      // unclaimed in some parent's pendingChildren, but it's still fully
      // intact and re-linkable. Disposed: gone forever. See
      // docs/plan-partial-repeaters.md.
      retracted: !1,
      disposed: !1,
      // True from dispose() through the end of the next refresh(): the
      // fresh run's partials/children still line up positionally with
      // pendingChildren's front, so createNextPartial()/
      // attachToCurrentParent() keep reconciling against it. Goes false
      // the moment anything doesn't match, for the rest of that run.
      reconciling: !1,
      nextToNotify: null,
      repeaterAction: qt(t, i),
      nonRecordedAction: n,
      options: i || {},
      finishRebuilding() {
        s(this);
      },
      time() {
        return typeof this.options.time < "u" ? this.options.time : 0;
      },
      causalityString() {
        const l = this.invalidatedInContext, f = this.invalidatedByObject;
        if (!f) return "Repeater started: " + this.description;
        const g = this.invalidatedByKey, v = l ? l.description : "outside repeater/invalidator", x = "  " + f.toString() + "." + g, E = "" + this.description;
        return "(" + v + ")" + x + " --> " + E;
      },
      creationString() {
        let l = "{";
        return l += "created: " + this.createdCount + ", ", l += "createdTemporary:" + this.createdTemporaryCount + ", ", l += "removed:" + this.removedCount + "}", l;
      },
      sourcesString() {
        let l = "";
        if (!this.currentPartial) return l;
        for (let f of this.currentPartial.sources) {
          for (; f.parent; ) f = f.parent;
          l += f.handler.proxy.toString() + "." + f.key + `
`;
        }
        return l;
      },
      restart() {
        this.invalidateAction();
      },
      invalidateAction() {
        _t(this);
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
        if (_e(this), this.children.first !== null) {
          let l = this.children.first;
          for (; l !== null; )
            l.listMembership = "pending", l.type === "partial" && l.writings.forEach(function(f) {
              Tt(f);
            }), l = l.nextSibling;
          this.pendingChildren = this.children, this.children = ie();
        }
        this.currentPartial = null;
      },
      notifyDisposeToCreatedObjects() {
        if (this.idObjectShapeMap)
          for (let l in this.idObjectShapeMap) {
            let f = this.idObjectShapeMap[l];
            typeof f[c].target.onDispose == "function" && f.onDispose();
          }
        else if (this.buildIdObjectMap)
          for (let l in this.buildIdObjectMap) {
            const f = this.buildIdObjectMap[l];
            typeof f.onDispose == "function" && f.onDispose();
          }
      },
      nextDirty: null,
      previousDirty: null,
      lastRepeatTime: 0,
      waitOnNonRecordedAction: 0,
      refresh() {
        const l = this, f = l.options;
        f.onRefresh && f.onRefresh(l), l.finishedRebuilding = !1, l.createdCount = 0, l.createdTemporaryCount = 0, l.removedCount = 0, l.reconciling = l.pendingChildren.first !== null;
        const g = ze(l);
        l.isRecording = !0, _(g), l.returnValue = l.repeaterAction(l), l.isRecording = !1, M();
        const v = l.currentPartial;
        be(v), Ge(l);
        const { debounce: x = 0, fireImmediately: E = !0 } = f;
        if (l.nonRecordedAction !== null)
          x === 0 || this.firstTime ? (E || !this.firstTime) && l.nonRecordedAction(l.returnValue) : (l.waitOnNonRecordedAction && clearTimeout(l.waitOnNonRecordedAction), l.waitOnNonRecordedAction = setTimeout(() => {
            l.nonRecordedAction(l.returnValue), l.waitOnNonRecordedAction = null;
          }, x));
        else if (x > 0)
          throw new Error("Debounce has to be used together with a non-recorded action.");
        return s(this), this.firstTime = !1, U(v), l;
      }
    };
  }
  function Ke(e) {
    const t = e.options.rebuildShapeAnalysis;
    function n(l, f) {
      l[c].forwardTo = f, f[c].copyTo = l, f[c].pendingCreationEvent && (delete f[c].pendingCreationEvent, l[c].pendingReCreationEvent = !0), delete f[c].pendingOnEstablishCall, delete e.newIdObjectShapeMap[f[c].id], e.newIdObjectShapeMap[l[c].id] = l;
    }
    function i(l, f) {
      if (l !== f) {
        const g = D(f), v = D(l);
        if (g !== v) return;
        if (g && v) {
          if (!e.newIdObjectShapeMap[f[c].id] || l[c].forwardTo === f || f[c].buildId || l[c].buildId) return;
          t.allowMatch && t.allowMatch(l, f) && (n(l, f), s(l[c].target, f[c].target));
        } else
          s(l, f);
      }
    }
    function s(l, f) {
      for (let [g, v] of t.slotsIterator(l, f, (x) => D(x) && x[c].buildId))
        i(g, v);
    }
    return { setAsMatch: n, matchChildrenInEquivalentSlot: s, matchInEquivalentSlot: i };
  }
  function Ft(e) {
    if (e.finishedRebuilding) return;
    const t = e.options;
    t.onStartBuildUpdate && t.onStartBuildUpdate();
    function n(i) {
      return i instanceof Array ? i.map((s) => n(s)) : D(i) && i[c].copyTo ? i[c].copyTo : i;
    }
    if (e.options.rebuildShapeAnalysis) {
      const { matchChildrenInEquivalentSlot: i, matchInEquivalentSlot: s } = Ke(e), l = e.options.rebuildShapeAnalysis;
      if (e.establishedRoot instanceof Array || l.shapeRoot() instanceof Array) {
        let f = e.establishedRoot, g = l.shapeRoot();
        f instanceof Array || (f = [f]), g instanceof Array || (g = [g]), i(f, g);
      } else
        s(e.establishedShapeRoot, l.shapeRoot());
      for (let f in e.newIdObjectShapeMap) {
        const g = e.newIdObjectShapeMap[f], v = g[c].forwardTo;
        v && i(g[c].target, v[c].target);
      }
      for (let f in e.newIdObjectShapeMap) {
        let g = e.newIdObjectShapeMap[f], v, x;
        const E = g[c].forwardTo;
        if (E ? (v = E[c].target, x = E[c].handler) : (v = g[c].target, x = g[c].handler), e.options.rebuildShapeAnalysis.translateReferences)
          e.options.rebuildShapeAnalysis.translateReferences(v, n);
        else if (v instanceof Array)
          for (let j in v)
            v[j] = n(v[j]);
        else {
          const j = pe(), A = F();
          Se(x, j, A).forEach(function(Y) {
            It(x, Y, n(ce(x, Y, j, A)), j, A);
          });
        }
      }
      e.establishedShapeRoot = n(e.options.rebuildShapeAnalysis.shapeRoot());
      for (let f in e.newIdObjectShapeMap) {
        let g = e.newIdObjectShapeMap[f];
        const v = g[c].forwardTo;
        v ? (v[c].copyTo = null, g[c].forwardTo = null, ve(g, v), g[c].pendingCreationEvent && (delete g[c].pendingCreationEvent, Xe(g[c].handler))) : (g[c].pendingCreationEvent && (delete g[c].pendingCreationEvent, ne(g[c].handler)), ye(g));
      }
      if (e.idObjectShapeMap) {
        for (let f in e.idObjectShapeMap)
          if (typeof e.newIdObjectShapeMap[f] > "u") {
            const g = e.idObjectShapeMap[f], v = g[c].target;
            He(g[c].handler), typeof v.onDispose == "function" && g.onDispose();
          }
      }
    } else {
      for (let i in e.newBuildIdObjectMap) {
        let s = e.newBuildIdObjectMap[i];
        const l = s[c].forwardTo;
        l !== null ? (s[c].forwardTo = null, l[c].isBeingRebuilt = !1, ve(s, l)) : ye(s);
      }
      if (e.buildIdObjectMap) {
        for (let i in e.buildIdObjectMap)
          if (typeof e.newBuildIdObjectMap[i] > "u") {
            const s = e.buildIdObjectMap[i], l = s[c].target;
            He(s[c].handler), typeof l.onDispose == "function" && s.onDispose();
          }
      }
    }
    e.buildIdObjectMap = e.newBuildIdObjectMap, e.newBuildIdObjectMap = {}, e.idObjectShapeMap = e.newIdObjectShapeMap, e.newIdObjectShapeMap = {}, e.finishedRebuilding = !0, t.onEndBuildUpdate && t.onEndBuildUpdate();
  }
  function ye(e) {
    const t = e[c];
    (t.pendingOnEstablishCall || !t.established) && (delete t.pendingOnEstablishCall, t.established = !0, typeof t.target.onEstablish == "function" && e.onEstablish());
  }
  function zt(e) {
    const t = e[c].forwardTo;
    if (t !== null) {
      if (r.inRepeater) {
        const n = r.inRepeater;
        if (n.options.rebuildShapeAnalysis) {
          const { matchChildrenInEquivalentSlot: i } = Ke(n);
          i(e[c].target, t[c].target);
        }
      }
      e[c].forwardTo = null, t[c].isBeingRebuilt = !1, ve(e, t);
    } else
      ye(e);
    return e;
  }
  function qt(e, { throttle: t = 0 }) {
    return t > 0 ? function(n) {
      let i = Date.now();
      const s = i - n.lastRepeatTime;
      if (t > s) {
        const l = t - s;
        setTimeout(() => {
          n.restart();
        }, l);
      } else
        return n.lastRepeatTime = i, e();
    } : e;
  }
  function Gt() {
    let e = "", t, n = null, i;
    const s = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
    if (typeof s[0] == "string")
      e = s.shift();
    else if (ke)
      throw new Error("Every repeater has to be given a name as first argument. Note: This requirement can be removed in the configuration.");
    if (typeof s[0] == "function" && (t = s.shift()), (typeof s[0] == "function" || s[0] === null) && (n = s.shift()), typeof s[0] == "object" && (i = s.shift()), i || (i = {}), tt && r.inActiveRecording) {
      let v = r.context.description;
      !v && r.context.parent && (v = r.context.parent.description), v || (v = "unnamed"), o.traceWarnings && console.warn(Error(`repeater ${e || "unnamed"} inside active recording ${v}`));
    }
    const l = b(e, t, n, i, Ft), f = r.context && r.context.type === "partial" ? r.context : null;
    l.parentRepeater = f ? f.repeater : null, l.chainHead = l.parentRepeater ? l.parentRepeater.chainHead : mt();
    const g = l.refresh();
    return qe(l), g;
  }
  function Kt(e) {
    return qe(e), e;
  }
  function _t(e) {
    e.dispose();
    const t = e.time();
    G(t);
    const i = r.dirtyRepeaters[t];
    i.last === null ? (i.last = e, i.first = e) : (i.last.nextDirty = e, e.previousDirty = i.last, i.last = e), Ye();
  }
  function Ut() {
    r.observerId = 0, r.dirtyRepeaters.map((e) => {
      e.first = null, e.last = null;
    });
  }
  function _e(e) {
    const t = e.time(), n = r.dirtyRepeaters[t];
    n.last === e && (n.last = e.previousDirty), n.first === e && (n.first = e.nextDirty), e.nextDirty && (e.nextDirty.previousDirty = e.previousDirty), e.previousDirty && (e.previousDirty.nextDirty = e.nextDirty), e.nextDirty = null, e.previousDirty = null;
  }
  function be(e) {
    e.pendingWritings.forEach(function(t, n) {
      C(t, n.handler.proxy, n.key);
    }), e.pendingWritings.clear();
  }
  function Yt(e) {
    e.writings.forEach(function(t, n) {
      C(t, n.handler.proxy, n.key);
    }), e.writings.clear(), be(e), Ot(e.repeater.chainHead, e);
  }
  function Ue(e = 0) {
    const t = r.dirtyRepeaters;
    let n = e;
    for (; n < t.length; ) {
      if (t[n].first !== null)
        return !0;
      n++;
    }
    return !1;
  }
  function $t() {
    const e = r.dirtyRepeaters;
    let t = r.revalidationTimeLock + 1;
    for (; t < e.length; ) {
      if (e[t].first)
        return e[t].first;
      t++;
    }
    for (r.revalidationTimeLock = -1, t = r.revalidationTimeLock + 1; t < e.length; ) {
      if (e[t].first)
        return e[t].first;
      t++;
    }
    return null;
  }
  function Ye() {
    if (r.postponeRefreshRepeaters === 0 && !r.refreshingAllDirtyRepeaters && Ue()) {
      for (r.refreshingAllDirtyRepeaters = !0; Ue(); ) {
        let e = $t();
        e.refresh(), _e(e), K(e.time());
      }
      r.refreshingAllDirtyRepeaters = !1;
    }
  }
  function Jt(e, t) {
    r.recordingPaused++, M(), W.log(e, t), r.recordingPaused--, M();
  }
  function Vt(e, t) {
    r.recordingPaused++, M(), W.group(e, t), r.recordingPaused--, M();
  }
  function Qt() {
    W.groupEnd();
  }
  function Zt(e, t) {
    r.recordingPaused++, M();
    let n = W.logToString(e, t);
    return r.recordingPaused--, M(), n;
  }
  return O;
}
let Oe = {};
function cn(o) {
  o || (o = {}), o = { ...fn, ...o };
  const r = nn(o);
  return typeof Oe[r] > "u" && (Oe[r] = dn(o)), Oe[r];
}
export {
  cn as default,
  cn as getWorld
};
