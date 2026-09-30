import { getWorld } from "../cascade.js";
import assert from "assert";

// Writer order comes from the tree itself (see cascade.js's
// structuralCompareWriterOrder): an O(depth) parent/sibling walk, siblings
// compared by position number. Exercised here against the same
// reconciliation-breaking shape reconciliation-position-staleness.js
// covers, plus the pressure-release stress shape.
describe("structural writer order", function () {
  it("holds across a reconciliation-breaking modal/docked transition", function () {
    const {
      observable, repeat, linkRepeater, postponeInvalidations, continueInvalidations,
    } = getWorld({ name: "structural-verifier-reconciliation-" + Math.random() });

    const windowSize = observable({ width: 500, height: 800 });
    const mainFrameContext = observable({ usableWidth: null, usableHeight: null });
    const menuFrameContext = observable({ usableWidth: null, usableHeight: null });

    let hamburgerRepeater = null;
    let menuRepeater = null;
    let workAreaRepeater = null;
    let menuFrameRepeater = null;
    let mainFrameRepeater = null;
    let menuOpen = false;

    function hamburgerRenderOnto() {
      if (!hamburgerRepeater) hamburgerRepeater = repeat(() => {});
      else linkRepeater(hamburgerRepeater);
    }
    function menuRenderOnto() {
      if (!menuRepeater) menuRepeater = repeat(() => {});
      else linkRepeater(menuRepeater);
    }
    function workAreaRenderOnto() {
      if (!workAreaRepeater) {
        workAreaRepeater = repeat(() => { void menuFrameContext.usableWidth; void menuFrameContext.usableHeight; });
      } else {
        linkRepeater(workAreaRepeater);
      }
    }
    function menuFrameRenderOnto() {
      if (!menuFrameRepeater) menuFrameRepeater = repeat(() => menuFrameRender());
      else linkRepeater(menuFrameRepeater);
    }

    function menuFrameRender() {
      const isModal = mainFrameContext.usableWidth < 660;
      postponeInvalidations();
      if (isModal) {
        hamburgerRenderOnto();
        menuFrameContext.usableWidth = mainFrameContext.usableWidth;
        menuFrameContext.usableHeight = mainFrameContext.usableHeight;
        workAreaRenderOnto();
        if (menuOpen) menuRenderOnto();
      } else {
        menuRenderOnto();
        menuFrameContext.usableWidth = mainFrameContext.usableWidth - 220;
        menuFrameContext.usableHeight = mainFrameContext.usableHeight;
        workAreaRenderOnto();
      }
      continueInvalidations();
    }

    mainFrameRepeater = repeat(() => {
      postponeInvalidations();
      mainFrameContext.usableWidth = windowSize.width;
      mainFrameContext.usableHeight = windowSize.height;
      menuFrameRenderOnto();
      continueInvalidations();
    });

    menuOpen = true;
    menuFrameRepeater.restart();

    windowSize.width = 1200;
    assert.doesNotThrow(() => mainFrameRepeater.restart());

    windowSize.width = 500;
    assert.doesNotThrow(() => mainFrameRepeater.restart());
  });

  it("holds across many pressure-release blasts", function () {
    const { observable, repeat, linkRepeater } = getWorld({
      name: "structural-verifier-pressure-" + Math.random(),
    });

    const target = observable({ value: 0 });
    const middles = [];
    let afterRepeater = null;
    let pendingCount = 0;

    const parent = repeat(() => {
      target.value = 0;
      for (const m of middles) linkRepeater(m);
      if (middles.length < pendingCount) {
        middles.push(repeat(() => { void target.value; }));
      }
      if (afterRepeater) linkRepeater(afterRepeater);
      else afterRepeater = repeat(() => {});
    });

    for (let i = 0; i < 24; i++) {
      pendingCount = i + 1;
      assert.doesNotThrow(() => parent.restart());
    }
  });
});
