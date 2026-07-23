#!/usr/bin/env node

import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(repoRoot, "dist");
const registryPath = join(repoRoot, "registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const copiedPaths = [];
const standaloneOnlyPaths = new Set(["substrate-001"]);

function safeRegistryPath(value) {
  const normalized = String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
  const absolute = resolve(repoRoot, normalized);
  const withinRepo = absolute === repoRoot || absolute.startsWith(`${repoRoot}${sep}`);

  if (!normalized || !withinRepo || relative(repoRoot, absolute).startsWith("..")) {
    throw new Error(`Unsafe registry path: ${value}`);
  }

  const topLevelPath = normalized.split("/")[0];
  if (standaloneOnlyPaths.has(topLevelPath)) {
    throw new Error(`Standalone publication path cannot enter the GUV build: ${topLevelPath}`);
  }

  return { normalized, absolute };
}

function shouldSkip(name, depth) {
  if (name.startsWith(".")) return true;
  if (depth === 0 && name === "api") return true;
  if (name === "vercel.json") return true;
  if (/\.backup\./i.test(name)) return true;
  return false;
}

async function copyTree(source, destination, depth = 0) {
  const sourceStat = await stat(source);

  if (sourceStat.isFile()) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return;
  }

  if (!sourceStat.isDirectory()) {
    throw new Error(`Unsupported registry source: ${source}`);
  }

  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkip(entry.name, depth)) continue;
    await copyTree(
      join(source, entry.name),
      join(destination, entry.name),
      depth + 1
    );
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await copyFile(join(repoRoot, "index.html"), join(outputRoot, "index.html"));
await copyFile(registryPath, join(outputRoot, "registry.json"));

for (const item of registry) {
  const { normalized, absolute } = safeRegistryPath(item.path);
  const page = join(absolute, "index.html");

  try {
    const pageStat = await stat(page);
    if (!pageStat.isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`Registry entry ${item.slug || item.title} has no index.html`);
  }

  await copyTree(absolute, join(outputRoot, normalized));
  copiedPaths.push(normalized.replace(/\/+$/, ""));
}

console.log(`Built GUVs static output with ${copiedPaths.length} registered apps:`);
for (const path of copiedPaths) console.log(`- ${path}`);
