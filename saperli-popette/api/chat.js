export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-groq-key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const authHeader = req.headers.authorization || "";
  const headerKey = req.headers["x-groq-key"];
  const bearerKey = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const groqKey = process.env.GROQ_API_KEY || headerKey || bearerKey;

  if (!groqKey || !String(groqKey).startsWith("gsk_")) {
    return res.status(401).json({ error: "Missing Groq key. Add one in the app settings or set GROQ_API_KEY in Vercel." });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: "Missing messages array." });
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: body.model || "llama-3.3-70b-versatile",
        messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.85,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 420
      })
    });

    const text = await groqResponse.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!groqResponse.ok) {
      const message = data?.error?.message || data?.error || data?.message || text || `Groq ${groqResponse.status}`;
      return res.status(groqResponse.status).json({ error: message });
    }

    return res.status(200).json({
      content: data?.choices?.[0]?.message?.content || "",
      usage: data?.usage || null,
      model: data?.model || body.model || "llama-3.3-70b-versatile"
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Proxy request failed." });
  }
}
