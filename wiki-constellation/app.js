const els = {
  canvas: document.querySelector("#graph"),
  stage: document.querySelector("#stage"),
  form: document.querySelector("#searchForm"),
  query: document.querySelector("#wikiQuery"),
  searchButton: document.querySelector("#searchButton"),
  starters: [...document.querySelectorAll(".starter")],
  graphStatus: document.querySelector("#graphStatus"),
  loading: document.querySelector("#loadingState"),
  error: document.querySelector("#errorState"),
  errorMessage: document.querySelector("#errorMessage"),
  retry: document.querySelector("#retryButton"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomIn: document.querySelector("#zoomIn"),
  freeze: document.querySelector("#freeze"),
  fit: document.querySelector("#fit"),
  originTitle: document.querySelector("#originTitle"),
  originExtract: document.querySelector("#originExtract"),
  originLink: document.querySelector("#originLink"),
  selectionKind: document.querySelector("#selectionKind"),
  selectionTitle: document.querySelector("#selectionTitle"),
  selectionNote: document.querySelector("#selectionNote"),
  selectionLink: document.querySelector("#selectionLink"),
  enterSelection: document.querySelector("#enterSelection"),
  backSelection: document.querySelector("#backSelection"),
  linkCount: document.querySelector("#linkCount"),
  linkFilter: document.querySelector("#linkFilter"),
  linkList: document.querySelector("#linkList"),
  backLayer: document.querySelector("#backLayer"),
  focusMembrane: document.querySelector("#focusMembrane"),
  focusKind: document.querySelector("#focusKind"),
  focusTitle: document.querySelector("#focusTitle"),
  focusNote: document.querySelector("#focusNote"),
  focusLink: document.querySelector("#focusLink"),
  enterFocus: document.querySelector("#enterFocus"),
  closeFocus: document.querySelector("#closeFocus")
};

const ctx = els.canvas.getContext("2d");
const palette = ["#78e9df", "#80baff", "#f4cf79", "#ff9bb7", "#c4adff", "#8d79ff"];

let graph = { origin: null, nodes: [], links: [], source: null };
let selected = null;
let hovered = null;
let dragNode = null;
let panning = false;
let moved = false;
let pointerStart = null;
let lastPointer = { x: 0, y: 0 };
let physicsFrozen = false;
let currentQuery = "";
let activeRequest = null;
let W = 0;
let H = 0;
let DPR = 1;
let firstFitDone = false;
let view = { x: 0, y: 0, k: 1 };
let targetView = { x: 0, y: 0, k: 1 };
let backgroundStars = [];
let focusVisible = false;
let settleTimer = null;
const traversalHistory = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setPhysicsFrozen(frozen) {
  physicsFrozen = frozen;
  els.freeze.setAttribute("aria-pressed", String(frozen));
  els.freeze.textContent = frozen ? "Unfreeze" : "Freeze";
}

function scheduleSettle(delay = 950) {
  if (settleTimer) window.clearTimeout(settleTimer);
  setPhysicsFrozen(false);
  settleTimer = window.setTimeout(() => {
    setPhysicsFrozen(true);
    if (!focusVisible) fitToGraph(false);
    settleTimer = null;
  }, delay);
}

function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

function initials(title) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function shortLabel(title, max = 26) {
  const value = String(title);
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function showLoading(isLoading) {
  els.loading.hidden = !isLoading;
  els.searchButton.disabled = isLoading;
  els.searchButton.textContent = isLoading ? "Mapping…" : "Map it";
  const cannotEnter = isLoading || !selected || selected.kind === "origin";
  els.enterSelection.disabled = cannotEnter;
  els.enterFocus.disabled = cannotEnter;
}

function showError(message) {
  els.errorMessage.textContent = message || "Try another article title.";
  els.error.hidden = false;
}

function clearError() {
  els.error.hidden = true;
}

function createGraph(source) {
  const origin = {
    id: source.title,
    name: source.title,
    kind: "origin",
    note: source.extract || "Origin article for this constellation.",
    url: source.articleUrl || articleUrl(source.title),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 34,
    color: "#f4cf79",
    ring: 0
  };

  const linkedNodes = source.links.map((link, index) => {
    const firstRingCount = Math.min(12, source.links.length);
    const ring = index < firstRingCount ? 1 : 2;
    const ringIndex = ring === 1 ? index : index - firstRingCount;
    const ringCount = ring === 1 ? firstRingCount : Math.max(1, source.links.length - firstRingCount);
    const angleOffset = ring === 1 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / ringCount;
    const angle = angleOffset + (ringIndex / ringCount) * Math.PI * 2;
    const radius = ring === 1 ? 180 : 320;

    return {
      id: link.title,
      name: link.title,
      kind: "linked",
      note: `Linked from ${source.title}.`,
      url: link.url || articleUrl(link.title),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      r: ring === 1 ? 22 : 19,
      color: palette[index % palette.length],
      ring
    };
  });

  return {
    origin,
    nodes: [origin, ...linkedNodes],
    links: linkedNodes.map((node) => ({ source: origin, target: node })),
    source
  };
}

function setGraph(source) {
  graph = createGraph(source);
  selected = graph.origin;
  focusVisible = false;
  hovered = null;
  firstFitDone = false;
  resizeCanvas();
  fitToGraph(true);
  renderOrigin();
  renderSelection();
  renderLinkList();
  renderTraversalState();
  els.linkFilter.value = "";
  els.graphStatus.textContent = `${source.title} · ${source.links.length} linked pages`;
  els.canvas.setAttribute(
    "aria-label",
    `Interactive constellation for ${source.title} with ${source.links.length} linked Wikipedia pages`
  );
  scheduleSettle();
}

function renderOrigin() {
  if (!graph.source) return;
  els.originTitle.textContent = graph.source.title;
  els.originExtract.textContent =
    graph.source.extract || "Wikipedia did not return a short introduction for this page.";
  els.originLink.href = graph.source.articleUrl || articleUrl(graph.source.title);
}

function renderSelection() {
  const isOrigin = Boolean(selected && selected.kind === "origin");
  const kind = selected ? (isOrigin ? "Origin article" : "Linked article") : "Selected star";
  const title = selected ? selected.name : "Choose a star";
  const note = selected
    ? isOrigin
      ? selected.note
      : `This page appears in ${graph.origin.name}’s outgoing Wikipedia links.`
    : "Tap any star, or use the linked-article index below.";

  if (!selected) {
    els.selectionKind.textContent = kind;
    els.selectionTitle.textContent = title;
    els.selectionNote.textContent = note;
    els.selectionLink.hidden = true;
  } else {
    els.selectionKind.textContent = kind;
    els.selectionTitle.textContent = title;
    els.selectionNote.textContent = note;
    els.selectionLink.href = selected.url;
    els.selectionLink.hidden = false;
  }

  els.focusKind.textContent = kind;
  els.focusTitle.textContent = title;
  els.focusNote.textContent = note;
  els.focusLink.href = selected?.url || "#";
  els.focusLink.hidden = !selected;
  els.enterSelection.disabled = !selected || isOrigin;
  els.enterFocus.disabled = !selected || isOrigin;
  els.enterSelection.textContent = isOrigin ? "Current origin" : "Enter this article";
  els.enterFocus.textContent = isOrigin ? "Current origin" : "Enter article";
  els.focusMembrane.classList.toggle("show", Boolean(selected && focusVisible));
  els.focusMembrane.setAttribute("aria-hidden", String(!(selected && focusVisible)));

  els.linkList.querySelectorAll(".link-item").forEach((button) => {
    button.classList.toggle("selected", Boolean(selected && button.dataset.nodeId === selected.id));
  });
}

function renderLinkList() {
  const filter = els.linkFilter.value.trim().toLowerCase();
  const linked = graph.nodes.filter((node) => node.kind === "linked");
  const visible = linked.filter((node) => node.name.toLowerCase().includes(filter));
  els.linkCount.textContent = `${linked.length} ${linked.length === 1 ? "page" : "pages"}`;
  els.linkList.replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-index";
    empty.textContent = linked.length ? "No linked titles match that filter." : "No outgoing article links were returned.";
    els.linkList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((node) => {
    const button = document.createElement("button");
    const label = document.createElement("span");
    button.type = "button";
    button.className = "link-item";
    button.dataset.nodeId = node.id;
    button.setAttribute("aria-label", `Inspect ${node.name}`);
    button.classList.toggle("selected", Boolean(selected && selected.id === node.id));
    label.textContent = node.name;
    button.append(label);
    button.addEventListener("click", () => selectNode(node, true));
    fragment.append(button);
  });
  els.linkList.append(fragment);
}

function selectNode(node, shouldFly = true) {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = null;
  setPhysicsFrozen(true);
  selected = node;
  focusVisible = Boolean(node);
  renderSelection();
  if (node && shouldFly) flyToNode(node, window.matchMedia("(max-width: 760px)").matches);
}

function captureGraphSnapshot() {
  return {
    source: graph.source,
    selectedId: selected?.id || graph.origin?.id || null,
    focusVisible,
    view: { ...view },
    targetView: { ...targetView },
    positions: graph.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      vx: node.vx,
      vy: node.vy
    }))
  };
}

