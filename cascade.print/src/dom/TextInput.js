import { DOMNodeComponent } from "@liquefy/cascade.dom";

/**
 * TextInput - where the keyboard goes while a document is edited: a hidden
 * textarea, focused when the papers are clicked, turning what's typed into
 * commands for the editor (see PaperEditor):
 *
 *   { type: "insert", text }       - typed, pasted, or composed
 *   { type: "key", key, shift, primary } - Backspace, Delete, Enter,
 *                                    the arrows, Home, End - or the name
 *                                    of a shortcut (see `shortcutFor`);
 *                                    `primary` is Ctrl - Cmd on a Mac
 *   { type: "focus" }, { type: "blur" }
 *
 * A textarea, so typing works as typing does everywhere - dead keys,
 * accents, an input method composing Chinese or Japanese: nothing is
 * inserted until a composition ends. Whatever it collects is taken out at
 * once, so it never holds anything.
 *
 * It renders its own node, with listeners of its own: an input's
 * `beforeinput`/composition events aren't element properties everywhere,
 * so they can't be given as attributes.
 *
 * Properties: `onCommand(command)`, and `shortcutFor(key)` - the name of
 * what Ctrl/Cmd plus a key is ("SelectAll" for "a", say), asked as it's
 * pressed: undefined leaves the key to the browser.
 */
export class TextInput extends DOMNodeComponent {
  setProperties({ onCommand, shortcutFor }) {
    this.onCommand = onCommand;
    this.shortcutFor = shortcutFor || null;
  }

  ensureNode() {
    const u = this.unobservable;
    if (!u.node) u.node = this.createTextarea();
    return u.node;
  }

  createTextarea() {
    const textarea = document.createElement("textarea");
    for (const [name, value] of [["autocomplete", "off"], ["autocapitalize", "off"], ["autocorrect", "off"], ["spellcheck", "false"], ["aria-label", "Document text"], ["aria-multiline", "true"]]) {
      textarea.setAttribute(name, value);
    }
    Object.assign(textarea.style, {
      // Fixed, and moved to the caret (see moveTo()): an input method opens
      // its window where its input is.
      position: "fixed", left: "0", top: "0", width: "1px", height: "1em",
      padding: "0", border: "0", margin: "0", outline: "none", resize: "none", overflow: "hidden",
      opacity: "0", pointerEvents: "none", whiteSpace: "pre", fontSize: "16px",
    });

    const send = (command) => {
      if (this.onCommand) this.onCommand(command);
    };
    let composing = false;
    const takeText = () => {
      const text = textarea.value;
      textarea.value = "";
      if (text) send({ type: "insert", text });
    };

    textarea.addEventListener("keydown", (event) => {
      if (composing || event.isComposing) return;
      const primary = event.ctrlKey || event.metaKey;
      const shortcut = primary && !event.altKey && this.shortcutFor ? this.shortcutFor(event.key.toLowerCase()) : undefined;
      if (!handledKeys.has(event.key) && !shortcut) return;
      event.preventDefault();
      send({ type: "key", key: shortcut || event.key, shift: event.shiftKey, primary });
    });
    textarea.addEventListener("compositionstart", () => { composing = true; });
    textarea.addEventListener("compositionend", () => {
      composing = false;
      takeText();
    });
    textarea.addEventListener("input", () => {
      if (!composing) takeText();
    });
    textarea.addEventListener("focus", () => send({ type: "focus" }));
    textarea.addEventListener("blur", () => send({ type: "blur" }));
    return textarea;
  }

  focus() {
    const node = this.unobservable.node;
    if (node) node.focus({ preventScroll: true });
  }

  isFocused() {
    const node = this.unobservable.node;
    return !!node && node.ownerDocument.activeElement === node;
  }

  // To where the caret is on screen (a client rect's left and top).
  moveTo(left, top) {
    const node = this.unobservable.node;
    if (!node) return;
    node.style.left = left + "px";
    node.style.top = top + "px";
  }
}

const handledKeys = new Set(["Backspace", "Delete", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
