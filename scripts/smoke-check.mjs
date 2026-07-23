#!/usr/bin/env node

const checks = [];
const guvsBase = normalizeBase(process.env.GUVS_BASE_URL || "https://coldysquares.github.io/guvs/");
const saperliBase = normalizeBase(process.env.SAPERLI_BASE_URL || "https://saperli-popette.vercel.app/");
const expectUnified = /^(1|true|yes)$/i.test(process.env.GUVS_EXPECT_UNIFIED || "");

function normalizeBase(value) {
  return `${String(value).replace(/\/+$/, "")}/`;
}

function target(base, path = "") {
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function checkTitle(name, url, expectedTitle) {
  try {
    const { response, text } = await fetchText(url);
    const present = text.includes(`<title>${expectedTitle}</title>`);
    if (response.ok && present) pass(name, `HTTP ${response.status}`);
    else fail(name, `HTTP ${response.status}; title ${present ? "present" : "missing"}`);
  } catch (error) {
    fail(name, error.message);
  }
}

async function checkApiRoute(name, url) {
  try {
    const { response } = await fetchText(url);
    if ([400, 401, 405].includes(response.status)) pass(name, `HTTP ${response.status}`);
    else fail(name, `Expected API-style status, got HTTP ${response.status}`);
  } catch (error) {
    fail(name, error.message);
  }
}

async function checkRegistry() {
  const name = "GUVs registry contains the active applications";
  try {
    const { response, text } = await fetchText(target(guvsBase, "registry.json"));
    const registry = JSON.parse(text);
    const titles = new Set(registry.map((entry) => entry.title));
    const expected = ["PSR", "AWD", "Zero-Waste Router", "Aster Graf", "Fungi Cell Map", "Saperli Popette"];
    const missing = expected.filter((title) => !titles.has(title));
    const substratePresent = titles.has("Substrate 001") || registry.some((entry) => entry.slug === "substrate-001");
    if (response.ok && missing.length === 0 && !substratePresent && registry.length === expected.length) {
      pass(name, `HTTP ${response.status}; ${registry.length} entries; Substrate excluded`);
    } else {
      fail(name, `HTTP ${response.status}; missing ${missing.join(", ") || "none"}; Substrate ${substratePresent ? "present" : "absent"}; ${registry.length} entries`);
    }
  } catch (error) {
    fail(name, error.message);
  }
}

await checkTitle("GUVs root serves the registry", guvsBase, "GUVs");
await checkRegistry();
await checkTitle("Standalone Saperli root serves Saperli", saperliBase, "Saperli Popette");
await checkApiRoute("Standalone Saperli /api/chat exists", target(saperliBase, "api/chat"));

if (expectUnified) {
  await checkTitle("Unified PSR route serves PSR", target(guvsBase, "psr/"), "PSR — Post-Slop Reagent");
  await checkTitle("Unified AWD route serves AWD", target(guvsBase, "awd/"), "AWD — AI Waste Deleter");
  await checkTitle("Unified Router route serves Router", target(guvsBase, "router/"), "Zero-Waste Router");
  await checkTitle("Unified Aster route serves Aster", target(guvsBase, "aster-graf/"), "Aster Graf — Skywalker Family");
  await checkTitle("Unified Fungi route serves Fungi", target(guvsBase, "fungi-cell-map/"), "Fungi Cell Map");
  await checkTitle("Unified Saperli route serves Saperli", target(guvsBase, "saperli-popette/"), "Saperli Popette");
  await checkApiRoute("Unified /api/chat exists", target(guvsBase, "api/chat"));
  await checkApiRoute("Unified /api/groq exists", target(guvsBase, "api/groq"));
}

console.log(`GUVs target: ${guvsBase}`);
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

if (checks.some((check) => !check.ok)) process.exitCode = 1;
