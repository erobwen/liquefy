import { getWorld } from "../cascade.js";
import assert from "assert";

const {
  observable, repeat, linkRepeater, postponeInvalidations, continueInvalidations,
} = getWorld({ name: "reconciliation-position-staleness", timeLevels: 5 });

// Found via cascade.application/demo's real menu/work-area responsive
// breakpoint (see docs/plan-partial-repeaters.md's "Rerun: partials get
// reused in place" for the reconciliation this exercises): a parent
// whose two branches call a *different* child at the same relative
// position - modal calls hamburger right before writing usableWidth;
// docked calls menu there instead - breaks the parent's own positional
// reconciliation (repeater.reconciling goes false) the moment the branch
// flips. A *third*, shared child (workArea) sits right after that write,
// unaffected in principle (it's the same repeater both times) - but its
// own `rightmostPartial` was last positioned whenever it actually
// executed, which can be arbitrarily far behind this chain's *current*
// insertion point once reconciliation has broken and started producing
// fresh (not inherited) chain slots. Left uncorrected, the fresh write
// right before workArea gets a *larger* orderNumber than workArea's own
// stale one, so workArea's later read of it - resolved via "the writing
// with the largest time <= my own position" - silently treats the write
// as not-yet-happened and falls through to nothing, even though it
// already ran. Fixed in attachToCurrentParent() by repositioning a
// relinked child's rightmostPartial (via movePartialToCurrentPosition())
// whenever reconciliation has broken, so its position always reflects
// the *current* run's real execution order rather than whenever it last
// happened to run.
describe("reconciliation position staleness (relinked child after a parent's reconciliation breaks)", function () {
  it("a shared child positioned after a freshly-diverged sibling still sees that sibling's fresh write", function () {
    const windowSize = observable({ width: 500, height: 800 });
    const mainFrameContext = observable({ usableWidth: null, usableHeight: null });
    const menuFrameContext = observable({ usableWidth: null, usableHeight: null });

    let hamburgerRepeater = null;
    let menuRepeater = null;
    let workAreaRepeater = null;
    let menuFrameRepeater = null;
    let mainFrameRepeater = null;
    let menuOpen = false;
    let workAreaReads = 0;
    let lastWorkAreaRead = null;

    function hamburgerRenderOnto() {
      if (!hamburgerRepeater) {
        hamburgerRepeater = repeat(() => {});
      } else {
        linkRepeater(hamburgerRepeater);
      }
    }

    function menuRenderOnto() {
      if (!menuRepeater) {
        menuRepeater = repeat(() => {});
      } else {
        linkRepeater(menuRepeater);
      }
    }

    function workAreaRenderOnto() {
      if (!workAreaRepeater) {
        workAreaRepeater = repeat(() => {
          workAreaReads++;
          lastWorkAreaRead = { usableWidth: menuFrameContext.usableWidth, usableHeight: menuFrameContext.usableHeight };
        });
      } else {
        linkRepeater(workAreaRepeater);
      }
    }

    function menuFrameRenderOnto() {
      if (!menuFrameRepeater) {
        menuFrameRepeater = repeat(() => menuFrameRender());
      } else {
        linkRepeater(menuFrameRepeater);
      }
    }

    function menuFrameRender() {
      const isModal = mainFrameContext.usableWidth < 660;

      postponeInvalidations();
      if (isModal) {
        hamburgerRenderOnto(); // occupies the position that "menu" occupies in the docked branch
        menuFrameContext.usableWidth = mainFrameContext.usableWidth;
        menuFrameContext.usableHeight = mainFrameContext.usableHeight;
        workAreaRenderOnto();
        if (menuOpen) {
          menuRenderOnto();
        }
      } else {
        menuRenderOnto(); // occupies the position "hamburger" occupied while modal
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

    assert.equal(workAreaReads, 1);
    assert.deepEqual(lastWorkAreaRead, { usableWidth: 500, usableHeight: 800 });

    // Opening the menu while still modal - menu becomes a third active
    // child (created here, at a position *after* workArea), so the
    // upcoming docked transition has a real, previously-live repeater
    // (menu) to swap into hamburger's old slot, not a brand-new one.
    menuOpen = true;
    menuFrameRepeater.restart();

    // Cross the breakpoint: hamburger gets retracted, menu (already
    // alive) takes over its old position - this is exactly the
    // structural divergence that breaks positional reconciliation.
    windowSize.width = 1200;
    mainFrameRepeater.restart();

    assert.equal(workAreaReads, 2, "workArea must actually rerun once more, not stay stuck on a stale read");
    assert.deepEqual(
      lastWorkAreaRead,
      { usableWidth: 980, usableHeight: 800 },
      "workArea must see the freshly-written value (1200 - 220), not fall through to nothing"
    );
  });
});
