const DEFAULT_TONE = "violet";

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSource(source, index, nodeId) {
  if (typeof source === "string") {
    return {
      id: `${nodeId}-source-${index + 1}`,
      label: cleanText(source, "Untitled source"),
      kind: "source",
      status: "context",
      note: "",
      url: ""
    };
  }

  return {
    id: cleanText(source?.id, `${nodeId}-source-${index + 1}`),
    label: cleanText(source?.label, "Untitled source"),
    kind: cleanText(source?.kind, "source"),
    status: cleanText(source?.status, "context"),
    note: cleanText(source?.note),
    url: cleanText(source?.url)
  };
}

function normalizeFact(fact, index) {
  if (typeof fact === "string") {
    return {
      id: `fact-${index + 1}`,
      label: "Observation",
      value: cleanText(fact),
      status: "context"
    };
  }

  return {
    id: cleanText(fact?.id, `fact-${index + 1}`),
    label: cleanText(fact?.label, "Observation"),
    value: cleanText(fact?.value, "No value recorded."),
    status: cleanText(fact?.status, "context")
  };
}

function normalizeNode(node, index) {
  const id = cleanText(node?.id, `node-${index + 1}`);
  return {
    ...node,
    id,
    title: cleanText(node?.title, `Membrane ${index + 1}`),
    subtitle: cleanText(node?.subtitle),
    summary: cleanText(node?.summary, "No summary recorded yet."),
    tone: cleanText(node?.tone, DEFAULT_TONE),
    confidence: cleanText(node?.confidence, "context"),
    facts: Array.isArray(node?.facts)
      ? node.facts.map((fact, factIndex) => normalizeFact(fact, factIndex))
      : [],
    sources: Array.isArray(node?.sources)
      ? node.sources.map((source, sourceIndex) => normalizeSource(source, sourceIndex, id))
      : [],
    tags: Array.isArray(node?.tags) ? unique(node.tags.map((tag) => cleanText(tag))) : [],
    position:
      Number.isFinite(node?.position?.x) && Number.isFinite(node?.position?.y)
        ? { x: Number(node.position.x), y: Number(node.position.y) }
        : null
  };
}

function bondKey(bond) {
  return cleanText(
    bond?.id,
    [cleanText(bond?.from), cleanText(bond?.to), cleanText(bond?.label, "bond")].join("::")
  );
}

function normalizeBond(bond, index) {
  return {
    ...bond,
    id: bondKey(bond) || `bond-${index + 1}`,
    from: cleanText(bond?.from),
    to: cleanText(bond?.to),
    label: cleanText(bond?.label, "connected to"),
    type: cleanText(bond?.type, "context"),
    note: cleanText(bond?.note),
    evidence: cleanText(bond?.evidence),
    sourceIds: Array.isArray(bond?.sourceIds)
      ? unique(bond.sourceIds.map((sourceId) => cleanText(sourceId)))
      : []
  };
}

export function normalizeDataset(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes.map(normalizeNode) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const bonds = (Array.isArray(input.bonds) ? input.bonds : [])
    .map(normalizeBond)
    .filter((bond) => bond.from && bond.to && nodeIds.has(bond.from) && nodeIds.has(bond.to));
  const requestedRoot = cleanText(input.rootId);
  const rootId = nodeIds.has(requestedRoot) ? requestedRoot : nodes[0]?.id || "";
  const initiallyVisible = unique([
    rootId,
    ...(Array.isArray(input.initiallyVisible) ? input.initiallyVisible : [])
  ]).filter((id) => nodeIds.has(id));

  return {
    ...input,
    id: cleanText(input.id, "membrane-dataset"),
    title: cleanText(input.title, "Membrane field"),
    kicker: cleanText(input.kicker, "P.O.N.D. / membrane explorer"),
    description: cleanText(input.description),
    sourceLabel: cleanText(input.sourceLabel, "Curated local substrate"),
    rootId,
    initiallyVisible,
    nodes,
    bonds
  };
}

export function mergeDatasets(currentInput, incomingInput) {
  const current = normalizeDataset(currentInput);
  const incoming = normalizeDataset({
    ...incomingInput,
    id: incomingInput?.id || current.id
  });
  const nodeMap = new Map(current.nodes.map((node) => [node.id, node]));
  const bondMap = new Map(current.bonds.map((bond) => [bond.id, bond]));

  for (const node of incoming.nodes) {
    const previous = nodeMap.get(node.id);
    nodeMap.set(node.id, previous ? { ...previous, ...node } : node);
  }
  for (const bond of incoming.bonds) {
    const previous = bondMap.get(bond.id);
    bondMap.set(bond.id, previous ? { ...previous, ...bond } : bond);
  }

  const metadata = {};
  for (const key of ["title", "kicker", "description", "sourceLabel"]) {
    if (incomingInput?.[key] != null && String(incomingInput[key]).trim()) {
      metadata[key] = incomingInput[key];
    }
  }

  return normalizeDataset({
    ...current,
    ...metadata,
    id: current.id,
    rootId: current.rootId || incoming.rootId,
    initiallyVisible: unique([
      ...current.initiallyVisible,
      ...incoming.initiallyVisible
    ]),
    nodes: [...nodeMap.values()],
    bonds: [...bondMap.values()]
  });
}

