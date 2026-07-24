#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(repoRoot, "dist");
const registry = JSON.parse(await readFile(join(distRoot, "registry.json"), "utf8"));
const failures = [];

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

requireCondition(registry.length === 7, `Expected 7 registered GUVs, found ${registry.length}.`);
requireCondition(
  !registry.some((entry) => entry.slug === "substrate-001"),
  "Substrate 001 entered the GUV registry."
);

for (const entry of registry) {
  const indexPath = join(distRoot, entry.path, "index.html");
  requireCondition(
    await exists(indexPath),
    `Registered app ${entry.slug || entry.title} has no built index.html.`
  );
}

for (const sharedPath of [
  "shared/membrane-model.js",
  "shared/membrane-runtime.js",
  "shared/membrane-runtime.css"
]) {
  requireCondition(await exists(join(distRoot, sharedPath)), `Missing shared runtime asset: ${sharedPath}`);
}

const asterHtml = await readFile(join(distRoot, "aster-graf", "index.html"), "utf8");
const wikiHtml = await readFile(join(distRoot, "wiki-constellation", "index.html"), "utf8");
requireCondition(
  asterHtml.includes("../shared/membrane-runtime.css") &&
    asterHtml.includes('type="module" src="./app.js"'),
  "Aster does not load the shared membrane runtime."
);
requireCondition(
  wikiHtml.includes("../shared/membrane-runtime.css") &&
    wikiHtml.includes('type="module" src="./app.js"'),
  "Wiki Graf does not load the shared membrane runtime."
);

const builtFiles = await walk(distRoot);
for (const path of builtFiles) {
  const builtPath = relative(distRoot, path).replaceAll("\\", "/");
  const forbidden =
    builtPath.startsWith("substrate-001/") ||
    builtPath.includes("/api/") ||
    builtPath.includes("/.vercel/") ||
    /(^|\/)vercel\.json$/i.test(builtPath) ||
    /\.backup\./i.test(builtPath);
  requireCondition(!forbidden, `Forbidden path entered dist/: ${builtPath}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS GUVs artifact: ${registry.length} registered apps, shared membrane runtime present, Substrate and app-local server metadata excluded.`
  );
}
