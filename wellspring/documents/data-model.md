# Data model

*Specification, draft. Part of [Wellspring](../README.md), with [its design](design.md). It details [the whitepaper](../../fountain/whitepaper.md), section 2.5, and is implemented by Wellspring (whitepaper section 2.6) on the server and by Fountain's client store on clients.*

This document states exactly what a synchronized object is, which values its fields can hold, how each value is stored and sent, and how an object is made again from what was stored. [The protocol](../../fountain/documents/protocol.md) between client and server is built from these values, and Wellspring stores them in [Aquifer](../../aquifer#readme).

Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified, in the style of Aquifer's [invariants](../../aquifer/documents/invariants.md). "Encoder" means the function that turns a field value into its stored or sent form, and "decoder" its inverse. "Write check" means the check made when a value is written to a field of a synchronized object, on the client or on the server.

"The object layer" means whichever of the two is at work: Wellspring on the server, the client store on a client. Both use the same code for what this document specifies: the registry of classes, the write check, the encoder and decoder, and the making of an object from a record. That code depends on neither Aquifer nor a network. Rules that concern storage apply to Wellspring only.

Open points are marked **Open** where they occur, and collected in section 11.

---

# 1. Terms

- **Synchronized object.** An object made to be kept in step with others: with the user interface through Cascade's repeaters, with stored records in the layer below, and with copies on other machines. It is a Cascade observable, made by `synchronized()` or by constructing a class that extends `Synchronized` (section 2). It is either a **record object**, with named fields, or an **array object**, an observable array.
- **Local** and **shared.** A synchronized object is local when it exists only where it was made. It becomes shared when a shared object comes to refer to it: on the server it is then stored, and on a client it is then sent to the server (section 2.2).
- **Local id.** The id Cascade gives every observable when it is made (`meta(object).id`), unique within one world for the lifetime of that world.
- **Identity.** The string that names a shared object, the same on the server, in storage, and on every client. It is the id of the object's record in Aquifer.
- **Field.** A named property of a record object, or an index of an array object.
- **Value.** What a field holds: one of the kinds in section 3.
- **Frozen value.** Plain data, deeply frozen with `Object.freeze`, held by a field as a whole (section 3.4).
- **Reference.** A field value that names another synchronized object, strong or weak (section 3.3).
- **Class.** A JavaScript class registered under a name (section 5).
- **Stub.** On a client, a shared object whose identity and class are known, but whose fields have not been delivered (section 7).
- **Record.** The stored form of a shared object: its class name, its version, and its encoded fields.

---

# 2. Synchronized objects

## 2.1 Making one

There are two ways to make a synchronized object, and they give the same thing.

```javascript
class Document extends Synchronized {
    title = "Untitled";
    chapters = synchronized([]);
}

const document = new Document();            // a class instance
const settings = synchronized({ tabs: 4 }); // a classless record object
const list = synchronized([]);              // an array object
```

`Synchronized` is a base class whose constructor returns the observable. Inside the constructors of its subclasses, and in their field initializers, `this` is therefore already the observable: every write goes through the write check, and a constructor cannot hand out a reference to an object that is not observable. This is how Cascade's components are built.

`synchronized(target)` makes a plain object or an array observable. It is the same operation as Cascade's `observable`, under the name that says what it is for at every level of the stack: an object that is kept in step, through repeaters, with whatever depends on it.

**Open.** Whether `synchronized` becomes an alias of `observable` in cascade.reactive itself, or is exported only by Wellspring and Fountain. As an alias, one function serves an object that is shown in a user interface and stored in a database, and both are the same Cascade world.

**O1. A synchronized object is an observable of the world it lives in.** On a client, synchronized objects are observables of the same Cascade world as the application's components, so that a component that reads one is updated when it changes. Fields of an object that is not observable are never synchronized.
*Maintained by:* the object layer, which makes objects only through Cascade, and the write check (V9). *Verified:* tests.

## 2.2 Local and shared

A synchronized object is local when it is made. Nothing stores it and nothing sends it.

**O2. Sharing is by reachability.** A local object becomes shared when a shared object comes to refer to it, at the end of the transaction in which that happens. Everything it refers to in turn, that is local, becomes shared with it. On the server, becoming shared means being stored; on a client, it means being sent to the server in the transaction's message, which the server then stores. Nothing is shared by calling a method on it.

On the server, the root of the database is shared from the start, and so is everything reachable from it. On a client, the objects the server has delivered are shared.

A client can also hand a local object to the server as an argument of a session method (whitepaper section 4.5). The object is then sent with the call. It is stored only if the method makes a stored object refer to it.

**O3. An object stops being shared when it can no longer be reached.** On the server, an object that cannot be reached from the root is reclaimed by Aquifer's collector, unless a load holds it ([design](design.md) sections 3.3 and 3.5). If its JavaScript object is still in memory when its record is reclaimed, it is local again: it keeps the fields it had, loses its identity, and is stored anew, under a new identity, if a shared object comes to refer to it again.

The criterion for being stored is always reachability from the root, as for a file in a file system. Holding a JavaScript reference to an object does not keep its record.

**Open.** A local-again object may hold references to objects that were reclaimed with it and were not in memory. Such a reference names nothing. The proposal is that it reads as `null`, and that this is reported in development. Code that needs to detach a structure and attach it again later holds it with a load meanwhile, or uses Aquifer's time-limited hold.

## 2.3 Identity

**O4. One instance per identity.** Within one world, on a client or on the server, there is at most one object for each identity. Delivering, loading, or receiving an object that is already present updates that object; it never creates a second one.
*Maintained by:* the object layer's identity map. *Verified:* tests; the protocol simulator.

**O5. Identity is immutable while an object is shared.** A shared object's identity never changes. A local object has no identity, only its local id. When a local object on a client becomes shared, the server assigns its identity, and the object is the same JavaScript object as before (whitepaper section 3.9). Until the identity arrives, the object is named by its local id, which is what the protocol calls a temporary identity.
*Maintained by:* the object layer. *Verified:* tests.

**O6. Identity carries no meaning.** An identity does not encode the object's class, owner, location, or server. Code must not parse identities.
*Maintained by:* convention; Aquifer assigns opaque ids. *Verified:* review.

**O7. Record objects and array objects.** A record object has string-named fields. An array object has fields named by consecutive non-negative integer indexes, and a length. An object is one or the other for its whole life.

Identities are ordinary ids, and need not be unguessable: a client can name only objects it holds or knows as stubs, and roots its session grants ([protocol](../../fountain/documents/protocol.md) section 6.1).

---

# 3. Field values

A field holds exactly one of the following kinds of value. Anything else is refused by the write check (V9).

| Kind | JavaScript | Identity of its own | Changed by |
|---|---|---|---|
| Absent | `undefined`, or no property | - | writing or deleting |
| Primitive | number, string, boolean, `null` | no | replacing |
| Strong reference | a synchronized object | the target's | replacing |
| Weak reference | a weak reference to a synchronized object | the target's | replacing |
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

**V3. A strong reference names a synchronized object.** A field that holds a synchronized object holds a strong reference to it. Once shared, the target is kept alive by the reference (Aquifer's `ref`).

**V4. A weak reference does not keep its target alive.** `weak(object)` makes a weak reference, with the interface of JavaScript's `WeakRef`: `deref()` returns the target while it exists, and `undefined` after the collector has reclaimed it. A field that holds one holds a weak reference (Aquifer's `weak`).

It is a class of the object layer's own, not JavaScript's `WeakRef`, which is cleared by the JavaScript engine rather than by Aquifer. It holds the target's identity, not the target, and `deref()` looks the identity up: in the identity map, and on the server, if the object is not in memory, in Aquifer. It therefore does not keep its target in memory either.

On the server, a weak reference whose target has been reclaimed dereferences to `undefined` from the moment of reclamation. A client is told of the reclamation ([protocol](../../fountain/documents/protocol.md) section 8.1), and from then on its weak references to the target dereference to `undefined` as well.

A weak reference to an object that is unreachable but not yet reclaimed still dereferences to it. Storing that object in a strong reference rescues it (whitepaper section 2.5).

**R1. A reference names a synchronized object of the same world.** The target of a reference is a synchronized object of the same Cascade world, never a frozen value or an object that is not synchronized. A stored object never refers to a volatile one, such as a session or a presence object (whitepaper section 3.11).
*Maintained by:* the write check, and, for volatile objects, the check made when an object becomes shared (O2). *Verified:* tests.

**R2. A strong reference never dangles in storage.** Every strong reference in a stored record names an object that exists.
*Maintained by:* Aquifer (its invariant R2). *Verified:* Aquifer's oracle.

## 3.4 Frozen values

**V5. A frozen value is deeply frozen plain data.** A frozen value is a plain object (whose prototype is `Object.prototype` or `null`) or an array, which is frozen, and whose own enumerable properties are, recursively, primitives, dates, binary values, or frozen values. It contains no references, no maps or sets, no functions, no symbols as keys, no accessors, and no cycles.

A property of a frozen object whose value is `undefined` is omitted when the value is encoded, as JSON does. A hole in a frozen array, and an `undefined` element, is encoded as `null`.

A frozen value is held as a whole. The field that holds it is written last-write-wins like any other field. Two frozen values are equal when their contents are equal, compared deeply; this is how Cascade already compares frozen plain data.

A frozen value is part of the object that holds it, and is read and written under that object's security.

A frozen value does not contain references to synchronized objects. Allowing them would make every frozen value a place where the collector and selectors must look.

## 3.5 Dates, maps, sets, and binary data

**V6. Dates.** A `Date` is a value, holding its time value in milliseconds. An invalid date (time value `NaN`) is a valid value and round-trips as such. A `Date` held by a synchronized field must not be changed in place; to change it, a new `Date` is written.

**V7. Maps and sets.** A `Map` or a `Set` is a value. Its keys and elements, and a map's values, are primitives, dates, binary values, frozen values, or references. Its order of insertion is preserved.

A map or set held by a synchronized field must not be changed in place. To change one, a new one is written. Cascade has no observable maps or sets; a collection that is changed entry by entry is a record object, an array object, or a structure of objects.

**V8. Binary data.** A `Uint8Array` is a value. It is meant for small data, such as an icon; larger data belongs in a blob (whitepaper section 8.17).

**Open.** How a client is stopped from changing a held `Date`, `Map`, `Set`, or `Uint8Array` in place, which would not be noticed. The options: freezing what can be frozen (a `Map` can be made read-only only by wrapping it), copying on read, or reporting it in development by comparing with a stored copy. The proposal is to report it in development, and to document it.

## 3.6 What is refused

**V9. The write check.** Writing a value to a field of a synchronized object throws if the value is not one of the kinds above. In particular, it throws for:

- An ordinary plain object or array that is neither synchronized nor frozen. The application must say whether it means an object of its own (`synchronized(...)`) or a value (`Object.freeze(...)`).
- A frozen object that is not deeply frozen plain data (V5).
- A class instance that is not a synchronized object.
- A function, a symbol, a `bigint`.
- An observable of another world (R1).

A synchronized object is accepted whether it is local or shared. Every synchronized object makes the check on its own fields from the moment it is made, also while it is local, so that when it becomes shared, its fields have already been checked.

The check is made at the moment of writing, on the side that writes, so that the error points at the code that caused it. The server makes the same check on every value it receives, and refuses a transaction that contains a value that fails it.
*Maintained by:* the object layer, through cascade.reactive's per-object hook `meta(object).checkWrite(key, value, operation)`, which is asked before every write, including deletes and every array method, and refuses by throwing. A delete of an array element is refused, since it would leave a hole (A2). *Verified:* tests, one per refused kind.

Deep checks of frozen values cost time in proportion to their size. A value that has been checked once can be remembered, by identity, in a weak set; since it is frozen, it cannot change afterwards.

---

# 4. Arrays

**A1. An array object is a synchronized object.** An array made with `synchronized([])` and held by a field is a strong reference to an array object, with its own identity once shared.

**A2. Arrays are dense.** An array object has no holes. Its elements are values of the kinds in section 3, other than absent. Writing `undefined` at an index, or adding it with an array method, is refused, and so is making an array with holes synchronized. (The hook that checks writes cannot change the value written, so turning `undefined` into `null` would need more of Cascade; refusing is the stricter rule, and can be relaxed later.)

**A3. Changes are splices.** Every change to an array object is described as a splice: a position, a number of elements removed, and the elements inserted. A write to an index is a splice that removes one element and inserts one. Cascade already reports array changes this way. How concurrent splices are anchored and rebased is the protocol's concern (whitepaper section 3.9).

**A4. Arrays are expected to be small.** No limit is enforced, but an array object is stored as one record and rewritten when it changes. A large synchronized array is a documented anti-pattern. The server must survive one, without being fast.

**A5. An array object has no named fields.** Properties other than indexes and `length` are not stored and not synchronized. Setting one throws in development.

---

# 5. Classes

**C1. Classes are registered by name.** A class whose instances are synchronized extends `Synchronized`, and is registered under a name, on the server and on every client, in the registry of the shared data model code. The name, not the JavaScript class, is what is stored and sent. The same name refers to the same class on both sides.
*Maintained by:* registration at start-up. *Verified:* the client states a digest of its registered names and versions when it connects (whitepaper section 8.6).

**C2. The class of an object never changes.** An object's class is set when it is made and is never changed. A change of class is done by making a new object and moving references to it.

**C3. Two names are built in.** A record object made with `synchronized({})`, with no class, has the class name `Object`. An array object has the class name `Array`. An application cannot register a class under either name. A classless object has no methods, and no security methods of its own. Under Fountain, arrays and classless objects are parts of the objects that refer to them: they are selected with them, and written under the security of the selection's root (whitepaper sections 3.4 and 4.2).

**C4. Unknown classes.** An object whose class name is not registered on the side that receives it is refused there, and reported. A client that does not know a class is running old code, and is handled as a version mismatch (whitepaper section 8.6).

**C5. Class versions.** A registered class has a version, a non-negative integer, 0 by default. Every record stores the version of the class it was last written under. An object whose stored version is older than its class's is migrated when it is loaded ([design](design.md) section 8), before any application code sees it. A record whose stored version is newer than its class's is refused.

**C6. No private fields.** A class whose instances are synchronized must not declare `#private` fields or methods. On an object that was constructed they work: the base class returns the observable, and the subclass's private fields are installed on it. But an object made from a record (K2) never ran the constructor, and has none, so every method that reads one throws on every object that was stored, sent, or loaded. Registration refuses a class in which private members can be seen in the source, and the rule is documented for the rest. State that must not be synchronized is kept in metadata (K5).

---

# 6. Creating and loading objects

**K1. A constructor runs once.** An object's constructor, including the initializers of fields in its class body, runs exactly once: in the world where the object is made, by application code. It does not run when the object is received by the server, loaded from storage, delivered to another client, or migrated.
*Maintained by:* the object layer, which makes received and loaded objects from the class's prototype. *Verified:* tests with constructors that count their calls.

**K2. How an object is made from a record.** To make an object from a record, the object layer:

1. Finds the class by name (C1). For the name `Array`, the object is an array object.
2. Creates an object with the class's prototype, without calling the constructor.
3. Decodes each stored field (section 8) and sets it on the object.
4. Makes the object observable, registers it under its identity (O4), and sets its metadata.

Steps 3 and 4 are made without emitting change events and without setting off repeaters: arriving data is not a change made by the application.

**K3. Fields set by the constructor are stored like any other.** A field that the constructor set is an ordinary field, stored and sent. A field that the constructor did not set, and that has never been written, is absent.

**K4. A hook after loading.** A class may define a method that the object layer calls after an object has been made from a record, for state that is not stored, such as a cache. It must not write to synchronized fields.

**Open.** The name of the hook (`onLoaded`, or Cascade's existing `onEstablish`), and whether writing from it is refused or only reported.

**K5. State that is not synchronized.** A class that needs state that is not stored and not sent keeps it in metadata (`metaData(object, name)`), which is never stored. It is lost when the object is unloaded, and absent when the object is made from a record; the hook of K4 can set it up again.

**Open.** Whether a class can declare ordinary named fields as not synchronized, for example with a static list. Metadata may be enough.

**K6. Accessors are not fields.** Getters and setters defined on a class are methods, not fields. What a setter writes to a field is stored; the accessor itself is not.

**K7. References are resolved when they are read, on the server.** A stored reference holds an identity and nothing else. The class of the object it names is in that object's own record, once, however many references name it. On the server, a decoded reference is therefore not turned into an object when the record that holds it is decoded. It is resolved when the field is first read: the object is taken from the identity map, or made from its record. Aquifer reads synchronously, so this is invisible to application code ([design](design.md) section 3.6).

**Open.** Resolving on read needs a place to do it in Cascade's handling of reads: the field holds a placeholder, and the read replaces it with the object. Whether Cascade's `onReadGlobal` can serve, or a small addition is needed, is to be settled in implementation.

---

# 7. Stubs

Stubs exist on clients. A client cannot read a record when it follows a reference, so it must be told the class of every object it knows only by reference, and have an object to stand for it.

**S1. A stub has identity, class, and metadata, and no fields.** When a reference leaves a client's selections, the object it names is delivered as a stub: the server sends its identity and its class name ([protocol](../../fountain/documents/protocol.md) section 6.2). A stub is made like any object (K2), with the class's prototype, but no fields are set.

**S2. A stub's loaded state is observable.** A stub's metadata says that it is not loaded, observably, so that a user interface can show it as loading (whitepaper section 2.4). When its fields arrive, the same object is filled in (O4), and its metadata says that it is loaded.

**S3. Reading a field of a stub is an error in development.** It is reported through Cascade's `onReadGlobal`, and returns Cascade's `cannotReadPropertyValue`. Calling a method of a stub is allowed; a method that reads fields reads the same error value.

**S4. A stub reveals existence and class.** That is accepted (whitepaper section 3.4).

**S5. An object can become a stub again.** When an object leaves all of a client's selections but is still referred to from objects the client holds, its fields are removed, and it becomes a stub. When nothing the client holds refers to it, it is dropped.

---

# 8. Encoding

Values are encoded the same way for storage, in Aquifer's records, and for the wire, in protocol messages, so that the server does not translate between the two.

## 8.1 Records

A record is a plain JSON object. Its keys are the object's field names, with two reserved keys beside them:

```json
{
  "$class": "Document",
  "$version": 2,
  "title": "A New Title",
  "chapters": { "$ref": "n456" },
  "settings": { "margin": 20, "columns": 2 },
  "created": { "$date": 1764028800000 }
}
```

The record of an array object holds its elements under a third reserved key:

```json
{ "$class": "Array", "$version": 0, "$elements": [ { "$ref": "n457" }, { "$ref": "n458" } ] }
```

Fields are kept flat, as Aquifer's own fields, so that Aquifer's `set` and `delete` of a field are a write and a delete of a field of the object.

The commit that last changed an object is not in its record. Aquifer keeps it with the object's metadata ([Aquifer's backlog](../../aquifer/documents/backlog.md)), and Wellspring reads it from there.

