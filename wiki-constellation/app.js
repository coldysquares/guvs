import { createMembraneRuntime } from "../shared/membrane-runtime.js";

const MAX_FIELD_LINKS = 12;
const INITIAL_RING = 6;
const EXPANSION_RING = 5;

function wikiId(title) {
  const slug = String(title || "")
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `wiki-${slug || "article"}`;
}

function toneFromTitle(title, root = false) {
  if (root) return "gold";
  return ["violet", "blue", "teal", "rose"][title.length % 4];
}

function linkedLead(link, originTitle) {
  return {
    id: wikiId(link.title),
    title: link.title,
    subtitle: `Linked from ${originTitle}`,
    summary:
      `The “${originTitle}” article links to this page. Enter its membrane to fetch the article summary and grow another sourced ring without discarding this one.`,
    tone: toneFromTitle(link.title),
    confidence: "unopened source",
    expanded: false,
    tags: ["Wikipedia lead", "outgoing article link"],
    facts: [
      { label: "Current evidence", value: `Outgoing link from ${originTitle}` },
      { label: "Article state", value: "Summary not fetched yet" },
      { label: "Semantic boundary", value: "A link is not causality" }
    ],
    sources: [
      {
        id: `${wikiId(link.title)}-lead`,
        label: `English Wikipedia · ${link.title}`,
        kind: "public source lead",
        status: "lead",
        note:
          `The source URL is known. Its own summary and outbound paths load only when this membrane is entered.`,
        url: link.url
      }
    ]
  };
}

function fragmentFromPayload(payload, options = {}) {
  const rootId = wikiId(payload.title);
  const links = payload.links.slice(0, MAX_FIELD_LINKS);
  const root = {
    id: rootId,
    title: payload.title,
    subtitle: "English Wikipedia · live article",
    summary:
      payload.extract ||
      "Wikipedia returned this article without an introductory extract.",
    tone: toneFromTitle(payload.title, true),
    confidence: "public source",
    expanded: true,
    articleUrl: payload.articleUrl,
    tags: ["live source", "public index", "outgoing links"],
    facts: [
      {
        label: "Article ID",
        value: payload.pageId ? String(payload.pageId) : "Not returned"
      },
      {
        label: "Outgoing links",
        value: String(payload.links.length)
      },
      {
        label: "Field sample",
        value: `${links.length} visible paths`
      }
    ],
    sources: [
      {
        id: `${rootId}-article`,
        label: `English Wikipedia · ${payload.title}`,
        kind: "public index",
        status: "source",
        note:
          "The membrane summary and the next-path list came from this article through the MediaWiki Action API.",
        url: payload.articleUrl
      },
      {
        id: `${rootId}-meaning`,
        label: "Link semantics",
        kind: "provenance boundary",
        status: "scope",
        note:
          "Every bond from this membrane means only that the source article links to the target page. It does not assert kinship, causality, agreement, or endorsement."
      }
    ]
  };
  const nodes = [root, ...links.map((link) => linkedLead(link, payload.title))];
  const bonds = links.map((link) => ({
    id: `${rootId}::${wikiId(link.title)}`,
    from: rootId,
    to: wikiId(link.title),
    label: "outgoing article link",
    type: "reference",
    evidence: `The English Wikipedia article “${payload.title}” links to “${link.title}”.`,
    sourceIds: [`${rootId}-article`]
  }));

  return {
    id: "wiki-live-v3",
    ...(options.includeMetadata
      ? {
          title: `${payload.title} research pond`,
          kicker: "Wiki lens / live public source",
          description:
            "Enter any article membrane; each sourced ring accumulates while the exact route back is preserved.",
          sourceLabel: "English Wikipedia",
          layout: "radial"
        }
      : {}),
    rootId,
    initiallyVisible: [rootId, ...nodes.slice(1, INITIAL_RING + 1).map((node) => node.id)],
    nodes,
    bonds
  };
}

async function fetchArticle(query, signal) {
  const response = await fetch(`/api/wiki?q=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/json" },
    signal
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Wikipedia lookup returned HTTP ${response.status}.`);
  }
  return payload;
}

