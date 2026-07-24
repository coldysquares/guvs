import {
  getFrontier,
  getNeighbors,
  getNode,
  getVisibleGraph,
  mergeDatasets,
  normalizeDataset,
  restoreDiscovered
} from "./membrane-model.js";

const TONES = {
  violet: { fill: "#8b78f6", rgb: "139, 120, 246" },
  blue: { fill: "#72b5ff", rgb: "114, 181, 255" },
  teal: { fill: "#78dfcf", rgb: "120, 223, 207" },
  gold: { fill: "#f2c76f", rgb: "242, 199, 111" },
  rose: { fill: "#ff9bb2", rgb: "255, 155, 178" },
  lime: { fill: "#c6f56f", rgb: "198, 245, 111" },
  orange: { fill: "#f2a766", rgb: "242, 167, 102" }
};

const BOND_COLORS = {
  parent: "rgba(114, 181, 255, 0.78)",
  partner: "rgba(242, 199, 111, 0.78)",
  sibling: "rgba(120, 223, 207, 0.68)",
  adoption: "rgba(255, 155, 178, 0.68)",
  reference: "rgba(139, 120, 246, 0.68)",
  supports: "rgba(120, 223, 207, 0.7)",
  tension: "rgba(255, 155, 178, 0.7)",
  context: "rgba(155, 174, 210, 0.56)"
};

