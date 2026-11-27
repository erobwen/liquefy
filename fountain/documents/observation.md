# Observation

*Specification, draft. Part of [Fountain](../README.md). It details [the whitepaper](../whitepaper.md), section 3.6, for the fifth step of its roadmap: recording what a computation reads, and matching it against commit change sets. It is implemented in `src/observation.js`, and in `src/index.js` where it meets sessions.*

This document states what a commit's change set is, how a computation is observed by what it reads, and what a session is to be sent after each commit. Each rule that can be checked is stated as an invariant, with who maintains it and how it is verified.

Nothing here is stored, and nothing is sent: the protocol sends what is made here (whitepaper section 3.6, "When observers run"). What is not done is listed in section 5.

---

# 1. Terms

- **Change set.** What one transaction wrote: for each object, the fields written, or all of them for an array whose elements changed.
- **Reads.** What a computation read: for each object, by identity, the fields read, or all of them where it read an array's elements or an object's keys.
- **Observer.** A computation that runs again when a commit's change set touches its reads.
- **Delivery.** What one session is to be sent for one commit: the objects that joined its selections, those that left, the changes to those it held before, and the stubs these refer to.
- **Held.** As in [the user model](user-model.md): in one of the session's selections, or the session itself.

---

# 2. Change sets

**C1. Every commit has a change set.** After every transaction that Deepwell stores, and after every one that changes only volatile objects, Fountain makes its change set: the commit number (null for volatile objects only), the identities of the objects stored in it, and for each object written, the names of the fields set or deleted, or all fields for an array that was spliced.
*Maintained by:* `ChangeSet.fromCommit`, from the events Deepwell gives with each commit. *Verified by:* a test.

**C2. A field written several times is in the change set once.** A change set says what changed, not how often.

**C3. A transaction that is not stored has no change set.** One that throws, or is undone, is reported to no one.

`fountain.onChangeSet(listener)` is told of every change set.

---

# 3. Observers

```javascript
const observer = fountain.observe(() => document.title, (title, changeSet) => { ... });
observer.stop();
```

**O1. Reads are recorded by identity.** What a computation read is recorded as identities and field names, through cascade.reactive's `sourcesOf()`. An observer holds no object in memory, so what it read may be unloaded between runs. A read of a method or a getter of a class is no read of state; what the getter read is. A read of an object that has no identity, one that is neither stored nor volatile, cannot be recorded.

**O2. An observer runs again when a commit touches what it read, and only then.** A change set touches reads when it wrote a field that was read, or any field of an object of which all fields were read: an array whose elements were read, or an object whose keys were. After such a commit, the computation runs again, its reads are recorded anew, and `changed(value, changeSet)` is called.
*Maintained by:* `touches`, in `committed`. *Verified by:* tests that write a field that was read, one that was not, an array that was read, and a new field of an object whose keys were read.

**O3. Observers run after the commit.** What they read is the committed state. They must not write: they are for what is decided after a commit, such as what to send.

Selections are Cascade repeaters, which run inside the transaction (whitepaper section 3.6): they are not observers in this sense, and are kept up to date before the commit, so that what is delivered after it is right.

---

# 4. What a session is sent

```javascript
fountain.onDelivery(session, (delivery) => send(connection, delivery));
fountain.takeDeliveries(session);    // what has not been taken, in order
```

A delivery is:

```javascript
{
    commit: 42,
    joined:  [{ id: "n7", record: { $class: "Document", $version: 0, title: "Notes", chapters: { $ref: "n8" } } }],
    left:    ["n3"],
    changed: [{ id: "n5", fields: { title: "New" }, deleted: ["subtitle"] },
              { id: "n8", splices: [{ index: 2, removed: 0, added: [{ $ref: "n9" }] }] }],
    stubs:   [{ id: "n9", class: "Chapter" }]
}
```

Records and values are in the encoding of Deepwell's [data model](../../deepwell/documents/data-model.md), section 8, which is the same for storage and for the wire: what is stored is what is sent, without `$indexes` and `$dependents`, which are Deepwell's own. A session is sent with the class `Fountain.Session`, whatever the application's class is: clients never have its code.

**D1. A session first receives itself.** A new session's first delivery holds the session.

**D2. What joins a selection is sent whole.** An object that the session did not hold before a transaction, and holds after it, is in `joined`, with its record as it is after the commit.

**D3. What the session held is sent as changes.** For an object it held before and after a transaction, the fields the transaction set are in `fields`, with their values after the commit, and the fields it deleted in `deleted`. An array's changes are its splices, in the order they were made.

**D4. What leaves is dropped.** An object that the session held before a transaction, and does not after it, is in `left`. A right that is taken away makes an object leave, with what is reached through it (user model S4).

**D5. What joins and leaves within one transaction is not sent.** Neither is an object that leaves and joins again: it was held throughout, and its changes are sent.

**D6. A reference that is sent is to something the client holds, or is told of.** Every identity that a record or a change refers to is held by the session after the delivery, or is in `stubs`, with its class, or was in the stubs of an earlier delivery. An object that leaves, and is still referred to from what the session holds, is a stub (data model S5).
A stub reveals that an object exists, and its class (user model E1).

**D7. A delivery is made only when there is something to send,** and only for the sessions that held something the commit wrote, or whose selections changed. It is found through what each session holds (user model S5), not by looking at every session.

**D8. Deliveries are in the order of their commits.** A client that applies them in order moves from one committed state to the next.

**D9. Convergence.** A client that applies every delivery of its session, in order, to an empty copy, holds after each commit exactly the records that the session holds on the server, as `fountain.clientView(session)` gives them.
*Maintained by:* `makeDelivery`, from what joined and left each selection during the transaction (Deepwell's `onChange`), and from the commit's events. *Verified by:* a fuzzer with two sessions of different users, which adds and removes pages, writes their fields, splices their lines, gives and takes rights, changes owners, attaches new objects and refers between pages, and resubscribes; after every commit, each client's copy is compared with the server's, and every reference in it with what the client holds or was told of (D6).

`applyDelivery(copy, delivery)` is how a client applies one.

---

# 5. Not done

- **Sending.** Deliveries are kept until taken, and given to listeners; the protocol sends them.
- **Reconnection** (whitepaper section 8.14): a client that states the commit it last saw and what it holds is sent what it lacks. Aquifer keeps the commit that last changed each record (`db.lastChanged`), which this needs.
- **A client's own writes:** a delivery sends back to the client what it wrote itself. Whether it is told only that they were confirmed is the protocol's to decide (whitepaper section 3.9).
- **Gated subscriptions** (whitepaper section 3.10).
- **Telling a client which of its subscriptions an object belongs to** (whitepaper section 3.7, "Overlapping subscriptions"), and subscription counts.
- **Observers that survive a restart.** An observer is in memory; what must survive a restart is a persistent repeater (Deepwell's indexes).