function restoreGraphSnapshot(snapshot) {
  if (!snapshot?.source) return;
  setGraph(snapshot.source);
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = null;
  setPhysicsFrozen(true);
  const positions = new Map(snapshot.positions.map((node) => [node.id, node]));
  graph.nodes.forEach((node) => {
    const prior = positions.get(node.id);
    if (!prior) return;
    node.x = prior.x;
    node.y = prior.y;
    node.vx = prior.vx;
    node.vy = prior.vy;
  });
  selected = graph.nodes.find((node) => node.id === snapshot.selectedId) || graph.origin;
  focusVisible = snapshot.focusVisible;
  view = { ...snapshot.view };
  targetView = { ...snapshot.targetView };
  renderOrigin();
  renderSelection();
  renderLinkList();
  renderTraversalState();
  currentQuery = graph.source.title;
  els.graphStatus.textContent = `${graph.source.title} · ${graph.source.links.length} linked pages`;
  const url = new URL(window.location.href);
  url.searchParams.set("q", graph.source.title);
  window.history.replaceState({}, "", url);
}

function renderTraversalState() {
  const canGoBack = traversalHistory.length > 0;
  els.backLayer.hidden = !canGoBack;
  els.backSelection.hidden = !canGoBack;
}

function enterSelectedArticle() {
  if (!selected || selected.kind === "origin") return;
  const destination = selected.name;
  traversalHistory.push(captureGraphSnapshot());
  renderTraversalState();
  loadQuery(destination, { updateHistory: true, preserveTraversal: true });
}