const AWD_MODES = {
  quick: {
    label: "Quick",
    system:
      "Answer the bounded request directly in one compact paragraph. Use only the supplied membrane context. Do not invent missing evidence."
  },
  decide: {
    label: "Decide",
    system:
      "Make one bounded recommendation from the supplied membrane context. State the choice, the strongest reason, and the main uncertainty in one compact paragraph."
  },
  explain: {
    label: "Explain",
    system:
      "Explain the requested point clearly in one compact paragraph using only the supplied membrane context. Mark uncertainty instead of filling gaps."
  },
  list: {
    label: "List",
    system:
      "Return a short list of at most five useful items grounded only in the supplied membrane context. Do not add an introduction or conclusion."
  }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function initials(title) {
  const words = String(title || "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
}

function truncate(value, length = 24) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function readJson(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing. The session still works.
  }
}

function relationCopy(relation, activeId) {
  const { bond, direction } = relation;
  if (bond.type === "parent") {
    return direction === "outgoing" ? "parent of" : "child of";
  }
  if (bond.type === "adoption") {
    return direction === "outgoing" ? "adoptive parent of" : "adopted child of";
  }
  if (bond.type === "supports") {
    return direction === "outgoing" ? "supports" : "supported by";
  }
  if (bond.type === "reference") {
    return direction === "outgoing" ? bond.label : `linked from ${bond.label || activeId}`;
  }
  return bond.label;
}

function toneFor(node) {
  return TONES[node?.tone] || TONES.violet;
}

export class MembraneRuntime {
  constructor(root, options = {}) {
    if (!(root instanceof Element)) {
      throw new Error("MembraneRuntime requires a root element.");
    }

    this.root = root;
    this.options = {
      awdEnabled: true,
      awdEndpoint: "/api/groq",
      persist: true,
      ...options
    };
    this.dataset = normalizeDataset(options.dataset);
    this.storage = this.options.storage || window.localStorage;
    this.persistKey = this.makePersistKey(this.dataset.id);
    this.discovered = new Set(
      restoreDiscovered(
        this.dataset,
        this.options.persist ? readJson(this.storage, `${this.persistKey}:discovered`, []) : []
      )
    );
    this.positions = new Map();
    this.activeId = null;
    this.activeTab = "inside";
    this.history = [];
    this.outerSnapshot = null;
    this.selectedId = this.dataset.rootId;
    this.keyboardIndex = 0;
    this.view = { x: 0, y: 0, scale: 1 };
    this.pointer = null;
    this.hoveredId = null;
    this.awdMode = "quick";
    this.awdOutput = "";
    this.awdBusy = false;
    this.statusTimer = 0;
    this.enterToken = 0;
    this.destroyed = false;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    this.backgroundStars = Array.from({ length: 92 }, (_, index) => ({
      x: (hashString(`star-x-${index}`) % 1000) / 1000,
      y: (hashString(`star-y-${index}`) % 1000) / 1000,
      r: 0.45 + (hashString(`star-r-${index}`) % 150) / 100,
      alpha: 0.15 + (hashString(`star-a-${index}`) % 55) / 100
    }));

    this.mount();
    this.bind();
    this.layoutNodes();
    this.resize();
    requestAnimationFrame(() => this.fit());
    this.frame = requestAnimationFrame((time) => this.draw(time));
  }

  makePersistKey(datasetId) {
    return `guvs-v3:membrane:${datasetId}`;
  }

  mount() {
    this.root.classList.add("pm-root");
    this.root.innerHTML = `
      <section class="pm-stage" aria-label="Interactive membrane field">
        <canvas
          class="pm-canvas"
          tabindex="0"
          aria-describedby="pmGraphInstructions"
          aria-label="Membrane map"
        ></canvas>

        <div class="pm-pond-hud" aria-hidden="false">
          <div class="pm-hud-top">
            <div class="pm-field-card">
              <p class="pm-kicker" data-field-kicker></p>
              <h2 class="pm-field-title" data-field-title></h2>
              <p class="pm-field-description" data-field-description></p>
            </div>
            <div class="pm-controls" aria-label="Map controls">
              <button class="pm-control" type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
              <button class="pm-control" type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
              <button class="pm-control" type="button" data-action="fit">Fit</button>
              <button class="pm-control" type="button" data-action="reset">Reset</button>
            </div>
          </div>
          <div class="pm-hud-bottom">
            <p class="pm-guide" id="pmGraphInstructions">
              <strong>Tap a membrane to enter.</strong>
              Drag the pond to move · pinch or use + / − to zoom · pale cells are paths not yet opened
            </p>
            <p class="pm-progress" data-progress></p>
          </div>
        </div>

        <div class="pm-loading" data-loading hidden>
          <span class="pm-loading-orbit" aria-hidden="true"></span>
          <strong data-loading-title>Reading the substrate…</strong>
          <span data-loading-note>This should only take a moment.</span>
        </div>

        <div class="pm-status" data-status role="status" aria-live="polite"></div>

        <section class="pm-membrane-view" data-membrane hidden aria-label="Active membrane">
          <article class="pm-membrane-surface" data-surface>
            <div class="pm-surface-head">
              <div class="pm-route">
                <button class="pm-route-button" type="button" data-action="back"></button>
              </div>
              <button class="pm-exit-button" type="button" data-action="exit" aria-label="Exit to the surrounding pond">×</button>
            </div>

            <div class="pm-identity">
              <div class="pm-identity-copy">
                <p class="pm-kicker" data-node-kicker>Inside membrane</p>
                <h2 data-node-title></h2>
                <p class="pm-subtitle" data-node-subtitle></p>
              </div>
              <span class="pm-confidence" data-node-confidence></span>
            </div>

            <div class="pm-tabs" role="tablist" aria-label="Membrane views">
              <button class="pm-tab" type="button" role="tab" data-tab="inside">Inside</button>
              <button class="pm-tab" type="button" role="tab" data-tab="evidence">Evidence</button>
              <button class="pm-tab" type="button" role="tab" data-tab="paths">Paths</button>
              <button class="pm-tab" type="button" role="tab" data-tab="awd">AWD</button>
            </div>

            <div class="pm-panels">
              <section class="pm-panel" role="tabpanel" data-panel="inside"></section>
              <section class="pm-panel" role="tabpanel" data-panel="evidence" hidden></section>
              <section class="pm-panel" role="tabpanel" data-panel="paths" hidden></section>
              <section class="pm-panel" role="tabpanel" data-panel="awd" hidden></section>
            </div>
          </article>
        </section>
      </section>
    `;

    this.canvas = this.root.querySelector(".pm-canvas");
    this.context = this.canvas.getContext("2d");
    this.loadingElement = this.root.querySelector("[data-loading]");
    this.statusElement = this.root.querySelector("[data-status]");
    this.membraneElement = this.root.querySelector("[data-membrane]");
    this.surfaceElement = this.root.querySelector("[data-surface]");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.renderFieldMeta();
  }

  bind() {
    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerUp = (event) => this.pointerUp(event);
    this.onWheel = (event) => this.wheel(event);
    this.onKeyDown = (event) => this.keyDown(event);
    this.onClick = (event) => this.click(event);
    this.onInput = (event) => this.input(event);

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("keydown", this.onKeyDown);
    this.root.addEventListener("click", this.onClick);
    this.root.addEventListener("input", this.onInput);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.statusTimer);
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("pointermove", this.onPointerMove);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas?.removeEventListener("wheel", this.onWheel);
    this.canvas?.removeEventListener("keydown", this.onKeyDown);
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("input", this.onInput);
    this.root.innerHTML = "";
  }

  renderFieldMeta() {
    this.root.querySelector("[data-field-kicker]").textContent = this.dataset.kicker;
    this.root.querySelector("[data-field-title]").textContent = this.dataset.title;
    this.root.querySelector("[data-field-description]").textContent = this.dataset.description;
    this.updateProgress();
  }

  updateProgress() {
    const total = this.dataset.nodes.length;
    const count = this.discovered.size;
    this.root.querySelector("[data-progress]").textContent = `${count} / ${total} surfaced`;
  }

  setDataset(input, options = {}) {
    this.enterToken += 1;
    this.dataset = normalizeDataset(input);
    this.persistKey = this.makePersistKey(this.dataset.id);
    const stored =
      options.preserveDiscovery && this.options.persist
        ? readJson(this.storage, `${this.persistKey}:discovered`, [])
        : [];
    this.discovered = new Set(restoreDiscovered(this.dataset, stored));
    this.positions.clear();
    this.activeId = null;
    this.activeTab = "inside";
    this.history = [];
    this.outerSnapshot = null;
    this.selectedId = this.dataset.rootId;
    this.keyboardIndex = 0;
    this.view = { x: 0, y: 0, scale: 1 };
    this.membraneElement.hidden = true;
    this.layoutNodes();
    this.renderFieldMeta();
    this.persistDiscovery();
    requestAnimationFrame(() => this.fit());
  }

  mergeDataset(input, options = {}) {
    this.dataset = mergeDatasets(this.dataset, input);
    for (const id of options.discover || []) {
      if (getNode(this.dataset, id)) this.discovered.add(id);
    }
    this.layoutNodes();
    this.persistDiscovery();
    this.renderFieldMeta();
    if (this.activeId) this.renderActive();
  }

  setNodeLoading(nodeId, loading = true) {
    const node = getNode(this.dataset, nodeId);
    if (!node) return;
    this.mergeDataset({
      id: this.dataset.id,
      nodes: [{ ...node, loading }]
    });
  }

  setLoading(open, title = "Reading the substrate…", note = "This should only take a moment.") {
    this.loadingElement.hidden = !open;
    this.root.querySelector("[data-loading-title]").textContent = title;
    this.root.querySelector("[data-loading-note]").textContent = note;
  }

  announce(message, duration = 2200) {
    clearTimeout(this.statusTimer);
    this.statusElement.textContent = message;
    this.statusElement.dataset.open = "true";
    this.statusTimer = window.setTimeout(() => {
      this.statusElement.dataset.open = "false";
    }, duration);
  }

  persistDiscovery() {
    if (!this.options.persist) return;
    writeJson(this.storage, `${this.persistKey}:discovered`, [...this.discovered]);
    this.updateProgress();
  }

  resetDiscovery() {
    const confirmed = window.confirm(
      `Reset the surfaced membranes in “${this.dataset.title}”?`
    );
    if (!confirmed) return;
    this.discovered = new Set(this.dataset.initiallyVisible);
    this.activeId = null;
    this.history = [];
    this.outerSnapshot = null;
    this.membraneElement.hidden = true;
    this.persistDiscovery();
    this.fit();
    this.announce("The pond returned to its first visible membrane.");
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.canvasWidth = width;
      this.canvasHeight = height;
      this.dpr = dpr;
    }
  }

  layoutNodes() {
    const nodeMap = new Map(this.dataset.nodes.map((node) => [node.id, node]));
    const rootNode = nodeMap.get(this.dataset.rootId);
    if (rootNode && !this.positions.has(rootNode.id)) {
      this.positions.set(rootNode.id, rootNode.position || { x: 0, y: 0 });
    }

    for (const node of this.dataset.nodes) {
      if (node.position) this.positions.set(node.id, node.position);
    }

    const unplaced = new Set(
      this.dataset.nodes.filter((node) => !this.positions.has(node.id)).map((node) => node.id)
    );
    let guard = this.dataset.nodes.length * 3;

    while (unplaced.size && guard > 0) {
      guard -= 1;
      let changed = false;
      for (const [anchorId, base] of [...this.positions.entries()]) {
        const targets = getNeighbors(this.dataset, anchorId)
          .map((relation) => relation.target)
          .filter((target) => unplaced.has(target.id));
        if (!targets.length) continue;

        const lineage = this.dataset.layout === "lineage";
        const isRoot = anchorId === this.dataset.rootId;
        const outwardAngle =
          isRoot && lineage
            ? Math.PI / 2
            : Math.hypot(base.x, base.y) < 20
              ? -Math.PI / 2
              : Math.atan2(base.y, base.x);
        const spread =
          isRoot && !lineage
            ? (Math.PI * 2) / targets.length
            : Math.min(0.82, 1.7 / Math.max(1, targets.length - 1));

        targets.forEach((target, index) => {
          const centeredIndex = index - (targets.length - 1) / 2;
          let angle =
            isRoot && !lineage
              ? -Math.PI / 2 + index * spread
              : outwardAngle + centeredIndex * spread;
          let distance = isRoot ? 230 : 205;
          let candidate = null;

          for (let attempt = 0; attempt < 16; attempt += 1) {
            candidate = {
              x: base.x + Math.cos(angle) * distance,
              y: base.y + Math.sin(angle) * distance
            };
            const collision = [...this.positions.values()].some(
              (point) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < 132
            );
            if (!collision) break;
            angle += (attempt % 2 === 0 ? 1 : -1) * (0.2 + attempt * 0.045);
            if (attempt % 4 === 3) distance += 42;
          }

          this.positions.set(target.id, candidate);
          unplaced.delete(target.id);
          changed = true;
        });
      }
      if (!changed) break;
    }

    let fallbackIndex = 0;
    for (const id of unplaced) {
      const angle = (fallbackIndex / Math.max(1, unplaced.size)) * Math.PI * 2;
      const ring = 260 + Math.floor(fallbackIndex / 8) * 160;
      this.positions.set(id, {
        x: Math.cos(angle) * ring,
        y: Math.sin(angle) * ring
      });
      fallbackIndex += 1;
    }
  }

  visibleGraph() {
    return getVisibleGraph(this.dataset, this.discovered, 12);
  }

  renderedNodes() {
    const graph = this.visibleGraph();
    return [
      ...graph.visibleNodes.map((node) => ({ node, ghost: false })),
      ...graph.ghostNodes.map((node) => ({ node, ghost: true }))
    ];
  }

  fit() {
    const rendered = this.renderedNodes();
    if (!rendered.length || !this.canvasWidth || !this.canvasHeight) return;
    const points = rendered.map(({ node }) => this.positions.get(node.id)).filter(Boolean);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const rangeX = Math.max(220, maxX - minX + 190);
    const rangeY = Math.max(220, maxY - minY + 210);
    const topReserve = this.canvasWidth <= 760 ? 82 : 110;
    const bottomReserve = this.canvasWidth <= 760 ? 72 : 88;
    const availableWidth = Math.max(180, this.canvasWidth - 44);
    const availableHeight = Math.max(180, this.canvasHeight - topReserve - bottomReserve);
    const scale = Math.max(0.38, Math.min(1.25, availableWidth / rangeX, availableHeight / rangeY));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.view.scale = scale;
    this.view.x = this.canvasWidth / 2 - centerX * scale;
    this.view.y = topReserve + availableHeight / 2 - centerY * scale;
  }

  zoom(factor, clientX = this.canvasWidth / 2, clientY = this.canvasHeight / 2) {
    const oldScale = this.view.scale;
    const nextScale = Math.max(0.28, Math.min(2.6, oldScale * factor));
    const worldX = (clientX - this.view.x) / oldScale;
    const worldY = (clientY - this.view.y) / oldScale;
    this.view.scale = nextScale;
    this.view.x = clientX - worldX * nextScale;
    this.view.y = clientY - worldY * nextScale;
  }

  pointerDown(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false
    };
    this.canvas.dataset.dragging = "true";
  }

  pointerMove(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) {
      this.hoveredId = this.hitTest(event.clientX, event.clientY)?.node.id || null;
      return;
    }
    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    if (
      Math.hypot(
        event.clientX - this.pointer.startX,
        event.clientY - this.pointer.startY
      ) > 6
    ) {
      this.pointer.moved = true;
    }
    if (this.pointer.moved) {
      this.view.x += dx;
      this.view.y += dy;
    }
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
  }

  pointerUp(event) {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    const moved = this.pointer.moved;
    this.pointer = null;
    this.canvas.dataset.dragging = "false";
    if (!moved) {
      const hit = this.hitTest(event.clientX, event.clientY);
      if (hit) this.enterNode(hit.node.id, { reveal: hit.ghost });
    }
  }

  wheel(event) {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.zoom(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - rect.left, event.clientY - rect.top);
  }

  keyDown(event) {
    const nodes = this.renderedNodes();
    if (!nodes.length) return;
    if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
      this.keyboardIndex = (this.keyboardIndex + direction + nodes.length) % nodes.length;
      this.selectedId = nodes[this.keyboardIndex].node.id;
      this.announce(`${nodes[this.keyboardIndex].node.title}. Press Enter to enter.`);
      return;
    }
    if (event.key === "Enter" && this.selectedId) {
      event.preventDefault();
      const target = nodes.find(({ node }) => node.id === this.selectedId);
      if (target) this.enterNode(target.node.id, { reveal: target.ghost });
      return;
    }
    if (event.key === "Escape") {
      this.back();
      return;
    }
    if (event.key === "+" || event.key === "=") this.zoom(1.12);
    if (event.key === "-" || event.key === "_") this.zoom(0.88);
    if (event.key.toLowerCase() === "f") this.fit();
  }

  click(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "zoom-in") this.zoom(1.14);
    if (action === "zoom-out") this.zoom(0.86);
    if (action === "fit") this.fit();
    if (action === "reset") this.resetDiscovery();
    if (action === "back") this.back();
    if (action === "exit") this.exitToPond();
    if (action === "run-awd") this.runAwd();
    if (action === "copy-awd") this.copyAwd();
    if (action === "keep-awd") this.keepAwd();
    if (action === "discard-awd") this.discardAwd();

    const tab = event.target.closest("[data-tab]")?.dataset.tab;
    if (tab) this.switchTab(tab);

    const mode = event.target.closest("[data-awd-mode]")?.dataset.awdMode;
    if (mode && AWD_MODES[mode]) {
      this.awdMode = mode;
      this.renderActive();
      this.switchTab("awd");
    }

    const targetId = event.target.closest("[data-enter-node]")?.dataset.enterNode;
    if (targetId) {
      this.enterNode(targetId, { reveal: !this.discovered.has(targetId), fromPath: true });
    }
  }

  input(event) {
    if (!event.target.matches("[data-awd-input]")) return;
    const count = this.root.querySelector("[data-char-count]");
    if (count) count.textContent = `${event.target.value.length} / 280`;
  }

  hitTest(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const nodes = this.renderedNodes().reverse();

    for (const item of nodes) {
      const position = this.positions.get(item.node.id);
      if (!position) continue;
      const x = position.x * this.view.scale + this.view.x;
      const y = position.y * this.view.scale + this.view.y;
      const radius = (item.ghost ? 31 : item.node.id === this.dataset.rootId ? 48 : 40) *
        Math.max(0.72, this.view.scale);
      if (Math.hypot(screenX - x, screenY - y) <= Math.max(28, radius + 10)) {
        return item;
      }
    }
    return null;
  }

  async enterNode(nodeId, options = {}) {
    const node = getNode(this.dataset, nodeId);
    if (!node) return;
    if (options.reveal && !this.discovered.has(nodeId)) {
      this.discovered.add(nodeId);
      this.persistDiscovery();
      this.announce(`${node.title} surfaced.`);
    }

    if (!this.activeId) {
      this.outerSnapshot = { ...this.view };
      this.history = [];
    } else if (this.activeId !== nodeId) {
      this.history.push({ nodeId: this.activeId, tab: this.activeTab });
    }

    this.activeId = nodeId;
    this.activeTab = "inside";
    this.selectedId = nodeId;
    this.awdOutput = "";
    this.membraneElement.hidden = false;
    this.renderActive();

    const token = ++this.enterToken;
    if (typeof this.options.onEnter === "function") {
      try {
        await this.options.onEnter({ node, runtime: this, firstVisit: options.reveal });
      } catch (error) {
        if (token === this.enterToken) {
          this.announce(error?.message || "This membrane could not expand.", 4200);
        }
      }
    }
    if (token === this.enterToken && this.activeId === nodeId) this.renderActive();
  }

  back() {
    if (!this.activeId) return;
    const frame = this.history.pop();
    if (!frame) {
      this.exitToPond();
      return;
    }
    this.enterToken += 1;
    this.activeId = frame.nodeId;
    this.activeTab = frame.tab || "inside";
    this.awdOutput = "";
    this.renderActive();
  }

  exitToPond() {
    if (!this.activeId) return;
    this.enterToken += 1;
    this.activeId = null;
    this.activeTab = "inside";
    this.history = [];
    this.membraneElement.hidden = true;
    if (this.outerSnapshot) this.view = { ...this.outerSnapshot };
    this.outerSnapshot = null;
    requestAnimationFrame(() => this.canvas.focus({ preventScroll: true }));
  }

  switchTab(tab) {
    if (!["inside", "evidence", "paths", "awd"].includes(tab)) return;
    if (tab === "awd" && !this.options.awdEnabled) {
      this.announce("AWD is not enabled for this lens.");
      return;
    }
    this.activeTab = tab;
    for (const button of this.root.querySelectorAll("[data-tab]")) {
      const selected = button.dataset.tab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const panel of this.root.querySelectorAll("[data-panel]")) {
      panel.hidden = panel.dataset.panel !== tab;
    }
  }

  renderActive() {
    const node = getNode(this.dataset, this.activeId);
    if (!node) {
      this.exitToPond();
      return;
    }
    const tone = toneFor(node);
    this.root.style.setProperty("--pm-accent", tone.fill);
    this.root.style.setProperty("--pm-accent-rgb", tone.rgb);
    this.root.querySelector("[data-node-kicker]").textContent =
      node.kicker || `Inside ${this.dataset.title}`;
    this.root.querySelector("[data-node-title]").textContent = node.title;
    this.root.querySelector("[data-node-subtitle]").textContent =
      node.subtitle || this.dataset.sourceLabel;
    this.root.querySelector("[data-node-confidence]").textContent = node.confidence;
    const previous = this.history.at(-1);
    this.root.querySelector("[data-action='back']").textContent = previous
      ? `← ${getNode(this.dataset, previous.nodeId)?.title || "Previous membrane"}`
      : "← Surrounding pond";

    this.root.querySelector("[data-panel='inside']").innerHTML = this.insideMarkup(node);
    this.root.querySelector("[data-panel='evidence']").innerHTML = this.evidenceMarkup(node);
    this.root.querySelector("[data-panel='paths']").innerHTML = this.pathsMarkup(node);
    this.root.querySelector("[data-panel='awd']").innerHTML = this.awdMarkup(node);
    this.switchTab(this.activeTab);
  }

  insideMarkup(node) {
    const facts = node.facts.length
      ? node.facts
      : [{ label: "State", value: "No structured facts recorded yet.", status: "context" }];
    const tags = node.tags.length
      ? `<div class="pm-tags">${node.tags
          .map((tag) => `<span class="pm-tag">${escapeHtml(tag)}</span>`)
          .join("")}</div>`
      : "";

    return `
      <div class="pm-inside-grid">
        <article class="pm-summary-card">
          <p>${escapeHtml(node.summary)}</p>
          ${tags}
        </article>
        <div class="pm-facts" aria-label="Key facts">
          ${facts
            .slice(0, 4)
            .map(
              (fact) => `
                <article class="pm-fact">
                  <span class="pm-fact-label">${escapeHtml(fact.label)}</span>
                  <span class="pm-fact-value">${escapeHtml(fact.value)}</span>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  evidenceMarkup(node) {
    if (!node.sources.length) {
      return `
        <div class="pm-empty-card">
          <div>
            <p class="pm-kicker">Evidence unresolved</p>
            <p>No source has been attached to this membrane yet.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="pm-section-heading">
        <div>
          <span class="pm-section-label">Claims stay beside their support</span>
          <h3>Evidence inside ${escapeHtml(node.title)}</h3>
        </div>
        <span class="pm-section-count">${node.sources.length} source${node.sources.length === 1 ? "" : "s"}</span>
      </div>
      <div class="pm-evidence-grid">
        ${node.sources
          .map((source) => {
            const url = safeUrl(source.url);
            return `
              <article class="pm-source-card">
                <div class="pm-source-top">
                  <span class="pm-source-kind">${escapeHtml(source.kind)}</span>
                  <span class="pm-source-status" data-status="${escapeHtml(source.status)}">${escapeHtml(source.status)}</span>
                </div>
                <h4 class="pm-source-title">${escapeHtml(source.label)}</h4>
                <p class="pm-source-note">${escapeHtml(source.note || "Attached to this membrane as context.")}</p>
                ${url ? `<a class="pm-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : ""}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  pathsMarkup(node) {
    const relations = getNeighbors(this.dataset, node.id);
    if (!relations.length) {
      return `
        <div class="pm-empty-card">
          <div>
            <p class="pm-kicker">Edge of the known pond</p>
            <p>No outgoing path has been recorded from this membrane.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="pm-section-heading">
        <div>
          <span class="pm-section-label">Move without losing your route back</span>
          <h3>Paths through this membrane</h3>
        </div>
        <span class="pm-section-count">${relations.length} bond${relations.length === 1 ? "" : "s"}</span>
      </div>
      <div class="pm-path-list">
        ${relations
          .map((relation) => {
            const surfaced = this.discovered.has(relation.target.id);
            return `
              <article class="pm-path-card">
                <div>
                  <p class="pm-path-relation">${escapeHtml(relationCopy(relation, node.id))}</p>
                  <h4 class="pm-path-title">${escapeHtml(relation.target.title)}</h4>
                  <p class="pm-path-note">${escapeHtml(
                    relation.bond.evidence ||
                      relation.bond.note ||
                      "Follow this recorded bond into the next membrane."
                  )}</p>
                </div>
                <button class="pm-path-button" type="button" data-enter-node="${escapeHtml(relation.target.id)}">
                  ${surfaced ? "Enter" : "Reveal + enter"}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  awdMarkup(node) {
    if (!this.options.awdEnabled) {
      return `
        <div class="pm-empty-card">
          <div>
            <p class="pm-kicker">AWD capsule unavailable</p>
            <p>This lens does not expose the bounded operation capsule.</p>
          </div>
        </div>
      `;
    }
    const kept = readJson(this.storage, `${this.persistKey}:awd:${node.id}`, []);
    return `
      <div class="pm-awd-grid">
        <section class="pm-awd-card">
          <span class="pm-section-label">Bounded operation capsule</span>
          <p class="pm-awd-context">
            ${escapeHtml(node.title)} and its visible facts are sent only when you tap Run. No thread is created.
          </p>
          <div class="pm-mode-row" aria-label="AWD answer mode">
            ${Object.entries(AWD_MODES)
              .map(
                ([id, mode]) => `
                  <button
                    class="pm-mode-button"
                    type="button"
                    data-awd-mode="${id}"
                    aria-pressed="${String(this.awdMode === id)}"
                  >${mode.label}</button>
                `
              )
              .join("")}
          </div>
          <textarea
            class="pm-awd-input"
            data-awd-input
            maxlength="280"
            placeholder="Ask one bounded question about this membrane…"
          ></textarea>
          <div class="pm-awd-meta">
            <span class="pm-char-count" data-char-count>0 / 280</span>
            <button class="pm-primary-button" type="button" data-action="run-awd" ${this.awdBusy ? "disabled" : ""}>
              ${this.awdBusy ? "Running…" : `Run ${escapeHtml(AWD_MODES[this.awdMode].label)}`}
            </button>
          </div>
        </section>
        <section class="pm-output-card">
          <span class="pm-section-label">Bounded output</span>
          <div class="pm-output" data-awd-output data-empty="${String(!this.awdOutput)}">${
            this.awdOutput
              ? escapeHtml(this.awdOutput)
              : "The answer will stay here until you keep, copy, or discard it."
          }</div>
          <div class="pm-output-actions">
            <button class="pm-secondary-button" type="button" data-action="copy-awd" ${this.awdOutput ? "" : "disabled"}>Copy</button>
            <button class="pm-secondary-button" type="button" data-action="keep-awd" ${this.awdOutput ? "" : "disabled"}>Keep here</button>
            <button class="pm-secondary-button" type="button" data-action="discard-awd" ${this.awdOutput ? "" : "disabled"}>Discard</button>
          </div>
          <p class="pm-kept">${kept.length ? `<strong>${kept.length} kept</strong> in this membrane on this device.` : "Nothing kept in this membrane yet."}</p>
        </section>
      </div>
    `;
  }

  membraneContext(node) {
    const facts = node.facts.map((fact) => `${fact.label}: ${fact.value}`).join("\n");
    const sources = node.sources
      .map((source) => `${source.label} [${source.status}]: ${source.note}`)
      .join("\n");
    const paths = getNeighbors(this.dataset, node.id)
      .map((relation) => `${relationCopy(relation, node.id)} ${relation.target.title}`)
      .join("\n");
    return [
      `ACTIVE MEMBRANE: ${node.title}`,
      `SUMMARY: ${node.summary}`,
      facts ? `FACTS:\n${facts}` : "",
      sources ? `EVIDENCE NOTES:\n${sources}` : "",
      paths ? `RECORDED PATHS:\n${paths}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  async runAwd() {
    if (this.awdBusy) return;
    const input = this.root.querySelector("[data-awd-input]");
    const task = input?.value.trim();
    const node = getNode(this.dataset, this.activeId);
    if (!task || !node) {
      this.announce("Add one bounded question first.");
      input?.focus();
      return;
    }
    this.awdBusy = true;
    this.awdOutput = "";
    this.renderActive();
    this.switchTab("awd");

    try {
      const response = await fetch(this.options.awdEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: this.awdMode === "list" ? 260 : 220,
          system: [
            "You are the AWD bounded operation capsule inside a provenance-first membrane explorer.",
            AWD_MODES[this.awdMode].system,
            "Treat source labels and confidence states as metadata, not proof beyond what they explicitly say."
          ].join(" "),
          task: `${this.membraneContext(node)}\n\nBOUNDED REQUEST:\n${task}`
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `AWD returned HTTP ${response.status}.`);
      }
      const output = String(payload?.choices?.[0]?.message?.content || "").trim();
      if (!output) throw new Error("AWD returned an empty answer.");
      this.awdOutput = output;
    } catch (error) {
      this.awdOutput = `AWD error: ${error?.message || "The bounded request failed."}`;
    } finally {
      this.awdBusy = false;
      this.renderActive();
      this.switchTab("awd");
    }
  }

  async copyAwd() {
    if (!this.awdOutput) return;
    try {
      await navigator.clipboard.writeText(this.awdOutput);
      this.announce("Bounded output copied.");
    } catch {
      this.announce("Copy was blocked by this browser.");
    }
  }

  keepAwd() {
    if (!this.awdOutput || !this.activeId) return;
    const key = `${this.persistKey}:awd:${this.activeId}`;
    const current = readJson(this.storage, key, []);
    current.push({
      mode: this.awdMode,
      output: this.awdOutput,
      keptAt: new Date().toISOString()
    });
    writeJson(this.storage, key, current.slice(-12));
    this.announce("Output kept inside this membrane.");
    this.renderActive();
    this.switchTab("awd");
  }

  discardAwd() {
    this.awdOutput = "";
    this.renderActive();
    this.switchTab("awd");
    this.announce("Output discarded.");
  }

  draw(time = 0) {
    if (this.destroyed) return;
    const ctx = this.context;
    const width = this.canvasWidth || 1;
    const height = this.canvasHeight || 1;
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    this.drawBackground(ctx, width, height);
    const graph = this.visibleGraph();
    this.drawBonds(ctx, graph.bonds);
    const pulse = this.reducedMotion ? 0 : Math.sin(time / 1250) * 0.025;
    for (const node of graph.ghostNodes) this.drawNode(ctx, node, true, pulse);
    for (const node of graph.visibleNodes) this.drawNode(ctx, node, false, pulse);
    this.frame = requestAnimationFrame((nextTime) => this.draw(nextTime));
  }

  drawBackground(ctx, width, height) {
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      20,
      width * 0.5,
      height * 0.48,
      Math.max(width, height) * 0.72
    );
    gradient.addColorStop(0, "rgba(24, 45, 78, 0.38)");
    gradient.addColorStop(0.55, "rgba(7, 16, 29, 0.2)");
    gradient.addColorStop(1, "rgba(3, 8, 16, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const star of this.backgroundStars) {
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(192, 208, 237, ${star.alpha})`;
      ctx.fill();
    }
  }

  drawBonds(ctx, bonds) {
    const discovered = this.discovered;
    for (const bond of bonds) {
      const from = this.positions.get(bond.from);
      const to = this.positions.get(bond.to);
      if (!from || !to) continue;
      const x1 = from.x * this.view.scale + this.view.x;
      const y1 = from.y * this.view.scale + this.view.y;
      const x2 = to.x * this.view.scale + this.view.x;
      const y2 = to.y * this.view.scale + this.view.y;
      const fullyVisible = discovered.has(bond.from) && discovered.has(bond.to);
      ctx.save();
      ctx.beginPath();
      const bend = ((hashString(bond.id) % 31) - 15) * this.view.scale;
      const midX = (x1 + x2) / 2 + (y2 - y1) * 0.035 + bend;
      const midY = (y1 + y2) / 2 - (x2 - x1) * 0.035 + bend * 0.35;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.strokeStyle = fullyVisible
        ? BOND_COLORS[bond.type] || BOND_COLORS.context
        : "rgba(143, 158, 191, 0.24)";
      ctx.lineWidth = fullyVisible ? Math.max(1.1, 2.2 * this.view.scale) : 1;
      if (!fullyVisible) ctx.setLineDash([4, 7]);
      ctx.stroke();
      ctx.restore();
    }
  }

  cellPath(ctx, x, y, radius, seed, pulse = 0) {
    const count = 10;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const wobble = ((hashString(`${seed}-${index}`) % 17) - 8) / 100;
      const r = radius * (1 + wobble + pulse);
      points.push({ x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r });
    }
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const firstMid = midpoint(points.at(-1), points[0]);
    ctx.beginPath();
    ctx.moveTo(firstMid.x, firstMid.y);
    for (let index = 0; index < count; index += 1) {
      const current = points[index];
      const next = points[(index + 1) % count];
      const nextMid = midpoint(current, next);
      ctx.quadraticCurveTo(current.x, current.y, nextMid.x, nextMid.y);
    }
    ctx.closePath();
  }

  drawNode(ctx, node, ghost, pulse) {
    const position = this.positions.get(node.id);
    if (!position) return;
    const x = position.x * this.view.scale + this.view.x;
    const y = position.y * this.view.scale + this.view.y;
    const baseRadius = ghost ? 31 : node.id === this.dataset.rootId ? 48 : 40;
    const radius = baseRadius * Math.max(0.72, Math.min(1.18, this.view.scale));
    const tone = toneFor(node);
    const highlighted =
      node.id === this.selectedId || node.id === this.hoveredId || node.id === this.dataset.rootId;

    ctx.save();
    this.cellPath(ctx, x, y, radius + 9, `${node.id}-halo`, pulse * 0.7);
    ctx.fillStyle = ghost
      ? "rgba(132, 149, 184, 0.055)"
      : `rgba(${tone.rgb}, ${highlighted ? 0.16 : 0.08})`;
    ctx.fill();

    this.cellPath(ctx, x, y, radius, node.id, pulse);
    if (ghost) {
      ctx.fillStyle = "rgba(15, 24, 39, 0.82)";
      ctx.strokeStyle = "rgba(161, 177, 210, 0.38)";
      ctx.setLineDash([4, 6]);
    } else {
      const fill = ctx.createRadialGradient(
        x - radius * 0.32,
        y - radius * 0.38,
        radius * 0.1,
        x,
        y,
        radius
      );
      fill.addColorStop(0, tone.fill);
      fill.addColorStop(1, `rgba(${tone.rgb}, 0.72)`);
      ctx.fillStyle = fill;
      ctx.strokeStyle = highlighted ? "#f6f8ff" : `rgba(${tone.rgb}, 0.92)`;
    }
    ctx.lineWidth = highlighted ? 2.5 : 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = ghost ? "rgba(211, 220, 239, 0.7)" : "#07101b";
    ctx.font = `750 ${Math.max(11, radius * 0.34)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ghost ? "?" : initials(node.title), x, y + 1);

    ctx.fillStyle = ghost ? "rgba(157, 171, 202, 0.72)" : "rgba(240, 244, 255, 0.94)";
    ctx.font = `600 ${Math.max(10, 12 * Math.min(1.12, this.view.scale))}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(ghost ? "unopened path" : truncate(node.title), x, y + radius + 9);
    ctx.restore();
  }
}

export function createMembraneRuntime(root, options) {
  return new MembraneRuntime(root, options);
}
