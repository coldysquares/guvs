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
  const hintToast = $("#hintToast");

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
  let toastTimer = null;

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

  const welcomeNoKey = `Bonjour! Je suis Saperli Popette. Je suis prête à discuter. Mets ta clé Groq, puis on parle. [HINT:
Saperli is saying: She is ready to talk, but you need to add your Groq key first.
Useful words:
- prête = ready
- discuter = to chat
- clé = key
Ways to respond:
- Bonjour. = Hello.
- Je veux parler français. = I want to speak French.
- Un moment. = One moment.
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
- Do not pretend a misunderstood word was valid vocabulary. If a word is unclear, recast the likely meaning or ask briefly.
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

  function setStatus(msg, isError = false) {
    status.textContent = msg || "";
    status.classList.toggle("error", Boolean(isError));
  }

  function showOverlay() {
    keyInput.value = "";
    overlay.classList.add("show");
    setTimeout(() => keyInput.focus(), 50);
  }

  function hideOverlay() {
    overlay.classList.remove("show");
  }

  function splitHint(text) {
    const source = String(text || "");
    const match = source.match(/\s*\[HINT:\s*([\s\S]*?)\]\s*$/i);
    if (!match) return { display: source.trim(), hint: null };
    return { display: source.replace(match[0], "").trim(), hint: match[1].trim() };
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function showHint(hint) {
    if (!hint) return;
    hintToast.innerHTML = "<strong>Hint:</strong> " + escapeHtml(hint);
    hintToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hintToast.classList.remove("show"), 14000);
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
        speakBtn.onclick = () => speak(parsed.display);
        actions.appendChild(speakBtn);

        if (parsed.hint) {
          const hintBtn = document.createElement("button");
          hintBtn.type = "button";
          hintBtn.className = "action-btn";
          hintBtn.textContent = "💡";
          hintBtn.title = "Show hint";
          hintBtn.onclick = () => showHint(parsed.hint);
          actions.appendChild(hintBtn);
        }

        bubble.appendChild(actions);
      }
    }

    row.appendChild(bubble);
    thread.appendChild(row);
    chat.scrollTop = chat.scrollHeight;
  }

  function removeThinking() {
    const thinking = $("#thinking");
    if (thinking) thinking.remove();
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    sendBtn.textContent = value ? "..." : "Send";
  }

  function autosizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

  function pickFrenchVoice() {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const french = voices.filter((v) => String(v.lang || "").toLowerCase().startsWith("fr"));
    const names = ["amelie", "amélie", "audrey", "aurelie", "aurélie", "celine", "céline", "chloe", "chloé", "claire", "julie", "lea", "léa", "marie"];
    return french.find((v) => names.some((name) => String(v.name || "").toLowerCase().includes(name))) || french[0] || voices[0] || null;
  }

  function speak(text) {
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
    u.rate = 0.94;
    u.pitch = 1.12;
    u.onstart = () => setStatus("Speaking...");
    u.onend = () => setStatus("");
    u.onerror = () => setStatus("");
    window.speechSynthesis.speak(u);
  }

  async function callChatApi(messages) {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-groq-key": apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: systemPrompt() }, ...messages],
        temperature: 0.85,
        max_tokens: 420
      })
    });

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

    if (!response.ok) {
      const msg = data?.error || data?.message || raw || ("API status " + response.status);
      throw new Error(msg);
    }

    return String(data?.content || data?.choices?.[0]?.message?.content || "").trim();
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

    if (!apiKey || !apiKey.startsWith("gsk_")) {
      showOverlay();
      return setStatus("Add your Groq key first.", true);
    }

    stopDictation(true);
    addBubble("user", clean);
    history.push({ role: "user", content: clean });
    trimHistory();
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
      if (!busy) setStatus(input.value.trim() ? "Dictation stopped. Edit or press Send." : "");
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
    if (!quiet) setStatus("Dictation stopped. Edit or press Send.");
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
    setStatus("Groq key cleared.");
    keyInput.focus();
  }

  sendBtn.onclick = () => send(input.value);
  input.addEventListener("input", autosizeInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input.value);
    }
  });
  micBtn.onclick = () => dictating ? stopDictation() : startDictation();
  $("#settingsBtn").onclick = showOverlay;
  $("#saveKey").onclick = saveKey;
  $("#clearKey").onclick = clearKey;
  keyInput.addEventListener("keydown", (event) => { if (event.key === "Enter") saveKey(); });

  if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = pickFrenchVoice;
  setupSpeechRecognition();

  if (apiKey && apiKey.startsWith("gsk_")) addBubble("assistant", welcomeWithKey);
  else {
    addBubble("assistant", welcomeNoKey);
    showOverlay();
  }

  input.focus();
})();
