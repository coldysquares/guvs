import {
  parseSupportHint,
  parseTranslationReply,
  recentConversationContext
} from "./language-tools.js";

(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const chat = $("#chat");
  const thread = $("#thread");
  const input = $("#input");
  const sendBtn = $("#sendBtn");
  const overlay = $("#overlay");
  const keyInput = $("#keyInput");
  const micBtn = $("#micBtn");
  const status = $("#status");
  const translateBtn = $("#translateBtn");
  const translationModePanel = $("#translationMode");
  const cancelTranslationBtn = $("#cancelTranslation");
  const draftProof = $("#draftProof");
  const draftMeaning = $("#draftMeaning");
  const draftNote = $("#draftNote");
  const speakDraftBtn = $("#speakDraft");
  const dismissDraftBtn = $("#dismissDraft");
  const supportOverlay = $("#supportOverlay");
  const supportContent = $("#supportContent");
  const closeSupportBtn = $("#closeSupport");
  const supportSpeakBtn = $("#supportSpeak");

  const STORAGE_KEY = "saperli_key";
  const MODEL = "llama-3.3-70b-versatile";
  const API_ENDPOINT = "/api/chat";
  const MAX_HISTORY_MESSAGES = 16;

  let apiKey = localStorage.getItem(STORAGE_KEY) || "";
  let history = [];
  let busy = false;
  let recognition = null;
  let dictating = false;
  let baseDictationText = "";
  let finalDictationText = "";
  let translationMode = false;
  let translatedDraft = "";
  let supportSpeechText = "";
  let supportReturnFocus = null;

  function syncViewportHeight() {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
  }

  const welcomeWithKey = `Bonjour! Je suis déjà réveillée dans le petit sous-bois numérique. On parle de quoi? [HINT:
Saperli is saying: She is awake and ready to chat.
Useful words:
- réveillée = awake
- sous-bois = undergrowth / forest floor
- parler = to talk
Ways to respond:
- Bonjour Saperli. = Hello Saperli.
- Je veux pratiquer le français. = I want to practice French.
- On parle de guitare ? = Shall we talk about guitar?
]`;

  const welcomeHybrid = `Bonjour! Je suis Saperli Popette. Je suis prête à discuter. Si la clé du serveur est réveillée, écris-moi tout de suite; sinon, ajoute ta clé Groq avec l’engrenage. [HINT:
Saperli is saying: She is ready to talk; the app can use a server key if configured, or you can add your own key in settings.
Useful words:
- prête = ready
- discuter = to chat
- clé du serveur = server key
- engrenage = gear / settings
Ways to respond:
- Bonjour. = Hello.
- Je veux parler français. = I want to speak French.
- On essaie. = Let’s try.
]`;

  function systemPrompt() {
    return `You are Saperli Popette, a warm, slightly eccentric, and curious French conversation partner.
The user is learning French conversationally and does not want worksheet-style lessons.

Behavior:
- Speak mostly in beginner-accessible French.
- Keep replies brief: usually 1 to 3 natural sentences.
- If the user makes a mistake, gently recast it in correct French without scolding.
- Treat (?) as the user's uncertainty marker. Infer the likely intended French and naturally recast it. Do not treat (?) as literal content.
- Repair the user's French freely, but never repair, infer, or complete their factual claims. When a family relationship, date, origin, identity, or causal connection is not established, ask a brief clarifying question.
- Acknowledge the meaning first, naturally reuse the corrected phrase, and avoid formal correction language.
- If a word is unclear, reflect the most likely meaning as a gentle question. Do not lecture, scold, or repeatedly announce that something is "not a word."
- Let a little English leak in only when it helps.
- Ask one simple follow-up question.
- Keep the vibe odd, friendly, mushroomy, and alive.

At the very end of every reply, append a hidden support note in this exact format:

[HINT:
Saperli is saying: one plain-English sentence explaining the gist of your message.
Useful words:
- French word or phrase = English meaning
- French word or phrase = English meaning
- French word or phrase = English meaning
Ways to respond:
- Simple French reply = English meaning
- Simple French reply = English meaning
- Simple French reply = English meaning
]

Keep the hint practical, short, and tied to the current conversation. Do not make it feel like a worksheet.`;
  }

  function translationSystemPrompt() {
    return `You are the private English-to-French drafting tool inside Saperli Popette.
Translate one learner's English draft into natural, beginner-accessible conversational French.

Rules:
- Preserve the exact intended meaning, emotional tone, names, uncertainty, and level of formality.
- Use contemporary spoken French. Do not answer the draft or continue the conversation.
- Use the bounded conversation context only to resolve pronouns or tone.
- If gender affects one word and context does not establish it, choose the masculine/default form and mention the feminine alternative in the note.
- Return only valid JSON with exactly these string fields:
{"french":"the editable French draft","meaning":"a literal English back-translation of that French","note":"one optional note of 12 words or fewer"}
- No markdown, commentary, or additional keys.`;
  }

  function setStatus(msg, isError = false) {
    status.textContent = msg || "";
    status.classList.toggle("error", Boolean(isError));
  }

  function showOverlay() {
    keyInput.value = "";
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    setTimeout(() => keyInput.focus(), 50);
  }

  function hideOverlay() {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  function splitHint(text) {
    const source = String(text || "");
    const match = source.match(/\s*\[HINT:\s*([\s\S]*?)\]\s*$/i);
    if (!match) return { display: source.trim(), hint: null };
    return { display: source.replace(match[0], "").trim(), hint: match[1].trim() };
  }

  function hideSupport({ restoreFocus = true } = {}) {
    supportOverlay.classList.remove("show");
    supportOverlay.setAttribute("aria-hidden", "true");
    supportSpeechText = "";
    if (restoreFocus && supportReturnFocus?.isConnected) supportReturnFocus.focus();
    supportReturnFocus = null;
  }

  function addSupportHeading(text) {
    const heading = document.createElement("h3");
    heading.textContent = text;
    supportContent.appendChild(heading);
  }

  function showSupport(hint, speechText) {
    if (!hint) return;
    const parsed = parseSupportHint(hint);
    supportContent.replaceChildren();
    supportSpeechText = String(speechText || "").trim();
    supportReturnFocus = document.activeElement;

    if (parsed.gist) {
      addSupportHeading("What Saperli means");
      const gist = document.createElement("p");
      gist.className = "support-gist";
      gist.textContent = parsed.gist;
      supportContent.appendChild(gist);
    }

    if (parsed.words.length) {
      addSupportHeading("Useful words");
      const words = document.createElement("dl");
      words.className = "word-list";
      for (const item of parsed.words) {
        const term = document.createElement("dt");
        term.textContent = item.french;
        const meaning = document.createElement("dd");
        meaning.textContent = item.english;
        words.append(term, meaning);
      }
      supportContent.appendChild(words);
    }

    if (parsed.replies.length) {
      addSupportHeading("Try saying");
      const choices = document.createElement("div");
      choices.className = "reply-choices";
      for (const item of parsed.replies) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "reply-choice";

        const french = document.createElement("strong");
        french.textContent = item.french;
        const english = document.createElement("span");
        english.textContent = item.english;
        button.append(french, english);

        button.addEventListener("click", () => {
          setTranslationMode(false);
          clearDraftProof();
          input.value = item.french;
          autosizeInput();
          hideSupport({ restoreFocus: false });
          setStatus("French reply added. Edit it or press Send.");
          input.focus();
        });
        choices.appendChild(button);
      }
      supportContent.appendChild(choices);
    }

    supportSpeakBtn.hidden = !supportSpeechText;
    supportOverlay.classList.add("show");
    supportOverlay.setAttribute("aria-hidden", "false");
    setTimeout(() => closeSupportBtn.focus(), 30);
  }

  function addBubble(role, text = "", isThinking = false) {
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "you" : "them");
    if (isThinking) row.id = "thinking";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (isThinking) {
      const i = document.createElement("i");
      i.textContent = "...";
      bubble.appendChild(i);
    } else {
      const parsed = splitHint(text);
      const span = document.createElement("span");
      span.textContent = parsed.display;
      bubble.appendChild(span);

      if (role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "actions";

        const speakBtn = document.createElement("button");
        speakBtn.type = "button";
        speakBtn.className = "action-btn";
        speakBtn.textContent = "🔊";
        speakBtn.title = "Speak";
        speakBtn.setAttribute("aria-label", "Speak this reply");
        speakBtn.onclick = () => speak(parsed.display);
        actions.appendChild(speakBtn);

        if (parsed.hint) {
          const hintBtn = document.createElement("button");
          hintBtn.type = "button";
          hintBtn.className = "action-btn";
          hintBtn.textContent = "💡";
          hintBtn.title = "Understand this reply";
          hintBtn.setAttribute("aria-label", "Understand and use this reply");
          hintBtn.onclick = () => showSupport(parsed.hint, parsed.display);
          actions.appendChild(hintBtn);
        }

        bubble.appendChild(actions);
      }
    }

    row.appendChild(bubble);
    thread.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  function addStarters() {
    const tray = document.createElement("div");
    tray.className = "starters";
    tray.id = "starters";
    tray.setAttribute("aria-label", "Conversation starters");
    [
      "Je veux pratiquer le français.",
      "On parle de musique ?",
      "Corrige-moi doucement, s’il te plaît."
    ].forEach((phrase) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "starter";
      button.textContent = phrase;
      button.addEventListener("click", () => send(phrase));
      tray.appendChild(button);
    });
    thread.appendChild(tray);
  }

  function removeThinking() {
    const thinking = $("#thinking");
    if (thinking) thinking.remove();
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    translateBtn.disabled = value;
    sendBtn.textContent = value ? "..." : (translationMode ? "Translate" : "Send");
  }

  function autosizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function clearDraftProof() {
    translatedDraft = "";
    draftProof.hidden = true;
    translateBtn.hidden = translationMode;
    draftMeaning.textContent = "";
    draftNote.textContent = "";
    draftNote.hidden = true;
  }

  function showDraftProof(result) {
    translatedDraft = result.french;
    translateBtn.hidden = true;
    draftMeaning.textContent = result.meaning;
    draftNote.textContent = result.note;
    draftNote.hidden = !result.note;
    draftProof.hidden = false;
  }

  function setTranslationMode(value) {
    stopDictation(true);
    translationMode = Boolean(value);
    translationModePanel.hidden = !translationMode;
    translateBtn.hidden = translationMode;
    input.lang = translationMode ? "en" : "fr";
    input.setAttribute(
      "aria-label",
      translationMode ? "English draft to translate into French" : "Message Saperli"
    );
    input.placeholder = translationMode
      ? "Say what you mean in English..."
      : "Speak, edit, then send...";
    micBtn.title = translationMode ? "Dictate in English" : "Dictate in French";
    micBtn.setAttribute(
      "aria-label",
      translationMode ? "Start English dictation" : "Start French dictation"
    );
    if (recognition) recognition.lang = translationMode ? "en-US" : "fr-FR";
    sendBtn.textContent = busy ? "..." : (translationMode ? "Translate" : "Send");
    if (translationMode) clearDraftProof();
    setStatus(
      translationMode
        ? "Write or dictate in English. Saperli will create an editable French draft."
        : ""
    );
    autosizeInput();
    input.focus();
  }

  function pickFrenchVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const french = voices.filter((v) => String(v.lang || "").toLowerCase().startsWith("fr"));
    const names = ["amelie", "amélie", "audrey", "aurelie", "aurélie", "celine", "céline", "chloe", "chloé", "claire", "julie", "lea", "léa", "marie"];
    return french.find((v) => names.some((name) => String(v.name || "").toLowerCase().includes(name))) || french[0] || voices[0] || null;
  }

  function speak(text, { slow = false } = {}) {
    if (!("speechSynthesis" in window)) return setStatus("Speech synthesis is not available here.", true);
    const clean = String(text || "").trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const voice = pickFrenchVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || "fr-FR";
    } else {
      u.lang = "fr-FR";
    }
    u.rate = slow ? 0.76 : 0.94;
    u.pitch = 1.12;
    u.onstart = () => setStatus(slow ? "Speaking slowly..." : "Speaking...");
    u.onend = () => setStatus("");
    u.onerror = () => setStatus("");
    window.speechSynthesis.speak(u);
  }

  async function callGroq(messages, {
    system = systemPrompt(),
    temperature = 0.85,
    maxTokens = 420
  } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey && apiKey.startsWith("gsk_")) headers["x-groq-key"] = apiKey;

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        temperature,
        max_tokens: maxTokens
      })
    });

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

    if (!response.ok) {
      const msg = data?.error || data?.message || raw || ("API status " + response.status);
      const error = new Error(msg);
      error.status = response.status;
      throw error;
    }

    return String(data?.content || data?.choices?.[0]?.message?.content || "").trim();
  }

  function callChatApi(messages) {
    return callGroq(messages);
  }

  async function translateDraft(text) {
    const sourceEnglish = String(text || "").trim();
    if (!sourceEnglish || busy) return;

    stopDictation(true);
    setBusy(true);
    setStatus("Saperli is shaping your French...");

    const context = recentConversationContext(history);
    const request = [
      context ? `Recent conversation context:\n${context}` : "No conversation context yet.",
      `English draft:\n${sourceEnglish}`
    ].join("\n\n");

    try {
      const raw = await callGroq(
        [{ role: "user", content: request }],
        {
          system: translationSystemPrompt(),
          temperature: 0.2,
          maxTokens: 220
        }
      );
      const result = parseTranslationReply(raw, sourceEnglish);
      if (!result.french) throw new Error("Saperli could not shape that draft. Please try again.");

      translationMode = false;
      translationModePanel.hidden = true;
      translateBtn.hidden = false;
      input.lang = "fr";
      input.setAttribute("aria-label", "Message Saperli");
      input.placeholder = "Speak, edit, then send...";
      micBtn.title = "Dictate in French";
      micBtn.setAttribute("aria-label", "Start French dictation");
      if (recognition) recognition.lang = "fr-FR";
      input.value = result.french;
      autosizeInput();
      showDraftProof(result);
      setStatus("French draft ready. Review it, then press Send.");
    } catch (err) {
      if (err.status === 401 || /groq key|api key|missing key/i.test(err.message || "")) {
        showOverlay();
      }
      setStatus(err.message || "Translation failed.", true);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function trimHistory() {
    if (history.length > MAX_HISTORY_MESSAGES) {
      const overflow = history.length - MAX_HISTORY_MESSAGES;
      const removeCount = Math.ceil(overflow / 2) * 2;
      history = history.slice(removeCount);
    }
  }

  async function send(text) {
    const clean = String(text || "").trim();
    if (!clean || busy) return;

    stopDictation(true);
    $("#starters")?.remove();
    addBubble("user", clean);
    history.push({ role: "user", content: clean });
    trimHistory();
    clearDraftProof();
    input.value = "";
    autosizeInput();

    setBusy(true);
    setStatus("Saperli is thinking...");
    addBubble("assistant", "", true);

    try {
      const reply = await callChatApi(history);
      removeThinking();

      if (!reply) {
        addBubble("assistant", `Je n’ai rien reçu. Une petite brume technique. Tu veux réessayer ? [HINT:
Saperli is saying: Something technical went wrong and she wants to try again.
Useful words:
- réessayer = to try again
- brume = mist
- technique = technical
Ways to respond:
- On réessaie. = Let’s try again.
- Ça ne marche pas. = It isn’t working.
- Encore une fois. = One more time.
]`);
        return setStatus("");
      }

      addBubble("assistant", reply);
      const parsed = splitHint(reply);
      history.push({ role: "assistant", content: parsed.display });
      trimHistory();
      speak(parsed.display);
    } catch (err) {
      removeThinking();
      if (err.status === 401 || /groq key|api key|missing key/i.test(err.message || "")) {
        showOverlay();
      }
      addBubble("assistant", "Erreur: " + err.message);
      setStatus(err.message, true);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.disabled = true;
      micBtn.title = "Speech recognition is not available in this browser";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      dictating = true;
      baseDictationText = input.value.trim();
      finalDictationText = "";
      micBtn.classList.add("active");
      micBtn.textContent = "■";
      setStatus("Listening. Edit before sending.");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalDictationText += transcript + " ";
        else interim += transcript;
      }
      input.value = [baseDictationText, finalDictationText.trim(), interim.trim()].filter(Boolean).join(" ");
      autosizeInput();
    };

    recognition.onerror = (event) => setStatus("Mic error: " + (event.error || "unknown"), true);

    recognition.onend = () => {
      dictating = false;
      micBtn.classList.remove("active");
      micBtn.textContent = "🎙️";
      if (!busy) {
        const nextAction = translationMode ? "Translate" : "Send";
        setStatus(input.value.trim() ? `Dictation stopped. Edit or press ${nextAction}.` : "");
      }
    };
  }

  function startDictation() {
    if (!recognition || busy) return;
    window.speechSynthesis?.cancel();
    try { recognition.start(); } catch {}
  }

  function stopDictation(quiet = false) {
    if (!recognition || !dictating) return;
    try { recognition.stop(); } catch {}
    if (!quiet) {
      const nextAction = translationMode ? "Translate" : "Send";
      setStatus(`Dictation stopped. Edit or press ${nextAction}.`);
    }
  }

  function saveKey() {
    const value = keyInput.value.trim();
    if (!value.startsWith("gsk_")) {
      setStatus("That does not look like a Groq key.", true);
      return keyInput.focus();
    }

    apiKey = value;
    localStorage.setItem(STORAGE_KEY, apiKey);
    hideOverlay();
    setStatus("");
    input.focus();
    if (!thread.children.length) addBubble("assistant", welcomeWithKey);
  }

  function clearKey() {
    apiKey = "";
    localStorage.removeItem(STORAGE_KEY);
    keyInput.value = "";
    hideOverlay();
    setStatus("Browser key cleared. Saperli will use the server key when available.");
    input.focus();
  }

  sendBtn.onclick = () => translationMode ? translateDraft(input.value) : send(input.value);
  translateBtn.onclick = () => setTranslationMode(true);
  cancelTranslationBtn.onclick = () => setTranslationMode(false);
  speakDraftBtn.onclick = () => speak(input.value, { slow: true });
  dismissDraftBtn.onclick = () => {
    clearDraftProof();
    input.focus();
  };
  closeSupportBtn.onclick = () => hideSupport();
  supportSpeakBtn.onclick = () => speak(supportSpeechText, { slow: true });
  supportOverlay.addEventListener("click", (event) => {
    if (event.target === supportOverlay) {
      hideSupport();
    }
  });
  input.addEventListener("input", () => {
    autosizeInput();
    if (translatedDraft && input.value.trim() !== translatedDraft) clearDraftProof();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (translationMode) translateDraft(input.value);
      else send(input.value);
    }
  });
  micBtn.onclick = () => dictating ? stopDictation() : startDictation();
  $("#settingsBtn").onclick = showOverlay;
  $("#closeSettings").onclick = () => { hideOverlay(); $("#settingsBtn").focus(); };
  $("#saveKey").onclick = saveKey;
  $("#clearKey").onclick = clearKey;
  keyInput.addEventListener("keydown", (event) => { if (event.key === "Enter") saveKey(); });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) { hideOverlay(); $("#settingsBtn").focus(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (supportOverlay.classList.contains("show")) {
        hideSupport();
      } else if (overlay.classList.contains("show")) {
        hideOverlay();
        $("#settingsBtn").focus();
      } else if (translationMode) {
        setTranslationMode(false);
      }
    }
  });

  if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = pickFrenchVoice;
  syncViewportHeight();
  window.visualViewport?.addEventListener("resize", syncViewportHeight);
  window.addEventListener("orientationchange", syncViewportHeight);
  setupSpeechRecognition();

  const normalizedPath = window.location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "");
  document.getElementById("guvHome").hidden = !normalizedPath.endsWith("/saperli-popette");
  addBubble("assistant", apiKey && apiKey.startsWith("gsk_") ? welcomeWithKey : welcomeHybrid);
  addStarters();

  if (window.matchMedia?.("(pointer:fine)").matches) input.focus();
})();
