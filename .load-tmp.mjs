import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const t0 = Date.now();
await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (route.request().resourceType() === "document") console.log(Date.now() - t0, "document", url);
  if (url.endsWith(".js")) await new Promise((r) => setTimeout(r, 1500));
  await route.continue();
});
const cdp = await page.context().newCDPSession(page);
page.goto("http://localhost:5392/").catch(() => {});
for (const at of [250, 700, 1300, 2200, 3200]) {
  await new Promise((r) => setTimeout(r, at - (Date.now() - t0)));
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  (await import("node:fs")).writeFileSync("C:/Users/rober/AppData/Local/Temp/claude/c--programming-liquefy/4738138a-3b7f-41ba-a7e5-f7d641d9de90/scratchpad/load/" + at + ".png", Buffer.from(data, "base64"));
  console.log(Date.now() - t0, "screenshot", at, await page.evaluate(() => location.pathname + " snapshot=" + !!document.querySelector("[data-prerendered]")).catch(() => "?"));
}
await browser.close();
