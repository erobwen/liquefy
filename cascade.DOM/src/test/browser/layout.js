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

  // Known gaps: the container's box, drawn at the size it comes from, also
  // lays what's in it out at another *size* than it has at rest - which
  // isn't taken back out, the way where it lies is (see startSizing()). One
  // with nothing of its own to scale by - no text - is then scaled twice.
  it.skip("what stretches to a row's height is first drawn as tall as it was, as something beside it grows", async function () {
    const { before, atStart } = await run("stretchingSibling");
    assert.deepEqual(atStart, before);
  });

  it.skip("what stretches to a column's width is first drawn as wide as it was, as the column widens", async function () {
    const { before, atStart } = await run("shrinkToFitWidens");
    assert.deepEqual(atStart, before);
  });
});
