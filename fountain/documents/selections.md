# Selections

*Specification, draft. Part of [Fountain](../README.md). It details [the whitepaper](../whitepaper.md), sections 3.4, 3.5 and 3.7, for the sixth step of its roadmap: selections per session, with named selectors and subscription counts, computed incrementally and tested against the selection computed from nothing. It is implemented in `src/selections.js`, and in `src/index.js` where it meets sessions, on Deepwell's `load`.*

This document states what a selector is, how a selection is computed, what it contains, and what a client is told about which of its subscriptions hold what. Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified.

The rights that a selection follows are [the user model](user-model.md)'s, and what is sent of it is [observation](observation.md)'s. What is not done is listed in section 6.

---

# 1. Terms

- **Selector.** A table of local rules by class name: for one object, which objects are selected along with it.
- **Selection.** The objects a selector selects from a starting object, for one session.
- **Subscription.** A session's selection, under a number the client chose.
- **Part.** As in the user model: an array, or a synchronized object without a class.
- **Whole.** A selector whose selection is computed from nothing each time anything it read changes.
- **Incremental.** A selector each of whose rules is a repeater of its own, for each object of the selection.

---

# 2. Named selectors

```javascript
fountain.registerSelector("document", {
    Document: (document, selection) => selection.add(...document.chapters),
    Chapter: (chapter, selection) => selection.add(...chapter.paragraphs),
});

fountain.subscribe(session, document, "document", { sub: 7 });
```

**N1. A client subscribes by the name of a selector.** Selectors are registered by name, and a client names one, with a starting object. It never sends code to the server (whitepaper section 3.4). A name that is not registered is refused. Server code may give a table of rules instead of a name.
*Verified by:* a test.

**N2. The session decides which subscriptions it allows.** After the starting object has been found to be one the session knows of and may read (user model S1 and S2), the session's `maySubscribe(selector, start)` is asked, with the selector's name, or null for a table given by server code. It allows any by default; an application narrows it, for example to a few selectors from objects the session gave. `maySubscribe` is not a remote method.
*Verified by:* a test with a session class that allows one selector.

**N3. A subscription is numbered by the client.** Its number is the client's to choose, unique within the session (the protocol's `sub`). A number in use is refused; one is given if the client gives none.

---

# 3. What a selection contains

**C1. The rules are applied transitively from the starting object.** The starting object is in the selection, if the user may read it, and so is everything that the rule of an object in the selection selects, if the user may read it, and so on. An object of a class that has no rule selects nothing beyond its parts.

**C2. Parts come along.** When an object is in the selection, the arrays and classless objects it refers to directly are selected along with it, and theirs in turn (whitepaper section 3.4). A selector decides only about objects of the application's classes: it does not have to add a chapter's list in order to add its paragraphs, nor its settings. A part that is not in memory is found to be one from its record.
*Maintained by:* `withParts`, which wraps every rule. *Verified by:* tests of nested parts, of an object of a class in an array, which does not come along by itself, of parts attached and removed, and of parts after the store has been opened anew.

**C3. A selection passes only through objects the user may read** (user model S3), and follows the rights as they change (user model S4). A part is read as a part of what it was reached through.

**C4. A reference that the selector does not follow is not followed.** Whatever it names is a stub to the client (observation D6).

---

# 4. Which subscriptions hold what

A client is told, for each object, which of its subscriptions hold it, so that it can count them without running selectors (whitepaper section 3.7, "Overlapping subscriptions").

**M1. A delivery says which subscriptions hold what changed.** For every object whose set of holding subscriptions changed in a transaction, and that is still held, a delivery's `memberships` gives the numbers of the subscriptions that hold it. An object that joined is among them. An object that leaves every subscription is in `left` (observation D4), and has no membership.

**M2. Overlapping subscriptions share their objects.** An object in two of a session's selections is held once, sent once, and counted twice. Releasing one subscription leaves it held by the other, and tells the client so.
*Verified by:* a test with two subscriptions that overlap, released one at a time.

**M3. What the client counts is what the server holds.** A client that applies every delivery's memberships, and drops what leaves, has for each object it holds the numbers of exactly the subscriptions whose selections contain it on the server.
*Verified by:* the fuzzer of R1, which compares them after every commit.

`fountain.subscriptionsHolding(session, object)` and `fountain.membershipsOf(session)` give the server's side.

---

# 5. Incremental and whole

```javascript
fountain.registerSelector("document", rules, { whole: true });   // computed from nothing on every change
fountain.registerSelector("document", rules);                    // one repeater per object
```

A whole selector runs as one repeater: it applies the rules from the starting object, and is run again when anything it read changes, which is correct by construction, and costs in proportion to the selection for every change (whitepaper section 3.5). An incremental selector runs the rule of each object as a repeater of its own, so that a change runs the rule of the changed object only; when a reference is cut, the selection is found again by following what the rules last gave, without running any rule (Deepwell's design, section 3.7). The two take the same table, so a selector can start out whole and be made incremental later.

**R1. Incremental and whole give the selection computed from nothing.** After every transaction, the selection of an incremental subscription, and of a whole one with the same rules and starting object, equal what `wholeSelection` gives when applied from nothing with the rights as they are.
*Maintained by:* Deepwell's `load`, with a table of rules or with a function. *Verified by:* a fuzzer that adds chapters to a book and elsewhere, removes them, links chapters in cycles through two fields, changes what the user may read of chapters and of the book, changes the book's owner, adds parts, and attaches objects that the selector does not follow; after every step, both subscriptions are compared with the selection computed from nothing, and the client's copy and memberships with the server's.

`fountain.recomputeSelection(session, subscription)` computes it from nothing.

---

# 6. Not done

- **Selectors as functions.** A selector is a table of rules. A function that fills the whole selection is what Deepwell's `load` also takes, but it cannot be kept from passing through objects the user may not read, so Fountain takes tables only. A table registered as whole is what a function would be.
- **Gated subscriptions** (whitepaper section 3.10).
- **A store that waits.** Parts are found from their records, read at once.
- **Removal that lags.** The whitepaper allows removal to lag behind addition (section 3.5); here both are immediate.
- **A subscription made inside a reactive computation**, released when it is disposed (whitepaper section 3.7). That is the client's.
