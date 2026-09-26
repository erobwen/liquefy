// Publishes every package in the repository whose version isn't on npm yet -
// so a release is: bump the versions that changed, commit, push a tag (see
// .github/workflows/release.yml, which runs this). Packages already
// published at their version are left alone, as are private ones.
//
//   node scripts/publish-new-versions.mjs --dry-run   (what would be published)
//   node scripts/publish-new-versions.mjs             (publish them)
//
// In the root package.json's workspace order - dependencies first.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

// Whether this exact version is on npm - and only a clear "not there" counts
// as not: any other failure (the network, say) stops the release.
function isPublished(name, version) {
  try {
    const out = execSync(`npm view ${name}@${version} version`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return out.trim() === version;
  } catch (error) {
    const message = String(error.stderr || error.message);
    if (message.includes("E404")) return false;
    throw new Error(`Couldn't check ${name}@${version} on npm:\n${message}`);
  }
}

const toPublish = [];
for (const dir of readJson(join(root, "package.json")).workspaces) {
  const pkg = readJson(join(root, dir, "package.json"));
  if (pkg.private) continue;
  const published = isPublished(pkg.name, pkg.version);
  console.log(`${published ? "  on npm   " : "  NEW      "} ${pkg.name}@${pkg.version}`);
  if (!published) toPublish.push({ dir, name: pkg.name, version: pkg.version });
}

if (toPublish.length === 0) {
  console.log("Nothing to publish: every package's version is on npm already.");
} else if (dryRun) {
  console.log(`Would publish ${toPublish.length}: ${toPublish.map((pkg) => pkg.name + "@" + pkg.version).join(", ")}`);
} else {
  for (const pkg of toPublish) {
    console.log(`Publishing ${pkg.name}@${pkg.version}`);
    execSync(`npm publish -w ${pkg.name}`, { cwd: root, stdio: "inherit" });
  }
  console.log(`Published ${toPublish.length}.`);
}
