const WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const REQUEST_TIMEOUT_MS = 9000;
const MAX_QUERY_LENGTH = 120;
const LINK_LIMIT = 28;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function articleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replaceAll(" ", "_"))}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const query = String(firstValue(req.query?.q) || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Add a Wikipedia search query with ?q=." });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Keep the query under ${MAX_QUERY_LENGTH} characters.` });
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "1",
    prop: "links|extracts|pageimages|info",
    inprop: "url",
    plnamespace: "0",
    pllimit: String(LINK_LIMIT),
    exintro: "1",
    explaintext: "1",
    exsentences: "3",
    piprop: "thumbnail",
    pithumbsize: "640",
    redirects: "1"
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${WIKIPEDIA_ENDPOINT}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GUVs-Wiki-Constellation/1.0 (https://github.com/coldysquares/guvs)"
      },
      signal: controller.signal
    });

    const text = await upstream.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!upstream.ok) {
      return res.status(502).json({ error: `Wikipedia returned HTTP ${upstream.status}.` });
    }
    if (data?.error) {
      return res.status(502).json({ error: data.error.info || data.error.code || "Wikipedia rejected the query." });
    }

    const page = data?.query?.pages?.find((candidate) => candidate && !candidate.missing);
    if (!page) {
      return res.status(404).json({ error: `No English Wikipedia article matched “${query}”.` });
    }

    const seen = new Set();
    const links = (page.links || [])
      .filter((link) => link?.ns === 0 && link.title && link.title !== page.title)
      .filter((link) => {
        const key = link.title.toLocaleLowerCase("en");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, LINK_LIMIT)
      .map((link) => ({
        title: link.title,
        url: articleUrl(link.title)
      }));

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      query,
      title: page.title,
      pageId: page.pageid || null,
      extract: page.extract || "",
      thumbnail: page.thumbnail?.source || null,
      articleUrl: page.fullurl || articleUrl(page.title),
      links
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return res.status(504).json({ error: "Wikipedia took too long to respond. Try again." });
    }
    return res.status(502).json({ error: error?.message || "Wikipedia lookup failed." });
  } finally {
    clearTimeout(timeout);
  }
}
