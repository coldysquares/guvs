import { createMembraneRuntime } from "../shared/membrane-runtime.js";
import { familyDataset } from "./data-family.js";
import { pitchDataset } from "./data-pitch.js";

const datasets = {
  family: familyDataset,
  pitch: pitchDataset
};

const params = new URLSearchParams(window.location.search);
const initialLens = datasets[params.get("lens")] ? params.get("lens") : "family";
let currentLens = initialLens;

const runtime = createMembraneRuntime(document.querySelector("#membraneApp"), {
  dataset: datasets[currentLens],
  awdEnabled: true,
  awdEndpoint: "/api/groq",
  persist: true
});

function selectLens(lens, announce = false) {
  if (!datasets[lens]) return;
  currentLens = lens;
  for (const button of document.querySelectorAll("[data-dataset]")) {
    button.setAttribute("aria-pressed", String(button.dataset.dataset === lens));
  }
  runtime.setDataset(datasets[lens], { preserveDiscovery: true });
  const url = new URL(window.location.href);
  if (lens === "family") url.searchParams.delete("lens");
  else url.searchParams.set("lens", lens);
  window.history.replaceState({ lens }, "", url);
  if (announce) {
    runtime.announce(
      lens === "family"
        ? "Family lens loaded. Enter Shmi’s membrane to begin."
        : "Pitch lens loaded. Enter the STaeT thesis to begin."
    );
  }
}

for (const button of document.querySelectorAll("[data-dataset]")) {
  button.addEventListener("click", () => selectLens(button.dataset.dataset, true));
}

window.addEventListener("popstate", () => {
  const lens = new URLSearchParams(window.location.search).get("lens");
  selectLens(datasets[lens] ? lens : "family");
});

selectLens(initialLens);
