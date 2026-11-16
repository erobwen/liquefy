import assert from "assert";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

// What only a real layout shows: FlipAnimationContainer and ScrollArea in
// Chromium - a container whose own corner moves as its box changes size,
// what's absolutely positioned in one that isn't positioned, a scroll
// area's real gaps and scroll height. The fake layout the other tests run
// on (see ../flipAnimationMoves.js) knows none of that.
//
// Not part of `npm test`: run with `npm run test:browser`. It needs vite
// and playwright (with its Chromium installed), which this package doesn't
// depend on - the repository's other workspaces bring them. Without them,
// it's skipped.
describe("In a real layout (Chromium)", function () {
  this.timeout(60000);
  let server;
  let browser;
  let page;

  before(async function () {
    let vite;
    let playwright;
    try {
      vite = await import("vite");
      playwright = await import("playwright");
    } catch (error) {
      this.skip();
    }
    const here = path.dirname(fileURLToPath(import.meta.url));
    server = await vite.createServer({
      root: path.join(here, "page"),
      configFile: false,
      logLevel: "error",
      cacheDir: path.join(os.tmpdir(), "cascade-dom-browser-test"),
      optimizeDeps: { noDiscovery: true },
      server: { port: 0, fs: { strict: false } },
    });
    await server.listen();
    try {
      browser = await playwright.chromium.launch();
    } catch (error) {
      // No Chromium installed.
      await server.close();
      server = null;
      this.skip();
    }
  });

  after(async function () {
    if (browser) await browser.close();
    if (server) await server.close();
  });

  beforeEach(async function () {
    page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    await page.goto("http://localhost:" + server.httpServer.address().port + "/");
    await page.waitForFunction(() => window.ready, null, { timeout: 20000 });
    assert.deepEqual(errors, []);
  });

  afterEach(async function () {
    await page.close();
  });

  const run = (scenario, ...parameters) => page.evaluate(([name, given]) => window.scenarios[name](...given), [scenario, parameters]);

  for (const position of ["static", "relative"]) {
    it("in a centered container (" + position + "), what stays as something leaves is first drawn where it was", async function () {
      const { before, atStart } = await run("centeredItemLeaves", position);
      assert.deepEqual(atStart, before);
    });

    it("in a centered container (" + position + "), what travels - raised - is first drawn where it was, as is what it leaves behind", async function () {
      const { before, atStart, raised } = await run("centeredTraveller", position);
      assert.ok(raised, "raised");
      assert.deepEqual(atStart, before);
    });
  }

  it("a ghost in a container that isn't positioned stays in the scroll area it's in: clipped by it, and scrolled with it", async function () {
    const { before, atStart, drawnAboveArea, movedWithScroll } = await run("ghostInScrollArea");
    assert.deepEqual(atStart, before, "where it was drawn");
    assert.equal(drawnAboveArea, false, "clipped");
    assert.equal(movedWithScroll, 40, "scrolled");
  });

  for (const inFlipAnimationContainer of [false, true]) {
    it("a scroll area's indicator is as long as the view is of all there is, gaps included - and follows children added" + (inFlipAnimationContainer ? ", in a FlipAnimationContainer" : ""), async function () {
      const { before, added, atBottom } = await run("scrollAreaChildrenAdded", inFlipAnimationContainer);
      const expected = ({ clientHeight, scrollHeight }) => (clientHeight - 6) * clientHeight / scrollHeight;
      for (const [name, read] of Object.entries({ before, added, atBottom })) {
        assert.ok(read.shown, name);
        assert.ok(Math.abs(read.thumbHeight - expected(read)) < 1, name + ": " + read.thumbHeight + " ~ " + expected(read));
      }
      assert.ok(added.scrollHeight > before.scrollHeight);
      assert.equal(atBottom.fromBottom, 3, "at the end of its track");
    });
  }

  // The container's box, drawn at the size it comes from, lays what's in
  // it out at another size than it has at rest, too - not only elsewhere.
  it("what stretches to a row's height is first drawn as tall as it was, as something beside it grows - and so is what's in it, where it was", async function () {
    const { before, atStart } = await run("stretchingSibling");
    assert.deepEqual(atStart, before);
  });

  it("on its way, it only grows - from as tall as it was to as tall as it is - with what's at its bottom at its bottom all the way", async function () {
    const { before, onTheWay } = await run("stretchingSibling", 1);
    let last = before;
    for (const now of onTheWay) {
      for (const key of ["stretcher", "full"]) {
        assert.ok(now[key].height >= last[key].height - 0.2, key + " shrinking: " + last[key].height + " -> " + now[key].height);
        assert.ok(now[key].height <= 200.2, key + " too tall: " + now[key].height);
      }
      const bottomOf = (rect) => rect.y + rect.height;
      assert.ok(Math.abs(bottomOf(now.bottom) - bottomOf(now.stretcher)) < 0.5, "not at its bottom: " + bottomOf(now.bottom) + " ~ " + bottomOf(now.stretcher));
      assert.ok(Math.abs(now.bottom.height - 20) < 0.5, "squashed: " + now.bottom.height);
      last = now;
    }
    assert.ok(onTheWay.some((now) => now.stretcher.height > 110 && now.stretcher.height < 190), "gradually");
    assert.equal(last.stretcher.height, 200);
    assert.equal(last.full.height, 200);
  });

  it("what stretches to a column's width is first drawn as wide as it was, as the column widens", async function () {
    const { before, atStart } = await run("shrinkToFitWidens");
    assert.deepEqual(atStart, before);
  });

  it("in a wrapping row that's first drawn two rows tall, what ends up side by side is first drawn where, and as tall as, it was", async function () {
    const { before, atStart } = await run("wrappingRowItemLeaves");
    assert.deepEqual(atStart, before);
  });

  it("what travels - raised - to beyond the edge of a list that scrolls is clipped by it, as it would be in its place: never seen beyond it once there", async function () {
    const { upperBottom, frames } = await run("travellerIntoScrolledOut");
    const raised = frames.filter((each) => each.raised);
    assert.ok(raised.length > 0, "raised");
    // Where it lands, it's beyond the upper list's edge: none of it to see.
    const last = raised[raised.length - 1];
    assert.ok(last.restTop > upperBottom, "lands beyond the edge: " + last.restTop + " > " + upperBottom);
    assert.ok(last.bottom - last.top < 1 || last.bottom <= upperBottom + 1, "seen beyond the edge: " + last.top + "-" + last.bottom + " vs " + upperBottom);
    // And what's seen of it only ever shrinks, as it goes there.
    for (let i = 1; i < raised.length; i++) {
      const was = raised[i - 1].bottom - raised[i - 1].top;
      const now = raised[i].bottom - raised[i].top;
      assert.ok(now <= was + 1, "grew: " + was + " -> " + now);
    }
  });
});
