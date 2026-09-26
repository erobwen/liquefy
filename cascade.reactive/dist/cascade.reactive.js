function ge(s) {
  return Array.prototype.slice.call(s);
}
function Me(s, r) {
  const c = s.causality.stateProperties || null, w = (v) => c !== null && c.has(v);
  if (r instanceof Array) {
    Fn(s.causality.target, r.causality.target).forEach(function(y) {
      let O = [];
      O.push(y.index, y.removed.length), O.push.apply(O, y.added), s.splice.apply(s, O);
    });
    for (let y in r)
      isNaN(y) && !w(y) && (s[y] = r[y]);
  } else
    for (let v in r)
      w(v) || (s[v] = r[v]);
  return s;
}
function Fn(s, r) {
  let c = !1, w = [], v = 0, y = 0, O = 0;
  function A(a) {
    let d = {
      type: "splice",
      index: v + O,
      removed: [],
      added: a
    };
    O += a.length, w.push(d);
  }
  function g(a) {
    let d = {
      type: "splice",
      index: v + O,
      removed: a,
      added: []
    };
    O -= a.length, w.push(d);
  }
  function u(a, d) {
    let b = {
      type: "splice",
      index: v + O,
      removed: a,
      added: d
    };
    O -= a.length, O += d.length, w.push(b);
  }
  for (; !c; ) {
    for (; v < s.length && y < r.length && s[v] === r[y]; )
      v++, y++;
    if (v === s.length && y === r.length)
      c = !0;
    else if (y === r.length) {
      const a = [];
      let d = v;
      for (; d < s.length; )
        a.push(s[d++]);
      g(a), c = !0;
    } else if (v === s.length) {
      const a = [];
      for (; y < r.length; )
        a.push(r[y++]);
      A(a), c = !0;
    } else {
      let a = v, d = y, b = !1;
      for (; a < s.length && !b; ) {
        for (d = y; d < r.length && !b; )
          s[a] === r[d] && (b = !0), b || d++;
        b || a++;
      }
      u(
        s.slice(v, a),
        r.slice(y, d)
      ), v = a, y = d;
    }
  }
  return w;
}
function zn(s) {
  return s.name ? s.name : (s = Ct(s), JSON.stringify(s));
}
function Ct(s) {
  if (typeof s == "object") {
    if (s === null) return "null";
    let r = Object.keys(s);
    r.sort(function(w, v) {
      return w < v ? -1 : w > v ? 1 : 0;
    });
    let c = {};
    return r.forEach(function(w) {
      let v = s[w];
      typeof v == "object" && (v = Ct(v)), c[w] = v;
    }), c;
  } else
    return "[" + typeof s + "]";
}
const Tt = {
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
  findLogs: !1,
  // Set to true in web browser that already has a good way to display objects with expandable trees.
  useConsoleDefault: !1
}, Z = 0;
function qn() {
  function s(r) {
    return r ? s(r.caller).concat([r.toString().split("(")[0].substring(9) + "(" + r.arguments.join(",") + ")"]) : [];
  }
  return s(arguments.callee.caller);
}
function ke(s) {
  let r = "";
  for (; s-- > 0; )
    r = r + L.indentToken;
  return r;
}
function We() {
  const s = {
    terminated: !1,
    rootLevel: !0,
    horizontal: !1,
    indentLevel: Z,
    unfinishedLine: !1
  };
  return s.resetColor = () => {
    s.setColor("Reset");
  }, s;
}
function Gn() {
  let s = We();
  return s.result = "", s.log = function(r) {
    this.unfinishedLine ? (this.result += r, this.unfinishedLine = !0) : (this.result += ke(this.indentLevel) + r, this.unfinishedLine = !0);
  }, s.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (this.result += `
`, this.unfinishedLine = !1);
  }, s.setColor = function() {
  }, s.jsonCompatible = !0, s;
}
function be() {
  let s = We();
  return s.lineMemory = "", s.log = function(r) {
    if (this.unfinishedLine)
      typeof process < "u" ? process.stdout.write(r) : s.lineMemory += r, this.unfinishedLine = !0;
    else {
      let c = ke(this.indentLevel);
      typeof process < "u" ? process.stdout.write(c + r) : s.lineMemory += c + r, this.unfinishedLine = !0;
    }
  }, s.finishOpenLine = function() {
    this.unfinishedLine && !this.horizontal && (s.lineMemory !== "" ? (console.log(s.lineMemory), s.lineMemory = "") : console.log(), this.unfinishedLine = !1);
  }, s.setColor = function(r) {
    Tt[r] || (r = "Reset"), s.log(Tt[r]);
  }, s.jsonCompatible = !1, s;
}
function Hn(s, r) {
  let c = We();
  return c.horizontal = !0, c.count = 0, c.limit = s, c.log = function(w) {
    if (this.unfinishedLine)
      this.count += w.length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    else {
      let v = ke(this.indentLevel);
      this.count += (v + w).length, this.terminated = this.count > this.limit, this.unfinishedLine = !0;
    }
  }, c.finishOpenLine = function() {
  }, c.setColor = function() {
  }, c.jsonCompatible = r.jsonCompatible, c;
}
function Pt(s, r, c, w) {
  let v = Hn(c, w);
  return q(s, r, v), !v.terminated;
}
function q(s, r, c) {
  const w = c.rootLevel, v = c.jsonCompatible;
  if (c.rootLevel = !1, typeof r > "u" && (r = 1), typeof r == "function" && (s = r(s), r = -1), !c.terminated) {
    if (typeof s != "object")
      if (typeof s == "function")
        c.setColor("FgBlue"), c.log("function( ... ) { ... }"), c.resetColor();
      else if (typeof s == "string")
        if (w)
          c.log(s);
        else {
          c.setColor("FgGreen");
          const y = v ? '"' : "'";
          c.log(y + s + y), c.resetColor();
        }
      else
        c.setColor("FgYellow"), c.log(s + ""), c.resetColor();
    else if (s === null)
      c.log("null");
    else if (r === 0)
      s instanceof Array ? (c.log("["), c.setColor("FgCyan"), c.log("..."), c.resetColor(), c.log("]")) : (c.log("{"), c.setColor("FgCyan"), c.log("..."), c.resetColor(), c.log("}"));
    else {
      let y = s instanceof Array;
      const O = Object.keys(s).length;
      let A = !1;
      if (!c.horizontal) {
        let u = L.bufferWidth - c.indentLevel * L.indentToken.length;
        c.horizontal = L.bufferWidth === -1 ? !0 : Pt(s, r, u, c), A = c.horizontal;
      }
      y && c.finishOpenLine(), c.log(y ? "[" : "{"), c.horizontal && O && c.log(" "), c.finishOpenLine(), c.indentLevel++;
      let g = !0;
      for (let u in s) {
        g || (c.log(", "), c.finishOpenLine()), (!y || isNaN(u)) && (v && c.log('"'), c.log(u), v && c.log('"'), c.log(": "));
        let a = null;
        typeof r == "object" ? a = r[u] : a = r === -1 ? -1 : r - 1, y || c.indentLevel++, q(s[u], a, c), y || c.indentLevel--, g = !1;
      }
      c.indentLevel--, c.finishOpenLine(), c.horizontal && O && c.log(" "), c.log(y ? "]" : "}"), A && (c.horizontal = !1);
    }
    w && c.finishOpenLine();
  }
}
const ee = {
  // Configuration
  configuration: L,
  stacktrace: qn,
  log(s, r) {
    if (ee.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.log(s) : q(s, r, be());
  },
  // If you need the output as a string.
  logToString(s, r) {
    let c = Gn();
    return q(s, r, c), c.result;
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
  logVar(s, r, c) {
    if (ee.findLogs) throw new Error("No logs allowed!");
    if (L.useConsoleDefault)
      console.log(s + ":"), console.group(), console.log(r), console.groupEnd();
    else {
      context = be(), typeof c > "u" && (c = 1), context.log(s + ": ");
      let w = L.bufferWidth - context.indentLevel * L.indentToken.length - (s + ": ").length;
      context.horizontal = L.bufferWidth === -1 ? !0 : Pt(r, c, w), context.horizontal ? q(r, c, context) : (context.indentLevel++, q(r, c, context), context.indentLevel--);
    }
  },
  group(s, r) {
    if (ee.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.group(s) : (typeof s < "u" && q(s, r, be()), Z++);
  },
  groupEnd(s, r) {
    if (ee.findLogs) throw new Error("No logs allowed!");
    L.useConsoleDefault ? console.groupEnd() : (Z--, Z < 0 && (Z = 0), typeof s < "u" && q(s, r, be()));
  }
};
function Kn(s) {
  function r(u, a) {
    if (typeof u != typeof a)
      return !1;
    if (u.length === a.length) {
      for (let d = 0; d < u.length; d++)
        if (u[d] !== a[d])
          return !1;
      return !0;
    } else
      return !1;
  }
  function c(u, a) {
    if (u.length === 0)
      return !1;
    for (let d = 0; d < u.length; d++)
      if (r(
        u[d].argumentList,
        a
      ))
        return !0;
    return !1;
  }
  function w(u, { signature: a, unique: d, argumentList: b }) {
    return d ? typeof u[a] < "u" : typeof u[a] > "u" ? !1 : c(u[a], b);
  }
  function v(u, { signature: a, unique: d, argumentList: b }) {
    if (d)
      return u[a];
    {
      let x = u[a];
      for (let T = 0; T < x.length; T++)
        if (r(x[T].argumentList, b))
          return x[T].value;
    }
  }
  function y(u, { signature: a, unique: d, argumentList: b }) {
    if (d) {
      delete u[a];
      return;
    } else {
      let x = u[a];
      for (let T = 0; T < x.length; T++)
        if (r(x[T].argumentList, functionArguments)) {
          x.splice(T, 1);
          return;
        }
    }
  }
  function O(u, { signature: a, unique: d, argumentList: b }, x) {
    if (d)
      u[a] = x;
    else {
      let T = u[a];
      T || (T = s([]), u[a] = T), T.push({ argumentList: b, value: x });
    }
  }
  function A(u) {
    let a = !0, d = "";
    return u.forEach(function(b, x) {
      x > 0 && (d += ","), typeof b.causality < "u" ? d += "{id=" + b.causality.id + "}" : typeof b == "number" || typeof b == "string" ? d += b : (a = !1, d += "{}");
    }), { signature: "(" + d + ")", unique: a, argumentList: u };
  }
  function g(u) {
    const a = s({});
    return () => {
      argumentsToArray(arguments);
      let d = A(argumentList);
      return w(a, d) || invalidateOnChange(
        () => {
          const b = u.apply(null, argumentList);
          O(a, d, b);
        },
        () => {
          y(a, d);
        }
      ), v(a, d);
    };
  }
  return g;
}
let Rt = 500;
function Vn(s) {
  const r = s.state, c = s.invalidateObserver;
  function w(g, u, a) {
    return typeof u != "string" && (a = u, u = null), {
      description: g,
      key: u,
      handler: a,
      isRoot: !0,
      contents: {},
      contentsCounter: 0,
      first: null,
      last: null
    };
  }
  function v(g, u, a, d, b) {
    let x = g.id;
    if (typeof u.contents[x] < "u" || u.contentsCounter === Rt && u.last !== null && (u = u.last, typeof u.contents[x] < "u"))
      return;
    if (u.contentsCounter === Rt) {
      let j = {
        isRoot: !1,
        contents: {},
        contentsCounter: 0,
        next: null,
        previous: null,
        parent: null
      };
      u.isRoot ? (j.parent = u, u.first = j, u.last = j) : (u.next = j, j.previous = u, j.parent = u.parent, u.parent.last = j), u = j;
    }
    let T = u.contents;
    typeof T[x] > "u" && (u.contentsCounter = u.contentsCounter + 1, T[x] = {
      observer: g,
      time: typeof d > "u" ? null : d,
      writer: typeof b > "u" ? null : b,
      // Set by cascade.js (flagRepeaterEntry) when this entry is found
      // overtaken by a closer writing but the change can't yet be acted
      // on (see resolveFlaggedRepeater) - guards against the same entry
      // being flagged twice over by a second, even-closer writing before
      // the first flag is ever resolved.
      flagged: !1
    }, g.sources.push(u));
  }
  function y(g) {
    const u = [];
    for (let d in g.contents)
      u.push({ id: d, entry: g.contents[d], owner: g });
    let a = g.first;
    for (; a !== null; ) {
      for (let d in a.contents)
        u.push({ id: d, entry: a.contents[d], owner: a });
      a = a.next;
    }
    return u;
  }
  function O(g, u, a) {
    if (r.postponeInvalidation++, r.blockInvalidation > 0)
      return;
    let d = g.contents;
    for (let b in d)
      c(d[b].observer, u, a);
    if (typeof g.first < "u") {
      let b = g.first;
      for (; b !== null; ) {
        let x = b.contents;
        for (let T in x)
          c(x[T].observer, u, a);
        b = b.next;
      }
    }
    r.postponeInvalidation--, s.proceedWithPostponedInvalidations();
  }
  function A(g, u) {
    let a = u.contents;
    delete a[g];
    let d = !1;
    u.contentsCounter--, u.contentsCounter == 0 && (u.isRoot ? u.first === null && u.last === null && (d = !0) : (u.parent.first === u && (u.parent.first, u.next), u.parent.last === u && (u.parent.last, u.previous), u.next !== null && (u.next.previous = u.previous), u.previous !== null && (u.previous.next = u.next), u.previous = null, u.next = null, u.parent.first === null && u.parent.last === null && (d = !0)), d && typeof u.handler.proxy.onRemovedLastObserver == "function" && u.handler.proxy.onRemovedLastObserver(u.description, u.key));
  }
  return {
    recordDependencyOnArray: (g, u) => {
      u._arrayObservers === null && (u._arrayObservers = w("arrayDependees", u)), v(g, u._arrayObservers);
    },
    recordDependencyOnEnumeration: (g, u, a, d) => {
      const b = s.getOrCreateEnumerationTimelineWriting(u, a, d);
      b.observers === null && (b.observers = w("enumerationDependees", u)), v(g, b.observers, void 0, a, d);
    },
    recordDependencyOnProperty: (g, u, a, d, b) => {
      if (a === "toString") return;
      const x = s.getOrCreateTimelineWriting(u, a, d, b);
      x.observers === null && (x.observers = w("propertyDependees", a, u)), v(g, x.observers, a, d, b);
    },
    invalidateArrayObservers: (g, u) => {
      g._arrayObservers !== null && O(g._arrayObservers, g.proxy, u);
    },
    invalidatePropertyObservers: (g, u, a, d) => {
      const b = g.timelines[u];
      if (typeof b > "u") return;
      const x = s.seekTimelineWriting(b, a, d);
      x.observers !== null && O(x.observers, g.proxy, u);
    },
    invalidateWritingObservers: (g, u, a) => {
      g.observers !== null && O(g.observers, u, a);
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
    collectOvertakenPropertyObservers: (g, u) => g.observers === null ? [] : y(g.observers).filter(({ entry: a }) => u(a.time, a.writer)).map(({ entry: a }) => a),
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
    // caller has nothing further to do in that case.
    relocatePropertyObserverEntry: (g, u, a) => {
      if (g.observers === null) return !1;
      const d = y(g.observers).find(({ entry: b }) => b === a);
      return d ? (A(d.id, d.owner), u.observers === null && (u.observers = w(
        g.observers.description,
        g.observers.key,
        g.observers.handler
      )), v(a.observer, u.observers, g.observers.key, a.time, a.writer), !0) : !1;
    },
    // Only invalidate readers positioned after this key add/remove (see
    // invalidateDownstreamEnumerationObservers in cascade.js) - before
    // this, every reader at every position shared one fixed writing, so
    // any key add/remove invalidated all of them regardless of where they
    // sat in the pipeline.
    invalidateEnumerateObservers: (g, u, a, d) => {
      const b = g.timelines[s.enumerationTimelineKey];
      typeof b > "u" || s.invalidateDownstreamEnumerationObservers(b.first, a, d, g.proxy, u);
    },
    removeAllSources: (g) => {
      const u = g.id;
      g.sources.forEach(function(a) {
        A(u, a);
      }), g.sources.length = 0;
    }
  };
}
const _n = ee, Un = {
  requireRepeaterName: !1,
  requireInvalidatorName: !1,
  warnOnNestedRepeater: !0,
  alwaysDependOnParentRepeater: !1,
  timeLevels: 4,
  // Dev-time-only safety net for the O(1) order-number chain (see
  // compareWriterOrder()/structuralCompareWriterOrder()): also compute
  // writer order via the older, structural parent/sibling walk (O(depth),
  // never optimized, but doesn't depend on the order-number bookkeeping
  // being correct) and throw if the two disagree. Off by default - it's
  // a real O(depth) tree walk on every comparison, not something to pay
  // for outside development.
  verifyChainOrderStructurally: !1,
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
function Yn(s) {
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
    refreshingAllDirtyRepeaters: !1,
    workOnTimeLevel: [...Array(s.timeLevels).keys()].map(() => 0),
    revalidationTimeLock: -1,
    // The repeater work scheduler - see "Repeater scheduling: pipelines,
    // wavefronts, parking" below for the full design. One {active, parked}
    // pair of FIFOs per time level, holding *pipelines* (chainHeads), not
    // individual repeaters - a chainHead's own internal heap/parkedPartials
    // (see createChainHead()) is where the actual repeaters needing
    // attention live.
    workQueue: [...Array(s.timeLevels).keys()].map(() => ({
      active: { first: null, last: null },
      parked: { first: null, last: null }
    })),
    // Separate from revalidationTimeLock above (which belongs to the
    // older, general context-enter/exit bookkeeping - see enterTimeLevel/
    // exitTimeLevel - and is left alone here specifically so this new
    // scheduler's own lock can't be perturbed by that unrelated
    // machinery, the same bug class already found and fixed once this
    // session when the two were briefly conflated).
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
  }, c = Symbol("timelines.enumeration"), w = {
    name: s.name,
    sameAsPreviousDeep: we,
    // Main API
    observable: ae,
    deeplyObservable: Pe,
    isObservable: k,
    create: ae,
    // observable alias
    invalidateOnChange: mn,
    repeat: Rn,
    linkRepeater: Cn,
    finalize: xn,
    // Modifiers
    withoutRecording: Qe,
    withoutReactions: Mt,
    flush: Lt,
    accessInitialValues: Fe,
    declareState: kt,
    retractRepeater: ht,
    refreshIfNeeded: Mn,
    // Transaction
    doWhileInvalidationsPostponed: Xe,
    transaction: Xe,
    postponeInvalidations: Et,
    continueInvalidations: jt,
    // Debugging and testing
    clearRepeaterLists: Nn,
    // Logging (these log commands do automatic withoutRecording to avoid your logs destroying your test-setup) 
    log: Wn,
    loge: (e) => {
      X.loge(e);
    },
    // "event"
    logs: () => {
      X.logs();
    },
    // "separator"
    logss: () => {
      X.logss();
    },
    logsss: () => {
      X.logss();
    },
    logGroup: Dn,
    logUngroup: Bn,
    logToString: Qn,
    // Advanced (only if you know what you are doing, typically used by plugins to causality)
    state: r,
    enterContext: Y,
    leaveContext: K,
    invalidateObserver: ce,
    getOrCreateTimelineWriting: Re,
    getOrCreateEnumerationTimelineWriting: nn,
    invalidateDownstreamEnumerationObservers: tn,
    seekTimelineWriting: D,
    enumerationTimelineKey: c,
    proceedWithPostponedInvalidations: Ie,
    nextObserverId: () => r.observerId++,
    // Libraries
    caching: Kn(ae),
    // Time levels 
    enterTimeLevel: ne,
    exitTimeLevel: ie,
    workOnTimeLevel: Wt
  }, v = s.customCreateRepeater ? s.customCreateRepeater : wn, y = s.customCreateInvalidator ? s.customCreateInvalidator : hn, O = s.customDependencyInterfaceCreator ? s.customDependencyInterfaceCreator(w) : Vn(w), A = O.recordDependencyOnArray, g = O.recordDependencyOnEnumeration, u = O.recordDependencyOnProperty, a = O.invalidateArrayObservers, d = O.invalidateEnumerateObservers, b = O.invalidatePropertyObservers, x = O.invalidateWritingObservers, T = O.collectOvertakenPropertyObservers, j = O.relocatePropertyObserverEntry, te = O.removeAllSources, X = s.customObjectlog ? s.customObjectlog : _n, De = Dt(), {
    requireRepeaterName: It,
    requireInvalidatorName: At,
    warnOnNestedRepeater: Nt,
    objectMetaProperty: p,
    objectTimelinesProperty: ve,
    sendEventsToObjects: Be,
    onEventGlobal: ye,
    emitReBuildEvents: St,
    onWriteGlobal: M,
    onReadGlobal: I,
    cannotReadPropertyValue: F
  } = s, N = !!ye || Be;
  function Qe(e) {
    r.recordingPaused++, S();
    const t = e();
    return r.recordingPaused--, S(), t;
  }
  function Xe(e) {
    r.postponeInvalidation++, e(), r.postponeInvalidation--, Ie();
  }
  function Et() {
    r.postponeInvalidation++;
  }
  function jt() {
    r.postponeInvalidation--, Ie();
  }
  function Mt(e) {
    r.blockInvalidation++, e(), r.blockInvalidation--;
  }
  function Lt(e) {
    r.flushing++;
    const t = e();
    return r.flushing--, t;
  }
  function Fe(e) {
    const t = r.context;
    r.context = null, S();
    const n = e();
    return r.context = t, S(), n;
  }
  function kt(e, t) {
    if (!k(e)) throw new Error("declareState() expects an observable object.");
    const n = e[p], i = (o) => {
      o.stateProperties || (o.stateProperties = /* @__PURE__ */ new Set()), Object.keys(t).forEach((l) => o.stateProperties.add(l));
    };
    return i(n), n.forwardTo !== null && i(n.forwardTo[p]), Fe(() => {
      Object.keys(t).forEach((o) => {
        e[o] = t[o];
      });
    }), e;
  }
  function ne(e) {
    if (typeof e != "number") {
      const t = e;
      e = typeof t.time == "function" ? t.time() : 0;
    }
    r.workOnTimeLevel[e]++;
  }
  function ie(e) {
    if (typeof e != "number") {
      const n = e;
      e = typeof n.time == "function" ? n.time() : 0;
    }
    r.workOnTimeLevel[e]--;
    let t = !0;
    for (; e < r.workOnTimeLevel.length && r.workOnTimeLevel[e] === 0; )
      typeof s.onFinishedTimeLevel == "function" && s.onFinishedTimeLevel(e, t), r.revalidationTimeLock = e, e++, t = !1;
  }
  function Wt(e, t) {
    ne(e), t(), ie(e);
  }
  function S() {
    r.inActiveRecording = r.context !== null && r.context.isRecording && r.recordingPaused === 0, r.inRepeater = r.context && r.context.type === "partial" ? r.context.repeater : null;
  }
  function Y(e) {
    return e.parent = r.context, r.context = e, S(), ne(e), e;
  }
  function K(e) {
    if (r.context && e === r.context)
      r.context = r.context.parent;
    else
      throw new Error("Context missmatch");
    S(), ie(e);
  }
  function Dt() {
    const e = {
      pop: function() {
        let t = this.target.length - 1, n = this.target.pop();
        return a(this, "pop"), N && G(this, t, [n], null), n;
      },
      push: function() {
        let t = this.target.length, n = ge(arguments);
        return this.target.push.apply(this.target, n), a(this, "push"), N && G(this, t, null, n), this.target.length;
      },
      shift: function() {
        let t = this.target.shift();
        return a(this, "shift"), N && G(this, 0, [t], null), t;
      },
      unshift: function() {
        let t = ge(arguments);
        return this.target.unshift.apply(this.target, t), a(this, "unshift"), N && G(this, 0, null, t), this.target.length;
      },
      splice: function() {
        let t = ge(arguments), n = t[0], i = t[1];
        typeof t[1] > "u" && (i = this.target.length - n);
        let o = t.slice(2), l = this.target.slice(n, n + i), f = this.target.splice.apply(this.target, t);
        return a(this, "splice"), N && G(this, n, l, o), f;
      },
      copyWithin: function(t, n, i) {
        if (n || (n = 0), i || (i = this.target.length), t < 0 && (n = this.target.length - t), n < 0 && (n = this.target.length - n), i < 0 && (n = this.target.length - i), i = Math.min(i, this.target.length), n = Math.min(n, this.target.length), n >= i)
          return;
        let o = this.target.slice(t, t + i - n), l = this.target.slice(n, i), f = this.target.copyWithin(t, n, i);
        return a(this, "copyWithin"), N && G(this, t, l, o), f;
      }
    };
    return ["reverse", "sort", "fill"].forEach(function(t) {
      e[t] = function() {
        let n = ge(arguments), i = this.target.slice(0), o = this.target[t].apply(this.target, n);
        return a(this, t), N && G(this, 0, i, this.target.slice(0)), o;
      };
    }), e;
  }
  function re(e, t) {
    return s.useNonObservablesAsValues ? we(e, t, s.valueComparisonDepthLimit) : e === t || Number.isNaN(e) && Number.isNaN(t) ? !0 : qe(e, t);
  }
  function ze(e) {
    if (e === null || typeof e != "object" || !Object.isFrozen(e) || k(e)) return !1;
    if (Array.isArray(e)) return !0;
    const t = Object.getPrototypeOf(e);
    return t === Object.prototype || t === null;
  }
  function qe(e, t, n = 0) {
    if (e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
    if (!ze(e) || !ze(t) || n > 64 || Array.isArray(e) !== Array.isArray(t)) return !1;
    const i = Object.keys(e);
    if (i.length !== Object.keys(t).length) return !1;
    for (const o of i)
      if (!Object.prototype.hasOwnProperty.call(t, o) || !qe(e[o], t[o], n + 1)) return !1;
    return !0;
  }
  function we(e, t, n) {
    if (typeof n > "u" && (n = 8), e === null && t === null || e === t || Number.isNaN(e) && Number.isNaN(t)) return !0;
    if (n === 0 || typeof e != typeof t || typeof e != "object" || e === null || t === null || k(e) || k(t) || Object.keys(e).length !== Object.keys(t).length) return !1;
    for (let i in e)
      if (!we(e[i], t[i], n - 1))
        return !1;
    return !0;
  }
  function Bt(e, t) {
    if (t === p)
      return this.meta;
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[p].handler;
      return n.get.apply(n, [n.target, t]);
    }
    return I && !I(this, e, t) ? F : De[t] ? De[t].bind(this) : (r.inActiveRecording && A(r.context, this), e[t]);
  }
  function Qt(e, t, n) {
    if (t === p) throw new Error("Cannot set the dedicated meta property '" + p + "'");
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[p].handler;
      return o.set.apply(o, [o.target, t, n]);
    }
    if (M && !M(this, e, t))
      return;
    let i = e[t];
    return t in e && re(i, n) ? !0 : (isNaN(t) ? (e[t] = n, (e[t] === n || Number.isNaN(e[t]) && Number.isNaN(n)) && (a(this, t), lt(this, t, n, i))) : (typeof t == "string" && (t = parseInt(t)), e[t] = n, (e[t] === n || Number.isNaN(e[t]) && Number.isNaN(n)) && (a(this, t), pn(this, t, n, i))), !(e[t] !== n && !(Number.isNaN(e[t]) && Number.isNaN(n))));
  }
  function Xt(e, t) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[p].handler;
      return i.deleteProperty.apply(
        i,
        [i.target, t]
      );
    }
    if (M && !M(this, e, t))
      return;
    if (!(t in e))
      return !0;
    let n = e[t];
    return delete e[t], t in e || (a(this, "delete"), st(this, t, n)), !(t in e);
  }
  function Ft(e) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[p].handler;
      return n.ownKeys.apply(
        n,
        [n.target]
      );
    }
    if (I && !I(this, e))
      return F;
    r.inActiveRecording && A(r.context, this);
    let t = Object.keys(e);
    return t.push("length"), t;
  }
  function zt(e, t) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[p].handler;
      return n.has.apply(n, [e, t]);
    }
    return I && !I(this, e, t) ? F : (r.inActiveRecording && A(r.context, this), t in e);
  }
  function qt(e, t, n) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[p].handler;
      return i.defineProperty.apply(
        i,
        [i.target, t, n]
      );
    }
    if (!(M && !M(this, e, t)))
      return a(this, t), e;
  }
  function Gt(e, t) {
    if (this.meta.forwardTo !== null) {
      let n = this.meta.forwardTo[p].handler;
      return n.getOwnPropertyDescriptor.apply(
        n,
        [n.target, t]
      );
    }
    return I && !I(this, e, t) ? F : (r.inActiveRecording && A(r.context, this), Object.getOwnPropertyDescriptor(e, t));
  }
  function Oe(e, t) {
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
      nextValue: void 0
    };
  }
  function Ht(e, t) {
    const n = Oe(0, null), i = {
      key: t,
      handler: e,
      first: n,
      last: n,
      // Cache pointer at the writing a reader/writer should start seeking
      // from - amortizes the common case where reads/writes at nearby
      // times cluster together, instead of always walking from `first`.
      currentWriting: n
    };
    return n.timeline = i, n.linked = !0, i;
  }
  function Ge(e) {
    const t = Oe(0, null);
    t.timeline = e, e.first = t, e.last = t, e.currentWriting = t, t.linked = !0;
  }
  function oe(e, t) {
    let n = e.timelines[t];
    return typeof n > "u" ? n = e.timelines[t] = Ht(e, t) : n.first === null && Ge(n), n;
  }
  function Kt(e) {
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
      // below for the full design. heap: repeaters needing attention,
      // sorted by repeater.firstPartial's live orderNumber (see
      // heapInsert/heapPopMin) - never the root repeater itself, which is
      // always earlier than anything that could be in here and is checked
      // directly instead (see drainActivePipeline). parkedPartials:
      // repeaters that arrived behind this pipeline's own wavefront,
      // waiting for the next wave (see scheduleWork). wavefront: the
      // firstPartial of the last-processed repeater this active session -
      // only meaningful while this chainHead === state.activePipeline.
      heap: [],
      parkedPartials: [],
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
  const le = Number.MAX_SAFE_INTEGER, He = Math.floor((le - 1) / 2);
  function Ke(e) {
    const t = e.count / le;
    return t < 0.25 ? 65536 : t < 0.75 ? 256 : 1;
  }
  function Ve(e, t) {
    if (e.count >= He)
      throw new Error("Partial chain exhausted its order-number space (" + He + " live partials)");
    const n = e.executionCursor, i = n !== null ? n.orderNext : null;
    let o;
    if (n === null)
      o = 0;
    else if (i === null)
      o = n.orderNumber + Ke(e);
    else {
      const l = Ke(e), f = n.orderNumber + l;
      o = f < i.orderNumber ? f : Math.floor((n.orderNumber + i.orderNumber) / 2);
    }
    t.orderNumber = o, t.orderPrevious = n, t.orderNext = i, n !== null ? n.orderNext = t : e.first = t, i !== null ? i.orderPrevious = t : e.last = t, e.count++, e.executionCursor = t, i !== null && (o - n.orderNumber <= 1 || i.orderNumber - o <= 1) && Vt(e, t);
  }
  function Vt(e, t) {
    const n = t.orderNumber;
    let i = t, o = t, l = 0, f = 0, h = 1, m = !1, C = !1;
    function R() {
      if (o.orderNext === null) {
        f = le - n, m = !0;
        return;
      }
      o = o.orderNext, f = o.orderNumber - n, h++;
    }
    function E() {
      if (i.orderPrevious === null) {
        C = !0;
        return;
      }
      i = i.orderPrevious, l = n - i.orderNumber, h++;
    }
    for (R(); !(m && C) && h / (f + l) > 0.5; )
      C ? R() : m || f > l ? E() : R();
    const W = i.orderNumber, P = m ? le : o.orderNumber, B = [];
    for (let Q = i; B.push(Q), Q !== o; Q = Q.orderNext)
      ;
    const U = B.length - 1;
    if (U <= 0) return;
    const Xn = (P - W) / U;
    for (let Q = 0; Q < B.length; Q++)
      B[Q].orderNumber = Math.round(W + Q * Xn);
  }
  function _t(e, t, n) {
    t.orderNumber = n.orderNumber, t.orderPrevious = n.orderPrevious, t.orderNext = n.orderNext, t.orderPrevious !== null ? t.orderPrevious.orderNext = t : e.first = t, t.orderNext !== null ? t.orderNext.orderPrevious = t : e.last = t, e.executionCursor = t;
  }
  function _e(e, t) {
    t.orderPrevious !== null ? t.orderPrevious.orderNext = t.orderNext : e.first = t.orderNext, t.orderNext !== null ? t.orderNext.orderPrevious = t.orderPrevious : e.last = t.orderPrevious, e.executionCursor === t && (e.executionCursor = t.orderPrevious || t.orderNext || null), t.orderPrevious = null, t.orderNext = null, e.count--;
  }
  function Ut(e, t) {
    _e(e, t), Ve(e, t);
  }
  function $(e, t) {
    if (e === t) return 0;
    if (e === null) return -1;
    if (t === null) return 1;
    const n = e.repeater.chainHead, i = t.repeater.chainHead;
    if (n !== i) return n.id - i.id;
    const o = $t(e, t);
    return o !== null ? o : e.orderNumber - t.orderNumber;
  }
  function Ue(e) {
    const t = [];
    let n = e;
    for (; n; )
      t.push(n), n = n.parentRepeater;
    return t;
  }
  function Yt(e, t, n) {
    let i = e.children.first;
    for (; i !== null; ) {
      if (i === t) return -1;
      if (i === n) return 1;
      i = i.nextSibling;
    }
    const o = t.listMembership === "pending", l = n.listMembership === "pending";
    return o && !l ? 1 : l && !o ? -1 : null;
  }
  function $t(e, t) {
    if (e === t) return 0;
    if (e === null) return -1;
    if (t === null) return 1;
    const n = Ue(e), i = Ue(t);
    let o = n.length - 1, l = i.length - 1;
    if (n[o] !== i[l]) return null;
    for (; o >= 0 && l >= 0 && n[o] === i[l]; )
      o--, l--;
    if (o < 0 || l < 0)
      return o < 0 ? -1 : 1;
    const f = n[o + 1];
    return Yt(f, n[o], i[l]);
  }
  function V(e, t, n, i) {
    return e !== n ? e - n : t !== null && i !== null && t.repeater.chainHead !== i.repeater.chainHead ? -1 : $(t, i);
  }
  function D(e, t, n) {
    if (typeof n > "u" && (n = null), e.currentWriting === null && Ge(e), t === 1 / 0)
      return e.currentWriting = e.last;
    let i = e.currentWriting;
    if (V(i.time, i.writer, t, n) <= 0)
      for (; i.next !== null && V(i.next.time, i.next.writer, t, n) <= 0; )
        i = i.next;
    else
      for (; V(i.time, i.writer, t, n) > 0; )
        i = i.previous;
    return e.currentWriting = i, i;
  }
  function Ye(e, t, n) {
    const i = D(e, t, n);
    return V(i.time, i.writer, t, n) === 0 ? i : null;
  }
  function $e(e, t) {
    const n = D(e, t.time, t.writer), i = n.next;
    t.writer !== null && (Je(e, t, n), i !== null && Je(e, t, i)), t.previous = n, t.next = i, n.next = t, i !== null ? i.previous = t : e.last = t, e.currentWriting = t, t.linked = !0;
  }
  function Je(e, t, n) {
    if (n.writer === null || n.time !== t.time) return;
    const i = n.writer.repeater, o = t.writer.repeater;
    if (i.chainHead !== o.chainHead)
      throw new Error(
        "Property '" + e.key + "' is already written at time level " + t.time + " by repeater '" + (i.chainHead.rootRepeater.description || "unnamed") + "'s pipeline; repeater '" + (o.description || "unnamed") + "' belongs to a different pipeline at the same time level and cannot write it too. Parallel pipelines may read each other's properties (seeing the latest writing), but each property has one writer pipeline per time level."
      );
  }
  function Ze(e, t, n) {
    const i = Oe(t, n);
    return i.timeline = e, $e(e, i), i;
  }
  function et(e) {
    e.linked && rt(e), $e(e.timeline, e);
  }
  function tt(e) {
    return e.hasNextValue ? { set: !0, value: e.nextValue } : { set: e.set, value: e.value };
  }
  function nt(e, t) {
    const n = tt(e), i = tt(t);
    return n.set !== i.set ? !1 : n.set ? re(n.value, i.value) : !0;
  }
  function xe(e, t) {
    return e.observer.type === "partial" && t !== null && e.observer.repeater.chainHead === t.repeater.chainHead;
  }
  function Jt(e, t) {
    return e.observers === null ? !1 : T(e, () => !0).some((n) => xe(n, t));
  }
  function it(e, t, n) {
    if (n.length === 0) return;
    const i = nt(e, t);
    n.forEach((o) => {
      if (!o.flagged) {
        if (i) {
          j(e, t, o);
          return;
        }
        xe(o, t.writer) ? vt(o.observer.repeater, o, e) : (j(e, t, o), ce(o.observer, t.timeline.handler.proxy, t.timeline.key));
      }
    });
  }
  function Te(e) {
    const t = e.previous;
    if (t === null) return;
    const n = T(
      t,
      (i, o) => V(e.time, e.writer, i, o) < 0
    );
    it(t, e, n);
  }
  function Zt(e, t) {
    if (e.observers === null) return;
    const n = T(e, () => !0);
    it(e, t, n);
  }
  function en(e, t, n, i) {
    const o = oe(e, t);
    return Ye(o, n, i) || Ze(o, n, i);
  }
  function tn(e, t, n, i, o) {
    if (e.observers === null) return;
    T(
      e,
      (f, h) => V(t, n, f, h) < 0
    ).forEach((f) => ce(f.observer, i, o));
  }
  function rt(e) {
    const t = e.timeline;
    e.previous !== null ? e.previous.next = e.next : t.first = e.next, e.next !== null ? e.next.previous = e.previous : t.last = e.previous, t.currentWriting === e && (t.currentWriting = e.previous || e.next || null), e.previous = null, e.next = null, e.linked = !1;
  }
  function Re(e, t, n, i) {
    return D(oe(e, t), n, i);
  }
  function nn(e, t, n) {
    return D(oe(e, c), t, n);
  }
  function rn(e, t) {
    Object.keys(t).forEach(function(n) {
      const i = Object.getOwnPropertyDescriptor(t, n);
      if (typeof i.get == "function" || typeof i.set == "function" || typeof i.value == "function")
        return;
      delete t[n];
      const o = Re(e, n, 0, null);
      o.value = i.value, o.set = !0;
    });
  }
  function se(e, t, n, i) {
    const o = e.timelines[t];
    if (typeof o > "u") return !1;
    const l = D(o, n, i);
    return l.hasNextValue || l.set;
  }
  function Ce(e, t, n, i) {
    const o = e.timelines[t];
    if (typeof o > "u") return;
    const l = D(o, n, i);
    return l.hasNextValue ? l.nextValue : l.set ? l.value : void 0;
  }
  function on(e, t, n, i, o) {
    const l = en(e, t, i, o);
    l.value = n, l.set = !0;
  }
  function ot(e, t, n) {
    const i = [];
    for (let o in e.timelines)
      D(e.timelines[o], t, n).set && i.push(o);
    return i;
  }
  function J() {
    const e = r.context;
    return e && typeof e.time == "function" ? e.time() : 0;
  }
  function ue() {
    const e = r.context;
    return e && typeof e.time == "function" ? e.time() : 1 / 0;
  }
  function z() {
    const e = r.context;
    return e && e.type === "partial" ? e : null;
  }
  function ln(e, t) {
    if (t = t.toString(), t === p)
      return this.meta;
    if (t === ve)
      return this.timelines;
    if (this.meta.forwardTo !== null) {
      let l = this.meta.forwardTo[p].handler;
      return l.get.apply(l, [l.target, t]);
    }
    if (I && !I(this, e, t))
      return F;
    const n = ue(), i = z();
    r.inActiveRecording && u(r.context, this, t, n, i);
    let o = e;
    for (; o !== null && typeof o < "u"; ) {
      let l = Object.getOwnPropertyDescriptor(o, t);
      if (typeof l < "u" && typeof l.get < "u")
        return l.get.bind(this.meta.proxy)();
      o = Object.getPrototypeOf(o);
    }
    return se(this, t, n, i) ? Ce(this, t, n, i) : e[t];
  }
  function sn(e, t, n) {
    if (t === p) throw new Error("Cannot set the dedicated meta property '" + p + "'");
    if (t === ve) throw new Error("Cannot set the dedicated timelines property '" + ve + "'");
    if (this.meta.forwardTo !== null) {
      let P = this.meta.forwardTo[p].handler;
      return P.set.apply(P, [P.target, t, n]);
    }
    if (this.meta.stateProperties && this.meta.stateProperties.has(t) && r.inRepeater !== null)
      throw new Error(
        "Cannot write state property '" + t + "' from inside a repeater. State is written at initialization (declareState/initializeState), from an event handler outside any repeater, or deliberately at initial time via accessInitialValues()/setState()."
      );
    if (M && !M(this, e, t))
      return;
    let i = e;
    for (; i !== null && typeof i < "u"; ) {
      let P = Object.getOwnPropertyDescriptor(i, t);
      if (typeof P < "u" && typeof P.set == "function")
        return P.set.call(this.meta.proxy, n), !0;
      if (typeof P < "u" && typeof P.get < "u")
        return !1;
      i = Object.getPrototypeOf(i);
    }
    const o = J(), l = z(), f = oe(this, t), h = r.context;
    let m = h && h.writings ? h.writings.get(f) : void 0, C = !1, R = null;
    if (typeof m > "u") {
      const P = l !== null ? l.repeater : null, B = P !== null && P.staleWritings !== null ? P.staleWritings.get(f) : void 0;
      if (B && B.length > 0) {
        const U = B.shift();
        B.length === 0 && P.staleWritings.delete(f), Jt(U, l) ? R = U : (m = U, h.touchedStaleWritings === null && (h.touchedStaleWritings = []), h.touchedStaleWritings.push(m));
      }
      typeof m > "u" && (m = Ye(f, o, l), m === null && (m = Ze(f, o, l), C = !0));
    }
    if (m.stale)
      return m.hasNextValue = !0, m.nextValue = n, m.writer = l, et(m), h && h.writings && h.writings.set(f, m), !0;
    const E = !m.set, W = m.value;
    return m.set && re(W, n) || (m.value = n, m.set = !0, h && h.writings && h.writings.set(f, m), x(m, this.proxy, t), C && Te(m), R !== null && Zt(R, m), E && d(this, t, o, l), lt(this, t, n, W)), !0;
  }
  function un(e, t) {
    if (this.meta.forwardTo !== null) {
      let f = this.meta.forwardTo[p].handler;
      return f.deleteProperty.apply(
        f,
        [f.target, t]
      ), !0;
    }
    if (M && !M(this, e, t))
      return;
    const n = J(), i = z(), o = se(this, t, n, i);
    if (!o && !(t in e))
      return !0;
    let l;
    if (o) {
      const f = Re(this, t, n, i);
      l = f.value, f.value = void 0, f.set = !1;
    } else
      l = e[t], delete e[t];
    return b(this, t, n, i), d(this, t, n, i), st(this, t, l), !0;
  }
  function an(e, t) {
    if (this.meta.forwardTo !== null) {
      let l = this.meta.forwardTo[p].handler;
      return l.ownKeys.apply(
        l,
        [l.target, t]
      );
    }
    if (I && !I(this, e, t))
      return F;
    const n = ue(), i = z();
    r.inActiveRecording && g(r.context, this, n, i);
    let o = Object.keys(e);
    return ot(this, n, i).forEach(function(l) {
      o.indexOf(l) === -1 && o.push(l);
    }), o;
  }
  function fn(e, t) {
    if (this.meta.forwardTo !== null) {
      let o = this.meta.forwardTo[p].handler;
      return o.has.apply(
        o,
        [o.target, t]
      );
    }
    if (I && !I(this, e, t))
      return F;
    const n = ue(), i = z();
    return r.inActiveRecording && g(r.context, this, n, i), se(this, t, n, i) ? !0 : t in e;
  }
  function cn(e, t, n) {
    if (this.meta.forwardTo !== null) {
      let i = this.meta.forwardTo[p].handler;
      return i.defineProperty.apply(
        i,
        [i.target, t]
      );
    }
    if (!(M && !M(this, e, t)))
      return d(this, "define property", J(), z()), Reflect.defineProperty(e, t, n);
  }
  function dn(e, t) {
    if (this.meta.forwardTo !== null) {
      let l = this.meta.forwardTo[p].handler;
      return l.getOwnPropertyDescriptor.apply(l, [l.target, t]);
    }
    if (I && !I(this, e, t))
      return F;
    const n = ue(), i = z();
    r.inActiveRecording && g(r.context, this, n, i);
    const o = Object.getOwnPropertyDescriptor(e, t);
    if (typeof o < "u") return o;
    if (se(this, t, n, i))
      return {
        value: Ce(this, t, n, i),
        writable: !0,
        enumerable: !0,
        configurable: !0
      };
  }
  function k(e) {
    return e !== null && typeof e == "object" && typeof e[p] == "object" && e[p].world === w;
  }
  function ae(e, t) {
    if (typeof e > "u" && (e = {}), typeof e != "object") return e;
    if (typeof t > "u" && (t = null), k(e))
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
      get: Bt,
      set: Qt,
      deleteProperty: Xt,
      ownKeys: Ft,
      has: zt,
      defineProperty: qt,
      getOwnPropertyDescriptor: Gt
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
      get: ln,
      set: sn,
      deleteProperty: un,
      ownKeys: an,
      has: fn,
      defineProperty: cn,
      getOwnPropertyDescriptor: dn
    };
    let i = new Proxy(e, n);
    if (n.target = e, n.proxy = i, n.meta = {
      world: w,
      id: "not yet",
      // Wait for rebuild analysis
      buildId: t,
      forwardTo: null,
      target: e,
      handler: n,
      proxy: i,
      // Here to avoid prevent events being sent to objects being rebuilt.
      isBeingRebuilt: !1
    }, e instanceof Array || rn(n, e), r.inRepeater !== null) {
      const o = r.inRepeater;
      if (t !== null) {
        if (o.newBuildIdObjectMap || (o.newBuildIdObjectMap = {}), o.buildIdObjectMap && typeof o.buildIdObjectMap[t] < "u" && Object.getPrototypeOf(o.buildIdObjectMap[t][p].target) === Object.getPrototypeOf(e) && (!o.options.rebuildShapeAnalysis || !o.options.rebuildShapeAnalysis.allowMatch || Qe(
          () => o.options.rebuildShapeAnalysis.allowMatch(o.buildIdObjectMap[t], i)
        ))) {
          n.meta.isBeingRebuilt = !0;
          let l = o.buildIdObjectMap[t];
          l[p].forwardTo = i, o.options.rebuildShapeAnalysis && (n.meta.copyTo = l), n.meta.id = "temp-" + r.nextTempObjectId++, o.newBuildIdObjectMap[t] = l, i = l, n = i[p].handler, ut(l[p].handler);
        } else
          n.meta.id = r.nextObjectId++, n.meta.pendingOnEstablishCall = !0, o.newBuildIdObjectMap[t] = i, fe(n);
        o.options.rebuildShapeAnalysis && (o.newIdObjectShapeMap || (o.newIdObjectShapeMap = {}), o.newIdObjectShapeMap[n.meta.id] = i);
      } else o.options.rebuildShapeAnalysis ? (n.meta.id = r.nextObjectId++, n.meta.pendingCreationEvent = !0, n.meta.pendingOnEstablishCall = !0, o.newIdObjectShapeMap || (o.newIdObjectShapeMap = {}), o.newIdObjectShapeMap[n.meta.id] = i) : (n.meta.id = r.nextObjectId++, fe(n));
    } else
      n.meta.id = r.nextObjectId++, fe(n);
    return i;
  }
  function Pe(e, t) {
    if (k(e) || typeof e != "object" || e === null) return e;
    let n;
    if (t) {
      const i = e instanceof Array ? [] : {};
      for (let o in e)
        i[o] = Pe(e[o], t);
      n = i;
    } else {
      n = e;
      for (let i in e)
        n[i] = Pe(n[i], t);
    }
    return ae(n);
  }
  function G(e, t, n, i) {
    N && H(e, { type: "splice", index: t, removed: n, added: i });
  }
  function pn(e, t, n, i) {
    N && H(e, {
      type: "splice",
      index: t,
      removed: [i],
      added: [n]
    });
  }
  function lt(e, t, n, i) {
    N && H(e, {
      type: "set",
      property: t,
      newValue: n,
      oldValue: i
    });
  }
  function st(e, t, n) {
    N && H(e, {
      type: "delete",
      property: t,
      deletedValue: n
    });
  }
  function ut(e) {
    N && H(e, { type: "reCreate" });
  }
  function fe(e) {
    N && H(e, { type: "create" });
  }
  function at(e) {
    N && H(e, { type: "dispose" });
  }
  function H(e, t) {
    t.object = e.meta.proxy, t.objectId = e.meta.id, !(!St && e.meta.isBeingRebuilt) && (ye && ye(t), Be && typeof e.target.onChange == "function" && e.proxy.onChange(t));
  }
  function Ie() {
    if (r.postponeInvalidation == 0) {
      for (r.postponeRefreshRepeaters++; r.nextObserverToInvalidate !== null; ) {
        let e = r.nextObserverToInvalidate;
        r.nextObserverToInvalidate = null;
        const t = e.nextToNotify;
        t ? (e.nextToNotify = null, r.nextObserverToInvalidate = t) : r.lastObserverToInvalidate = null, e.invalidateAction(), ie(e);
      }
      r.postponeRefreshRepeaters--, xt();
    }
  }
  function ce(e, t, n) {
    if (e.type === "partial" && e.repeater.isRecording) {
      _(e.repeater, e);
      return;
    }
    let i = !1, o = r.context;
    for (; o; ) {
      if (o === e) {
        i = !0;
        break;
      }
      o = o.parent;
    }
    i || (e.invalidatedInContext = r.context, e.invalidatedByKey = n, e.invalidatedByObject = t, e.dispose(), r.postponeInvalidation > 0 ? (ne(e), r.lastObserverToInvalidate !== null ? r.lastObserverToInvalidate.nextToNotify = e : r.nextObserverToInvalidate = e, r.lastObserverToInvalidate = e) : e.invalidateAction(n));
  }
  function hn(e, t) {
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
        te(this);
      },
      record: function(n) {
        if (r.context == this || this.isRemoved) return n();
        const i = Y(this), o = n();
        return K(i), o;
      },
      returnValue: null,
      causalityString() {
        return "<invalidator>" + this.invalidateAction;
      }
    };
  }
  function mn() {
    let e, t, n = null;
    if (arguments.length > 2)
      n = arguments[0], e = arguments[1], t = arguments[2];
    else {
      if (At) throw new Error("Missing description for 'invalidateOnChange'");
      e = arguments[0], t = arguments[1];
    }
    const i = y(n, t);
    return Y(i), i.returnValue = e(i), K(i), i;
  }
  function gn(e) {
    return {
      type: "partial",
      id: r.observerId++,
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
        te(this);
      },
      invalidateAction() {
        this.repeater.invalidateAction(this);
      },
      causalityString() {
        return "<partial of> " + this.repeater.causalityString();
      }
    };
  }
  function de() {
    return { first: null, last: null };
  }
  function ft(e, t) {
    t.previousSibling = e.last, t.nextSibling = null, e.last !== null ? e.last.nextSibling = t : e.first = t, e.last = t;
  }
  function pe(e, t) {
    t.previousSibling !== null ? t.previousSibling.nextSibling = t.nextSibling : e.first = t.nextSibling, t.nextSibling !== null ? t.nextSibling.previousSibling = t.previousSibling : e.last = t.previousSibling, t.previousSibling = null, t.nextSibling = null;
  }
  function ct(e) {
    const t = gn(e);
    let n = !1;
    if (e.reconciling) {
      const i = e.pendingChildren.first;
      i !== null && i.type === "partial" ? (pe(e.pendingChildren, i), te(i), _t(e.chainHead, t, i), n = !0) : e.reconciling = !1;
    }
    return n || Ve(e.chainHead, t), e.rightmostPartial = t, t.parentRepeater = e, t.listMembership = "confirmed", e.currentPartial = t, ft(e.children, t), t;
  }
  function Ae(e, t) {
    if (e.type === "partial")
      for (const n of e.writings.values()) t.push(n);
    else {
      let n = e.children.first;
      for (; n !== null; )
        Ae(n, t), n = n.nextSibling;
    }
  }
  function bn(e, t) {
    let n = e;
    for (; n !== null; ) {
      if (n === t) return !0;
      n = n.parentRepeater;
    }
    return !1;
  }
  function vn(e, t) {
    const n = [];
    Ae(e, n);
    for (const i of n) {
      const o = T(i, () => !0);
      for (const l of o)
        l.flagged || bn(l.observer.repeater, t) && ($(i.writer, l.writer) < 0 || (l.flagged = !0, _(l.observer.repeater)));
    }
  }
  function yn(e) {
    const t = [];
    Ae(e, t);
    const n = /* @__PURE__ */ new Map();
    for (const i of t) {
      if (!i.linked) continue;
      let o = n.get(i.timeline);
      o || (o = [], n.set(i.timeline, o)), o.push(i);
    }
    for (const i of n.values()) {
      i.sort((o, l) => $(o.writer, l.writer));
      for (const o of i)
        et(o), Te(o);
    }
  }
  function dt(e) {
    const t = r.context;
    if (!t || t.type !== "partial")
      return;
    const n = t.repeater;
    let i = null, o = !1;
    if (n.reconciling && n.pendingChildren.first === e)
      pe(n.pendingChildren, e);
    else {
      if (o = !0, n.reconciling = !1, e.parentRepeater === n && e.listMembership === "pending") {
        i = [];
        let h = n.pendingChildren.first;
        for (; h !== e; )
          i.push(h), h = h.nextSibling;
        pe(n.pendingChildren, e);
      }
      e.rightmostPartial && Ut(n.chainHead, e.rightmostPartial);
    }
    const l = e.parentRepeater;
    if (l && l !== n && e.listMembership && pe(e.listMembership === "pending" ? l.pendingChildren : l.children, e), e.parentRepeater = n, e.listMembership = "confirmed", typeof e.retracted < "u" && (e.retracted = !1), ft(n.children, e), o && yn(e), i !== null)
      for (const h of i)
        vn(h, e);
    n.chainHead.executionCursor = e.rightmostPartial, je(t), K(t);
    const f = ct(n);
    Y(f);
  }
  function pt(e) {
    let t = e.pendingChildren.first;
    for (; t !== null; ) {
      const n = t.nextSibling;
      t.previousSibling = null, t.nextSibling = null, t.listMembership = null, t.type === "partial" ? (te(t), En(t)) : ht(t), t = n;
    }
    e.pendingChildren = de();
  }
  function ht(e) {
    e.retracted || (e.dispose(), pt(e), yt(e), e.workStatus = null, e.flagRecords = null, e.retracted = !0, e.options.onRetract && e.options.onRetract(e));
  }
  function wn(e, t, n, i, o) {
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
      // This repeater's own *first* partial of its current/latest run -
      // set fresh every refresh() (see there), never left pointing at a
      // stale object across reruns. The position used for this repeater's
      // own heap entry (see "Repeater scheduling" below) - has to be the
      // first partial, not rightmostPartial: a child's first partial is
      // always created strictly after its parent's own first partial
      // begins (the parent's own action is what creates the child), so
      // first-partial ordering guarantees a parent's heap entry always
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
      children: de(),
      pendingChildren: de(),
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
      // inHeap stays false for it forever, since a root never enters a
      // heap (see drainActivePipeline() - it's always checked directly
      // instead, being unconditionally the earliest position in its own
      // pipeline). A nested repeater only ever uses inHeap.
      inHeap: !1,
      inATimeBucket: !1,
      nextToNotify: null,
      repeaterAction: Tn(t, i),
      nonRecordedAction: n,
      options: i || {},
      finishRebuilding() {
        o(this);
      },
      time() {
        return this.chainHead.time;
      },
      causalityString() {
        const l = this.invalidatedInContext, f = this.invalidatedByObject;
        if (!f) return "Repeater started: " + this.description;
        const h = this.invalidatedByKey, m = l ? l.description : "outside repeater/invalidator", C = "  " + f.toString() + "." + h, R = "" + this.description;
        return "(" + m + ")" + C + " --> " + R;
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
        this.retracted && this.parentRepeater === null && (this.retracted = !1), this.invalidateAction();
      },
      // `partial`: which of its partials read what changed, when it's a
      // read that's invalidated (see invalidateRepeater()).
      invalidateAction(l) {
        _(this, l);
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
        if (this.children.first !== null) {
          let l = this.children.first;
          for (; l !== null; )
            l.listMembership = "pending", l.type === "partial" && l.writings.forEach((f, h) => {
              rt(f), f.stale = !0, this.staleWritings === null && (this.staleWritings = /* @__PURE__ */ new Map());
              let m = this.staleWritings.get(h);
              typeof m > "u" && (m = [], this.staleWritings.set(h, m)), m.push(f);
            }), l = l.nextSibling;
          this.pendingChildren = this.children, this.children = de();
        }
        this.currentPartial = null;
      },
      notifyDisposeToCreatedObjects() {
        if (this.idObjectShapeMap)
          for (let l in this.idObjectShapeMap) {
            let f = this.idObjectShapeMap[l];
            typeof f[p].target.onDispose == "function" && f.onDispose();
          }
        else if (this.buildIdObjectMap)
          for (let l in this.buildIdObjectMap) {
            const f = this.buildIdObjectMap[l];
            typeof f.onDispose == "function" && f.onDispose();
          }
      },
      lastRepeatTime: 0,
      waitOnNonRecordedAction: 0,
      refresh() {
        const l = this, f = l.options;
        f.onRefresh && f.onRefresh(l), l.finishedRebuilding = !1, l.createdCount = 0, l.createdTemporaryCount = 0, l.removedCount = 0, l.reconciling = l.pendingChildren.first !== null;
        const h = ct(l);
        l.firstPartial = h, l.invalidatedWhileRunning = !1, l.isRecording = !0;
        const m = r.context;
        Y(h);
        try {
          l.returnValue = l.repeaterAction(l);
        } catch (W) {
          for (l.isRecording = !1; r.context !== null && r.context !== m; )
            K(r.context);
          throw W;
        }
        l.isRecording = !1, S();
        const C = l.currentPartial;
        o(this), je(C), yt(l), pt(l);
        const { debounce: R = 0, fireImmediately: E = !0 } = f;
        if (l.nonRecordedAction !== null)
          R === 0 || this.firstTime ? (E || !this.firstTime) && l.nonRecordedAction(l.returnValue) : (l.waitOnNonRecordedAction && clearTimeout(l.waitOnNonRecordedAction), l.waitOnNonRecordedAction = setTimeout(() => {
            l.nonRecordedAction(l.returnValue), l.waitOnNonRecordedAction = null;
          }, R));
        else if (R > 0)
          throw new Error("Debounce has to be used together with a non-recorded action.");
        return this.firstTime = !1, K(C), l.invalidatedWhileRunning && (l.invalidatedWhileRunning = !1, _(l)), l;
      }
    };
  }
  function mt(e) {
    const t = e.options.rebuildShapeAnalysis;
    function n(l, f) {
      l[p].forwardTo = f, f[p].copyTo = l, f[p].pendingCreationEvent && (delete f[p].pendingCreationEvent, l[p].pendingReCreationEvent = !0), delete f[p].pendingOnEstablishCall, delete e.newIdObjectShapeMap[f[p].id], e.newIdObjectShapeMap[l[p].id] = l;
    }
    function i(l, f) {
      if (l !== f) {
        const h = k(f), m = k(l);
        if (h !== m) return;
        if (h && m) {
          if (!e.newIdObjectShapeMap[f[p].id] || l[p].forwardTo === f || f[p].buildId || l[p].buildId) return;
          t.allowMatch && t.allowMatch(l, f) && (n(l, f), o(l[p].target, f[p].target));
        } else
          o(l, f);
      }
    }
    function o(l, f) {
      for (let [h, m] of t.slotsIterator(l, f, (C) => k(C) && C[p].buildId))
        i(h, m);
    }
    return { setAsMatch: n, matchChildrenInEquivalentSlot: o, matchInEquivalentSlot: i };
  }
  function On(e) {
    if (e.finishedRebuilding) return;
    const t = e.options;
    t.onStartBuildUpdate && t.onStartBuildUpdate();
    function n(i) {
      return i instanceof Array ? i.map((o) => n(o)) : k(i) && i[p].copyTo ? i[p].copyTo : i;
    }
    if (e.options.rebuildShapeAnalysis) {
      const { matchChildrenInEquivalentSlot: i, matchInEquivalentSlot: o } = mt(e), l = e.options.rebuildShapeAnalysis;
      if (e.establishedRoot instanceof Array || l.shapeRoot() instanceof Array) {
        let f = e.establishedRoot, h = l.shapeRoot();
        f instanceof Array || (f = [f]), h instanceof Array || (h = [h]), i(f, h);
      } else
        o(e.establishedShapeRoot, l.shapeRoot());
      for (let f in e.newIdObjectShapeMap) {
        const h = e.newIdObjectShapeMap[f], m = h[p].forwardTo;
        m && i(h[p].target, m[p].target);
      }
      for (let f in e.newIdObjectShapeMap) {
        let h = e.newIdObjectShapeMap[f], m, C;
        const R = h[p].forwardTo;
        if (R ? (m = R[p].target, C = R[p].handler) : (m = h[p].target, C = h[p].handler), e.options.rebuildShapeAnalysis.translateReferences)
          e.options.rebuildShapeAnalysis.translateReferences(m, n);
        else if (m instanceof Array)
          for (let E in m)
            m[E] = n(m[E]);
        else {
          const E = J(), W = z();
          ot(C, E, W).forEach(function(P) {
            on(C, P, n(Ce(C, P, E, W)), E, W);
          });
        }
      }
      e.establishedShapeRoot = n(e.options.rebuildShapeAnalysis.shapeRoot());
      for (let f in e.newIdObjectShapeMap) {
        let h = e.newIdObjectShapeMap[f];
        const m = h[p].forwardTo;
        m ? (m[p].copyTo = null, h[p].forwardTo = null, Me(h, m), h[p].pendingCreationEvent && (delete h[p].pendingCreationEvent, ut(h[p].handler))) : (h[p].pendingCreationEvent && (delete h[p].pendingCreationEvent, fe(h[p].handler)), Ne(h));
      }
      if (e.idObjectShapeMap) {
        for (let f in e.idObjectShapeMap)
          if (typeof e.newIdObjectShapeMap[f] > "u") {
            const h = e.idObjectShapeMap[f], m = h[p].target;
            at(h[p].handler), typeof m.onDispose == "function" && h.onDispose();
          }
      }
    } else {
      for (let i in e.newBuildIdObjectMap) {
        let o = e.newBuildIdObjectMap[i];
        const l = o[p].forwardTo;
        l !== null ? (o[p].forwardTo = null, l[p].isBeingRebuilt = !1, Me(o, l)) : Ne(o);
      }
      if (e.buildIdObjectMap) {
        for (let i in e.buildIdObjectMap)
          if (e.newBuildIdObjectMap[i] !== e.buildIdObjectMap[i]) {
            const o = e.buildIdObjectMap[i], l = o[p].target;
            at(o[p].handler), typeof l.onDispose == "function" && o.onDispose();
          }
      }
    }
    e.buildIdObjectMap = e.newBuildIdObjectMap, e.newBuildIdObjectMap = {}, e.idObjectShapeMap = e.newIdObjectShapeMap, e.newIdObjectShapeMap = {}, e.finishedRebuilding = !0, t.onEndBuildUpdate && t.onEndBuildUpdate();
  }
  function Ne(e) {
    const t = e[p];
    (t.pendingOnEstablishCall || !t.established) && (delete t.pendingOnEstablishCall, t.established = !0, typeof t.target.onEstablish == "function" && e.onEstablish());
  }
  function xn(e) {
    const t = e[p].forwardTo;
    if (t !== null) {
      if (r.inRepeater) {
        const n = r.inRepeater;
        if (n.options.rebuildShapeAnalysis) {
          const { matchChildrenInEquivalentSlot: i } = mt(n);
          i(e[p].target, t[p].target);
        }
      }
      e[p].forwardTo = null, t[p].isBeingRebuilt = !1, Me(e, t);
    } else
      Ne(e);
    return e;
  }
  function Tn(e, { throttle: t = 0 }) {
    return t > 0 ? function(n) {
      let i = Date.now();
      const o = i - n.lastRepeatTime;
      if (t > o) {
        const l = t - o;
        setTimeout(() => {
          n.restart();
        }, l);
      } else
        return n.lastRepeatTime = i, e();
    } : e;
  }
  function Rn() {
    let e = "", t, n = null, i;
    const o = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
    if (typeof o[0] == "string")
      e = o.shift();
    else if (It)
      throw new Error("Every repeater has to be given a name as first argument. Note: This requirement can be removed in the configuration.");
    typeof o[0] == "function" && (t = o.shift()), (typeof o[0] == "function" || o[0] === null) && (n = o.shift()), typeof o[0] == "object" && (i = o.shift()), i || (i = {});
    const l = i.independent === !0, f = l && typeof i.time > "u" && r.context !== null ? J() : void 0;
    if (Nt && r.inActiveRecording && !l) {
      let R = r.context.description;
      !R && r.context.parent && (R = r.context.parent.description), R || (R = "unnamed"), s.traceWarnings && console.warn(Error(`repeater ${e || "unnamed"} inside active recording ${R}`));
    }
    const h = v(e, t, n, i, On), m = !l && r.context && r.context.type === "partial" ? r.context : null;
    h.parentRepeater = m ? m.repeater : null, h.chainHead = h.parentRepeater ? h.parentRepeater.chainHead : Kt(h), typeof f < "u" && (h.chainHead.time = f);
    const C = h.refresh();
    return l || dt(h), C;
  }
  function Cn(e) {
    return e.workStatus === "flagged" && me(e), dt(e), e;
  }
  function he(e, t) {
    let n = e.length;
    for (; n > 0 && $(e[n - 1].firstPartial, t.firstPartial) > 0; )
      n--;
    e.splice(n, 0, t);
  }
  function Pn(e) {
    return e.shift();
  }
  function Se(e, t, n) {
    const i = r.workQueue[t][n];
    e.previousQueued = i.last, e.nextQueued = null, i.last !== null ? i.last.nextQueued = e : i.first = e, i.last = e;
  }
  function Ee(e, t, n) {
    const i = r.workQueue[t][n];
    i.first === e && (i.first = e.nextQueued), i.last === e && (i.last = e.previousQueued), e.nextQueued !== null && (e.nextQueued.previousQueued = e.previousQueued), e.previousQueued !== null && (e.previousQueued.nextQueued = e.nextQueued), e.nextQueued = null, e.previousQueued = null;
  }
  function In(e, t, n) {
    const i = r.workQueue[t][n];
    e.previousQueued = null, e.nextQueued = i.first, i.first !== null ? i.first.previousQueued = e : i.last = e, i.first = e;
  }
  function gt(e) {
    if (e === r.activePipeline) return;
    r.flushing > 0 && e.time <= r.workQueueTimeLock && (r.workQueueTimeLock = e.time - 1, r.waveRetreated = !0);
    const n = e.time <= r.workQueueTimeLock ? "parked" : "active";
    e.queueMembership !== n && (e.queueMembership !== null && Ee(e, e.time, e.queueMembership), Se(e, e.time, n), e.queueMembership = n);
  }
  function An(e) {
    const t = e.options.pulledBy, n = typeof t == "function" ? t() : t;
    if (!n || n.disposed) return !1;
    if (n.retracted) return !0;
    if (n.isRecording) return !1;
    for (let i = r.context; i; i = i.parent)
      if (i.type === "partial" && i.repeater === n) return !1;
    return n.workStatus !== "invalid" && _(n), !0;
  }
  function bt(e) {
    const t = e.chainHead;
    if (e.options.pulledBy && An(e)) return;
    if (e.parentRepeater === null) {
      if (e.inATimeBucket) return;
      e.inATimeBucket = !0, gt(t);
      return;
    }
    if (e.inHeap) return;
    e.inHeap = !0, gt(t);
    const n = t === r.activePipeline, i = n ? $(e.firstPartial, t.wavefront) <= 0 : t.time <= r.workQueueTimeLock;
    i && n && r.flushing > 0 ? (r.waveRetreated = !0, he(t.heap, e)) : i ? t.parkedPartials.push(e) : he(t.heap, e);
  }
  function _(e, t) {
    if (e.isRecording) {
      (!t || t.listMembership !== "pending") && (e.invalidatedWhileRunning = !0);
      return;
    }
    e.dispose(), e.flagRecords = null, e.workStatus = "invalid", bt(e), xt();
  }
  function Nn() {
    r.observerId = 0, r.workQueue.forEach((e) => {
      e.active.first = null, e.active.last = null, e.parked.first = null, e.parked.last = null;
    }), r.workQueueTimeLock = -1, r.activePipeline = null, r.waveRetreated = !1;
  }
  function vt(e, t, n) {
    t.flagged = !0, e.flagRecords === null && (e.flagRecords = []), e.flagRecords.push({ entry: t, previousWriting: n }), e.workStatus === null && (e.workStatus = "flagged", bt(e));
  }
  function Sn(e) {
    const t = e.flagRecords;
    e.flagRecords = null, !(t === null || t.length === 0) && t.forEach(({ entry: n, previousWriting: i }) => {
      n.flagged = !1;
      let o = D(i.timeline, n.time, n.writer);
      if (o.writer === n.writer && o.previous !== null && (o = o.previous), o === i) return;
      const l = !nt(i, o);
      j(i, o, n), l && _(e);
    });
  }
  function En(e) {
    _e(e.repeater.chainHead, e);
  }
  function jn(e) {
    e.observers !== null && T(e, () => !0).forEach((t) => {
      t.flagged || (xe(t, e.writer) ? vt(t.observer.repeater, t, e) : ce(t.observer, e.timeline.handler.proxy, e.timeline.key));
    }), e.stale = !1, e.hasNextValue = !1, e.nextValue = void 0;
  }
  function je(e) {
    e.touchedStaleWritings !== null && (e.touchedStaleWritings.forEach(function(t) {
      t.stale = !1, re(t.value, t.nextValue) || (t.value = t.nextValue, x(t, t.timeline.handler.proxy, t.timeline.key)), t.hasNextValue = !1, t.nextValue = void 0, Te(t);
    }), e.touchedStaleWritings = null);
  }
  function yt(e) {
    e.staleWritings !== null && (e.staleWritings.forEach(function(t) {
      t.forEach(jn);
    }), e.staleWritings = null);
  }
  function me(e) {
    e.workStatus === "invalid" ? (e.workStatus = null, e.refresh()) : e.workStatus === "flagged" && (e.workStatus = null, Sn(e));
  }
  function Mn(e) {
    return e.retracted || e.disposed || (r.context !== null && r.context.type === "partial" && je(r.context), me(e)), e;
  }
  function wt(e) {
    return !r.waveRetreated || (r.waveRetreated = !1, r.workQueueTimeLock >= e.time - 1) ? !1 : (e.parkedPartials.forEach((t) => he(e.heap, t)), e.parkedPartials = [], e.wavefront = null, r.activePipeline = null, In(e, e.time, "active"), e.queueMembership = "active", !0);
  }
  function Ln() {
    const e = r.activePipeline;
    e.wavefront = null;
    const t = e.rootRepeater;
    for (t.inATimeBucket = !1; t.workStatus !== null; )
      if (t.inATimeBucket = !1, me(t), wt(e)) return;
    for (; e.heap.length > 0; ) {
      const i = Pn(e.heap);
      if (i.inHeap = !1, !(i.disposed || i.retracted) && i.workStatus !== null && (e.wavefront = i.firstPartial, me(i), wt(e)))
        return;
    }
    r.activePipeline = null;
    const n = t.workStatus !== null;
    (e.parkedPartials.length > 0 || n) && (Se(e, e.time, "parked"), e.queueMembership = "parked");
  }
  function kn() {
    return r.workQueue.some((e) => e.active.first !== null || e.parked.first !== null);
  }
  function Ot() {
    let e = r.workQueueTimeLock + 1;
    for (; e < r.workQueue.length; ) {
      if (r.workQueue[e].active.first !== null)
        return r.workQueue[e].active.first;
      r.workQueueTimeLock = e, e++;
    }
    let t = !1;
    for (let n = 0; n < r.workQueue.length; n++) {
      let i = r.workQueue[n].parked.first;
      for (; i !== null; ) {
        const o = i.nextQueued;
        Ee(i, n, "parked"), i.parkedPartials.forEach((l) => he(i.heap, l)), i.parkedPartials = [], Se(i, n, "active"), i.queueMembership = "active", t = !0, i = o;
      }
    }
    return t ? (r.workQueueTimeLock = -1, Ot()) : null;
  }
  function xt() {
    if (r.postponeRefreshRepeaters === 0 && !r.refreshingAllDirtyRepeaters && kn()) {
      r.refreshingAllDirtyRepeaters = !0;
      let e;
      for (; (e = Ot()) !== null; )
        Ee(e, e.time, "active"), e.queueMembership = null, r.activePipeline = e, Ln();
      r.workQueueTimeLock = -1, r.refreshingAllDirtyRepeaters = !1;
    }
  }
  function Wn(e, t) {
    r.recordingPaused++, S(), X.log(e, t), r.recordingPaused--, S();
  }
  function Dn(e, t) {
    r.recordingPaused++, S(), X.group(e, t), r.recordingPaused--, S();
  }
  function Bn() {
    X.groupEnd();
  }
  function Qn(e, t) {
    r.recordingPaused++, S();
    let n = X.logToString(e, t);
    return r.recordingPaused--, S(), n;
  }
  return w;
}
let Le = {};
function $n(s) {
  s || (s = {}), s = { ...Un, ...s };
  const r = zn(s);
  return typeof Le[r] > "u" && (Le[r] = Yn(s)), Le[r];
}
export {
  $n as default,
  $n as getWorld
};