## 8.2 Values

| Kind | Encoded as |
|---|---|
| string, boolean, `null` | itself |
| finite number other than `-0` | itself |
| `NaN`, `Infinity`, `-Infinity`, `-0` | `{ "$number": "NaN" }`, `"Infinity"`, `"-Infinity"`, `"-0"` |
| strong reference | `{ "$ref": "<identity>" }` (Aquifer's `ref`) |
| weak reference | `{ "$weak": "<identity>" }` (Aquifer's `weak`) |
| frozen plain object | a JSON object, with its keys escaped (E1) and its values encoded |
| frozen array | a JSON array, with its elements encoded |
| `Date` | `{ "$date": <time value> }`, with `"NaN"` for an invalid date |
| `Map` | `{ "$map": [[key, value], ...] }`, keys and values encoded |
| `Set` | `{ "$set": [element, ...] }`, elements encoded |
| `Uint8Array` | `{ "$binary": "<base64>" }` |

**E1. Every key that begins with `$` is the encoding's own.** In an encoded record, at any depth, a key that begins with a single `$` is one of the reserved keys (`$class`, `$version`, `$elements`) or tags (`$ref`, `$weak`, `$number`, `$date`, `$map`, `$set`, `$binary`). A key of the application's that begins with `$`, whether the name of a field or a key inside a frozen value, is escaped by writing one more `$` in front of it: a field named `$ref` is stored under `$$ref`, and one named `$$x` under `$$$x`. The decoder removes one `$` from every key that begins with two.
*Maintained by:* the encoder. *Verified:* round-trip tests with field names and frozen values whose keys are, or look like, tags.

This is needed for more than tidiness. Aquifer finds references by looking, at any depth of a record, for an object with a `$ref` key. An application value such as `{ $ref: "n1", note: "x" }` stored as it is would be taken for a reference, and a client could use it to keep an arbitrary object alive, or to name one that does not exist.

**E2. Round trip.** For every value `v` that passes the write check, `decode(encode(v))` equals `v`: primitives and dates by value (with `-0` and `NaN` preserved), frozen values deeply and deeply frozen again (without properties that were `undefined`), maps and sets with the same entries in the same order, binary data byte for byte, and references to the same identity.
*Maintained by:* the encoder and decoder. *Verified:* property-based round-trip tests over generated values (section 10).

**E3. Decoded values are frozen where they can be.** A decoded frozen value is deeply frozen. A decoded `Date`, `Map`, `Set`, or `Uint8Array` is a new object, not shared with any other field.

**E4. References are where the collector finds them, and nowhere else.** `$ref` appears in an encoded record only as the single key of a strong reference, and `$weak` only as the single key of a weak reference (E1). The collector and the object layer therefore agree on the graph.
*Maintained by:* the encoder. *Verified:* Aquifer's oracle, run over records written by the object layer; tests that try to forge a reference through a frozen value, a map, and a field name.

---

# 9. Equality and change

**Q1. When a write is a change.** Writing a value to a field is a change, and is stored, sent, and observed, only if the new value differs from the old:

- primitives by `===`, with `NaN` equal to `NaN`. `0` and `-0` are therefore equal: writing one over the other is not a change. This is Cascade's comparison;
- references by identity;
- frozen values by content, deeply, which Cascade does already;
- dates by time value, maps and sets by their entries in order, binary values byte for byte, also where they occur inside a frozen value, a map, or a set.

The last point is not what Cascade does today: it compares dates, maps, sets, and binary values by identity, also inside frozen values, so that writing an equal date is a change. Comparing them by content is work to be done in cascade.reactive.
*Maintained by:* the object layer's write handler, through Cascade's comparison. *Verified:* tests.

---

# 10. Verification

- **Round-trip tests.** A generator of values of every kind, including field names and frozen values with keys that begin with `$`, nested frozen values, maps of maps, and special numbers, checks E1 to E3 for each.
- **Forgery tests.** Values built to look like references, in every place a value can occur, never produce a reference in the stored record (E4).
- **Write-check tests.** One test per refused kind (V9), on local and on shared objects.
- **Construction tests.** Classes with counting constructors and field initializers check K1 across creating, sending, storing, loading, and migrating. A constructor that stores `this` elsewhere stores the observable.
- **Sharing tests.** A local structure becomes shared as a whole when one reference to it is written (O2), and an object whose record is reclaimed while it is in memory is local again (O3).
- **Identity tests.** Delivering, loading, and becoming a stub and back keep one object per identity (O4) and the same JavaScript object (O5, S2).
- **Collector agreement.** Records written by the object layer, run through Aquifer's oracle, give the graph that the object layer believes it wrote (E4).

---

# 11. Open points

| Point | Section |
|---|---|
| `synchronized` as an alias of `observable` in cascade.reactive | 2.1 |
| What a local-again object's references to reclaimed objects read as | 2.2 |
| Support for `bigint` | 3.2 |
| Stopping in-place changes to held dates, maps, sets, and binary values | 3.5 |
| Name and rules of the hook after loading | 6 |
| Declaring fields as not synchronized | 6 |
| Where in Cascade's reads a reference is resolved | 6 |
| Comparing dates, maps, sets, and binary values by content in cascade.reactive | 9 |
