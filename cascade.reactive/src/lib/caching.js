/**
 * caching(f) - f, with its results cached per argument list, for as long
 * as what they were computed from stays the same. Flow's cache: a value is
 * computed inside an invalidator (invalidateOnChange()), not a repeater -
 * the first change of anything it read just clears it out, and nothing is
 * kept alive for it. So only what someone actually asks for again is ever
 * computed again, and a value nobody asks for any more leaves no observer
 * behind. Whoever reads a cached value depends on the cache entry, so it's
 * notified when the entry is cleared.
 *
 * Arguments are told apart by identity for observables and by value for
 * numbers and strings; anything else is compared element by element in a
 * bucket of its own signature.
 *
 * When to use it - memory over speed. The alternative is a repeater that
 * keeps the value up to date (as cascade.component's RenderContext does for
 * inherit()): it lives as long as whatever owns it, keeping its value and
 * its dependencies whether anyone still reads them or not - but when its
 * inputs change and it recomputes the same value, nobody who read it is
 * disturbed. Here it's the other way round: an entry costs nothing once
 * it's cleared, but clearing it invalidates everyone who read it, even if
 * the value computed again turns out the same. So use this for many values
 * that are read now and then, by few - and a repeater for values that are
 * read all the time, by many, whose inputs change without changing them.
 */
export function createCachingFunction(observable, invalidateOnChange, withoutRecording, objectMetaProperty) {

  function compareArraysShallow(a, b) {
    if( typeof a !== typeof b )
      return false;
    
    if (a.length === b.length) {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  }

  function isCachedInBucket(signaturesCacheBucket, argumentList) {
    if (signaturesCacheBucket.length === 0) {
      return false;
    } else {
      // Search in the bucket!
      for (let i = 0; i < signaturesCacheBucket.length; i++) {
        if (compareArraysShallow(
          signaturesCacheBucket[i].argumentList,
          argumentList)) {
          return true;
        }
      }
      return false;
    }
  }

  function cacheRecordExists(signaturesCaches, {signature, unique, argumentList}) {
    if (unique) {
      return typeof(signaturesCaches[signature]) !== 'undefined';
    } else {
      if (typeof(signaturesCaches[signature]) === 'undefined') return false;
      return isCachedInBucket(signaturesCaches[signature], argumentList);
    }
  }


  function getExistingRecord(signaturesCaches, {signature, unique, argumentList}) {
    if (unique) {
      return signaturesCaches[signature].value;
    } else {
      let signaturesCacheBucket = signaturesCaches[signature];
      for (let i=0; i < signaturesCacheBucket.length; i++) {
        if (compareArraysShallow(signaturesCacheBucket[i].argumentList, argumentList)) {
          return signaturesCacheBucket[i].value;
        }
      }
    }
  }

  function deleteExistingRecord(signaturesCaches, {signature, unique, argumentList}) {
    if (unique) {
      delete signaturesCaches[signature];
      return;
    } else {
      let signaturesCacheBucket = signaturesCaches[signature];
      for (let i=0; i < signaturesCacheBucket.length; i++) {
        if (compareArraysShallow(signaturesCacheBucket[i].argumentList, argumentList)) {
          signaturesCacheBucket.splice(i, 1);
          return;
        }
      }
    }
  }

  function createNewRecord(signaturesCaches, {signature, unique, argumentList}, value) {
    if (unique) {
      signaturesCaches[signature] = { value };
    } else {
      let signaturesCacheBucket = signaturesCaches[signature];
      if (!signaturesCacheBucket) {
        signaturesCacheBucket = observable([]);
        signaturesCaches[signature] = signaturesCacheBucket;
      }
      signaturesCacheBucket.push({argumentList, value });
    }
  }

  function getArgumentSignature(argumentList) {
    let unique = true;
    let signature  = "";
    argumentList.forEach(function (argument, index) {
      if (index > 0) signature += ",";
      const meta = argument !== null && typeof(argument) === "object" ? argument[objectMetaProperty] : undefined;
      if (typeof(meta) !== 'undefined') {
        signature += "{id=" + meta.id + "}";
      } else if (typeof(argument) === 'number' || typeof(argument) === 'string') {
        signature += argument;
      } else {
        unique = false;
        signature += "{}";  // Non-identifiable, we have to rely on the signature-bucket.
      }
    });
    return { signature: "(" + signature + ")", unique, argumentList };
  }


  function caching(targetFunction) {
    const signaturesCaches = observable({});

    return function (...argumentList) {
      let argumentSignature = getArgumentSignature(argumentList);
      // Whether it's there is not what the caller depends on - its value is
      // (read below, after it's been computed): a reader depending on its
      // absence would be invalidated by the very write that fills it.
      if (!withoutRecording(() => cacheRecordExists(signaturesCaches, argumentSignature))) {
        invalidateOnChange(
          () => { 
            const value = targetFunction.apply(null, argumentList); // TODO: deal with already bound functions.
            createNewRecord(signaturesCaches, argumentSignature, value); 
          },
          () => { deleteExistingRecord(signaturesCaches, argumentSignature); }
        );
      } 
      return getExistingRecord(signaturesCaches, argumentSignature)
    }
  }

  return caching;
}

