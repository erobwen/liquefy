// Builds the site for GitHub Pages into ./site: a landing page at its root
// (landing/), the Cascade demo under cascade/, and the Flow demo under flow/.
//
//   npm run build:site                       (served from /liquefy/)
//   SITE_BASE=/ npm run build:site           (served from the domain's root)
//
// GitHub Pages serves static files only: a demo's page opened directly -
// /liquefy/cascade/themes, say - has no file of its own. For every address
// it has no file for, Pages serves 404.html instead, so that is a page that
// loads the right demo's index.html in place, keeping the address - and the
// demo shows the page the address names. Any other address gets the landing
// page.
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const base = (process.env.SITE_BASE || "/liquefy/").replace(/\/?$/, "/");

const demos = [
  { name: "Cascade", dir: "cascade.application/demo", path: "cascade/" },
  { name: "Flow", dir: "flow.application/demo", path: "flow/" },
];

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

for (const demo of demos) {
  const demoBase = base + demo.path;
  console.log(`Building the ${demo.name} demo, for ${demoBase}`);
  // vite itself, not the demo's build script - which may do more than build.
  execSync(`npx vite build --base=${demoBase} --outDir=dist`, { cwd: join(root, demo.dir), stdio: "inherit" });
  cpSync(join(root, demo.dir, "dist"), join(site, demo.path), { recursive: true });
}

// The landing page, and the images it shows - from where they live.
cpSync(join(root, "landing"), site, { recursive: true });
for (const [from, to] of [
  ["cascade/images/what-if-everything.svg", "what-if-everything.svg"],
  ["cascade/images/menu-bar-logo.png", "cascade-logo.png"],
  ["cascade/images/favicon.svg", "favicon.svg"],
  ["cascade/images/favicon.png", "favicon.png"],
  ["flow.application/demo/public/flow.svg", "flow-logo.svg"],
]) cpSync(join(root, from), join(site, to));

// The demo an address belongs to: the one with the longest path it's in.
const byLongestPath = [...demos].sort((a, b) => b.path.length - a.path.length);
writeFileSync(join(site, "404.html"), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Liquefy</title>
    <script>
      // An address with no file of its own: a demo's page, opened directly.
      // Load that demo's index.html in place - keeping the address, which the
      // demo then reads to show the page. Anything else: the landing page.
      (function () {
        var base = ${JSON.stringify(base)};
        var paths = ${JSON.stringify(byLongestPath.map((demo) => demo.path))};
        var here = location.pathname.replace(/\\/?$/, "/");
        var demo = paths.filter(function (path) { return here.indexOf(base + path) === 0; })[0];
        if (demo === undefined) { location.replace(base); return; }
        fetch(base + demo + "index.html")
          .then(function (response) { return response.text(); })
          .then(function (html) { document.open(); document.write(html); document.close(); });
      })();
    </script>
  </head>
  <body></body>
</html>
`);

// No Jekyll processing: serve the files as they are.
writeFileSync(join(site, ".nojekyll"), "");
console.log(`Site built in ${site}`);
