/**
 * What runs in the browser, in the page being prerendered - so these
 * functions are handed to Playwright as they are, and may use nothing from
 * outside themselves.
 */

/**
 * Wait until the app has settled: nothing in the document has changed for
 * `quiet` milliseconds, and no animation that ends is still running (one
 * that never ends - a blinking caret - is no reason to wait). Gives up
 * after `timeout`, and says so: the snapshot is then taken as it is.
 */
export function settle({ quiet, timeout }) {
  return new Promise((resolve) => {
    const started = performance.now();
    let lastChange = performance.now();
    const observer = new MutationObserver(() => { lastChange = performance.now(); });
    observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const animating = () => document.getAnimations().some((animation) => {
      const timing = animation.effect && animation.effect.getComputedTiming();
      return animation.playState === "running" && timing && timing.iterations !== Infinity;
    });
    const check = () => {
      const now = performance.now();
      if (now - started > timeout) { observer.disconnect(); return resolve({ settled: false }); }
      if (now - lastChange >= quiet && !animating()) {
        // Fonts loading change the layout: wait for them too.
        return document.fonts.ready.then(() => { observer.disconnect(); resolve({ settled: true }); });
      }
      setTimeout(check, 50);
    };
    requestAnimationFrame(() => requestAnimationFrame(check));
  });
}

/**
 * The snapshot of the page as it is: what's in the root element, the head
 * documentHead() wrote, the style sheets the app added - and the links in
 * it, for finding further addresses.
 *
 * Debug ids - the id every element a component creates gets, naming it
 * (see cascade.DOM's DOMNodeComponent) - are left out, unless kept: they
 * mean nothing to anyone reading the page, and there's one on every
 * element.
 */
export function capture({ root, keepDebugIds, templateStyles }) {
  const element = document.getElementById(root);
  if (!element) throw new Error(`No element with id "${root}" in the page.`);
  const copy = element.cloneNode(true);
  // One looks like "DOMElementComponent:45(key) | Page:12": each part a
  // component, "ClassName:id(key)", the key optional.
  if (!keepDebugIds) {
    const isDebugId = (id) => id.split(" | ").every((part) => /^[A-Za-z_$][\w$]*:\d+(\(.*\))?$/.test(part));
    for (const each of copy.querySelectorAll("[id]")) {
      if (isDebugId(each.id)) each.removeAttribute("id");
    }
  }
  // Form fields: what's typed is a property, not an attribute - written
  // down, so the snapshot shows it.
  const fields = element.querySelectorAll("input, textarea, select");
  const copies = copy.querySelectorAll("input, textarea, select");
  fields.forEach((field, index) => {
    const into = copies[index];
    if (field.tagName === "TEXTAREA") into.textContent = field.value;
    else if (field.tagName === "SELECT") {
      for (const option of into.options) option.toggleAttribute("selected", option.value === field.value);
    } else if (field.type === "checkbox" || field.type === "radio") into.toggleAttribute("checked", field.checked);
    else if (field.type !== "password" && field.type !== "file") into.setAttribute("value", field.value);
  });

  const head = [...document.head.querySelectorAll("[data-cascade-head]")].map((tag) => tag.outerHTML);
  const styles = [...document.head.querySelectorAll("style")]
    .map((style) => style.textContent)
    .filter((css) => !templateStyles.includes(css));
  const links = [...element.querySelectorAll("a[href]")].map((link) => link.href);
  return { html: copy.innerHTML, title: document.title, head, styles, links };
}
