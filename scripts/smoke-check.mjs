#!/usr/bin/env node

const checks = [];

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

async function checkSaperliRoot() {
  const name = "Saperli root serves Saperli title";
  try {
    const { response, text } = await fetchText("https://saperli-popette.vercel.app/");
    if (response.ok && text.includes("<title>Saperli Popette</title>")) {
      pass(name, `HTTP ${response.status}`);
    } else {
      fail(name, `HTTP ${response.status}; title ${text.includes("<title>Saperli Popette</title>") ? "present" : "missing"}`);
    }
  } catch (error) {
    fail(name, error.message);
  }
}

async function checkSaperliApiRoute() {
  const name = "Saperli /api/chat route exists";
  try {
    const { response } = await fetchText("https://saperli-popette.vercel.app/api/chat");
    if (response.status === 405 || response.status === 401 || response.status === 400) {
      pass(name, `HTTP ${response.status}`);
    } else {
      fail(name, `Expected API-ish status, got HTTP ${response.status}`);
    }
  } catch (error) {
    fail(name, error.message);
  }
}

async function checkRegistryIncludesApps() {
  const name = "GUVs registry includes AWD and Saperli";
  try {
    const { response, text } = await fetchText("https://coldysquares.github.io/guvs/registry.json");
    const registry = JSON.parse(text);
    const titles = new Set(registry.map((entry) => entry.title));
    if (response.ok && titles.has("AWD") && titles.has("Saperli Popette")) {
      pass(name, `HTTP ${response.status}`);
    } else {
      fail(name, `HTTP ${response.status}; AWD=${titles.has("AWD")} Saperli=${titles.has("Saperli Popette")}`);
    }
  } catch (error) {
    fail(name, error.message);
  }
}

await checkSaperliRoot();
await checkSaperliApiRoute();
await checkRegistryIncludesApps();

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
}

if (checks.some((check) => !check.ok)) {
  process.exitCode = 1;
}
