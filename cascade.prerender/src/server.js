import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

/**
 * The built app, served the way its host will serve it - below its base,
 * with every address that has no file of its own answered with the app's
 * index.html (as a single page app's host does - and as GitHub Pages'
 * 404.html does for the Cascade demo). Always the template it was given,
 * never a page written meanwhile: every address is rendered from the app
 * as built.
 */
export async function serve({ dist: distOption, base, template }) {
  const dist = resolve(distOption);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!(pathname + "/").startsWith(base)) return send(response, 404, "text/plain", "Not below the base.");
      const relative = pathname.slice(base.length);
      const file = normalize(join(dist, relative));
      if (file !== dist && !file.startsWith(dist.endsWith(sep) ? dist : dist + sep)) return send(response, 403, "text/plain", "Outside the app.");
      const info = relative === "" ? null : await stat(file).catch(() => null);
      if (info && info.isFile() && relative !== "index.html") {
        return send(response, 200, types[extname(file).toLowerCase()] || "application/octet-stream", await readFile(file));
      }
      // An asset that isn't there is missing - only addresses get the app.
      if (extname(relative) !== "" && extname(relative) !== ".html") return send(response, 404, "text/plain", "Not found.");
      send(response, 200, types[".html"], template);
    } catch (error) {
      send(response, 500, "text/plain", String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function send(response, status, type, body) {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(body);
}