function backOneLayer() {
  const snapshot = traversalHistory.pop();
  if (!snapshot) return;
  restoreGraphSnapshot(snapshot);
}

function resetTraversal() {
  traversalHistory.length = 0;
  renderTraversalState();
}

function makeBackgroundStars() {
  backgroundStars = [];
  const count = Math.max(70, Math.floor((W * H) / 12500));
  for (let i = 0; i < count; i += 1) {
    backgroundStars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.35 + 0.2,
      a: Math.random() * 0.5 + 0.12
    });
  }
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const previousWidth = W;
  const previousHeight = H;
  W = rect.width;
  H = rect.height;
  DPR = clamp(window.devicePixelRatio || 1, 1, 2);
  els.canvas.width = Math.round(W * DPR);
  els.canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  makeBackgroundStars();

  const significantResize =
    Math.abs(W - previousWidth) > 40 || Math.abs(H - previousHeight) > 40;
  if (graph.nodes.length && (!firstFitDone || significantResize)) {
    fitToGraph(true);
    firstFitDone = true;
  }
}

function graphBounds() {
  if (!graph.nodes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  graph.nodes.forEach((node) => {
    const labelRoom = node.kind === "origin" ? 54 : 38;
    minX = Math.min(minX, node.x - node.r - 34);
    maxX = Math.max(maxX, node.x + node.r + 34);
    minY = Math.min(minY, node.y - node.r - 34);
    maxY = Math.max(maxY, node.y + node.r + labelRoom);
  });

  return { minX, minY, maxX, maxY };
}

function fitToGraph(immediate = false) {
  const bounds = graphBounds();
  if (!bounds || !W || !H) return;
  const graphW = Math.max(1, bounds.maxX - bounds.minX);
  const graphH = Math.max(1, bounds.maxY - bounds.minY);
  const padding = clamp(Math.min(W, H) * 0.1, 42, 96);
  const nextK = clamp(
    Math.min((W - padding * 2) / graphW, (H - padding * 2) / graphH),
    0.28,
    1.24
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  targetView = {
    x: W / 2 - centerX * nextK,
    y: H / 2 - centerY * nextK,
    k: nextK
  };
  if (immediate) view = { ...targetView };
}

function flyToNode(node, leaveMembraneRoom = false) {
  const nextK = clamp(Math.max(targetView.k, 0.82), 0.6, 1.35);
  targetView = {
    x: W / 2 - node.x * nextK,
    y: (leaveMembraneRoom ? H * 0.36 : H / 2) - node.y * nextK,
    k: nextK
  };
}

function zoomAt(factor, screenX = W / 2, screenY = H / 2) {
  if (!W || !H) return;
  const world = toWorld(screenX, screenY, true);
  const nextK = clamp(targetView.k * factor, 0.24, 2.35);
  targetView.k = nextK;
  targetView.x = screenX - world.x * nextK;
  targetView.y = screenY - world.y * nextK;
}

function tickPhysics() {
  if (!graph.nodes.length) return;
  const nodes = graph.nodes;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const distanceSquared = dx * dx + dy * dy || 0.01;
      const distance = Math.sqrt(distanceSquared);
      const force = 1600 / distanceSquared;
      dx /= distance;
      dy /= distance;
      a.vx -= dx * force;
      a.vy -= dy * force;
      b.vx += dx * force;
      b.vy += dy * force;
    }
  }

  graph.links.forEach((link) => {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const rest = link.target.ring === 1 ? 180 : 310;
    const force = (distance - rest) * 0.0045;
    const unitX = dx / distance;
    const unitY = dy / distance;
    link.source.vx += unitX * force;
    link.source.vy += unitY * force;
    link.target.vx -= unitX * force;
    link.target.vy -= unitY * force;
  });

  nodes.forEach((node) => {
    const anchor = node.kind === "origin" ? 0.012 : 0.0016;
    node.vx += (0 - node.x) * anchor;
    node.vy += (0 - node.y) * anchor;
    if (node !== dragNode) {
      node.vx *= 0.86;
      node.vy *= 0.86;
      node.x += node.vx;
      node.y += node.vy;
    }
  });
}

