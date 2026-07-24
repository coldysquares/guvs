import test from "node:test";
import assert from "node:assert/strict";
import {
  getFrontier,
  getNeighbors,
  getVisibleGraph,
  mergeDatasets,
  normalizeDataset,
  restoreDiscovered
} from "../shared/membrane-model.js";

const fixture = {
  id: "fixture",
  rootId: "a",
  initiallyVisible: ["a"],
  nodes: [
    { id: "a", title: "A" },
    { id: "b", title: "B" },
    { id: "c", title: "C" }
  ],
  bonds: [
    { from: "a", to: "b", label: "opens" },
    { from: "b", to: "c", label: "opens" }
  ]
};

test("normalization keeps only valid bonds and starts at the root", () => {
  const normalized = normalizeDataset({
    ...fixture,
    bonds: [...fixture.bonds, { from: "a", to: "missing" }]
  });
  assert.equal(normalized.bonds.length, 2);
  assert.deepEqual(normalized.initiallyVisible, ["a"]);
});

test("frontier exposes only the next undiscovered membrane", () => {
  assert.deepEqual(
    getFrontier(fixture, ["a"]).map((item) => item.target.id),
    ["b"]
  );
  const graph = getVisibleGraph(fixture, ["a", "b"]);
  assert.deepEqual(graph.visibleNodes.map((node) => node.id), ["a", "b"]);
  assert.deepEqual(graph.ghostNodes.map((node) => node.id), ["c"]);
});

test("neighbors preserve relation direction", () => {
  const relations = getNeighbors(fixture, "b");
  assert.deepEqual(
    relations.map((item) => [item.target.id, item.direction]),
    [["a", "incoming"], ["c", "outgoing"]]
  );
});

test("merge updates existing nodes and accumulates new paths", () => {
  const merged = mergeDatasets(fixture, {
    id: "incoming",
    nodes: [
      { id: "b", title: "B expanded", summary: "Loaded" },
      { id: "d", title: "D" }
    ],
    bonds: [{ from: "b", to: "d", label: "expands" }]
  });
  assert.equal(merged.nodes.find((node) => node.id === "b").title, "B expanded");
  assert.ok(merged.nodes.some((node) => node.id === "d"));
  assert.ok(merged.bonds.some((bond) => bond.to === "d"));
});

test("dynamic expansion preserves the session pond metadata", () => {
  const merged = mergeDatasets(
    { ...fixture, title: "Original pond", layout: "radial" },
    {
      id: "fragment",
      nodes: [{ id: "b", title: "B expanded" }]
    }
  );
  assert.equal(merged.title, "Original pond");
  assert.equal(merged.layout, "radial");
  assert.equal(merged.rootId, "a");
});

test("restored discovery cannot resurrect nodes from another dataset", () => {
  assert.deepEqual(restoreDiscovered(fixture, ["b", "unknown"]), ["a", "b"]);
});
