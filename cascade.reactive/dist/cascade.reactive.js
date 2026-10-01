function Me(s) {
  return Array.prototype.slice.call(s);
}
function at(s, o) {
  const c = s.causality.stateProperties || null, E = (v) => c !== null && c.has(v);
  if (o instanceof Array) {
    const v = s.causality.world;
    v.assignArray(s, v.withoutRecording(() => o.slice()));
    for (let I in o)
      isNaN(I) && !E(I) && (s[I] = o[I]);
  } else
    for (let v in o)
      E(v) || (s[v] = o[v]);
  return s;
}
function Ir(s) {
  return s.name ? s.name : (s = on(s), JSON.stringify(s));
}
const ct = /* @__PURE__ */ new WeakMap();
let Tr = 0;
function Sr(s) {
  return ct.has(s) || ct.set(s, Tr++), ct.get(s);
}
function on(s) {
  if (typeof s == "object") {
    if (s === null) return "null";
    let o = Object.keys(s);
    o.sort(function(E, v) {
      return E < v ? -1 : E > v ? 1 : 0;
    });
    let c = {};
    return o.forEach(function(E) {
      let v = s[E];
      (typeof v == "object" || typeof v == "function") && (v = on(v)), c[E] = v;
    }), c;
  } else return typeof s == "function" ? "[function " + Sr(s) + "]" : "[" + typeof s + "]";
}
const rn = {
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
let X = {
  // Count the number of chars that can fit horizontally in your buffer. Set to -1 for one line logging only. 
  bufferWidth: 83,
  // bufferWidth : 83
  // bufferWidth : 76
  indentToken: "  ",
  // Change to true in order to find all logs hidden in your code.
  findLogs: !1,
  // Set to true in web browser that already has a good way to display objects with expandable trees.
  useConsoleDefault: !1
}, ve = 0;
function jr() {
  function s(o) {
    return o ? s(o.caller).concat([o.toString().split("(")[0].substring(9) + "(" + o.arguments.join(",") + ")"]) : [];
  }
  return s(arguments.callee.caller);
}
function pt(s) {
  let o = "";
  for (; s-- > 0; )
    o = o + X.indentToken;
  return o;
}
function ht() {
  const s = {
    terminated: !1,
    rootLevel: !0,
    horizontal: !1,
    indentLevel: ve,
    unfinishedLine: !1
  };
  return s.resetColor = () => {
    s.setColor("Reset");
  }, s;
}
function Nr() {
  let s = ht();
  return s.result = "", s.log = function(o) {
    this.unfinishedLine ? (this.result += o, this.unfinishedLine = !0) : (this.result += pt(this.indentLevel) + o, this.unfinishedLine = !0);
  }, s.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (this.result += `
`, this.unfinishedLine = !1);
  }, s.setColor = function() {
  }, s.jsonCompatible = !0, s;
}
function We() {
  let s = ht();
  return s.lineMemory = "", s.log = function(o) {
    if (this.unfinishedLine)
      typeof process < "u" ? process.stdout.write(o) : s.lineMemory += o, this.unfinishedLine = !0;
    else {
      let c = pt(this.indentLevel);
      typeof process < "u" ? process.stdout.write(c + o) : s.lineMemory += c + o, this.unfinishedLine = !0;
    }
  }, s.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (s.lineMemory !== "" ? (console.log(s.lineMemory), s.lineMemory = "") : console.log(), this.unfinishedLine = !1);
  }, s.setColor = function(o) {
    rn[o] || (o = "Reset"), s.log(rn[o]);
  }, s.jsonCompatible = !1, s;
}
function Mr(s, o) {
  let c = ht();
  return c.horizontal = !0, c.count = 0, c.limit = s, c.log = function(E) {
    if (this.unfinishedLine)
      this.count += E.length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    else {
      let v = pt(this.indentLevel);
      this.count += (v + E).length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    }
  }, c.finishOpenLine = function() {
  }, c.setColor = function() {
  }, c.jsonCompatible = o.jsonCompatible, c;
}
function sn(s, o, c, E) {
  let v = Mr(c, E);
  return $(s, o, v), !v.terminated;
}
function $(s, o, c) {
  const E = c.rootLevel, v = c.jsonCompatible;
  if (c.rootLevel = !1, typeof o > "u" && (o = 1), typeof o == "function" && (s = o(s), o = -1), !c.terminated) {
    if (typeof s != "object")
      if (typeof s == "function")
        c.setColor("FgBlue"), c.log("function( ... ) { ... }"), c.resetColor();
      else if (typeof s == "string")
        if (E)
          c.log(s);
        else {
          c.setColor("FgGreen");
          const I = v ? '"' : "'";
          c.log(I + s + I), c.resetColor();
        }
      else
        c.setColor("FgYellow"), c.log(s + ""), c.resetColor();
    else if (s === null)
      c.log("null");
    else if (o === 0)
      s instanceof Array ? (c.log("["), c.setColor("FgCyan"), c.log("..."), c.resetColor(), c.log("]")) : (c.log("{"), c.setColor("FgCyan"), c.log("..."), c.resetColor(), c.log("}"));
    else {
      let I = s instanceof Array;
      const N = Object.keys(s).length;
      let K = !1;
      if (!c.horizontal) {
        let f = X.bufferWidth - c.indentLevel * X.indentToken.length;
        c.horizontal = X.bufferWidth === -1 ? !0 : sn(s, o, f, c), K = c.horizontal;
      }
      I && c.finishOpenLine(), c.log(I ? "[" : "{"), c.horizontal && N && c.log(" "), c.finishOpenLine(), c.indentLevel++;
      let b = !0;
      for (let f in s) {
        b || (c.log(", "), c.finishOpenLine()), (!I || isNaN(f)) && (v && c.log('"'), c.log(f), v && c.log('"'), c.log(": "));
        let m = null;
        typeof o == "object" ? m = o[f] : m = o === -1 ? -1 : o - 1, I || c.indentLevel++, $(s[f], m, c), I || c.indentLevel--, b = !1;
      }
      c.indentLevel--, c.finishOpenLine(), c.horizontal && N && c.log(" "), c.log(I ? "]" : "}"), K && (c.horizontal = !1);
    }
    E && c.finishOpenLine();
  }
}
const xe = {
  // Configuration
  configuration: X,
  stacktrace: jr,
  log(s, o) {
    if (xe.findLogs) throw new Error("No logs allowed!");
    X.useConsoleDefault ? console.log(s) : $(s, o, We());
  },
  // If you need the output as a string.
  logToString(s, o) {
    let c = Nr();
    return $(s, o, c), c.result;
  },
  loge(s) {
    this.log("<<<" + s + ">>>");
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
  logVar(s, o, c) {
    if (xe.findLogs) throw new Error("No logs allowed!");
    if (X.useConsoleDefault)
      console.log(s + ":"), console.group(), console.log(o), console.groupEnd();
    else {
      context = We(), typeof c > "u" && (c = 1), context.log(s + ": ");
      let E = X.bufferWidth - context.indentLevel * X.indentToken.length - (s + ": ").length;
      context.horizontal = X.bufferWidth === -1 ? !0 : sn(o, c, E), context.horizontal ? $(o, c, context) : (context.indentLevel++, $(o, c, context), context.indentLevel--);
    }
  },
  group(s, o) {
    if (xe.findLogs) throw new Error("No logs allowed!");
    X.useConsoleDefault ? console.group(s) : (typeof s < "u" && $(s, o, We()), ve++);
  },
  groupEnd(s, o) {
    if (xe.findLogs) throw new Error("No logs allowed!");
    X.useConsoleDefault ? console.groupEnd() : (ve--, ve < 0 && (ve = 0), typeof s < "u" && $(s, o, We()));
  }
};
function Wr(s, o, c, E) {
  function v(h, g) {
    if (typeof h != typeof g)
      return !1;
    if (h.length === g.length) {
      for (let x = 0; x < h.length; x++)
        if (h[x] !== g[x])
          return !1;
      return !0;
    } else
      return !1;
  }
  function I(h, g) {
    if (h.length === 0)
      return !1;
    for (let x = 0; x < h.length; x++)
      if (v(
        h[x].argumentList,
        g
      ))
        return !0;
    return !1;
  }
  function N(h, { signature: g, unique: x, argumentList: R }) {
    return x ? typeof h[g] < "u" : typeof h[g] > "u" ? !1 : I(h[g], R);
  }
  function K(h, { signature: g, unique: x, argumentList: R }) {
    if (x)
      return h[g].value;
    {
      let P = h[g];
      for (let T = 0; T < P.length; T++)
        if (v(P[T].argumentList, R))
          return P[T].value;
    }
  }
  function b(h, { signature: g, unique: x, argumentList: R }) {
    if (x) {
      delete h[g];
      return;
    } else {
      let P = h[g];
      for (let T = 0; T < P.length; T++)
        if (v(P[T].argumentList, R)) {
          P.splice(T, 1);
          return;
        }
    }
  }
  function f(h, { signature: g, unique: x, argumentList: R }, P) {
    if (x)
      h[g] = { value: P };
    else {
      let T = h[g];
      T || (T = s([]), h[g] = T), T.push({ argumentList: R, value: P });
    }
  }
  function m(h) {
    let g = !0, x = "";
    return h.forEach(function(R, P) {
      P > 0 && (x += ",");
      const T = R !== null && typeof R == "object" ? R[E] : void 0;
      typeof T < "u" ? x += "{id=" + T.id + "}" : typeof R == "number" || typeof R == "string" ? x += R : (g = !1, x += "{}");
    }), { signature: "(" + x + ")", unique: g, argumentList: h };
  }
  function O(h) {
    const g = s({});
    return function(...x) {
      let R = m(x);
      return c(() => N(g, R)) || o(
        () => {
          const P = h.apply(null, x);
          f(g, R, P);
        },
        () => {
          b(g, R);
        }
      ), K(g, R);
    };
  }
  return O;
}
let ln = 500;
function Lr(s) {
  const o = s.state, c = s.invalidateObserver;
  function E(b, f, m) {
    return arguments.length < 3 && (m = f, f = null), {
      description: b,
      key: f,
      handler: m,
      isRoot: !0,
      contents: {},
      contentsCounter: 0,
      first: null,
      last: null
    };
  }
  function v(b, f, m, O, h) {
    let g = b.id;
    if (typeof f.contents[g] < "u" || f.contentsCounter === ln && f.last !== null && (f = f.last, typeof f.contents[g] < "u"))
      return f.contents[g];
    if (f.contentsCounter === ln) {
      let R = {
        isRoot: !1,
        contents: {},
        contentsCounter: 0,
        next: null,
        previous: null,
        parent: null
      };
      f.isRoot ? (R.parent = f, f.first = R, f.last = R) : (f.next = R, R.previous = f, R.parent = f.parent, f.parent.last = R), f = R;
    }
    let x = f.contents;
    return typeof x[g] > "u" && (f.contentsCounter = f.contentsCounter + 1, x[g] = {
      observer: b,
      time: typeof O > "u" ? null : O,
      writer: typeof h > "u" ? null : h,
      // Set by cascade.js (flagRepeaterEntry) when this entry is found
      // overtaken by a closer writing but the change can't yet be acted
      // on (see resolveFlaggedRepeater) - guards against the same entry
      // being flagged twice over by a second, even-closer writing before
      // the first flag is ever resolved.
      flagged: !1,
      // Set once the entry is gone from its observerSet - see
      // removeFromObserverSet. A reference to it held elsewhere (a flag
      // record, say) can tell.
      removed: !1
    }, b.sources.push(f)), x[g];
  }
  function I(b) {
    const f = [];
    for (let O in b.contents)
      f.push({ id: O, entry: b.contents[O], owner: b });
    let m = b.first;
    for (; m !== null; ) {
      for (let O in m.contents)
        f.push({ id: O, entry: m.contents[O], owner: m });
      m = m.next;
    }
    return f;
  }
  function N(b, f, m) {
    if (!(o.blockInvalidation > 0)) {
      o.postponeInvalidation++;
      try {
        let O = b.contents;
        for (let h in O)
          c(O[h].observer, f, m);
        if (typeof b.first < "u") {
          const h = [];
          for (let g = b.first; g !== null; g = g.next) h.push(g);
          for (const g of h) {
            let x = g.contents;
            for (let R in x)
              c(x[R].observer, f, m);
          }
        }
      } finally {
        o.postponeInvalidation--;
      }
      s.proceedWithPostponedInvalidations();
    }
  }
  function K(b, f) {
    let m = f.contents;
    if (typeof m[b] > "u") return;
    m[b].removed = !0, delete m[b];
    let O = !1;
    if (f.contentsCounter--, f.contentsCounter == 0) {
      f.isRoot ? f.first === null && f.last === null && (O = !0) : (f.parent.first === f && (f.parent.first = f.next), f.parent.last === f && (f.parent.last = f.previous), f.next !== null && (f.next.previous = f.previous), f.previous !== null && (f.previous.next = f.next), f.previous = null, f.next = null, f.parent.first === null && f.parent.last === null && f.parent.contentsCounter === 0 && (O = !0));
      const h = f.isRoot ? f : f.parent;
      O && typeof h.handler.proxy.onRemovedLastObserver == "function" && h.handler.proxy.onRemovedLastObserver(h.description, h.key);
    }
  }
  return {
    // A read of an array's elements, on the writing of its elements
    // timeline it resolved to (or, for a partial reading its own writing,
    // the one before it - see cascade.js's observeArray). Returns the
    // entry: cascade.js notes on it what was read, and what was seen.
    recordDependencyOnArray: (b, f, m, O, h) => (m.observers === null && (m.observers = E("arrayDependees", f)), v(b, m.observers, void 0, O, h)),
    recordDependencyOnEnumeration: (b, f, m, O) => {
      const h = s.getOrCreateEnumerationTimelineWriting(f, m, O);
      h.observers === null && (h.observers = E("enumerationDependees", f)), v(b, h.observers, void 0, m, O);
    },
    recordDependencyOnProperty: (b, f, m, O, h) => {
      const g = s.getOrCreateTimelineWriting(f, m, O, h);
      g.observers === null && (g.observers = E("propertyDependees", m, f)), v(b, g.observers, m, O, h);
    },
    invalidatePropertyObservers: (b, f, m, O) => {
      const h = b.timelines[f];
      if (typeof h > "u") return;
      const g = s.seekTimelineWriting(h, m, O);
      g.observers !== null && N(g.observers, b.proxy, f);
    },
    invalidateWritingObservers: (b, f, m) => {
      b.observers !== null && N(b.observers, f, m);
    },
    // A reader that resolved to `previousWriting` (the nearest writing at
    // or before its own position, at the time it read) can be left with a
    // stale dependency once a *closer* writing is inserted between
    // `previousWriting` and that reader's real position: nothing about
    // ordinary writing-scoped invalidation (invalidateWritingObservers
    // above) ever touches a writing other than the one actually being
    // written, so a reader attached to `previousWriting` never learns that
    // a closer writing is now the one it should really be depending on.
    // Only `previousWriting`'s own observers can possibly be affected here
    // - any reader attached to an even-earlier writing must have its own
    // read position strictly before `previousWriting`'s (otherwise it
    // would have resolved to `previousWriting` instead), which is in turn
    // before the new writing's position, so it's unaffected by
    // construction.
    //
    // Just the *finding*, not the decision of what to do about it - see
    // cascade.js's migrateOvertakenObserversFor for why that decision
    // (repoint silently now vs. flag for a deferred recheck later) isn't
    // made here: it needs writingsHaveSameEffectiveValue and (for the
    // deferred case) the repeater-flagging bookkeeping, neither of which
    // this module knows about. `isOvertaken(time, writer)` decides, per
    // recorded entry, whether that entry's own read position is strictly
    // after the new writing's (compareWritingToReader lives in cascade.js, not
    // here - passed in rather than duplicated).
    collectOvertakenPropertyObservers: (b, f) => b.observers === null ? [] : I(b.observers).filter(({ entry: m }) => f(m.time, m.writer)).map(({ entry: m }) => m),
    // Move one specific, already-found entry (from collectOvertakenPropertyObservers
    // above, or a flag record being resolved later) off `previousWriting`
    // and onto `freshWriting` - the entry's own {time, writer} travel with
    // it unchanged, only which writing's observers it's parked on changes.
    // Re-scans `previousWriting.observers` for the exact entry (by
    // reference) rather than requiring the caller to also track which
    // chunk it lives in - cheap, since it's bounded by however many
    // readers `previousWriting` currently has, not a system-wide search.
    // Returns false if the entry wasn't found there anymore (e.g. it was
    // independently cleared by a real invalidation in between) - the
    // caller has nothing further to do in that case. Otherwise returns the
    // entry as it now stands on `freshWriting` - a new one, or the one the
    // same observer already had there.
    relocatePropertyObserverEntry: (b, f, m) => {
      if (b.observers === null) return !1;
      const O = I(b.observers).find(({ entry: h }) => h === m);
      return O ? (K(O.id, O.owner), f.observers === null && (f.observers = E(
        b.observers.description,
        b.observers.key,
        b.observers.handler
      )), v(m.observer, f.observers, b.observers.key, m.time, m.writer)) : !1;
    },
    // Only invalidate readers positioned after this key add/remove (see
    // invalidateDownstreamEnumerationObservers in cascade.js) - before
    // this, every reader at every position shared one fixed writing, so
    // any key add/remove invalidated all of them regardless of where they
    // sat in the pipeline.
    invalidateEnumerateObservers: (b, f, m, O) => {
      const h = b.timelines[s.enumerationTimelineKey];
      typeof h > "u" || s.invalidateDownstreamEnumerationObservers(h.first, m, O, b.proxy, f);
    },
    removeAllSources: (b) => {
      const f = b.id;
      b.sources.forEach(function(m) {
        K(f, m);
      }), b.sources.length = 0;
    }
  };
}
const kr = xe, Qr = {
  requireRepeaterName: !1,
  requireInvalidatorName: !1,
  warnOnNestedRepeater: !0,
  timeLevels: 4,
  objectMetaProperty: "causality",
  objectTimelinesProperty: "timelines",
  useNonObservablesAsValues: !1,
  valueComparisonDepthLimit: 5,
  sendEventsToObjects: !0,
  // Reserved properties that you can override on observables IF sendEventsToObjects is set to true. 
  // onChange
  // onEstablish
  // onDispose
  onEventGlobal: null,
  emitReBuildEvents: !1,
  // allowNonObservableReferences: true, // Allow observables to refer to non referables. TODO?
  onWriteGlobal: null,
  onReadGlobal: null,
  cannotReadPropertyValue: null,
  customObjectlog: null,
  customDependencyInterfaceCreator: null,
  //{recordDependencyOnArray, recordDependencyOnEnumeration, recordDependencyOnProperty, recordDependency, ...} - see lib/defaultDependencyInterface.js
  customCreateInvalidator: null,
  customCreateRepeater: null
};
function Dr(s) {
  const o = {
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
    refreshingAllDirtyRepeaters: !1,
    // The repeater work scheduler - see "Repeater scheduling: pipelines,
    // wavefronts, parking" below for the full design. One {active, parked}
    // pair of FIFOs per time level, holding *pipelines* (chainHeads), not
    // individual repeaters - a chainHead's own internal sortedQueue/parkedRepeaters
    // (see createChainHead()) is where the actual repeaters needing
    // attention live.
    workQueue: [...Array(s.timeLevels).keys()].map(() => ({
      active: { first: null, last: null },
      parked: { first: null, last: null }
    })),
    // How far the current wave has got - see "Repeater scheduling" below.
    workQueueTimeLock: -1,
    // The chainHead currently being drained by drainActivePipeline(), if
    // any - see scheduleWork()'s own use of it to detect "is new work
    // arriving for the very pipeline I'm mid-processing".
    activePipeline: null,
    // flush() (see below) - recursion-safe, like recordingPaused/
    // blockInvalidation above. While > 0, an invalidation/flagging that
    // would otherwise park (waiting for the next wave) instead retreats
    // the wave - see ensurePipelineActiveOrParked()/scheduleWork().
    flushing: 0,
    // Set by either kind of retreat (the outer workQueueTimeLock, or a
    // pipeline's own internal wavefront) - checked once, right after every
    // processRepeater() call, never mid-refresh - see checkWaveRetreat().
    waveRetreated: !1
  }, c = Symbol("timelines.enumeration"), E = {
    name: s.name,
    sameAsPreviousDeep: De,
    // Main API
    observable: Ze,
    deeplyObservable: et,
    isObservable: V,
    invalidateOnChange: zt,
    repeat: hr,
    linkRepeater: gr,
    finalize: pr,
    establish: je,
    dispose: it,
    // Modifiers
    withoutRecording: J,
    withoutReactions: hn,
    flush: gn,
    accessInitialValues: mt,
    declareState: mn,
    retractRepeater: Ut,
    refreshIfNeeded: wr,
    // Transaction
    transaction: Qe,
    postponeInvalidations: dn,
    continueInvalidations: pn,
    // Debugging and testing
    // Logging (these log commands do automatic withoutRecording to avoid your logs destroying your test-setup) 
    log: Ar,
    loge: (e) => {
      P.loge(e);
    },
    // "event"
    logs: () => {
      P.logs();
    },
    // "separator"
    logss: () => {
      P.logss();
    },
    logGroup: Cr,
    logUngroup: Er,
    logToString: Pr,
    // Advanced (only if you know what you are doing, typically used by plugins to causality)
    state: o,
    enterContext: ae,
    leaveContext: Z,
    invalidateObserver: ue,
    getOrCreateTimelineWriting: Ae,
    getOrCreateEnumerationTimelineWriting: _n,
    invalidateDownstreamEnumerationObservers: Yn,
    seekTimelineWriting: Q,
    assignArray: Ln,
    enumerationTimelineKey: c,
    proceedWithPostponedInvalidations: me,
    // Libraries
    caching: Wr(Ze, zt, J, s.objectMetaProperty)
  }, v = s.customCreateRepeater ? s.customCreateRepeater : fr, I = s.customCreateInvalidator ? s.customCreateInvalidator : ir, N = s.customDependencyInterfaceCreator ? s.customDependencyInterfaceCreator(E) : Lr(E), K = N.recordDependencyOnArray, b = N.recordDependencyOnEnumeration, f = N.recordDependencyOnProperty, m = N.invalidateEnumerateObservers, O = N.invalidatePropertyObservers, h = N.invalidateWritingObservers, g = N.collectOvertakenPropertyObservers, x = N.relocatePropertyObserverEntry, R = N.removeAllSources, P = s.customObjectlog ? s.customObjectlog : kr, T = In(), {
    requireRepeaterName: un,
    requireInvalidatorName: fn,
    warnOnNestedRepeater: an,
    objectMetaProperty: p,
    objectTimelinesProperty: Le,
    sendEventsToObjects: gt,
    onEventGlobal: ke,
    emitReBuildEvents: cn,
    onWriteGlobal: B,
    onReadGlobal: W,
    cannotReadPropertyValue: H
  } = s, L = !!ke || gt;
  function J(e) {
    o.recordingPaused++, G();
    try {
      return e();
    } finally {
      o.recordingPaused--, G();
    }
  }
  function Qe(e) {
    o.postponeInvalidation++;
    try {
      return e();
    } finally {
      o.postponeInvalidation--, me();
    }
  }
  function dn() {
    o.postponeInvalidation++;
  }
  function pn() {
    o.postponeInvalidation--, me();
  }
  function hn(e) {
    o.blockInvalidation++;
    try {
      e();
    } finally {
      o.blockInvalidation--;
    }
  }
  function gn(e) {
    o.flushing++;
    try {
      return e();
    } finally {
      o.flushing--;
    }
  }
  function mt(e) {
    const t = o.context;
    o.context = null, G();
    try {
      return e();
    } finally {
      o.context = t, G();
    }
  }
  function mn(e, t) {
    if (!V(e)) throw new Error("declareState() expects an observable object.");
    const n = e[p], r = (i) => {
      i.stateProperties || (i.stateProperties = /* @__PURE__ */ new Set()), Object.keys(t).forEach((l) => i.stateProperties.add(l));
    };
    return r(n), n.rebuildTwin !== null && r(n.rebuildTwin[p]), mt(() => {
      Object.keys(t).forEach((i) => {
        e[i] = t[i];
      });
    }), e;
  }
  function G() {
    o.inActiveRecording = o.context !== null && o.context.isRecording && o.recordingPaused === 0, o.inRepeater = o.context && o.context.type === "partial" ? o.context.repeater : null;
  }
  function ae(e) {
    return e.parent = o.context, o.context = e, G(), e;
  }
  function Z(e) {
    if (o.context && e === o.context)
      o.context = o.context.parent;
    else
      throw new Error("Context missmatch");
    G();
  }
  function ce(e, t) {
    return s.useNonObservablesAsValues ? De(e, t, s.valueComparisonDepthLimit) : e === t || Number.isNaN(e) && Number.isNaN(t) ? !0 : yt(e, t);
  }
  function bt(e) {
    if (e === null || typeof e != "object" || !Object.isFrozen(e) || V(e)) return !1;
    if (Array.isArray(e)) return !0;
    const t = Object.getPrototypeOf(e);
    return t === Object.prototype || t === null;
  }
  function yt(e, t, n = 0) {
    if (e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
    if (!bt(e) || !bt(t) || n > 64 || Array.isArray(e) !== Array.isArray(t)) return !1;
    const r = Object.keys(e);
    if (r.length !== Object.keys(t).length) return !1;
    for (const i of r)
      if (!Object.prototype.hasOwnProperty.call(t, i) || !yt(e[i], t[i], n + 1)) return !1;
    return !0;
  }
  function De(e, t, n) {
    if (typeof n > "u" && (n = 8), e === null && t === null || e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
    if (n === 0 || typeof e != typeof t || typeof e != "object" || e === null || t === null || V(e) || V(t) || Object.keys(e).length !== Object.keys(t).length) return !1;
    for (let r in e)
      if (!De(e[r], t[r], n - 1))
        return !1;
    return !0;
  }
  const Be = "(array elements)", ee = /* @__PURE__ */ new Set(), bn = 8;
  function Y(e) {
    if (typeof e != "string") return !1;
    const t = Number(e);
    return String(t >>> 0) === e && t !== 4294967295;
  }
  function Fe(e, t) {
    const n = t >= 0 && t in e;
    return { present: n, value: n ? e[t] : void 0 };
  }
  function Xe(e, t, n) {
    const r = n >= 0 && n in t;
    return e.present !== r ? !1 : !r || ce(e.value, t[n]);
  }
  function yn() {
    return { whole: null, length: null, indices: null, fromEnd: null };
  }
  function de(e, t, n, r) {
    t === "whole" ? e.whole = r.slice() : t === "length" ? e.length = r.length : t === "index" ? (e.indices || (e.indices = /* @__PURE__ */ new Map())).set(n, Fe(r, n)) : t === "fromEnd" && (e.fromEnd || (e.fromEnd = /* @__PURE__ */ new Map())).set(n, Fe(r, r.length - n));
  }
  function vn(e, t, n) {
    t.whole !== null && de(e, "whole", null, n), t.length !== null && de(e, "length", null, n), t.indices !== null && t.indices.forEach((r, i) => de(e, "index", i, n)), t.fromEnd !== null && t.fromEnd.forEach((r, i) => de(e, "fromEnd", i, n));
  }
  function ze(e, t) {
    if (e.whole !== null) {
      const n = e.whole;
      if (n.length !== t.length) return !0;
      for (let r = 0; r < n.length; r++)
        if (!Xe(Fe(n, r), t, r)) return !0;
      return !1;
    }
    if (e.length !== null && e.length !== t.length) return !0;
    if (e.indices !== null) {
      for (const [n, r] of e.indices)
        if (!Xe(r, t, n)) return !0;
    }
    if (e.fromEnd !== null) {
      for (const [n, r] of e.fromEnd)
        if (!Xe(r, t, t.length - n)) return !0;
    }
    return !1;
  }
  function pe(e, t) {
    switch (t.kind) {
      case "push":
        return Array.prototype.push.apply(e, t.items);
      case "unshift":
        return Array.prototype.unshift.apply(e, t.items);
      case "pop":
        return e.pop();
      case "shift":
        return e.shift();
      case "splice":
        return Array.prototype.splice.apply(e, t.args);
      case "set":
        return e[t.index] = t.value, t.value;
      case "delete":
        return delete e[t.index];
      case "length":
        return e.length = t.value, t.value;
      case "assign":
        e.length = 0;
        for (let n = 0; n < t.items.length; n++)
          n in t.items && (e[n] = t.items[n]);
        return e.length = t.items.length, e;
      default:
        return Array.prototype[t.kind].apply(e, t.args);
    }
  }
  function vt(e, t) {
    o.recordingPaused++, G();
    try {
      t.forEach((n) => n.ops.forEach((r) => pe(e, r)));
    } finally {
      o.recordingPaused--, G();
    }
  }
  function te(e, t) {
    if (e.cursorWriting === t) return e.cursorContent;
    if (e.cursorWriting !== null) {
      const l = [];
      let u = e.cursorWriting.next;
      for (; u !== null && u !== t; )
        l.push(u), u = u.next;
      if (u === t) {
        l.push(t);
        const d = e.cursorContent;
        return e.cursorWriting = null, e.cursorContent = null, vt(d, l), e.cursorWriting = t, e.cursorContent = d, d;
      }
    }
    const n = e.first, r = n.content.slice(), i = [];
    if (t !== n) {
      let l = n.next;
      for (; l !== null && l !== t; )
        i.push(l), l = l.next;
      if (l === null) throw new Error("Array writing not on its timeline.");
      i.push(t);
    }
    return e.cursorWriting = null, e.cursorContent = null, vt(r, i), e.cursorWriting = t, e.cursorContent = r, r;
  }
  function qe(e) {
    e.cursorWriting = null, e.cursorContent = null;
  }
  function xt(e, t) {
    if (e.cursorWriting === null) return !0;
    let n = e.cursorWriting.next;
    for (let r = 0; n !== null && r < bn; r++) {
      if (n === t) return !0;
      n = n.next;
    }
    return !1;
  }
  function xn(e, t) {
    e.version++, xt(e, t) || qe(e), ee.add(e.handler);
  }
  function wn(e, t) {
    e.version++, xt(e, t) || qe(e), ee.add(e.handler);
  }
  function On(e) {
    const t = e.elements;
    if (e.mirrorVersion === t.version) return;
    const n = te(t, t.last), r = e.target;
    r.length = 0;
    for (let i = 0; i < n.length; i++)
      i in n && (r[i] = n[i]);
    r.length = n.length, e.mirrorVersion = t.version;
  }
  function Ve() {
    if (ee.size === 0) return;
    const e = [...ee];
    ee.clear(), e.forEach(On);
  }
  function Rn(e, t, n, r, i) {
    e.arrayRead ? e.arrayVersion !== t.version && ze(e.arrayRead, i) && ue(e.observer, t.handler.proxy, Be) : e.arrayRead = yn(), e.arrayVersion = t.version, de(e.arrayRead, n, r, i);
  }
  function k(e, t, n) {
    const r = e.elements, i = re(), l = M(), u = Q(r, i, l);
    if (o.inActiveRecording) {
      let a = u, w = t;
      l !== null && u.writer === l && u.previous !== null && (a = u.previous, w = "whole");
      const C = K(o.context, e, a, i, l);
      a.observersAllFlagged = !1, Rn(C, r, w, n, te(r, a));
    }
    const d = te(r, u);
    return t === "whole" ? d.slice() : d;
  }
  function U(e) {
    return te(e.elements, Q(e.elements, _(), M()));
  }
  function An(e) {
    const t = e.elements, n = o.context;
    let r = n && n.writings ? n.writings.get(t) : void 0;
    if (typeof r < "u") return r;
    const i = _(), l = M(), u = l !== null ? l.repeater : null, d = u !== null && u.staleWritings !== null ? u.staleWritings.get(t) : void 0;
    return d && d.length > 0 ? (r = d.shift(), d.length === 0 && u.staleWritings.delete(t), r.stale = !1, r.writer = l, r.ops = [], _e(r)) : (r = Ue(t, i, l), r === null && (r = Ye(t, i, l))), n && n.writings && n.writings.set(t, r), r;
  }
  function q(e, t) {
    const n = An(e), r = e.elements, i = n === r.last && e.mirrorVersion === r.version;
    let l;
    if (n.ops === null ? (l = pe(n.content, t), r.cursorWriting === n ? pe(r.cursorContent, t) : qe(r)) : (l = pe(te(r, n), t), n.ops.push(t)), r.version++, i && (t.kind === "push" || t.kind === "pop" || t.kind === "set" || t.kind === "length") ? (pe(e.target, t), e.mirrorVersion = r.version) : ee.add(e), n.writer !== null) {
      const u = n.writer;
      u.touchedArrayWritings === null && (u.touchedArrayWritings = /* @__PURE__ */ new Set()), u.touchedArrayWritings.add(n);
    } else
      Ke(n, null), Ve();
    return l;
  }
  function Cn(e, t, n) {
    return e.flagged || e.removed || !e.arrayRead ? !0 : Re(e, n) ? (st(e.observer.repeater, e, t), !0) : (Ot(e, t) && ue(e.observer, t.timeline.handler.proxy, Be), !1);
  }
  function wt(e, t, n, r, i, l) {
    if (o.blockInvalidation > 0) return;
    const u = [];
    e !== null && g(
      e,
      (a, w) => ne(t, n, a, w) < 0
    ).forEach((a) => u.push([a, e, null]));
    const d = [];
    for (let a = r; a !== null; a = a.next) {
      if (a.observersAllFlagged === !0) continue;
      const w = { writing: a, allFlagged: !0 };
      d.push(w), a.observersAllFlagged = null, g(a, () => !0).forEach((C) => u.push([C, a, w]));
    }
    l && g(l, () => !0).forEach((a) => u.push([a, l, null])), o.postponeInvalidation++;
    try {
      u.forEach(([a, w, C]) => {
        const y = Cn(a, w, i);
        C !== null && !y && (C.allFlagged = !1);
      }), d.forEach((a) => {
        a.writing.observersAllFlagged === null && (a.writing.observersAllFlagged = a.allFlagged);
      });
    } finally {
      o.postponeInvalidation--;
    }
    me();
  }
  function Ke(e, t) {
    wt(e.previous, e.time, e.writer, e, t, null);
  }
  function En(e) {
    if (e.touchedArrayWritings === null) return;
    const t = e.touchedArrayWritings;
    e.touchedArrayWritings = null, t.forEach((n) => {
      n.linked && Ke(n, n.writer);
    });
  }
  function Pn(e) {
    e.stale = !1;
    const t = Q(e.timeline, e.time, e.writer);
    wt(t, e.time, e.writer, t.next, e.writer, e);
  }
  function Ot(e, t) {
    if (e.removed) return !1;
    const n = t.timeline;
    let r = Q(n, e.time, e.writer);
    e.writer !== null && r.writer === e.writer && r.previous !== null && (r = r.previous);
    const i = te(n, r);
    if (ze(e.arrayRead, i)) return !0;
    if (e.arrayVersion = n.version, r !== t) {
      const l = x(t, r, e);
      if (l && l !== e) {
        if (r.observersAllFlagged = !1, !l.arrayRead)
          l.arrayRead = e.arrayRead;
        else {
          if (ze(l.arrayRead, i)) return !0;
          vn(l.arrayRead, e.arrayRead, i);
        }
        l.arrayVersion = n.version;
      }
    }
    return !1;
  }
  function In() {
    const e = /* @__PURE__ */ Object.create(null);
    return e.push = function() {
      const t = Me(arguments), n = q(this, { kind: "push", items: t });
      return L && ie(this, n - t.length, null, t), n;
    }, e.unshift = function() {
      const t = Me(arguments), n = q(this, { kind: "unshift", items: t });
      return L && ie(this, 0, null, t), n;
    }, e.pop = function() {
      k(this, "fromEnd", 1);
      const t = U(this).length - 1, n = q(this, { kind: "pop" });
      return L && t >= 0 && ie(this, t, [n], null), n;
    }, e.shift = function() {
      k(this, "index", 0);
      const t = U(this).length, n = q(this, { kind: "shift" });
      return L && t > 0 && ie(this, 0, [n], null), n;
    }, e.splice = function() {
      const t = Me(arguments), n = U(this).length, r = (a) => (a = Math.trunc(Number(a)) || 0, a < 0 ? Math.max(n + a, 0) : Math.min(a, n));
      let i = 0, l = 0, u = !1;
      if (t.length > 0) {
        const a = Math.trunc(Number(t[0])) || 0;
        if (i = r(a), (a < 0 || a > n) && (u = !0), t.length === 1)
          l = n - i, u = !0;
        else {
          const w = Math.trunc(Number(t[1])) || 0;
          l = Math.min(Math.max(w, 0), n - i), w > n - i && (u = !0);
        }
      }
      u && k(this, "length");
      for (let a = i; a < i + l; a++) k(this, "index", a);
      const d = q(this, { kind: "splice", args: t });
      return L && ie(this, i, d, t.slice(2)), d;
    }, ["reverse", "sort", "fill", "copyWithin"].forEach((t) => {
      e[t] = function() {
        const n = Me(arguments), r = L ? U(this).slice() : null;
        return q(this, { kind: t, args: n }), L && ie(this, 0, r, U(this).slice()), this.proxy;
      };
    }), [
      "indexOf",
      "lastIndexOf",
      "includes",
      "join",
      "slice",
      "concat",
      "flat",
      "entries",
      "keys",
      "values",
      "toString",
      "toLocaleString",
      "toReversed",
      "toSorted",
      "toSpliced",
      "with"
    ].forEach((t) => {
      typeof Array.prototype[t] == "function" && (e[t] = function() {
        const n = k(this, "whole");
        return Array.prototype[t].apply(n, arguments);
      });
    }), ["forEach", "map", "filter", "some", "every", "find", "findIndex", "findLast", "findLastIndex", "flatMap"].forEach((t) => {
      typeof Array.prototype[t] == "function" && (e[t] = function(n, r) {
        const i = k(this, "whole");
        if (typeof n != "function") return Array.prototype[t].apply(i, arguments);
        const l = this.proxy;
        return Array.prototype[t].call(i, (u, d) => n.call(r, u, d, l));
      });
    }), ["reduce", "reduceRight"].forEach((t) => {
      e[t] = function(n) {
        const r = k(this, "whole");
        if (typeof n != "function") return Array.prototype[t].apply(r, arguments);
        const i = this.proxy, l = (u, d, a) => n(u, d, a, i);
        return arguments.length > 1 ? Array.prototype[t].call(r, l, arguments[1]) : Array.prototype[t].call(r, l);
      };
    }), e.at = function(t) {
      if (t = Math.trunc(Number(t)) || 0, t >= 0) return k(this, "index", t)[t];
      const n = k(this, "fromEnd", -t);
      return n[n.length + t];
    }, e;
  }
  function Tn(e, t) {
    if (t === p)
      return this.meta;
    if (this.meta.rebuildTwin !== null) {
      let i = this.meta.rebuildTwin[p].handler;
      return i.get.apply(i, [i.target, t]);
    }
    if (W && !W(this, e, t))
      return H;
    if (typeof t == "symbol")
      return t === Symbol.iterator ? T.values.bind(this) : e[t];
    if (t === "length") return k(this, "length").length;
    if (Y(t)) {
      const i = Number(t);
      return k(this, "index", i)[i];
    }
    if (T[t]) return T[t].bind(this);
    if (t in Array.prototype || Object.prototype.hasOwnProperty.call(e, t)) return e[t];
    const n = re(), r = M();
    return o.inActiveRecording && f(o.context, this, t, n, r), Ce(this, t, n, r);
  }
  function Rt(e, t, n) {
    if (t === p) throw new Error("Cannot set the dedicated meta property '" + p + "'");
    if (this.meta.rebuildTwin !== null) {
      let r = this.meta.rebuildTwin[p].handler;
      return r.set.apply(r, [r.target, t, n]);
    }
    if (!(B && !B(this, e, t))) {
      if (t === "length") {
        const r = Number(n);
        if (r >>> 0 !== r) throw new RangeError("Invalid array length");
        const i = U(this);
        if (M() === null && i.length === r) return !0;
        const l = i.length;
        return q(this, { kind: "length", value: r }), Ft(this, t, r, l), !0;
      }
      if (Y(t)) {
        const r = Number(t), i = U(this), l = i[r];
        return M() === null && r in i && ce(l, n) || (q(this, { kind: "set", index: r, value: n }), nr(this, r, n, l)), !0;
      }
      if (typeof t == "symbol" || typeof n == "function")
        return e[t] = n, !0;
      if (this.meta.stateProperties && this.meta.stateProperties.has(t) && o.inRepeater !== null)
        throw new Error("Cannot write state property '" + t + "' from inside a repeater.");
      return Ee(this, t, n, !0);
    }
  }
  function Sn(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let n = this.meta.rebuildTwin[p].handler;
      return n.deleteProperty.apply(
        n,
        [n.target, t]
      );
    }
    if (!(B && !B(this, e, t))) {
      if (t === "length") return !1;
      if (Y(t)) {
        const n = Number(t), r = U(this);
        if (M() === null && !(n in r)) return !0;
        const i = r[n];
        return q(this, { kind: "delete", index: n }), tt(this, t, i), !0;
      }
      return kt.call(this, e, t);
    }
  }
  function jn(e) {
    if (this.meta.rebuildTwin !== null) {
      let l = this.meta.rebuildTwin[p].handler;
      return l.ownKeys.apply(
        l,
        [l.target]
      );
    }
    if (W && !W(this, e))
      return H;
    const t = k(this, "whole"), n = re(), r = M();
    o.inActiveRecording && b(o.context, this, n, r);
    const i = Object.keys(t);
    return i.push("length"), Reflect.ownKeys(e).forEach((l) => {
      l !== "length" && !Y(l) && i.push(l);
    }), Je(this, n, r).forEach((l) => {
      i.indexOf(l) === -1 && i.push(l);
    }), i;
  }
  function Nn(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let n = this.meta.rebuildTwin[p].handler;
      return n.has.apply(n, [n.target, t]);
    }
    if (W && !W(this, e, t))
      return H;
    if (t === "length") return !0;
    if (Y(t)) {
      const n = Number(t);
      return n in k(this, "index", n);
    }
    return typeof t == "symbol" || t in Array.prototype ? t in e : Qt.call(this, e, t);
  }
  function Mn(e, t, n) {
    if (this.meta.rebuildTwin !== null) {
      let r = this.meta.rebuildTwin[p].handler;
      return r.defineProperty.apply(
        r,
        [r.target, t, n]
      );
    }
    if (!(B && !B(this, e, t)))
      return t === "length" || Y(t) ? "value" in n ? Rt.call(this, e, t, n.value) : !1 : Dt.call(this, e, t, n);
  }
  function Wn(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let n = this.meta.rebuildTwin[p].handler;
      return n.getOwnPropertyDescriptor.apply(
        n,
        [n.target, t]
      );
    }
    if (W && !W(this, e, t))
      return H;
    if (t === "length")
      return { value: k(this, "length").length, writable: !0, enumerable: !1, configurable: !1 };
    if (Y(t)) {
      const n = Number(t), r = k(this, "index", n);
      return n in r ? { value: r[n], writable: !0, enumerable: !0, configurable: !0 } : void 0;
    }
    return Bt.call(this, e, t);
  }
  function Ln(e, t) {
    const n = e[p].handler, r = L ? U(n).slice() : null;
    q(n, { kind: "assign", items: t.slice() }), L && ie(n, 0, r, t.slice());
  }
  function kn(e, t) {
    const n = {
      key: Be,
      handler: e,
      isArray: !0,
      first: null,
      last: null,
      currentWriting: null,
      // The current content, and the writing it's the elements as of -
      // see moveArrayCursor(). None yet: built when first needed.
      cursorWriting: null,
      cursorContent: null,
      // Bumped by every change to the elements, anywhere on the timeline -
      // see recordArrayRead() and syncArrayMirror().
      version: 0
    };
    return Ge(n), n.first.content = t.slice(), e.mirrorVersion = n.version, n;
  }
  function Qn(e, t) {
    Object.keys(t).forEach(function(n) {
      if (Y(n)) return;
      const r = Object.getOwnPropertyDescriptor(t, n);
      if (typeof r.get == "function" || typeof r.set == "function" || typeof r.value == "function") return;
      delete t[n];
      const i = Ae(e, n, 0, null);
      i.value = r.value, i.set = !0;
    });
  }
  function Dn(e, t) {
    const n = e.elements, r = Q(n, _(), M()), i = te(n, r);
    let l = !1;
    const u = i.slice();
    for (let d = 0; d < u.length; d++) {
      if (!(d in u)) continue;
      const a = t(u[d]);
      a !== u[d] && (u[d] = a, l = !0);
    }
    l && (r.ops !== null ? r.ops = [{ kind: "assign", items: u.slice() }] : r.content = u.slice(), n.cursorContent = u, n.version++, ee.add(e));
  }
  function At(e, t) {
    return {
      time: e,
      // Which partial (or null, for external code) actually made this
      // writing - the tie-breaker when two writings share the same
      // declared `time` number (a parent and child defaulting to the same
      // level, most commonly) - see compareWritingToReader()/compareWriterOrder()
      // below.
      writer: typeof t > "u" ? null : t,
      value: void 0,
      set: !1,
      observers: null,
      timeline: null,
      next: null,
      previous: null,
      // Whether this writing is currently spliced into its timeline's own
      // linked list - see unlinkWriting()/spliceWritingIntoTimeline(). Kept
      // as an explicit flag rather than inferred from previous/next being
      // null, since a writing that's the sole entry in its timeline has
      // both null while still genuinely linked.
      linked: !1,
      // Owning-repeater staleness (see repeater.dispose() and
      // finalizeTouchedStaleWritings()/finalizeStaleWritings()): true
      // while this writing is this repeater's own prior output, unlinked
      // from its timeline (same as any other invalidated writing - a
      // repeater's prior output is invisible to everyone the instant it's
      // known to be stale, not just to itself) but held onto, not
      // discarded, in case this repeater's current rerun writes this same
      // property again - reused (same object, relinked) instead of always
      // creating a fresh one. nextValue/hasNextValue buffer whatever this
      // run's own write(s) to the same property produce, within the one
      // partial that claimed it - deliberately not compared against
      // `value` (or notified) until that partial closes, so a property
      // set, unset, and set again within one partial's own execution
      // settles once against the real before/after, not once per
      // intermediate write.
      stale: !1,
      hasNextValue: !1,
      nextValue: void 0,
      // Whether the buffered write sets the property (false: deletes it).
      nextSet: !1
    };
  }
  function Bn(e, t) {
    const n = At(0, null), r = {
      key: t,
      handler: e,
      first: n,
      last: n,
      // Cache pointer at the writing a reader/writer should start seeking
      // from - amortizes the common case where reads/writes at nearby
      // times cluster together, instead of always walking from `first`.
      currentWriting: n
    };
    return n.timeline = r, n.linked = !0, r;
  }
  function Ct(e, t, n) {
    const r = At(t, n);
    if (r.timeline = e, e.isArray) {
      const i = t === 0 && r.writer === null;
      r.ops = i ? null : [], r.content = i ? [] : null, r.observersAllFlagged = !1;
    }
    return r;
  }
  function Ge(e) {
    const t = Ct(e, 0, null);
    e.first = t, e.last = t, e.currentWriting = t, t.linked = !0;
  }
  function we(e, t) {
    let n = e.timelines[t];
    return typeof n > "u" ? n = e.timelines[t] = Bn(e, t) : n.first === null && Ge(n), n;
  }
  function Fn(e) {
    return {
      id: o.observerId++,
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
      executionCursor: null,
      // This pipeline's one, single time level - set once, here, from its
      // root repeater's own declared time (or 0), and never changed after
      // (an {independent: true} root with no declared time takes its
      // creator's level instead - see repeat(), set right after this).
      // Every repeater sharing this chainHead uses it - see repeater.time()
      // - since a pipeline was decided to always execute within exactly
      // one time level (nothing forces a nested repeater to ever declare a
      // different one; if something legitimately needs to run at an
      // earlier/later level, that's a *different* pipeline, owned by
      // whatever component requested it, not a child of this one).
      time: typeof e.options.time < "u" ? e.options.time : 0,
      rootRepeater: e,
      // This pipeline's own work, this wave - see "Repeater scheduling"
      // below for the full design. sortedQueue: repeaters needing attention,
      // sorted by repeater.firstPartial's live orderNumber (see
      // sortedQueueInsert/sortedQueuePopMin) - never the root repeater itself, which is
      // always earlier than anything that could be in here and is checked
      // directly instead (see drainActivePipeline). parkedRepeaters:
      // repeaters that arrived behind this pipeline's own wavefront,
      // waiting for the next wave (see scheduleWork). wavefront: the
      // firstPartial of the last-processed repeater this active session -
      // only meaningful while this chainHead === state.activePipeline.
      sortedQueue: [],
      parkedRepeaters: [],
      wavefront: null,
      // This chainHead's own membership in state.workQueue[time] - which
      // of its two lists (if either) it's currently sitting in, plus the
      // FIFO linkage within that list. null while fully idle (and while
      // this chainHead === state.activePipeline, mid-drain - see
      // ensurePipelineActiveOrParked()).
      queueMembership: null,
      nextQueued: null,
      previousQueued: null
    };
  }
  const Oe = Number.MAX_SAFE_INTEGER, Et = Math.floor((Oe - 1) / 2);
  function Pt(e) {
    const t = e.count / Oe;
    return t < 0.25 ? 65536 : t < 0.75 ? 256 : 1;
  }
  function It(e, t) {
    if (e.count >= Et)
      throw new Error("Partial chain exhausted its order-number space (" + Et + " live partials)");
    const n = e.executionCursor, r = n !== null ? n.orderNext : null;
    let i;
    if (n === null)
      i = 0;
    else if (r === null)
      i = n.orderNumber + Pt(e);
    else {
      const l = Pt(e), u = n.orderNumber + l;
      i = u < r.orderNumber ? u : Math.floor((n.orderNumber + r.orderNumber) / 2);
    }
    t.orderNumber = i, t.orderPrevious = n, t.orderNext = r, n !== null ? n.orderNext = t : e.first = t, r !== null ? r.orderPrevious = t : e.last = t, e.count++, e.executionCursor = t, r !== null && (i - n.orderNumber <= 1 || r.orderNumber - i <= 1) && Xn(e, t);
  }
  function Xn(e, t) {
    const n = t.orderNumber;
    let r = t, i = t, l = 0, u = 0, d = 1, a = !1, w = !1;
    function C() {
      if (i.orderNext === null) {
        u = Oe - n, a = !0;
        return;
      }
      i = i.orderNext, u = i.orderNumber - n, d++;
    }
    function y() {
      if (r.orderPrevious === null) {
        w = !0;
        return;
      }
      r = r.orderPrevious, l = n - r.orderNumber, d++;
    }
    for (C(); !(a && w) && d / (u + l) > 0.5; )
      w ? C() : a || u > l ? y() : C();
    const A = r.orderNumber, S = a ? Oe : i.orderNumber, D = [];
    for (let F = r; D.push(F), F !== i; F = F.orderNext)
      ;
    const z = D.length - 1;
    if (z <= 0) return;
    const j = (S - A) / z;
    for (let F = 0; F < D.length; F++)
      D[F].orderNumber = Math.round(A + F * j);
  }
  function zn(e, t, n) {
    t.orderNumber = n.orderNumber, t.orderPrevious = n.orderPrevious, t.orderNext = n.orderNext, t.orderPrevious !== null ? t.orderPrevious.orderNext = t : e.first = t, t.orderNext !== null ? t.orderNext.orderPrevious = t : e.last = t, e.executionCursor = t;
  }
  function Tt(e, t) {
    t.orderPrevious !== null ? t.orderPrevious.orderNext = t.orderNext : e.first = t.orderNext, t.orderNext !== null ? t.orderNext.orderPrevious = t.orderPrevious : e.last = t.orderPrevious, e.executionCursor === t && (e.executionCursor = t.orderPrevious || t.orderNext || null), t.orderPrevious = null, t.orderNext = null, e.count--;
  }
  function qn(e, t) {
    Tt(e, t), It(e, t);
  }
  function he(e, t) {
    if (e === t) return 0;
    if (e === null) return -1;
    if (t === null) return 1;
    const n = e.repeater.chainHead, r = t.repeater.chainHead;
    if (n !== r) return n.id - r.id;
    const i = Kn(e, t);
    return i !== null ? i : e.orderNumber - t.orderNumber;
  }
  function St(e) {
    const t = [];
    let n = e;
    for (; n; )
      t.push(n), n = n.parentRepeater;
    return t;
  }
  function Vn(e, t, n) {
    const r = e.children, i = t.childList === r, l = n.childList === r;
    if (i && l) return t.siblingIndex < n.siblingIndex ? -1 : 1;
    if (i) return -1;
    if (l) return 1;
    const u = e.pendingChildren;
    if (t.childList === u && n.childList === u) return t.siblingIndex < n.siblingIndex ? -1 : 1;
    const d = t.listMembership === "pending", a = n.listMembership === "pending";
    return d && !a ? 1 : a && !d ? -1 : null;
  }
  function Kn(e, t) {
    if (e === t) return 0;
    if (e === null) return -1;
    if (t === null) return 1;
    const n = St(e), r = St(t);
    let i = n.length - 1, l = r.length - 1;
    if (n[i] !== r[l]) return null;
    for (; i >= 0 && l >= 0 && n[i] === r[l]; )
      i--, l--;
    if (i < 0 || l < 0)
      return i < 0 ? -1 : 1;
    const u = n[i + 1];
    return Vn(u, n[i], r[l]);
  }
  function ne(e, t, n, r) {
    return e !== n ? e - n : t !== null && r !== null && t.repeater.chainHead !== r.repeater.chainHead ? -1 : he(t, r);
  }
  function Q(e, t, n) {
    if (typeof n > "u" && (n = null), e.currentWriting === null && Ge(e), t === 1 / 0)
      return e.currentWriting = e.last;
    let r = e.currentWriting;
    if (ne(r.time, r.writer, t, n) <= 0)
      for (; r.next !== null && ne(r.next.time, r.next.writer, t, n) <= 0; )
        r = r.next;
    else
      for (; ne(r.time, r.writer, t, n) > 0; )
        r = r.previous;
    return e.currentWriting = r, r;
  }
  function Ue(e, t, n) {
    const r = Q(e, t, n);
    return ne(r.time, r.writer, t, n) === 0 ? r : null;
  }
  function He(e, t) {
    const n = Q(e, t.time, t.writer), r = n.next;
    t.writer !== null && (jt(e, t, n), r !== null && jt(e, t, r)), t.previous = n, t.next = r, n.next = t, r !== null ? r.previous = t : e.last = t, e.currentWriting = t, t.linked = !0, e.isArray && xn(e, t);
  }
  function jt(e, t, n) {
    if (n.writer === null || n.time !== t.time) return;
    const r = n.writer.repeater, i = t.writer.repeater;
    if (r.chainHead !== i.chainHead)
      throw new Error(
        (e.isArray ? "Array elements are" : "Property '" + e.key + "' is") + " already written at time level " + t.time + " by repeater '" + (r.chainHead.rootRepeater.description || "unnamed") + "'s pipeline; repeater '" + (i.description || "unnamed") + "' belongs to a different pipeline at the same time level and cannot write it too. Parallel pipelines may read each other's properties (seeing the latest writing), but each property has one writer pipeline per time level."
      );
  }
  function Ye(e, t, n) {
    const r = Ct(e, t, n);
    return He(e, r), r;
  }
  function _e(e) {
    const t = e.timeline;
    if (e.linked) {
      const n = e.previous, r = t.isArray ? t.cursorWriting : null, i = t.isArray ? t.cursorContent : null;
      Lt(e), He(t, e), r !== null && e.previous === n && (t.cursorWriting = r, t.cursorContent = i);
      return;
    }
    He(t, e);
  }
  function Nt(e) {
    return e.hasNextValue ? { set: e.nextSet, value: e.nextSet ? e.nextValue : void 0 } : { set: e.set, value: e.value };
  }
  function Mt(e, t) {
    const n = Nt(e), r = Nt(t);
    return n.set !== r.set ? !1 : n.set ? ce(n.value, r.value) : !0;
  }
  function Re(e, t) {
    return e.observer.type === "partial" && t !== null && e.observer.repeater.chainHead === t.repeater.chainHead;
  }
  function Gn(e, t) {
    return e.observers === null ? !1 : g(e, () => !0).some((n) => Re(n, t));
  }
  function Wt(e, t, n) {
    if (n.length === 0) return;
    const r = Mt(e, t);
    Qe(() => n.forEach((i) => {
      if (!i.flagged) {
        if (r) {
          x(e, t, i);
          return;
        }
        Re(i, t.writer) ? st(i.observer.repeater, i, e) : (x(e, t, i), ue(i.observer, t.timeline.handler.proxy, t.timeline.key));
      }
    }));
  }
  function $e(e) {
    if (e.timeline.isArray) {
      Ke(e, e.writer);
      return;
    }
    const t = e.previous;
    if (t === null) return;
    const n = g(
      t,
      (r, i) => ne(e.time, e.writer, r, i) < 0
    );
    Wt(t, e, n);
  }
  function Un(e, t) {
    if (e.observers === null) return;
    const n = g(e, () => !0);
    Wt(e, t, n);
  }
  function Hn(e, t, n, r) {
    const i = we(e, t);
    return Ue(i, n, r) || Ye(i, n, r);
  }
  function Yn(e, t, n, r, i) {
    if (e.observers === null || o.blockInvalidation > 0) return;
    const l = g(
      e,
      (u, d) => ne(t, n, u, d) < 0
    );
    o.postponeInvalidation++;
    try {
      l.forEach((u) => ue(u.observer, r, i));
    } finally {
      o.postponeInvalidation--;
    }
    me();
  }
  function Lt(e) {
    const t = e.timeline;
    t.isArray && wn(t, e), e.previous !== null ? e.previous.next = e.next : t.first = e.next, e.next !== null ? e.next.previous = e.previous : t.last = e.previous, t.currentWriting === e && (t.currentWriting = e.previous || e.next || null), e.previous = null, e.next = null, e.linked = !1;
  }
  function Ae(e, t, n, r) {
    return Q(we(e, t), n, r);
  }
  function _n(e, t, n) {
    return Q(we(e, c), t, n);
  }
  function $n(e, t) {
    Object.keys(t).forEach(function(n) {
      const r = Object.getOwnPropertyDescriptor(t, n);
      if (typeof r.get == "function" || typeof r.set == "function" || typeof r.value == "function")
        return;
      delete t[n];
      const i = Ae(e, n, 0, null);
      i.value = r.value, i.set = !0;
    });
  }
  function ge(e, t, n, r) {
    const i = e.timelines[t];
    if (typeof i > "u") return !1;
    const l = Q(i, n, r);
    return l.hasNextValue ? l.nextSet : l.set;
  }
  function Ce(e, t, n, r) {
    const i = e.timelines[t];
    if (typeof i > "u") return;
    const l = Q(i, n, r);
    return l.hasNextValue ? l.nextSet ? l.nextValue : void 0 : l.set ? l.value : void 0;
  }
  function Jn(e, t, n, r, i) {
    const l = Hn(e, t, r, i);
    l.value = n, l.set = !0;
  }
  function Je(e, t, n) {
    const r = [];
    for (let i in e.timelines)
      Q(e.timelines[i], t, n).set && r.push(i);
    return r;
  }
  function _() {
    const e = o.context;
    return e && typeof e.time == "function" ? e.time() : 0;
  }
  function re() {
    const e = o.context;
    return e && typeof e.time == "function" ? e.time() : 1 / 0;
  }
  function M() {
    const e = o.context;
    return e && e.type === "partial" ? e : null;
  }
  function Zn(e, t) {
    if (t === p)
      return this.meta;
    if (t === Le)
      return this.timelines;
    if (this.meta.rebuildTwin !== null) {
      let l = this.meta.rebuildTwin[p].handler;
      return l.get.apply(l, [l.target, t]);
    }
    if (W && !W(this, e, t))
      return H;
    const n = re(), r = M();
    o.inActiveRecording && f(o.context, this, t, n, r);
    let i = e;
    for (; i !== null && typeof i < "u"; ) {
      let l = Object.getOwnPropertyDescriptor(i, t);
      if (typeof l < "u" && typeof l.get < "u")
        return l.get.bind(this.meta.proxy)();
      i = Object.getPrototypeOf(i);
    }
    return ge(this, t, n, r) ? Ce(this, t, n, r) : e[t];
  }
  function er(e, t, n) {
    if (t === p) throw new Error("Cannot set the dedicated meta property '" + p + "'");
    if (t === Le) throw new Error("Cannot set the dedicated timelines property '" + Le + "'");
    if (this.meta.rebuildTwin !== null) {
      let i = this.meta.rebuildTwin[p].handler;
      return i.set.apply(i, [i.target, t, n]);
    }
    if (this.meta.stateProperties && this.meta.stateProperties.has(t) && o.inRepeater !== null)
      throw new Error(
        "Cannot write state property '" + t + "' from inside a repeater. State is written at initialization (declareState/initialState), from an event handler outside any repeater, or deliberately at initial time via accessInitialValues()/setState()."
      );
    if (B && !B(this, e, t))
      return;
    let r = e;
    for (; r !== null && typeof r < "u"; ) {
      let i = Object.getOwnPropertyDescriptor(r, t);
      if (typeof i < "u" && typeof i.set == "function")
        return i.set.call(this.meta.proxy, n), !0;
      if (typeof i < "u" && typeof i.get < "u")
        return !1;
      r = Object.getPrototypeOf(r);
    }
    return Ee(this, t, n, !0);
  }
  function Ee(e, t, n, r) {
    const i = _(), l = M(), u = we(e, t), d = o.context;
    let a = d && d.writings ? d.writings.get(u) : void 0, w = !1, C = null;
    if (typeof a > "u") {
      const S = l !== null ? l.repeater : null, D = S !== null && S.staleWritings !== null ? S.staleWritings.get(u) : void 0;
      if (D && D.length > 0) {
        const z = D.shift();
        D.length === 0 && S.staleWritings.delete(u), Gn(z, l) ? C = z : (a = z, d.touchedStaleWritings === null && (d.touchedStaleWritings = []), d.touchedStaleWritings.push(a));
      }
      typeof a > "u" && (a = Ue(u, i, l), a === null && (a = Ye(u, i, l), w = !0));
    }
    if (a.stale)
      return a.hasNextValue = !0, a.nextSet = r, a.nextValue = r ? n : void 0, a.writer = l, _e(a), d && d.writings && d.writings.set(u, a), !0;
    const y = a.set, A = a.value;
    return r && y && ce(A, n) || !r && !y && !w && C === null || (a.value = r ? n : void 0, a.set = r, d && d.writings && d.writings.set(u, a), (r || y) && h(a, e.proxy, t), w && $e(a), C !== null && Un(C, a), (r ? !y : y || w) && m(e, t, i, l), r ? Ft(e, t, n, A) : tt(e, t, A)), !0;
  }
  function kt(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let u = this.meta.rebuildTwin[p].handler;
      return u.deleteProperty.apply(
        u,
        [u.target, t]
      ), !0;
    }
    if (B && !B(this, e, t))
      return;
    const n = _(), r = M();
    if (r !== null)
      return ge(this, t, n, r) ? Ee(this, t, void 0, !1) : !0;
    const i = ge(this, t, n, r);
    if (!i && !(t in e))
      return !0;
    let l;
    if (i) {
      const u = Ae(this, t, n, r);
      l = u.value, u.value = void 0, u.set = !1;
    } else
      l = e[t], delete e[t];
    return O(this, t, n, r), m(this, t, n, r), tt(this, t, l), !0;
  }
  function tr(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let l = this.meta.rebuildTwin[p].handler;
      return l.ownKeys.apply(
        l,
        [l.target, t]
      );
    }
    if (W && !W(this, e, t))
      return H;
    const n = re(), r = M();
    o.inActiveRecording && b(o.context, this, n, r);
    let i = Object.keys(e);
    return Je(this, n, r).forEach(function(l) {
      i.indexOf(l) === -1 && i.push(l);
    }), i;
  }
  function Qt(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let i = this.meta.rebuildTwin[p].handler;
      return i.has.apply(
        i,
        [i.target, t]
      );
    }
    if (W && !W(this, e, t))
      return H;
    const n = re(), r = M();
    return o.inActiveRecording && b(o.context, this, n, r), ge(this, t, n, r) ? !0 : t in e;
  }
  function Dt(e, t, n) {
    if (this.meta.rebuildTwin !== null) {
      let r = this.meta.rebuildTwin[p].handler;
      return r.defineProperty.apply(
        r,
        [r.target, t, n]
      );
    }
    if (!(B && !B(this, e, t)))
      return "value" in n && typeof n.value != "function" ? Ee(this, t, n.value, !0) : (m(this, t, _(), M()), Reflect.defineProperty(e, t, n));
  }
  function Bt(e, t) {
    if (this.meta.rebuildTwin !== null) {
      let l = this.meta.rebuildTwin[p].handler;
      return l.getOwnPropertyDescriptor.apply(l, [l.target, t]);
    }
    if (W && !W(this, e, t))
      return H;
    const n = re(), r = M();
    o.inActiveRecording && b(o.context, this, n, r);
    const i = Object.getOwnPropertyDescriptor(e, t);
    if (typeof i < "u") return i;
    if (ge(this, t, n, r))
      return {
        value: Ce(this, t, n, r),
        writable: !0,
        enumerable: !0,
        configurable: !0
      };
  }
  function V(e) {
    return e !== null && typeof e == "object" && typeof e[p] == "object" && e[p].world === E;
  }
  function Ze(e, t) {
    if (typeof e > "u" && (e = {}), typeof e != "object") return e;
    if (typeof t > "u" && (t = null), V(e))
      throw new Error("Cannot observe an already observed object!");
    let n;
    e instanceof Array ? n = {
      // Its other (non-index) properties - see "Array Handlers".
      timelines: /* @__PURE__ */ Object.create(null),
      // Set right below - see createElementsTimeline().
      elements: null,
      // The elements timeline's version the target last mirrored - see
      // syncArrayMirror().
      mirrorVersion: 0,
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: Tn,
      set: Rt,
      deleteProperty: Sn,
      ownKeys: jn,
      has: Nn,
      defineProperty: Mn,
      getOwnPropertyDescriptor: Wn
    } : n = {
      // Object.create(null), not {} - this is used as a map from
      // property key to timeline (see hasTimelineValue/getOrCreateTimeline),
      // checked via `typeof timelines[key] === 'undefined'`. A plain {}
      // has its own prototype chain, so a key that collides with one of
      // Object.prototype's own member names ("toString", "valueOf",
      // "hasOwnProperty", "constructor", ...) resolves to *that*
      // built-in function instead of undefined - hasTimelineValue's own
      // check never catches it, and whatever called seekWriting with it
      // crashes reading .time off a function that obviously has no such
      // property. Never triggered before a real, user-defined
      // toString() existed on any observable's own prototype (see
      // cascade.component's Component.toString()) for anyone to ever
      // actually read - this file's own timelines lookup was already
      // this fragile, just never exercised.
      timelines: /* @__PURE__ */ Object.create(null),
      // getPrototypeOf: function () {},
      // setPrototypeOf: function () {},
      // isExtensible: function () {},
      // preventExtensions: function () {},
      // apply: function () {},
      // construct: function () {},
      get: Zn,
      set: er,
      deleteProperty: kt,
      ownKeys: tr,
      has: Qt,
      defineProperty: Dt,
      getOwnPropertyDescriptor: Bt
    };
    let r = new Proxy(e, n);
    if (n.target = e, n.proxy = r, n.meta = {
      world: E,
      id: "not yet",
      // Wait for rebuild analysis
      buildId: t,
      rebuildTwin: null,
      target: e,
      handler: n,
      proxy: r,
      // Here to avoid prevent events being sent to objects being rebuilt.
      isRebuildTwin: !1
    }, e instanceof Array ? (n.elements = kn(n, e), Qn(n, e)) : $n(n, e), o.inRepeater !== null) {
      const i = o.inRepeater;
      if (t !== null) {
        if (i.newBuildIdObjectMap || (i.newBuildIdObjectMap = {}), typeof i.newBuildIdObjectMap[t] < "u")
          throw new Error('Duplicate key "' + t + '" in one build (a ' + (e.constructor ? e.constructor.name : "object") + "): keys must be unique among what a build constructs.");
        if (i.buildIdObjectMap && typeof i.buildIdObjectMap[t] < "u" && Object.getPrototypeOf(i.buildIdObjectMap[t][p].target) === Object.getPrototypeOf(e)) {
          n.meta.isRebuildTwin = !0;
          let l = i.buildIdObjectMap[t];
          l[p].rebuildTwin = r, i.options.rebuildShapeAnalysis && (n.meta.establishedOriginal = l), n.meta.id = "temp-" + o.nextTempObjectId++, i.newBuildIdObjectMap[t] = l, r = l, n = r[p].handler, Xt(l[p].handler);
        } else
          n.meta.id = o.nextObjectId++, n.meta.pendingOnEstablishCall = !0, i.newBuildIdObjectMap[t] = r, Pe(n);
        i.options.rebuildShapeAnalysis && (i.newIdObjectShapeMap || (i.newIdObjectShapeMap = {}), i.newIdObjectShapeMap[n.meta.id] = r);
      } else i.options.rebuildShapeAnalysis ? (n.meta.id = o.nextObjectId++, n.meta.pendingCreationEvent = !0, n.meta.pendingOnEstablishCall = !0, i.newIdObjectShapeMap || (i.newIdObjectShapeMap = {}), i.newIdObjectShapeMap[n.meta.id] = r) : (n.meta.id = o.nextObjectId++, Pe(n));
    } else
      n.meta.id = o.nextObjectId++, Pe(n);
    return r;
  }
  function et(e, t) {
    if (V(e) || typeof e != "object" || e === null) return e;
    let n;
    if (t) {
      const r = e instanceof Array ? [] : {};
      for (let i in e)
        r[i] = et(e[i], t);
      n = r;
    } else {
      n = e;
      for (let r in e)
        n[r] = et(n[r], t);
    }
    return Ze(n);
  }
  function ie(e, t, n, r) {
    L && le(e, { type: "splice", index: t, removed: n, added: r });
  }
  function nr(e, t, n, r) {
    L && le(e, {
      type: "splice",
      index: t,
      removed: [r],
      added: [n]
    });
  }
  function Ft(e, t, n, r) {
    L && le(e, {
      type: "set",
      property: t,
      newValue: n,
      oldValue: r
    });
  }
  function tt(e, t, n) {
    L && le(e, {
      type: "delete",
      property: t,
      deletedValue: n
    });
  }
  function Xt(e) {
    L && le(e, { type: "reCreate" });
  }
  function Pe(e) {
    L && le(e, { type: "create" });
  }
  function rr(e) {
    L && le(e, { type: "dispose" });
  }
  function le(e, t) {
    t.object = e.meta.proxy, t.objectId = e.meta.id, !(!cn && e.meta.isRebuildTwin) && (ke && ke(t), gt && typeof e.target.onChange == "function" && e.proxy.onChange(t));
  }
  function me() {
    if (o.postponeInvalidation == 0) {
      o.postponeRefreshRepeaters++;
      try {
        for (; o.nextObserverToInvalidate !== null; ) {
          let e = o.nextObserverToInvalidate;
          o.nextObserverToInvalidate = null;
          const t = e.nextToNotify;
          t ? (e.nextToNotify = null, o.nextObserverToInvalidate = t) : o.lastObserverToInvalidate = null, e.invalidateAction();
        }
      } finally {
        o.postponeRefreshRepeaters--;
      }
      en();
    }
  }
  function ue(e, t, n) {
    if (e.type === "partial" && e.repeater.isRecording) {
      se(e.repeater, e);
      return;
    }
    let r = !1, i = o.context;
    for (; i; ) {
      if (i === e) {
        r = !0;
        break;
      }
      i = i.parent;
    }
    r || (e.invalidatedInContext = o.context, e.invalidatedByKey = n, e.invalidatedByObject = t, e.dispose(), o.postponeInvalidation > 0 ? (o.lastObserverToInvalidate !== null ? o.lastObserverToInvalidate.nextToNotify = e : o.nextObserverToInvalidate = e, o.lastObserverToInvalidate = e) : e.invalidateAction(n));
  }
  function ir(e, t) {
    return {
      isRecording: !0,
      type: "invalidator",
      id: o.observerId++,
      description: e,
      sources: [],
      nextToNotify: null,
      invalidateAction: t,
      dispose: function() {
        R(this);
      },
      record: function(n) {
        if (o.context == this || this.isRemoved) return n();
        const r = ae(this);
        try {
          return n();
        } finally {
          Z(r);
        }
      },
      returnValue: null,
      causalityString() {
        return "<invalidator>" + this.invalidateAction;
      }
    };
  }
  function zt() {
    let e, t, n = null;
    if (arguments.length > 2)
      n = arguments[0], e = arguments[1], t = arguments[2];
    else {
      if (fn) throw new Error("Missing description for 'invalidateOnChange'");
      e = arguments[0], t = arguments[1];
    }
    const r = I(n, t);
    ae(r);
    try {
      r.returnValue = e(r);
    } finally {
      Z(r);
    }
    return r;
  }
  function lr(e) {
    return {
      type: "partial",
      id: o.observerId++,
      description: e.description,
      repeater: e,
      sources: [],
      // Writings this partial itself produced, last run - see
      // repeater.dispose() (which collects these, across all of a
      // repeater's own partials, into the repeater-level staleWritings
      // map) and finalizeStaleWritings().
      writings: /* @__PURE__ */ new Map(),
      // Stale writings (see repeater.dispose()/finalizeStaleWritings())
      // this specific partial has claimed and buffered a nextValue for so
      // far - finalized (compared, reused-or-notified) the moment *this*
      // partial closes (see attachToCurrentParent()/refresh()), not
      // deferred until the whole repeater's run finishes. That scoping
      // matters: a repeater's later partial's own reads (or an entirely
      // different repeater's, interleaved via the dirty queue) may depend
      // on what an *earlier* partial of this same repeater just wrote,
      // and need to see that notification in real time, in the same
      // relative order the old writes themselves happened in - not have
      // it batched up behind everything the rest of this run's later
      // partials also happen to touch.
      touchedStaleWritings: null,
      // Array writings this partial wrote - their readers settled when it
      // closes, all its operations at once (see mutateArray()/
      // settleTouchedArrayWritings()).
      touchedArrayWritings: null,
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
        this.repeater.invalidateAction(this);
      },
      causalityString() {
        return "<partial of> " + this.repeater.causalityString();
      }
    };
  }
  function Ie() {
    return { first: null, last: null };
  }
  function qt(e, t) {
    t.previousSibling = e.last, t.nextSibling = null, t.siblingIndex = e.last !== null ? e.last.siblingIndex + 1 : 0, t.childList = e, e.last !== null ? e.last.nextSibling = t : e.first = t, e.last = t;
  }
  function Te(e, t) {
    t.previousSibling !== null ? t.previousSibling.nextSibling = t.nextSibling : e.first = t.nextSibling, t.nextSibling !== null ? t.nextSibling.previousSibling = t.previousSibling : e.last = t.previousSibling, t.previousSibling = null, t.nextSibling = null, t.childList = null;
  }
  function Vt(e) {
    const t = lr(e);
    let n = !1;
    if (e.reconciling) {
      const r = e.pendingChildren.first;
      r !== null && r.type === "partial" ? (Te(e.pendingChildren, r), R(r), zn(e.chainHead, t, r), n = !0) : e.reconciling = !1;
    }
    return n || It(e.chainHead, t), e.rightmostPartial = t, t.parentRepeater = e, t.listMembership = "confirmed", e.currentPartial = t, qt(e.children, t), t;
  }
  function nt(e, t, n) {
    if (e.type === "partial")
      for (const r of e.writings.values()) t.push(r);
    else {
      const r = n ? [e.children, e.pendingChildren] : [e.children];
      for (const i of r) {
        let l = i.first;
        for (; l !== null; )
          nt(l, t, n), l = l.nextSibling;
      }
    }
  }
  function or(e, t) {
    let n = e;
    for (; n !== null; ) {
      if (n === t) return !0;
      n = n.parentRepeater;
    }
    return !1;
  }
  function sr(e, t) {
    const n = [];
    nt(e, n);
    for (const r of n) {
      const i = g(r, () => !0);
      for (const l of i)
        l.flagged || or(l.observer.repeater, t) && (he(r.writer, l.writer) < 0 || (l.flagged = !0, se(l.observer.repeater)));
    }
  }
  function ur(e) {
    const t = [];
    nt(e, t, !0);
    const n = /* @__PURE__ */ new Map();
    for (const r of t) {
      if (!r.linked) continue;
      let i = n.get(r.timeline);
      i || (i = [], n.set(r.timeline, i)), i.push(r);
    }
    for (const r of n.values()) {
      r.sort((i, l) => he(i.writer, l.writer));
      for (const i of r)
        _e(i), $e(i);
    }
  }
  function Kt(e) {
    const t = o.context;
    if (!t || t.type !== "partial")
      return;
    const n = t.repeater;
    let r = null, i = !1;
    if (n.reconciling && n.pendingChildren.first === e)
      Te(n.pendingChildren, e);
    else {
      if (i = !0, n.reconciling = !1, e.parentRepeater === n && e.listMembership === "pending") {
        r = [];
        let d = n.pendingChildren.first;
        for (; d !== e; )
          r.push(d), d = d.nextSibling;
        Te(n.pendingChildren, e);
      }
      e.rightmostPartial && qn(n.chainHead, e.rightmostPartial);
    }
    const l = e.parentRepeater;
    if (l && l !== n && e.listMembership && Te(e.listMembership === "pending" ? l.pendingChildren : l.children, e), e.parentRepeater = n, e.listMembership = "confirmed", typeof e.retracted < "u" && (e.retracted = !1), qt(n.children, e), i && ur(e), r !== null)
      for (const d of r)
        sr(d, e);
    n.chainHead.executionCursor = e.rightmostPartial, ut(t), Z(t);
    const u = Vt(n);
    ae(u);
  }
  function Gt(e) {
    let t = e.pendingChildren.first;
    for (; t !== null; ) {
      const n = t.nextSibling;
      t.previousSibling = null, t.nextSibling = null, t.listMembership = null, t.type === "partial" ? (R(t), vr(t)) : Ut(t), t = n;
    }
    e.pendingChildren = Ie();
  }
  function Ut(e) {
    e.retracted || (e.dispose(), Gt(e), Jt(e), e.workStatus = null, e.flagRecords = null, e.retracted = !0, e.options.onRetract && e.options.onRetract(e));
  }
  function fr(e, t, n, r, i) {
    return {
      isRecording: !0,
      type: "repeater",
      id: o.observerId++,
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
      // This repeater's own *first* partial of its current/latest run -
      // set fresh every refresh() (see there), never left pointing at a
      // stale object across reruns. The position used for this repeater's
      // own sortedQueue entry (see "Repeater scheduling" below) - has to be the
      // first partial, not rightmostPartial: a child's first partial is
      // always created strictly after its parent's own first partial
      // begins (the parent's own action is what creates the child), so
      // first-partial ordering guarantees a parent's sortedQueue entry always
      // sorts before any of its descendants' - exactly what makes the
      // lazy-pruning discard in drainActivePipeline() correct.
      // rightmostPartial has the opposite property (by construction it's
      // always >= any descendant's), so it would sort a parent *after*
      // its own children - the wrong direction.
      firstPartial: null,
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
      children: Ie(),
      pendingChildren: Ie(),
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
      // This repeater's own writings from its previous run, keyed by
      // timeline (each a FIFO queue, not a single writing - see
      // dispose()'s own comment on why: this same repeater can easily
      // write the very same property more than once in one run, from
      // different partials), from the moment dispose() marks them stale
      // until each is either claimed this run (moved into
      // touchedStaleWritings below) or left here to be genuinely
      // abandoned once this repeater's current run finishes (see
      // finalizeStaleWritings()). Timeline-identity-keyed, not
      // position-keyed - this is what lets a rerun whose own structure
      // changed enough to break positional reconciliation still recognize
      // "I already have a writing for this exact property" instead of
      // always creating a fresh one (and always notifying, even when
      // nothing really changed). Lazily created (most repeaters never
      // write anything of their own). Never shared with another repeater -
      // see finalizeStaleWritings()'s note on why writings can't be reused
      // across repeaters.
      staleWritings: null,
      // Dependencies of this repeater's own (still-live, not-yet-rerun)
      // partials that migrateOvertakenObserversFor found possibly
      // overtaken by a closer writing, but couldn't yet resolve for real -
      // see flagRepeaterEntry()/resolveFlaggedRepeater(). Each entry is
      // {entry, previousWriting}: `entry` is the very same {observer,
      // time, writer, flagged} object still sitting in
      // `previousWriting.observers` (untouched - see
      // migrateOvertakenObserversFor's own comment on why leaving it
      // there is exactly what keeps it covered by previousWriting's own
      // ordinary invalidation in the meantime). Lazily created; null means
      // "nothing pending".
      flagRecords: null,
      // null | 'invalid' | 'flagged' - see "Repeater scheduling" above.
      // 'invalid' always wins over 'flagged' and is never downgraded back
      // (see flagRepeaterEntry()). Cleared (back to null) the moment
      // processRepeater() actually acts on it.
      workStatus: null,
      // Two separate dedup flags, for the two different places a repeater
      // can be waiting in the scheduler - see scheduleWork(). A root
      // repeater (parentRepeater === null) only ever uses inATimeBucket;
      // inSortedQueue stays false for it forever, since a root never enters a
      // sortedQueue (see drainActivePipeline() - it's always checked directly
      // instead, being unconditionally the earliest position in its own
      // pipeline). A nested repeater only ever uses inSortedQueue.
      inSortedQueue: !1,
      inATimeBucket: !1,
      nextToNotify: null,
      repeaterAction: t,
      nonRecordedAction: n,
      options: r || {},
      finishRebuilding() {
        i(this);
      },
      time() {
        return this.chainHead.time;
      },
      causalityString() {
        const l = this.invalidatedInContext, u = this.invalidatedByObject;
        if (!u) return "Repeater started: " + this.description;
        const d = this.invalidatedByKey, a = l ? l.description : "outside repeater/invalidator", w = "  " + u.toString() + "." + d, C = "" + this.description;
        return "(" + a + ")" + w + " --> " + C;
      },
      sourcesString() {
        let l = "";
        if (!this.currentPartial) return l;
        for (let u of this.currentPartial.sources) {
          for (; u.parent; ) u = u.parent;
          l += u.handler.proxy.toString() + "." + u.key + `
`;
        }
        return l;
      },
      restart() {
        this.retracted && this.parentRepeater === null && (this.retracted = !1), this.invalidateAction();
      },
      // `partial`: which of its partials read what changed, when it's a
      // read that's invalidated (see invalidateRepeater()).
      invalidateAction(l) {
        se(this, l);
      },
      dispose() {
        if (this.children.first !== null) {
          let l = this.children.first;
          for (; l !== null; )
            l.listMembership = "pending", l.type === "partial" && l.writings.forEach((u, d) => {
              Lt(u), u.stale = !0, this.staleWritings === null && (this.staleWritings = /* @__PURE__ */ new Map());
              let a = this.staleWritings.get(d);
              typeof a > "u" && (a = [], this.staleWritings.set(d, a)), a.push(u);
            }), l = l.nextSibling;
          this.pendingChildren = this.children, this.children = Ie();
        }
        this.currentPartial = null;
      },
      refresh() {
        const l = this, u = l.options;
        u.onRefresh && u.onRefresh(l), l.finishedRebuilding = !1, l.reconciling = l.pendingChildren.first !== null;
        const d = Vt(l);
        l.firstPartial = d, l.invalidatedWhileRunning = !1, l.isRecording = !0;
        const a = o.context;
        ae(d);
        try {
          l.returnValue = l.repeaterAction(l);
        } catch (C) {
          for (l.isRecording = !1; o.context !== null && o.context !== a; )
            Z(o.context);
          throw C;
        }
        l.isRecording = !1, G();
        const w = l.currentPartial;
        try {
          i(this), ut(w), Jt(l), Gt(l), l.nonRecordedAction !== null && l.nonRecordedAction(l.returnValue), this.firstTime = !1;
        } catch (C) {
          for (; o.context !== null && o.context !== a; )
            Z(o.context);
          throw C;
        }
        return Z(w), l.invalidatedWhileRunning && (l.invalidatedWhileRunning = !1, se(l)), l;
      }
    };
  }
  function fe(e, t) {
    return V(t) && e[t[p].id] === t;
  }
  function oe(e) {
    const t = e[p].buildId;
    return t !== null && typeof t < "u";
  }
  function Ht(e, t) {
    return e.signature ? e.signature(t) : null;
  }
  function be(e, t, n, r) {
    if (n instanceof Array)
      return n.map((l) => be(e, t, l, r));
    if (!fe(t, n) || r.has(n)) return null;
    r.add(n);
    const i = {
      object: n,
      prototype: Object.getPrototypeOf(n),
      signature: Ht(e, n),
      slots: {}
    };
    for (let l in n) {
      const u = n[l];
      u instanceof Array ? u.some((d) => d instanceof Array || fe(t, d)) && (i.slots[l] = be(e, t, u, r)) : fe(t, u) && (i.slots[l] = be(e, t, u, r));
    }
    return i;
  }
  function ar(e, t, n, r) {
    const i = e.newIdObjectShapeMap;
    let l = !1;
    function u(y, A) {
      y[p].rebuildTwin = A, A[p].establishedOriginal = y, delete A[p].pendingCreationEvent, delete A[p].pendingOnEstablishCall, y[p].pendingReCreationEvent = !0, delete i[A[p].id], i[y[p].id] = y, l = !0;
    }
    function d(y, A) {
      if (y === null || typeof y > "u") return;
      if (y instanceof Array) {
        A instanceof Array && C(y, A);
        return;
      }
      if (!fe(i, A)) return;
      if (y.object === A) {
        w(y, A);
        return;
      }
      const S = y.object;
      oe(A) || oe(S) || S[p].rebuildTwin === null && Object.getPrototypeOf(A) === y.prototype && Ht(t, A) === y.signature && (u(S, A), w(y, A));
    }
    const a = /* @__PURE__ */ new Set();
    function w(y, A) {
      if (oe(A)) {
        if (a.has(A)) return;
        a.add(A);
      }
      for (let S in y.slots) d(y.slots[S], A[S]);
    }
    function C(y, A) {
      const S = /* @__PURE__ */ new Map(), D = [];
      y.forEach((j) => {
        j === null || j instanceof Array || (S.set(j.object, j), oe(j.object) || D.push(j));
      });
      let z = 0;
      A.forEach((j, F) => {
        if (j instanceof Array) {
          y[F] instanceof Array && C(y[F], j);
          return;
        }
        if (!fe(i, j)) return;
        if (oe(j)) {
          const nn = S.get(j);
          nn && w(nn, j);
          return;
        }
        const tn = D[z++];
        tn && d(tn, j);
      });
    }
    return d(n.root, r), n.withBuildId.forEach((y) => {
      fe(i, y.object) && w(y, y.object);
    }), l;
  }
  function cr(e, t, n) {
    const r = be(e, t, n, /* @__PURE__ */ new Set()), i = rt(r, []), l = new Set(i.map((u) => u.object));
    for (let u in t) {
      const d = t[u];
      oe(d) && !l.has(d) && i.push(be(e, t, d, /* @__PURE__ */ new Set()));
    }
    return { root: r, withBuildId: i };
  }
  function rt(e, t) {
    if (e === null || typeof e > "u") return t;
    if (e instanceof Array)
      return e.forEach((n) => rt(n, t)), t;
    oe(e.object) && t.push(e);
    for (let n in e.slots) rt(e.slots[n], t);
    return t;
  }
  function Se(e) {
    if (e instanceof Array && !V(e)) {
      let t = !1;
      const n = e.map((r) => {
        const i = Se(r);
        return i !== r && (t = !0), i;
      });
      return t ? (Object.isFrozen(e) && Object.freeze(n), n) : e;
    }
    return V(e) && e[p].establishedOriginal ? e[p].establishedOriginal : e;
  }
  function dr(e) {
    if (e.finishedRebuilding) return;
    const t = e.options;
    if (t.onStartBuildUpdate && t.onStartBuildUpdate(), e.options.rebuildShapeAnalysis) {
      const n = e.options.rebuildShapeAnalysis;
      e.newIdObjectShapeMap || (e.newIdObjectShapeMap = {}), J(() => {
        const i = n.shapeRoot();
        if (e.establishedShape && ar(e, n, e.establishedShape, i)) {
          for (let u in e.newIdObjectShapeMap) {
            const d = e.newIdObjectShapeMap[u], a = d[p].rebuildTwin, w = a || d, C = w[p].target, y = w[p].handler;
            C instanceof Array && Dn(y, Se);
            const A = _(), S = M();
            Je(y, A, S).forEach(function(D) {
              const z = Ce(y, D, A, S), j = Se(z);
              j !== z && Jn(y, D, j, A, S);
            });
          }
          if (n.setShapeRoot) {
            const u = Se(i);
            u !== i && n.setShapeRoot(u);
          }
        }
      });
      for (let i in e.newIdObjectShapeMap) {
        let l = e.newIdObjectShapeMap[i];
        const u = l[p].rebuildTwin;
        u ? (u[p].establishedOriginal = null, u[p].isRebuildTwin = !1, l[p].rebuildTwin = null, at(l, u), l[p].pendingReCreationEvent && (delete l[p].pendingReCreationEvent, Xt(l[p].handler))) : (l[p].pendingCreationEvent && (delete l[p].pendingCreationEvent, Pe(l[p].handler)), je(l));
      }
      if (e.idObjectShapeMap)
        for (let i in e.idObjectShapeMap)
          e.newIdObjectShapeMap[i] !== e.idObjectShapeMap[i] && it(e.idObjectShapeMap[i]);
      const r = e.newIdObjectShapeMap;
      e.establishedShape = J(
        () => cr(n, r, n.shapeRoot())
      );
    } else {
      for (let n in e.newBuildIdObjectMap) {
        let r = e.newBuildIdObjectMap[n];
        const i = r[p].rebuildTwin;
        i !== null ? (r[p].rebuildTwin = null, i[p].isRebuildTwin = !1, at(r, i)) : je(r);
      }
      if (e.buildIdObjectMap)
        for (let n in e.buildIdObjectMap)
          e.newBuildIdObjectMap[n] !== e.buildIdObjectMap[n] && it(e.buildIdObjectMap[n]);
    }
    e.buildIdObjectMap = e.newBuildIdObjectMap, e.newBuildIdObjectMap = {}, e.idObjectShapeMap = e.newIdObjectShapeMap, e.newIdObjectShapeMap = {}, e.finishedRebuilding = !0, t.onEndBuildUpdate && t.onEndBuildUpdate();
  }
  function je(e) {
    const t = e[p];
    return (t.pendingOnEstablishCall || !t.established) && (delete t.pendingOnEstablishCall, t.established = !0, typeof t.target.onEstablish == "function" && e.onEstablish()), e;
  }
  function it(e) {
    const t = e[p];
    rr(t.handler), typeof t.target.onDispose == "function" && e.onDispose();
  }
  function pr(e) {
    const t = e[p].rebuildTwin;
    return t !== null ? (e[p].rebuildTwin = null, t[p].isRebuildTwin = !1, at(e, t)) : je(e), e;
  }
  function hr() {
    let e = "", t, n = null, r;
    const i = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
    if (typeof i[0] == "string")
      e = i.shift();
    else if (un)
      throw new Error("Every repeater has to be given a name as first argument. Note: This requirement can be removed in the configuration.");
    typeof i[0] == "function" && (t = i.shift()), (typeof i[0] == "function" || i[0] === null) && (n = i.shift()), typeof i[0] == "object" && (r = i.shift()), r || (r = {});
    const l = r.independent === !0;
    if (typeof r.time < "u" && !(Number.isInteger(r.time) && r.time >= 0 && r.time < s.timeLevels))
      throw new Error("repeat(): time " + r.time + " is outside this world's time levels, 0 to " + (s.timeLevels - 1) + " - see getWorld({ timeLevels }).");
    const u = l && typeof r.time > "u" && o.context !== null ? _() : void 0;
    if (an && o.inActiveRecording && !l) {
      let C = o.context.description;
      !C && o.context.parent && (C = o.context.parent.description), C || (C = "unnamed"), s.traceWarnings && console.warn(Error(`repeater ${e || "unnamed"} inside active recording ${C}`));
    }
    const d = v(e, t, n, r, dr), a = !l && o.context && o.context.type === "partial" ? o.context : null;
    d.parentRepeater = a ? a.repeater : null, d.chainHead = d.parentRepeater ? d.parentRepeater.chainHead : Fn(d), typeof u < "u" && (d.chainHead.time = u);
    const w = d.refresh();
    return l || Kt(d), o.context === null && Ve(), w;
  }
  function gr(e) {
    return e.workStatus === "flagged" && ye(e), Kt(e), e;
  }
  function Ne(e, t) {
    let n = e.length;
    for (; n > 0 && he(e[n - 1].firstPartial, t.firstPartial) > 0; )
      n--;
    e.splice(n, 0, t);
  }
  function mr(e) {
    return e.shift();
  }
  function lt(e, t, n) {
    const r = o.workQueue[t][n];
    e.previousQueued = r.last, e.nextQueued = null, r.last !== null ? r.last.nextQueued = e : r.first = e, r.last = e;
  }
  function ot(e, t, n) {
    const r = o.workQueue[t][n];
    r.first === e && (r.first = e.nextQueued), r.last === e && (r.last = e.previousQueued), e.nextQueued !== null && (e.nextQueued.previousQueued = e.previousQueued), e.previousQueued !== null && (e.previousQueued.nextQueued = e.nextQueued), e.nextQueued = null, e.previousQueued = null;
  }
  function Yt(e, t, n) {
    const r = o.workQueue[t][n];
    e.previousQueued = null, e.nextQueued = r.first, r.first !== null ? r.first.previousQueued = e : r.last = e, r.first = e;
  }
  function _t(e) {
    if (e === o.activePipeline) return;
    o.flushing > 0 && e.time <= o.workQueueTimeLock && (o.workQueueTimeLock = e.time - 1, o.waveRetreated = !0);
    const n = e.time <= o.workQueueTimeLock ? "parked" : "active";
    e.queueMembership !== n && (e.queueMembership !== null && ot(e, e.time, e.queueMembership), lt(e, e.time, n), e.queueMembership = n);
  }
  function br(e) {
    const t = e.options.pulledBy, n = typeof t == "function" ? t() : t;
    if (!n) return !1;
    if (n.retracted) return !0;
    if (n.isRecording) return !1;
    for (let r = o.context; r; r = r.parent)
      if (r.type === "partial" && r.repeater === n) return !1;
    return n.workStatus !== "invalid" && se(n), !0;
  }
  function $t(e) {
    const t = e.chainHead;
    if (e.options.pulledBy && br(e)) return;
    if (e.parentRepeater === null) {
      if (e.inATimeBucket) return;
      e.inATimeBucket = !0, _t(t);
      return;
    }
    if (e.inSortedQueue) return;
    e.inSortedQueue = !0, _t(t);
    const n = t === o.activePipeline, r = n ? he(e.firstPartial, t.wavefront) <= 0 : t.time <= o.workQueueTimeLock;
    r && n && o.flushing > 0 ? (o.waveRetreated = !0, Ne(t.sortedQueue, e)) : r ? t.parkedRepeaters.push(e) : Ne(t.sortedQueue, e);
  }
  function se(e, t) {
    if (e.isRecording) {
      (!t || t.listMembership !== "pending") && (e.invalidatedWhileRunning = !0);
      return;
    }
    e.dispose(), e.flagRecords = null, e.workStatus = "invalid", $t(e), en();
  }
  function st(e, t, n) {
    t.flagged = !0, e.flagRecords === null && (e.flagRecords = []), e.flagRecords.push({ entry: t, previousWriting: n }), e.workStatus === null && (e.workStatus = "flagged", $t(e));
  }
  function yr(e) {
    const t = e.flagRecords;
    if (e.flagRecords = null, t === null || t.length === 0) return;
    let n = !1;
    t.forEach(({ entry: r, previousWriting: i }) => {
      if (r.flagged = !1, i.timeline.isArray) {
        i.observersAllFlagged = !1, !n && Ot(r, i) && (n = !0, se(e));
        return;
      }
      let l = Q(i.timeline, r.time, r.writer);
      if (l.writer === r.writer && l.previous !== null && (l = l.previous), l === i) return;
      const u = !Mt(i, l);
      x(i, l, r), u && se(e);
    });
  }
  function vr(e) {
    Tt(e.repeater.chainHead, e);
  }
  function xr(e) {
    if (e.timeline.isArray) {
      Pn(e);
      return;
    }
    const t = e.timeline.handler;
    if (Q(e.timeline, e.time, e.writer).set !== e.set && m(t, e.timeline.key, e.time, e.writer), e.observers !== null) {
      const r = g(e, () => !0);
      Qe(() => r.forEach((i) => {
        i.flagged || (Re(i, e.writer) ? st(i.observer.repeater, i, e) : ue(i.observer, e.timeline.handler.proxy, e.timeline.key));
      }));
    }
    e.stale = !1, e.hasNextValue = !1, e.nextValue = void 0, e.nextSet = !1;
  }
  function ut(e) {
    En(e), e.touchedStaleWritings !== null && (e.touchedStaleWritings.forEach(function(t) {
      if (t.stale = !1, t.set !== t.nextSet || t.nextSet && !ce(t.value, t.nextValue)) {
        const r = t.set !== t.nextSet;
        t.value = t.nextSet ? t.nextValue : void 0, t.set = t.nextSet, h(t, t.timeline.handler.proxy, t.timeline.key), r && m(t.timeline.handler, t.timeline.key, t.time, t.writer);
      }
      t.hasNextValue = !1, t.nextValue = void 0, t.nextSet = !1, $e(t);
    }), e.touchedStaleWritings = null);
  }
  function Jt(e) {
    e.staleWritings !== null && (e.staleWritings.forEach(function(t) {
      t.forEach(xr);
    }), e.staleWritings = null);
  }
  function ye(e) {
    e.workStatus === "invalid" ? (e.workStatus = null, e.refresh()) : e.workStatus === "flagged" && (e.workStatus = null, yr(e));
  }
  function wr(e) {
    return e.retracted || (o.context !== null && o.context.type === "partial" && ut(o.context), ye(e)), e;
  }
  function ft(e) {
    return !o.waveRetreated || (o.waveRetreated = !1, o.workQueueTimeLock >= e.time - 1) ? !1 : (e.parkedRepeaters.forEach((t) => Ne(e.sortedQueue, t)), e.parkedRepeaters = [], e.wavefront = null, o.activePipeline = null, Yt(e, e.time, "active"), e.queueMembership = "active", !0);
  }
  function Or() {
    const e = o.activePipeline;
    e.wavefront = null;
    const t = e.rootRepeater;
    for (t.inATimeBucket = !1; t.workStatus !== null; )
      if (t.inATimeBucket = !1, ye(t), ft(e)) return;
    for (; e.sortedQueue.length > 0; ) {
      const r = mr(e.sortedQueue);
      if (r.inSortedQueue = !1, r.retracted || r.workStatus === null) continue;
      e.wavefront = r.firstPartial;
      const i = r.workStatus === "flagged";
      if (ye(r), ft(e) || i && r.workStatus === "invalid" && !r.retracted && (ye(r), ft(e)))
        return;
    }
    o.activePipeline = null;
    const n = t.workStatus !== null;
    (e.parkedRepeaters.length > 0 || n) && (lt(e, e.time, "parked"), e.queueMembership = "parked");
  }
  function Rr() {
    return o.workQueue.some((e) => e.active.first !== null || e.parked.first !== null);
  }
  function Zt() {
    let e = o.workQueueTimeLock + 1;
    for (; e < o.workQueue.length; ) {
      if (o.workQueue[e].active.first !== null)
        return o.workQueue[e].active.first;
      o.workQueueTimeLock = e, e++;
    }
    let t = !1;
    for (let n = 0; n < o.workQueue.length; n++) {
      let r = o.workQueue[n].parked.first;
      for (; r !== null; ) {
        const i = r.nextQueued;
        ot(r, n, "parked"), r.parkedRepeaters.forEach((l) => Ne(r.sortedQueue, l)), r.parkedRepeaters = [], lt(r, n, "active"), r.queueMembership = "active", t = !0, r = i;
      }
    }
    return t ? (o.workQueueTimeLock = -1, Zt()) : null;
  }
  function en() {
    if (o.postponeRefreshRepeaters === 0 && !o.refreshingAllDirtyRepeaters) {
      if (Rr()) {
        o.refreshingAllDirtyRepeaters = !0;
        let e;
        try {
          for (; (e = Zt()) !== null; )
            ot(e, e.time, "active"), e.queueMembership = null, o.activePipeline = e, Or();
        } catch (t) {
          const n = o.activePipeline;
          throw o.activePipeline = null, n !== null && n.queueMembership === null && (n.sortedQueue.length > 0 || n.parkedRepeaters.length > 0 || n.rootRepeater.workStatus !== null) && (Yt(n, n.time, "active"), n.queueMembership = "active"), o.refreshingAllDirtyRepeaters = !1, t;
        }
        o.workQueueTimeLock = -1, o.refreshingAllDirtyRepeaters = !1;
      }
      !o.refreshingAllDirtyRepeaters && o.context === null && Ve();
    }
  }
  function Ar(e, t) {
    J(() => {
      P.log(e, t);
    });
  }
  function Cr(e, t) {
    J(() => {
      P.group(e, t);
    });
  }
  function Er() {
    P.groupEnd();
  }
  function Pr(e, t) {
    return J(() => P.logToString(e, t));
  }
  return E;
}
let dt = {};
function Br(s) {
  s || (s = {}), s = { ...Qr, ...s };
  const o = Ir(s);
  return typeof dt[o] > "u" && (dt[o] = Dr(s)), dt[o];
}
export {
  Br as default,
  Br as getWorld
};
