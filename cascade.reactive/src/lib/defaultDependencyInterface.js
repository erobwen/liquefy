
let sourcesObserverSetChunkSize = 500;

export function defaultDependencyInterfaceCreator(causality) {

  const state = causality.state;
  const invalidateObserver = causality.invalidateObserver;

  function createObserverSet(description, optionalKey, handler) {
    if (typeof(optionalKey) !== "string") {
      handler = optionalKey;
      optionalKey = null;
    }
    return {
      description : description,
      key: optionalKey,
      handler: handler,
      isRoot : true,
      contents : {},
      contentsCounter : 0,
      first : null,
      last : null,
    }
  }

  // `time`/`writer` (only meaningful for a property dependency - see
  // recordDependencyOnProperty) record *where this observer's own read
  // resolved to*, not just *that* it depends on this observerSet - the
  // extra bit of information migrateOvertakenPropertyObservers (below)
  // needs to tell which of a writing's existing observers a later,
  // closer-inserted writing actually overtakes, rather than having to
  // treat all of them alike.
  function recordDependency(observer, observerSet, optionalKey, time, writer) {
    let observerId = observer.id;
    //console.log("recordDependency", observer, observerSet);
    if (typeof(observerSet.contents[observerId]) !== 'undefined') {
      return;
    }

    if (observerSet.contentsCounter === sourcesObserverSetChunkSize &&
        observerSet.last !== null) {
      observerSet = observerSet.last;
      if (typeof(observerSet.contents[observerId]) !== 'undefined') {
        return;
      }
    }
    if (observerSet.contentsCounter === sourcesObserverSetChunkSize) {
      let newChunk =
        {
          isRoot : false,
          contents: {},
          contentsCounter: 0,
          next: null,
          previous: null,
          parent: null
        };
      if (observerSet.isRoot) {
        newChunk.parent = observerSet;
        observerSet.first = newChunk;
        observerSet.last = newChunk;
      } else {
        observerSet.next = newChunk;
        newChunk.previous = observerSet;
        newChunk.parent = observerSet.parent;
        observerSet.parent.last = newChunk;
      }
      observerSet = newChunk;
    }

    // Add repeater on object beeing observed,
    // if not already added before
    let observerSetContents = observerSet.contents;
    if (typeof(observerSetContents[observerId]) === 'undefined') {
      observerSet.contentsCounter = observerSet.contentsCounter + 1;
      observerSetContents[observerId] = {
        observer,
        time: typeof(time) === 'undefined' ? null : time,
        writer: typeof(writer) === 'undefined' ? null : writer,
        // Set by cascade.js (flagRepeaterEntry) when this entry is found
        // overtaken by a closer writing but the change can't yet be acted
        // on (see resolveFlaggedRepeater) - guards against the same entry
        // being flagged twice over by a second, even-closer writing before
        // the first flag is ever resolved.
        flagged: false,
      };

      // Note dependency in repeater itself (for cleaning up)
      observer.sources.push(observerSet);
    }
  }

  // Every entry across an observerSet's root contents plus any chained
  // overflow chunks (see the chunking above), flattened - each tagged with
  // the specific {contents} object it actually lives in (root or chunk),
  // since removeFromObserverSet needs that exact object, not just the
  // logical observerSet as a whole.
  function collectObserverEntries(observerSet) {
    const result = [];
    for (let id in observerSet.contents) {
      result.push({ id, entry: observerSet.contents[id], owner: observerSet });
    }
    let chunk = observerSet.first;
    while (chunk !== null) {
      for (let id in chunk.contents) {
        result.push({ id, entry: chunk.contents[id], owner: chunk });
      }
      chunk = chunk.next;
    }
    return result;
  }

  function invalidateObservers(observers, proxy, key) {
    state.postponeInvalidation++;

    if (state.blockInvalidation > 0) {
      return;
    }

    let contents = observers.contents;
    for (let id in contents) {
      invalidateObserver(contents[id].observer, proxy, key);
    }

    if (typeof(observers.first) !== 'undefined') {
      let chainedObserverChunk = observers.first;
      while(chainedObserverChunk !== null) {
        let contents = chainedObserverChunk.contents;
        for (let id in contents) {
          invalidateObserver(contents[id].observer, proxy, key);
        }
        chainedObserverChunk = chainedObserverChunk.next;
      }
    }

    state.postponeInvalidation--;
    causality.proceedWithPostponedInvalidations();
  }

  function removeFromObserverSet(id, observerSet) {
    let observerSetContents = observerSet['contents'];
    delete observerSetContents[id];
    let noMoreObservers = false;
    observerSet.contentsCounter--;
    // trace.context && log(
    //     "observerSet.contentsCounter: " +
    //         observerSet.contentsCounter);
    if (observerSet.contentsCounter == 0) {
      if (observerSet.isRoot) {
        if (observerSet.first === null &&
            observerSet.last === null) {
          noMoreObservers = true;
        }
      } else {
        if (observerSet.parent.first === observerSet) {
          observerSet.parent.first === observerSet.next;
        }

        if (observerSet.parent.last === observerSet) {
          observerSet.parent.last
            === observerSet.previous;
        }

        if (observerSet.next !== null) {
          observerSet.next.previous =
            observerSet.previous;
        }

        if (observerSet.previous !== null) {
          observerSet.previous.next = observerSet.next;
        }

        observerSet.previous = null;
        observerSet.next = null;

        if (observerSet.parent.first === null &&
            observerSet.parent.last === null) {
          noMoreObservers = true;
        }
      }

      if (noMoreObservers && typeof(observerSet.handler.proxy.onRemovedLastObserver) === "function") {
        observerSet.handler.proxy.onRemovedLastObserver(observerSet.description, observerSet.key)
      }
    }
  }

  return {
    
    recordDependencyOnArray: (observer, handler) => {
      if (handler._arrayObservers === null) {
        handler._arrayObservers = createObserverSet("arrayDependees", handler);
      }
      recordDependency(observer, handler._arrayObservers);//object
    },

    recordDependencyOnEnumeration: (observer, handler, time, writer) => {
      const writing = causality.getOrCreateEnumerationTimelineWriting(handler, time, writer);
      if (writing.observers === null) {
        writing.observers = createObserverSet("enumerationDependees", handler);
      }
      recordDependency(observer, writing.observers, undefined, time, writer);
    },

    recordDependencyOnProperty: (observer, handler, key, time, writer) => {
      // Note: if key == toString this will break!!!
      if (key === "toString") return;
      const writing = causality.getOrCreateTimelineWriting(handler, key, time, writer);
      if (writing.observers === null) {
        writing.observers = createObserverSet("propertyDependees", key, handler);
      }
      recordDependency(observer, writing.observers, key, time, writer);
    },

    invalidateArrayObservers: (handler, key) => {
      if (handler._arrayObservers !== null) {
        invalidateObservers(handler._arrayObservers, handler.proxy, key);
      }
    },

    invalidatePropertyObservers: (handler, key, time, writer) => {
      const timeline = handler.timelines[key];
      if (typeof(timeline) === 'undefined') return;
      const writing = causality.seekTimelineWriting(timeline, time, writer);
      if (writing.observers !== null) {
        invalidateObservers(writing.observers, handler.proxy, key);
      }
    },

    invalidateWritingObservers: (writing, proxy, key) => {
      if (writing.observers !== null) {
        invalidateObservers(writing.observers, proxy, key);
      }
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
    collectOvertakenPropertyObservers: (previousWriting, isOvertaken) => {
      if (previousWriting.observers === null) return [];
      return collectObserverEntries(previousWriting.observers)
        .filter(({ entry }) => isOvertaken(entry.time, entry.writer))
        .map(({ entry }) => entry);
    },

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
    relocatePropertyObserverEntry: (previousWriting, freshWriting, targetEntry) => {
      if (previousWriting.observers === null) return false;
      const found = collectObserverEntries(previousWriting.observers)
        .find(({ entry }) => entry === targetEntry);
      if (!found) return false;
      removeFromObserverSet(found.id, found.owner);
      if (freshWriting.observers === null) {
        freshWriting.observers = createObserverSet(
          previousWriting.observers.description,
          previousWriting.observers.key,
          previousWriting.observers.handler
        );
      }
      recordDependency(targetEntry.observer, freshWriting.observers, previousWriting.observers.key, targetEntry.time, targetEntry.writer);
      return true;
    },

    // Only invalidate readers positioned after this key add/remove (see
    // invalidateDownstreamEnumerationObservers in cascade.js) - before
    // this, every reader at every position shared one fixed writing, so
    // any key add/remove invalidated all of them regardless of where they
    // sat in the pipeline.
    invalidateEnumerateObservers: (handler, key, time, writer) => {
      const timeline = handler.timelines[causality.enumerationTimelineKey];
      if (typeof(timeline) === 'undefined') return;
      causality.invalidateDownstreamEnumerationObservers(timeline.first, time, writer, handler.proxy, key);
    },

    removeAllSources: (observer) => {
      const observerId = observer.id;
      // trace.context && logGroup(`remove invalidator ${observer.id}`);
      // Clear out previous observations
      observer.sources.forEach(function(observerSet) {
        removeFromObserverSet(observerId, observerSet);
      
      });
      observer.sources.length = 0;  // From repeater itself.
      // trace.context && logUngroup();
    }
  }
}