export function getNode(datasetInput, nodeId) {
  const dataset = normalizeDataset(datasetInput);
  return dataset.nodes.find((node) => node.id === nodeId) || null;
}

export function getNeighbors(datasetInput, nodeId) {
  const dataset = normalizeDataset(datasetInput);
  const nodeMap = new Map(dataset.nodes.map((node) => [node.id, node]));

  return dataset.bonds
    .filter((bond) => bond.from === nodeId || bond.to === nodeId)
    .map((bond) => {
      const outgoing = bond.from === nodeId;
      const targetId = outgoing ? bond.to : bond.from;
      return {
        bond,
        direction: outgoing ? "outgoing" : "incoming",
        target: nodeMap.get(targetId) || null
      };
    })
    .filter((relation) => relation.target);
}

export function getFrontier(datasetInput, discoveredIds, limit = 10) {
  const dataset = normalizeDataset(datasetInput);
  const discovered = new Set(discoveredIds || []);
  const frontier = [];
  const seen = new Set();

  for (const id of discovered) {
    for (const relation of getNeighbors(dataset, id)) {
      if (discovered.has(relation.target.id) || seen.has(relation.target.id)) continue;
      seen.add(relation.target.id);
      frontier.push({
        ...relation,
        fromId: id
      });
      if (frontier.length >= limit) return frontier;
    }
  }

  return frontier;
}

export function getVisibleGraph(datasetInput, discoveredIds, frontierLimit = 10) {
  const dataset = normalizeDataset(datasetInput);
  const discovered = new Set(discoveredIds || []);
  const visibleNodes = dataset.nodes.filter((node) => discovered.has(node.id));
  const frontier = getFrontier(dataset, discovered, frontierLimit);
  const frontierIds = new Set(frontier.map((item) => item.target.id));
  const ghostNodes = dataset.nodes.filter((node) => frontierIds.has(node.id));
  const renderedIds = new Set([...discovered, ...frontierIds]);
  const bonds = dataset.bonds.filter(
    (bond) =>
      renderedIds.has(bond.from) &&
      renderedIds.has(bond.to) &&
      (discovered.has(bond.from) || discovered.has(bond.to))
  );

  return { visibleNodes, ghostNodes, bonds, frontier };
}

function discoveredPath(dataset, discovered, startId, endId) {
  if (!startId || !endId || !discovered.has(startId) || !discovered.has(endId)) return [];
  if (startId === endId) return [startId];

  const queue = [startId];
  const previous = new Map([[startId, null]]);

  while (queue.length) {
    const current = queue.shift();
    for (const relation of getNeighbors(dataset, current)) {
      const targetId = relation.target.id;
      if (!discovered.has(targetId) || previous.has(targetId)) continue;
      previous.set(targetId, current);
      if (targetId === endId) {
        const path = [endId];
        let cursor = current;
        while (cursor) {
          path.unshift(cursor);
          cursor = previous.get(cursor);
        }
        return path;
      }
      queue.push(targetId);
    }
  }

  return [];
}

export function getFocusedGraph(
  datasetInput,
  discoveredIds,
  focusId,
  trailIds = [],
  frontierLimit = 3
) {
  const dataset = normalizeDataset(datasetInput);
  const discovered = new Set(discoveredIds || []);
  const focus = discovered.has(focusId) ? focusId : dataset.rootId;
  const suppliedTrail = unique(trailIds).filter((id) => discovered.has(id));
  const path =
    suppliedTrail.includes(focus) && suppliedTrail.includes(dataset.rootId)
      ? suppliedTrail
      : discoveredPath(dataset, discovered, dataset.rootId, focus);
  const visibleIds = new Set([dataset.rootId, focus, ...path].filter(Boolean));
  const frontier = [];
  const seenFrontier = new Set();

  for (const relation of getNeighbors(dataset, focus)) {
    if (discovered.has(relation.target.id)) {
      visibleIds.add(relation.target.id);
      continue;
    }
    if (seenFrontier.has(relation.target.id) || frontier.length >= frontierLimit) continue;
    seenFrontier.add(relation.target.id);
    frontier.push({ ...relation, fromId: focus });
  }

  const frontierIds = new Set(frontier.map((item) => item.target.id));
  const renderedIds = new Set([...visibleIds, ...frontierIds]);
  const visibleNodes = dataset.nodes.filter((node) => visibleIds.has(node.id));
  const ghostNodes = dataset.nodes.filter((node) => frontierIds.has(node.id));
  const bonds = dataset.bonds.filter(
    (bond) =>
      renderedIds.has(bond.from) &&
      renderedIds.has(bond.to) &&
      (visibleIds.has(bond.from) || visibleIds.has(bond.to))
  );

  return { visibleNodes, ghostNodes, bonds, frontier };
}

export function restoreDiscovered(datasetInput, storedIds = []) {
  const dataset = normalizeDataset(datasetInput);
  const validIds = new Set(dataset.nodes.map((node) => node.id));
  return unique([
    ...dataset.initiallyVisible,
    ...(Array.isArray(storedIds) ? storedIds : [])
  ]).filter((id) => validIds.has(id));
}
