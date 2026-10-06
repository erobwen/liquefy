#!/usr/bin/env node
// Prerender a built app from the command line - any folder with an
// index.html, however it was built:
//
//   cascade-prerender dist --base /shop/ --site https://shop.example --route product/12 --route product/13
//
// Options (see src/prerender.js for what each does):
//   --base <path>         where the app is served from (default /)
//   --route <route>       an address to render, below the base (repeatable; default the root)
//   --routes <file>       addresses to render, one per line
//   --no-crawl            only the routes given, not what they link to
//   --exclude <regexp>    addresses not to render (repeatable)
//   --root <id>           the element the app renders into (default application)
//   --site <origin>       where the app will be - also writes sitemap.xml
//   --files html|directory
//   --width <px> --height <px>
//   --timeout <ms> --quiet <ms> --concurrency <n>
//   --keep-debug-ids
import { readFileSync } from "node:fs";
import { prerender } from "../src/prerender.js";

const args = process.argv.slice(2);
const options = { routes: [], exclude: [], viewport: { width: 1280, height: 800 } };
let dist = null;
const value = (index) => {
  if (index >= args.length) fail(`${args[index - 1]} needs a value.`);
  return args[index];
};
function fail(message) {
  console.error(message);
  process.exit(1);
}

for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  switch (arg) {
    case "--base": options.base = value(++index); break;
    case "--route": options.routes.push(value(++index)); break;
    case "--routes": options.routes.push(...readFileSync(value(++index), "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)); break;
    case "--no-crawl": options.crawl = false; break;
    case "--exclude": options.exclude.push(new RegExp(value(++index))); break;
    case "--root": options.root = value(++index); break;
    case "--site": options.site = value(++index); break;
    case "--files": options.files = value(++index); break;
    case "--width": options.viewport.width = Number(value(++index)); break;
    case "--height": options.viewport.height = Number(value(++index)); break;
    case "--timeout": options.timeout = Number(value(++index)); break;
    case "--quiet": options.quiet = Number(value(++index)); break;
    case "--concurrency": options.concurrency = Number(value(++index)); break;
    case "--keep-debug-ids": options.keepDebugIds = true; break;
    default:
      if (arg.startsWith("--") || dist !== null) fail(`Unknown argument: ${arg}`);
      dist = arg;
  }
}
if (dist === null) fail("Usage: cascade-prerender <dist> [--base /path/] [--site https://...] [--route r]... (see the README)");
if (options.routes.length === 0) options.routes = [""];

prerender({ dist, ...options }).catch((error) => fail(error.message));
