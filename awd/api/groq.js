module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY not set on server" });
    return;
  }
  try {
    const { model, max_tokens, system, task } = req.body || {};
    if (!task) {
      res.status(400).json({ error: "task required" });
      return;
    }
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        max_tokens: max_tokens || 300,
        temperature: 0.2,
        stream: false,
        messages: [
          { role: "system", content: system || "" },
          { role: "user", content: task },
        ],
      }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
