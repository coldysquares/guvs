function cleanLine(value) {
  return String(value || "").trim();
}

function splitPair(value) {
  const line = cleanLine(value).replace(/^[-•]\s*/, "");
  const separator = line.indexOf(" = ");
  if (separator === -1) return { french: line, english: "" };
  return {
    french: line.slice(0, separator).trim(),
    english: line.slice(separator + 3).trim()
  };
}

export function parseSupportHint(value) {
  const support = {
    gist: "",
    words: [],
    replies: []
  };
  let section = "gist";

  for (const rawLine of String(value || "").split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    if (/^useful words\s*:/i.test(line)) {
      section = "words";
      continue;
    }
    if (/^ways to respond\s*:/i.test(line)) {
      section = "replies";
      continue;
    }
    if (/^saperli is saying\s*:/i.test(line)) {
      support.gist = line.replace(/^saperli is saying\s*:/i, "").trim();
      section = "gist";
      continue;
    }

    if (section === "words") support.words.push(splitPair(line));
    else if (section === "replies") support.replies.push(splitPair(line));
    else support.gist = [support.gist, line].filter(Boolean).join(" ");
  }

  return support;
}

function unwrapJson(value) {
  const source = cleanLine(value);
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : source;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace
    ? candidate.slice(firstBrace, lastBrace + 1)
    : "";
}

export function parseTranslationReply(value, sourceEnglish = "") {
  const raw = cleanLine(value);
  const json = unwrapJson(raw);

  if (json) {
    try {
      const parsed = JSON.parse(json);
      return {
        french: cleanLine(parsed.french),
        meaning: cleanLine(parsed.meaning || parsed.back_translation || sourceEnglish),
        note: cleanLine(parsed.note)
      };
    } catch {
      // Fall through to a plain-text recovery so a useful draft is never discarded.
    }
  }

  return {
    french: raw.replace(/^["“]|["”]$/g, "").trim(),
    meaning: cleanLine(sourceEnglish),
    note: ""
  };
}

export function recentConversationContext(history, limit = 4) {
  return (Array.isArray(history) ? history : [])
    .slice(-Math.max(0, limit))
    .map((message) => {
      const role = message?.role === "assistant" ? "Saperli" : "Learner";
      return `${role}: ${cleanLine(message?.content)}`;
    })
    .filter((line) => !line.endsWith(":"))
    .join("\n");
}
