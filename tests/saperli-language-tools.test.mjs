import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSupportHint,
  parseTranslationReply,
  recentConversationContext
} from "../saperli-popette/language-tools.js";

test("Saperli support hints become an English gist, vocabulary, and reply choices", () => {
  const parsed = parseSupportHint(`Saperli is saying: She would like to talk about music.
Useful words:
- parler = to talk
- écouter = to listen
Ways to respond:
- On parle de musique ? = Shall we talk about music?
- Oui, volontiers. = Yes, gladly.`);

  assert.equal(parsed.gist, "She would like to talk about music.");
  assert.deepEqual(parsed.words[0], { french: "parler", english: "to talk" });
  assert.deepEqual(parsed.replies[1], { french: "Oui, volontiers.", english: "Yes, gladly." });
});

test("translation JSON is recovered from a fenced model response", () => {
  const parsed = parseTranslationReply(`\`\`\`json
{"french":"Je me sens un peu seul ce soir.","meaning":"I feel a little lonely tonight.","note":"Use seule if you identify as feminine."}
\`\`\``, "I feel a little lonely tonight.");

  assert.deepEqual(parsed, {
    french: "Je me sens un peu seul ce soir.",
    meaning: "I feel a little lonely tonight.",
    note: "Use seule if you identify as feminine."
  });
});

test("plain French remains usable when the model omits JSON", () => {
  assert.deepEqual(parseTranslationReply("« On écoute un album ? »", "Should we listen to an album?"), {
    french: "« On écoute un album ? »",
    meaning: "Should we listen to an album?",
    note: ""
  });
});

test("translation context is bounded and labels both speakers", () => {
  const context = recentConversationContext([
    { role: "user", content: "Bonjour" },
    { role: "assistant", content: "Bonsoir !" },
    { role: "user", content: "On parle de musique ?" },
    { role: "assistant", content: "Oui, avec plaisir." },
    { role: "user", content: "Pick an album for me." }
  ], 3);

  assert.equal(
    context,
    "Learner: On parle de musique ?\nSaperli: Oui, avec plaisir.\nLearner: Pick an album for me."
  );
});