const placeholder = {
  id: "wiki-live-v3",
  title: "Preparing a research pond",
  kicker: "Wiki lens / live public source",
  description:
    "A searched article becomes the first membrane; its outgoing links become sourced paths.",
  layout: "radial",
  rootId: "wiki-preparing",
  initiallyVisible: ["wiki-preparing"],
  nodes: [
    {
      id: "wiki-preparing",
      title: "Wikipedia",
      subtitle: "Waiting for a query",
      summary:
        "Search a person, place, work, or idea to begin a live, accumulating source exploration.",
      tone: "violet",
      confidence: "not loaded",
      facts: [
        { label: "Source", value: "English Wikipedia" },
        { label: "Operation", value: "Read-only query" },
        { label: "Path meaning", value: "Outgoing article link" }
      ],
      sources: []
    }
  ],
  bonds: []
};

let rootRequest = null;
const expanded = new Set();
const queryInput = document.querySelector("#wikiQuery");
const searchForm = document.querySelector("#wikiSearch");
const searchButton = searchForm.querySelector("button[type='submit']");

const runtime = createMembraneRuntime(document.querySelector("#membraneApp"), {
  dataset: placeholder,
  awdEnabled: true,
  awdEndpoint: "/api/groq",
  persist: false,
  async onEnter({ node, runtime: activeRuntime }) {
    if (node.expanded || expanded.has(node.id)) return;
    expanded.add(node.id);
    activeRuntime.setLoading(
      true,
      `Reading ${node.title}…`,
      "Its article will become another ring in the same pond."
    );
    try {
      const payload = await fetchArticle(node.title);
      const fragment = fragmentFromPayload(payload);
      const childIds = fragment.nodes.slice(1, EXPANSION_RING + 1).map((child) => child.id);
      activeRuntime.mergeDataset(fragment, {
        discover: [wikiId(payload.title), ...childIds]
      });
      activeRuntime.announce(`${payload.title} expanded into ${childIds.length} new paths.`);
    } catch (error) {
      expanded.delete(node.id);
      throw error;
    } finally {
      activeRuntime.setLoading(false);
    }
  }
});

async function loadRoot(query) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    runtime.announce("Enter a Wikipedia article or search phrase.");
    queryInput.focus();
    return;
  }

  rootRequest?.abort();
  rootRequest = new AbortController();
  expanded.clear();
  searchButton.disabled = true;
  searchButton.textContent = "Growing…";
  runtime.setLoading(
    true,
    "Growing a live source pond…",
    `Resolving “${cleanQuery}” through English Wikipedia.`
  );

  try {
    const payload = await fetchArticle(cleanQuery, rootRequest.signal);
    runtime.setDataset(fragmentFromPayload(payload, { includeMetadata: true }));
    queryInput.value = payload.title;
    const url = new URL(window.location.href);
    url.searchParams.set("q", payload.title);
    window.history.replaceState({ query: payload.title }, "", url);
    runtime.announce(`${payload.title} mapped with ${Math.min(payload.links.length, MAX_FIELD_LINKS)} sourced paths.`);
  } catch (error) {
    if (error?.name !== "AbortError") {
      runtime.announce(error?.message || "The Wikipedia pond could not be grown.", 5200);
    }
  } finally {
    runtime.setLoading(false);
    searchButton.disabled = false;
    searchButton.textContent = "Grow pond";
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadRoot(queryInput.value);
});

for (const starter of document.querySelectorAll("[data-query]")) {
  starter.addEventListener("click", () => {
    queryInput.value = starter.dataset.query;
    loadRoot(starter.dataset.query);
  });
}

window.addEventListener("popstate", () => {
  const query = new URLSearchParams(window.location.search).get("q");
  if (query) loadRoot(query);
});

const initialQuery =
  new URLSearchParams(window.location.search).get("q") || "Paul Thomas Anderson";
queryInput.value = initialQuery;
loadRoot(initialQuery);
