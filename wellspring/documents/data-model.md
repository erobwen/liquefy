# Data model

*Specification, draft. Part of [Wellspring](../README.md), with [its design](design.md). It details [the whitepaper](../../fountain/whitepaper.md), section 2.5, and is implemented by Wellspring (whitepaper section 2.6) on the server and by Fountain's client store on clients.*

This document states exactly what a synchronized object is, which values its fields can hold, how each value is stored and sent, and how an object is made again from what was stored. [The protocol](../../fountain/documents/protocol.md) between client and server is built from these values, and the object layer over [Aquifer](../../aquifer#readme) stores them.

Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified, in the style of Aquifer's [invariants](../../aquifer/documents/invariants.md). "Encoder" means the function that turns a field value into its stored or sent form, and "decoder" its inverse. "Write check" means the check made when a value is written to a field of a synchronized object, on the client or on the server.

"The object layer" means whichever of the two is at work: Wellspring on the server, the client store on a client. Both use the same code for what this document specifies. Rules that concern storage apply to Wellspring only.

Open points are marked **Open** where they occur, and collected in section 11.

---

# 1. Terms

- **Synchronized object.** An object whose fields are stored by the server and delivered to clients. On both sides it is a Cascade observable, made with `observable` or `temporal`. It has an identity. It is either a **record object**, a plain or class-instance object with named fields, or an **array object**, an observable array.
- **Identity.** The string that names a synchronized object, the same on the server, in storage, and on every client. It is the id of the object's record in Aquifer.
- **Field.** A named property of a record object, or an index of an array object.
- **Value.** What a field holds: one of the kinds in section 3.
- **Frozen value.** Plain data, deeply frozen with `Object.freeze`, held by a field as a whole (section 3.4).
- **Reference.** A field value that names another synchronized object, strong or weak (section 3.3).
- **Class.** A JavaScript class registered with Fountain under a name (section 5). A record object whose class is not registered is a **classless object**.
- **Stub.** A synchronized object whose identity and class are known on a client, but whose fields have not been delivered (section 7).
- **Record.** The stored form of a synchronized object: its class name, its version, and its encoded fields.

---

# 2. Synchronized objects

**O1. A synchronized object is an observable.** On a client and on the server, every synchronized object is a Cascade observable. Fields of a non-observable object are never synchronized.
*Maintained by:* the object layer, which creates objects only through Cascade, and the write check (V9). *Verified:* tests.

**O2. One instance per identity.** Within one world, on a client or on the server, there is at most one object for each identity. Delivering, loading, or receiving an object that is already present updates that object; it never creates a second one.
*Maintained by:* the object layer's identity map. *Verified:* tests; the protocol simulator.

**O3. Identity is immutable.** An object's identity never changes once it has been assigned. On a client, an object created there has a temporary local identity until the server assigns its permanent one (whitepaper section 3.9); after that, the permanent identity never changes, and the object is the same JavaScript object as before.
*Maintained by:* the object layer. *Verified:* tests.

**O4. Identity carries no meaning.** An identity does not encode the object's class, owner, location, or server. Code must not parse identities.
*Maintained by:* convention; Aquifer assigns opaque ids. *Verified:* review.

**O5. Record objects and array objects.** A record object has string-named fields. An array object has fields named by consecutive non-negative integer indexes, and a length. An object is one or the other for its whole life.

**Open.** Whether identities are unguessable, or ordinary sequential ids, depends on whether a client may name any object by its identity (whitepaper section 8.8). The data model does not depend on the answer.

---

# 3. Field values

A field holds exactly one of the following kinds of value. Anything else is refused by the write check (V9).

| Kind | JavaScript | Identity of its own | Changed by |
|---|---|---|---|
| Absent | `undefined`, or no property | - | writing or deleting |
| Primitive | number, string, boolean, `null` | no | replacing |
| Strong reference | a synchronized object | the target's | replacing |
| Weak reference | a `WeakRef` to a synchronized object | the target's | replacing |
| Frozen value | deeply frozen plain object or array | no | replacing |
| Date | `Date` | no | replacing |
| Map | `Map` | no | replacing |
| Set | `Set` | no | replacing |
| Binary | `Uint8Array` | no | replacing |

Every kind except references is a value in the strict sense: it has no identity, it is compared by content, and it is never changed in place, only replaced.

## 3.1 Absent

**V1. Absent and deleted are the same.** A field whose value is `undefined` and a field that does not exist are the same state. Writing `undefined` to a field deletes it. A stored record contains no field whose value is absent, and the set of fields an object has is the set of its present fields.
*Maintained by:* the encoder, which omits absent fields, and the write check, which turns a write of `undefined` into a delete. *Verified:* round-trip tests (section 10).

## 3.2 Primitives

**V2. Primitives.** A primitive is a string, a boolean, `null`, or a number.

Numbers include `NaN`, `Infinity`, `-Infinity`, and `-0`, which JSON cannot represent; the encoder represents them (section 8.2) so that they survive a round trip. Integers beyond `Number.MAX_SAFE_INTEGER` are stored as the number they are, without extra precision.

`bigint` and `symbol` are refused. A string may contain any Unicode text, including lone surrogates, which the encoding must preserve.

**Open.** Whether `bigint` should be supported, as a value encoded like a date. Nothing needs it yet.

## 3.3 References

**V3. A strong reference names a synchronized object.** A field that holds a synchronized object holds a strong reference to it. The target is kept alive by the reference (Aquifer's `ref`).

**V4. A weak reference does not keep its target alive.** A field that holds a `WeakRef` whose target is a synchronized object holds a weak reference (Aquifer's `weak`). Its `deref()` returns the target while the target exists, and `undefined` after the collector has reclaimed it.

On the server, where the collector runs, a weak reference whose target has been reclaimed dereferences to `undefined` from the moment of reclamation. A client is told of the reclamation like of any other change, and from then on its `WeakRef` dereferences to `undefined` as well.

A weak reference to an object that is unreachable but not yet reclaimed still dereferences to it. Storing that object in a strong reference rescues it (whitepaper section 2.5).

**Open.** JavaScript's own `WeakRef` is reclaimed by the JavaScript engine's collector, not by Aquifer's. The object layer therefore needs its own weak reference class, with the same interface (`deref()`), whose target is held by the object layer for as long as the object exists in the database. Whether it can be a subclass of `WeakRef`, or must be a class of its own, is to be decided in implementation.

**R1. A reference names a synchronized object of the same world.** The target of a reference is a synchronized object, never a frozen value, a presence object (whitepaper section 3.11), a server-local object, or an object of another world.
*Maintained by:* the write check. *Verified:* tests.

**R2. A strong reference never dangles in storage.** Every strong reference in a stored record names an object that exists.
*Maintained by:* Aquifer (its invariant R2). *Verified:* Aquifer's oracle.

## 3.4 Frozen values

**V5. A frozen value is deeply frozen plain data.** A frozen value is a plain object (whose prototype is `Object.prototype` or `null`) or an array, which is frozen, and whose own enumerable properties are, recursively, primitives, dates, binary values, or frozen values. It contains no references, no maps or sets, no functions, no symbols as keys, no accessors, and no cycles.

A frozen value is held as a whole. The field that holds it is written last-write-wins like any other field. Two frozen values are equal when their contents are equal, compared deeply; this is how Cascade already compares frozen plain data.

A frozen value is part of the object that holds it, and is read and written under that object's security.

**Open.** Whether a frozen value may contain references to synchronized objects. Allowing them would make every frozen value a place where the collector and selectors must look. The proposal is not to allow them (whitepaper section 2.5).

## 3.5 Dates, maps, sets, and binary data

**V6. Dates.** A `Date` is a value, holding its time value in milliseconds. An invalid date (time value `NaN`) is a valid value and round-trips as such. A `Date` held by a synchronized field must not be changed in place; to change it, a new `Date` is written.

**V7. Maps and sets.** A `Map` or a `Set` is a value. Its keys and elements, and a map's values, are primitives, dates, binary values, frozen values, or references. Its order of insertion is preserved.

A map or set held by a synchronized field must not be changed in place. To change one, a new one is written. Cascade has no observable maps or sets; a collection that is changed entry by entry is a record object, an array object, or a structure of objects.

**V8. Binary data.** A `Uint8Array` is a value. It is meant for small data, such as an icon; larger data belongs in a blob (whitepaper section 8.17).

**Open.** How a client is stopped from changing a held `Date`, `Map`, `Set`, or `Uint8Array` in place, which would not be noticed. The options: freezing what can be frozen (a `Map` can be made read-only only by wrapping it), copying on read, or reporting it in development by comparing with a stored copy. The proposal is to report it in development, and to document it.

## 3.6 What is refused

**V9. The write check.** Writing a value to a field of a synchronized object throws if the value is not one of the kinds above. In particular, it throws for:

- An ordinary, unfrozen plain object or array that is not observable. The application must say whether it means an object of its own (`observable(...)`) or a value (`Object.freeze(...)`).
- A frozen object that is not deeply frozen plain data (V5).
- A class instance that is not a synchronized object.
- A function, a symbol, a `bigint`.
- A presence object, a server-local object, or an object of another world (R1).

The check is made at the moment of writing, on the side that writes, so that the error points at the code that caused it. The server makes the same check on every value it receives, and refuses a transaction that contains a value that fails it.
*Maintained by:* the object layer's write handler. *Verified:* tests, one per refused kind.

Deep checks of frozen values cost time in proportion to their size. A value that has been checked once can be remembered, by identity, in a weak set; since it is frozen, it cannot change afterwards.

---

# 4. Arrays

**A1. An array object is a synchronized object.** An observable array held by a field is a strong reference to an array object, with its own identity.

**A2. Arrays are dense.** An array object has no holes. Its elements are values of the kinds in section 3, other than absent. Writing `undefined` at an index stores `null`.

**Open.** Whether to refuse holes and `undefined` rather than turn them into `null`. Turning them into `null` is what JSON does, and is least surprising.

**A3. Changes are splices.** Every change to an array object is described as a splice: a position, a number of elements removed, and the elements inserted. A write to an index is a splice that removes one element and inserts one. Cascade already reports array changes this way. How concurrent splices are anchored and rebased is the protocol's concern (whitepaper section 3.9).

**A4. Arrays are expected to be small.** No limit is enforced, but an array object is stored as one record and rewritten when it changes. A large synchronized array is a documented anti-pattern. The server must survive one, without being fast.

**A5. An array object has no named fields.** Properties other than indexes and `length` are not stored and not synchronized. Setting one throws in development.

---

# 5. Classes

**C1. Classes are registered by name.** A class whose instances are synchronized is registered with Fountain under a name, on the server and on every client. The name, not the JavaScript class, is what is stored and sent. The same name refers to the same class on both sides.
*Maintained by:* registration at start-up. *Verified:* the client states its registered names when it connects (with its code version, whitepaper section 8.6).

**C2. The class of an object never changes.** An object's class is set when it is created and is never changed. A change of class is done by creating a new object and moving references to it.

**C3. A classless object.** A record object created with `observable({})`, with no registered class, has the class name of plain observables. It has no methods, and no security methods of its own (whitepaper section 4.2).

**C4. Unknown classes.** An object whose class name is not registered on the side that receives it is refused there, and reported. A client that does not know a class is running old code, and is handled as a version mismatch (whitepaper section 8.6).

**C5. Class versions.** A registered class has a version, a non-negative integer, 0 by default. Every record stores the version of the class it was last written under. An object whose stored version is older than its class's is migrated when it is loaded (whitepaper section 6), before any application code sees it.

---

# 6. Creating and loading objects

**K1. A constructor runs once.** An object's constructor, including the initializers of fields in its class body, runs exactly once: in the world where the object is created, by application code. It does not run when the object is received by the server, loaded from storage, delivered to another client, or migrated.
*Maintained by:* the object layer, which makes received and loaded objects from the class's prototype. *Verified:* tests with constructors that count their calls.

**K2. How an object is made from a record.** To make an object from a record, the object layer:

1. Finds the class by name (C1). For an array object, the array class.
2. Creates an object with the class's prototype, without calling the constructor.
3. Decodes each stored field (section 8) and sets it on the object.
4. Makes the object observable, registers it under its identity (O2), and sets its metadata.

Steps 3 and 4 are made without emitting change events and without setting off repeaters: arriving data is not a change made by the application.

**K3. Fields set by the constructor are stored like any other.** A field that the constructor set is an ordinary field, stored and sent. A field that the constructor did not set, and that has never been written, is absent.

**K4. A hook after loading.** A class may define a method that the object layer calls after an object has been made from a record, for state that is not stored, such as a cache. It must not write to synchronized fields.

**Open.** The name of the hook (`onLoaded`, or Cascade's existing `onEstablish`), and whether writing from it is refused or only reported.

**K5. Private and non-synchronized state.** Fields declared with JavaScript's `#private` syntax are not stored and not synchronized: the object layer cannot see them, and they are lost when an object is made from a record. A class that needs state that is not synchronized keeps it in metadata (`metaData(object, name)`), which is never stored.

**Open.** Whether a class can declare ordinary named fields as not synchronized, for example with a static list. Metadata may be enough.

**K6. Accessors are not fields.** Getters and setters defined on a class are methods, not fields. What a setter writes to a field is stored; the accessor itself is not.

---

# 7. Stubs

**S1. A stub has identity, class, and metadata, and no fields.** When a reference leaves a client's selections, the object it names is delivered as a stub. A stub is made like any object (K2), with the class's prototype, but no fields are set.

**S2. A stub's loaded state is observable.** A stub's metadata says that it is not loaded, observably, so that a user interface can show it as loading (whitepaper section 2.4). When its fields arrive, the same object is filled in (O2), and its metadata says that it is loaded.

**S3. Reading a field of a stub is an error in development.** It is reported through Cascade's `onReadGlobal`, and returns Cascade's `cannotReadPropertyValue`. Calling a method of a stub is allowed; a method that reads fields reads the same error value.

**S4. A stub reveals existence and class.** That is accepted (whitepaper section 3.4).

**S5. An object can become a stub again.** When an object leaves all of a client's selections but is still referred to from objects the client holds, its fields are removed, and it becomes a stub. When nothing the client holds refers to it, it is dropped.

---

# 8. Encoding

Values are encoded the same way for storage, in Aquifer's records, and for the wire, in protocol messages, so that the server does not translate between the two.

## 8.1 Records

A record is a plain JSON object:

```json
{
  "$class": "Document",
  "$version": 2,
  "fields": {
    "title": "A New Title",
    "chapters": { "$ref": "n456" },
    "settings": { "margin": 20, "columns": 2 },
    "created": { "$date": 1764028800000 }
  }
}
```

The record of an array object has `"$class": "Array"` and an `elements` array in place of `fields`.

**Open.** Whether `$class` and `$version` sit beside the fields in Aquifer's record, as here, or are kept by the object layer elsewhere. Aquifer today stores one plain object of fields per record, and finds references in it wherever they are.

## 8.2 Values

| Kind | Encoded as |
|---|---|
| string, boolean, `null` | itself |
| finite number other than `-0` | itself |
| `NaN`, `Infinity`, `-Infinity`, `-0` | `{ "$number": "NaN" }`, `"Infinity"`, `"-Infinity"`, `"-0"` |
| strong reference | `{ "$ref": "<identity>" }` (Aquifer's `ref`) |
| weak reference | `{ "$weak": "<identity>" }` (Aquifer's `weak`) |
| frozen plain object | a JSON object, with its fields encoded |
| frozen array | a JSON array, with its elements encoded |
| `Date` | `{ "$date": <time value> }`, with `"NaN"` for an invalid date |
| `Map` | `{ "$map": [[key, value], ...] }`, keys and values encoded |
| `Set` | `{ "$set": [element, ...] }`, elements encoded |
| `Uint8Array` | `{ "$binary": "<base64>" }` |

**E1. Tags are reserved.** An encoded object whose only key is one of `$ref`, `$weak`, `$number`, `$date`, `$map`, `$set`, `$binary`, or `$escape` is a tagged value. A frozen plain object that has exactly one key, and that key begins with `$`, is encoded escaped: `{ "$escape": { ... } }`. The decoder unwraps `$escape` without interpreting its content as a tag.
*Maintained by:* the encoder. *Verified:* round-trip tests with frozen values whose keys look like tags.

**E2. Round trip.** For every value `v` that passes the write check, `decode(encode(v))` equals `v`: primitives and dates by value (with `-0` and `NaN` preserved), frozen values deeply and deeply frozen again, maps and sets with the same entries in the same order, binary data byte for byte, and references to the same identity.
*Maintained by:* the encoder and decoder. *Verified:* property-based round-trip tests over generated values (section 10).

**E3. Decoded values are frozen where they can be.** A decoded frozen value is deeply frozen. A decoded `Date`, `Map`, `Set`, or `Uint8Array` is a new object, not shared with any other field.

**E4. Strong references are where the collector finds them.** Aquifer finds strong references anywhere in a record by their `$ref` tag. The encoding never puts `$ref` anywhere except for a strong reference, so the collector and the object layer agree on the graph. Escaping (E1) guarantees it for frozen values.
*Maintained by:* the encoder. *Verified:* Aquifer's oracle, run over records written by the object layer.

---

# 9. Equality and change

**Q1. When a write is a change.** Writing a value to a field is a change, and is stored, sent, and observed, only if the new value differs from the old:

- primitives by `Object.is` (so `NaN` equals `NaN`, and `0` differs from `-0`);
- references by identity;
- frozen values, dates, maps, sets, and binary values by content.

Cascade compares frozen plain data by content already; dates, maps, sets, and binary values must be added to that comparison.
*Maintained by:* the object layer's write handler. *Verified:* tests.

---

# 10. Verification

- **Round-trip tests.** A generator of values of every kind, including tagged-looking frozen values, nested frozen values, maps of maps, and special numbers, checks E2 and E3 for each.
- **Write-check tests.** One test per refused kind (V9).
- **Construction tests.** Classes with counting constructors and field initializers check K1 across creating, sending, storing, loading, and migrating.
- **Identity tests.** Delivering, loading, and becoming a stub and back keep one object per identity (O2) and the same JavaScript object (O3, S2).
- **Collector agreement.** Records written by the object layer, run through Aquifer's oracle, give the graph that the object layer believes it wrote (E4).

---

# 11. Open points

| Point | Section |
|---|---|
| Unguessable or sequential identities | 2 |
| Support for `bigint` | 3.2 |
| The weak reference class, and how it relates to `WeakRef` | 3.3 |
| References inside frozen values | 3.4 |
| Stopping in-place changes to held dates, maps, sets, and binary values | 3.5 |
| Holes and `undefined` in arrays: refuse, or store as `null` | 4 |
| Name and rules of the hook after loading | 6 |
| Declaring fields as not synchronized | 6 |
| Where `$class` and `$version` are stored in Aquifer's records | 8.1 |
| A `$commit` in every record, the commit that last changed the object, which reconnection needs ([protocol](../../fountain/documents/protocol.md) section 11.2) | 8.1 |