function tickView() {
  view.x += (targetView.x - view.x) * 0.15;
  view.y += (targetView.y - view.y) * 0.15;
  view.k += (targetView.k - view.k) * 0.17;
}

function drawBackground() {
  backgroundStars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235, 241, 255, ${star.a})`;
    ctx.fill();
  });
}

function drawGraph() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  if (!graph.nodes.length) return;

  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.k, view.k);

  const focusActive = Boolean(focusVisible && selected);
  const focusNodes = focusActive
    ? graph.nodes.filter(
        (node) =>
          node === selected ||
          graph.links.some(
            (link) =>
              (link.source === selected && link.target === node) ||
              (link.target === selected && link.source === node)
          )
      )
    : [];

  if (focusNodes.length) {
    const centerX = focusNodes.reduce((sum, node) => sum + node.x, 0) / focusNodes.length;
    const centerY = focusNodes.reduce((sum, node) => sum + node.y, 0) / focusNodes.length;
    const radius = clamp(
      Math.max(...focusNodes.map((node) => Math.hypot(node.x - centerX, node.y - centerY) + node.r)) + 34,
      88,
      360
    );
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120, 233, 223, 0.035)";
    ctx.fill();
    ctx.setLineDash([3, 8]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(120, 233, 223, 0.34)";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  graph.links.forEach((link) => {
    const active = selected === link.source || selected === link.target;
    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
    ctx.strokeStyle = active ? "rgba(120, 233, 223, 0.78)" : "rgba(154, 130, 255, 0.36)";
    ctx.lineWidth = active ? 2.5 : 1.35;
    ctx.globalAlpha = focusActive && !active ? 0.1 : 1;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  graph.nodes.forEach((node) => {
    const isSelected = node === selected;
    const isHovered = node === hovered;
    const connectedToSelection =
      selected && graph.links.some(
        (link) =>
          (link.source === selected && link.target === node) ||
          (link.target === selected && link.source === node)
      );
    ctx.globalAlpha = focusActive && !isSelected && !connectedToSelection ? 0.12 : 1;

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r + 8, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "rgba(120, 233, 223, 0.18)" : "rgba(154, 130, 255, 0.09)";
    if (isSelected) {
      ctx.shadowBlur = 26;
      ctx.shadowColor = "rgba(120, 233, 223, 0.4)";
    } else if (isHovered) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(154, 130, 255, 0.35)";
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    const gradient = ctx.createLinearGradient(
      node.x - node.r,
      node.y - node.r,
      node.x + node.r,
      node.y + node.r
    );
    gradient.addColorStop(0, node.color);
    gradient.addColorStop(1, node.kind === "origin" ? "#f09b75" : "#8d79ff");
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = isSelected ? 3 : connectedToSelection ? 2 : 1.2;
    ctx.strokeStyle = isSelected
      ? "#ffffff"
      : connectedToSelection
        ? "rgba(255,255,255,0.7)"
        : "rgba(255,255,255,0.2)";
    ctx.stroke();

    ctx.fillStyle = "#0b1020";
    ctx.font = `${node.kind === "origin" ? 750 : 700} ${node.kind === "origin" ? 13 : 10}px ui-sans-serif, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(node.name), node.x, node.y);

    if (node.kind === "origin" || isSelected || isHovered || view.k >= 0.5) {
      ctx.fillStyle = "#eef2ff";
      ctx.font = `${node.kind === "origin" ? 650 : 500} ${node.kind === "origin" ? 13 : 11}px ui-sans-serif, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(shortLabel(node.name, node.kind === "origin" ? 34 : 24), node.x, node.y + node.r + 7);
    }
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}

function loop() {
  if (!physicsFrozen) tickPhysics();
  tickView();
  drawGraph();
  window.requestAnimationFrame(loop);
}

function toWorld(x, y, useTarget = false) {
  const current = useTarget ? targetView : view;
  return {
    x: (x - current.x) / current.k,
    y: (y - current.y) / current.k
  };
}

function pickNode(x, y) {
  const world = toWorld(x, y);
  for (let i = graph.nodes.length - 1; i >= 0; i -= 1) {
    const node = graph.nodes[i];
    const dx = world.x - node.x;
    const dy = world.y - node.y;
    const hitRadius = Math.max(node.r, 24 / view.k);
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return node;
  }
  return null;
}

function pointerPosition(event) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

els.canvas.addEventListener("pointerdown", (event) => {
  const point = pointerPosition(event);
  const node = pickNode(point.x, point.y);
  moved = false;
  pointerStart = point;
  lastPointer = point;
  els.canvas.setPointerCapture(event.pointerId);
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = null;
  setPhysicsFrozen(true);

  if (node) {
    dragNode = node;
  } else {
    panning = true;
  }
  els.canvas.classList.add("dragging");
});

els.canvas.addEventListener("pointermove", (event) => {
  const point = pointerPosition(event);
  if (pointerStart && !moved) {
    if (Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) < 8) return;
    moved = true;
  }

  if (dragNode) {
    const world = toWorld(point.x, point.y);
    dragNode.x = world.x;
    dragNode.y = world.y;
    dragNode.vx = 0;
    dragNode.vy = 0;
    return;
  }

  if (panning) {
    const dx = point.x - lastPointer.x;
    const dy = point.y - lastPointer.y;
    view.x += dx;
    view.y += dy;
    targetView.x += dx;
    targetView.y += dy;
    lastPointer = point;
    return;
  }

  hovered = pickNode(point.x, point.y);
  els.canvas.style.cursor = hovered ? "pointer" : "grab";
});

function finishPointer(event) {
  const point = pointerPosition(event);
  const clickedNode = !moved ? pickNode(point.x, point.y) : null;
  if (clickedNode) selectNode(clickedNode, true);
  dragNode = null;
  panning = false;
  moved = false;
  pointerStart = null;
  els.canvas.classList.remove("dragging");
}

els.canvas.addEventListener("pointerup", finishPointer);
els.canvas.addEventListener("pointercancel", () => {
  dragNode = null;
  panning = false;
  moved = false;
  pointerStart = null;
  els.canvas.classList.remove("dragging");
});

els.canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const point = pointerPosition(event);
    zoomAt(Math.exp(-event.deltaY * 0.0012), point.x, point.y);
  },
  { passive: false }
);

els.canvas.addEventListener("keydown", (event) => {
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomAt(1.18);
  } else if (event.key === "-") {
    event.preventDefault();
    zoomAt(0.86);
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    fitToGraph(false);
  } else if (event.key === "Escape") {
    event.preventDefault();
    if (focusVisible) {
      focusVisible = false;
      renderSelection();
    } else if (traversalHistory.length) {
      backOneLayer();
    } else {
      selected = graph.origin;
      renderSelection();
      fitToGraph(false);
    }
  }
});

els.zoomIn.addEventListener("click", () => zoomAt(1.18));
els.zoomOut.addEventListener("click", () => zoomAt(0.86));
els.fit.addEventListener("click", () => fitToGraph(false));
els.enterSelection.addEventListener("click", enterSelectedArticle);
els.enterFocus.addEventListener("click", enterSelectedArticle);
els.backLayer.addEventListener("click", backOneLayer);
els.backSelection.addEventListener("click", backOneLayer);
els.closeFocus.addEventListener("click", () => {
  focusVisible = false;
  renderSelection();
  fitToGraph(false);
  els.canvas.focus();
});
els.freeze.addEventListener("click", () => {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = null;
  setPhysicsFrozen(!physicsFrozen);
});

els.linkFilter.addEventListener("input", renderLinkList);

async function loadQuery(rawQuery, { updateHistory = true, preserveTraversal = false } = {}) {
  const query = String(rawQuery || "").trim();
  if (!query) {
    els.query.focus();
    return;
  }

  if (!preserveTraversal) resetTraversal();
  if (activeRequest) activeRequest.abort();
  const request = new AbortController();
  activeRequest = request;
  currentQuery = query;
  els.query.value = query;
  clearError();
  showLoading(true);
  els.graphStatus.textContent = `Mapping ${query}…`;

  try {
    const response = await fetch(`/api/wiki?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
      signal: request.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Wikipedia lookup failed with HTTP ${response.status}.`);
    if (!data.title || !Array.isArray(data.links)) throw new Error("Wikipedia returned an incomplete graph.");

    setGraph(data);
    clearError();
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("q", data.title);
      window.history.replaceState({}, "", url);
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    els.graphStatus.textContent = `Could not map ${query}`;
    showError(error.message);
  } finally {
    if (activeRequest === request) {
      showLoading(false);
      activeRequest = null;
    }
  }
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadQuery(els.query.value);
});

els.starters.forEach((button) => {
  button.addEventListener("click", () => loadQuery(button.dataset.query));
});

els.retry.addEventListener("click", () => loadQuery(currentQuery || els.query.value));

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(els.stage);

const initialQuery = new URL(window.location.href).searchParams.get("q") || "Paul Thomas Anderson";
loadQuery(initialQuery, { updateHistory: false });
window.requestAnimationFrame(loop);
