  const storeKey = "psrCases.v1";
  const generatedKey = "psrGenerated.v1";
  const wikiEndpoint = "https://en.wikipedia.org/w/api.php";
  const seenConcepts = new Set();
  let conceptPool = [];
  let refillPromise = null;
  let sessionGenerated = Number(sessionStorage.getItem(generatedKey) || 0);
  let current = { id: makeId(), triplet: "", domains: "live Wikipedia corpus", createdAt: new Date().toISOString(), source: "wikipedia-live" };

  function makeId() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0,14);
    const rand = Math.random().toString(36).slice(2,6).toUpperCase();
    return `SC-${stamp}-${rand}`;
  }

  function normalizeConcept(title) {
    return title.replace(/_/g," ").replace(/\s+/g," ").trim();
  }

  function conceptIsUseful(title) {
    if (!title || title.length < 3 || title.length > 34) return false;
    if (/\([^)]*\)/.test(title)) return false;
    if (/^(list of|outline of|index of|timeline of|category:|template:|portal:)/i.test(title)) return false;
    if (/^\d{3,4}$/.test(title)) return false;
    if (/^[\W\d_]+$/.test(title)) return false;
    const words = title.trim().split(/\s+/);
    if (words.length > 4) return false;
    return true;
  }

  async function fetchConceptBatch(limit = 50) {
    const params = new URLSearchParams({ action:"query", list:"random", rnnamespace:"0", rnlimit:String(limit), format:"json", origin:"*" });
    const response = await fetch(`${wikiEndpoint}?${params.toString()}`, { mode:"cors", cache:"no-store" });
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
    const data = await response.json();
    return (data?.query?.random || [])
      .map(row => normalizeConcept(row.title))
      .filter(conceptIsUseful)
      .filter(title => {
        const key = title.toLowerCase();
        if (seenConcepts.has(key)) return false;
        seenConcepts.add(key);
        return true;
      });
  }

  async function refillConceptPool(minimum = 24) {
    if (conceptPool.length >= minimum) return;
    if (refillPromise) return refillPromise;
    refillPromise = (async () => {
      let attempts = 0;
      while (conceptPool.length < minimum && attempts < 4) {
        const fresh = await fetchConceptBatch(50);
        conceptPool.push(...fresh);
        attempts += 1;
      }
      if (conceptPool.length < 3) throw new Error("Not enough live concepts returned");
    })().finally(() => { refillPromise = null; });
    return refillPromise;
  }

  function takeConcept() {
    const index = Math.floor(Math.random() * conceptPool.length);
    return conceptPool.splice(index,1)[0];
  }

  async function liveTriplet() {
    await refillConceptPool(18);
    const words = [takeConcept(),takeConcept(),takeConcept()];
    if (conceptPool.length < 12) refillConceptPool(24).catch(() => {});
    return {
      id: makeId(),
      triplet: words.join(" · "),
      domains: "live Wikipedia corpus",
      createdAt: new Date().toISOString(),
      source: "wikipedia-live",
      concepts: words
    };
  }

  function auditPrompt(value) {
    return `Treat these as unrelated terms: ${value}.\n\nFirst define each term separately with source-aware precision. Then test whether any real connection exists.\n\nOutput:\n1. Separate definitions\n2. Evidence-backed connections, if any\n3. Metaphorical connections, clearly labeled\n4. Speculative connections, clearly labeled\n5. Hallucination risk: where an AI might falsely splice these into a fake theory\n6. Source notes / citations`;
  }
  function bridgePrompt(value) {
    return `Find the strongest hidden conceptual bridge between these three unrelated terms: ${value}.\n\nDo not pretend a real field, historical connection, or scientific relationship exists unless there is evidence.\n\nOutput:\n1. The most honest factual reading\n2. The best metaphorical bridge\n3. The most interesting speculative sci-fi / literature premise\n4. The exact point where speculation begins\n5. A warning about where hallucination or attractor-splice behavior would likely creep in`;
  }
  function selectedPrompt() {
    const type = document.getElementById("promptType").value;
    if (type === "bridge") return bridgePrompt(current.triplet);
    if (type === "raw") return current.triplet;
    return auditPrompt(current.triplet);
  }
  function updatePromptPreview() { document.getElementById("promptPreview").textContent = current.triplet ? selectedPrompt() : "Generate a reagent first."; }

  function setStatus(text, sticky = false) {
    const el = document.getElementById("status"); el.textContent = text;
    if (!sticky && text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 1800);
  }

  function setGeneratorBusy(busy, text = "drawing fresh concepts…") {
    const generate = document.getElementById("generate"); const chaos = document.getElementById("chaos"); const output = document.getElementById("output");
    generate.disabled = busy; chaos.disabled = busy;
    if (busy) { output.classList.add("loading"); output.textContent = text; }
  }

  function render(item, countAsGenerated = true) {
    current = item;
    const output = document.getElementById("output"); output.classList.remove("loading"); output.textContent = item.triplet;
    document.getElementById("caseId").textContent = `seed: ${item.id}`;
    document.getElementById("domains").textContent = item.domains;
    document.getElementById("generatedAt").textContent = new Date(item.createdAt).toLocaleString();
    updatePromptPreview();
    if (countAsGenerated) { sessionGenerated += 1; sessionStorage.setItem(generatedKey,String(sessionGenerated)); }
    updateStats();
  }

  async function generateOne(countAsGenerated = true) {
    setGeneratorBusy(true);
    setStatus("pulling from live corpus…", true);
    try {
      const item = await liveTriplet(); render(item,countAsGenerated); setStatus("fresh live reagent"); return item;
    } catch (error) {
      console.error(error);
      const output = document.getElementById("output"); output.classList.add("loading"); output.textContent = "live corpus unavailable — retry";
      setStatus("could not reach Wikipedia; no fixed fallback used", true);
      return null;
    } finally {
      document.getElementById("generate").disabled = false; document.getElementById("chaos").disabled = false;
    }
  }

  async function generateChaos() {
    setGeneratorBusy(true,"drawing 10 fresh reagents…"); setStatus("loading live concept pool…",true);
    try {
      await refillConceptPool(36);
      for (let i=0;i<10;i++) { const item = await liveTriplet(); render(item,true); }
      setStatus("generated 10 live reagents");
    } catch (error) {
      console.error(error); setStatus("live corpus unavailable; chaos aborted",true);
    } finally {
      document.getElementById("generate").disabled = false; document.getElementById("chaos").disabled = false;
    }
  }

  async function copyText(text,label) {
    try { await navigator.clipboard.writeText(text); setStatus(`copied: ${label}`); }
    catch { setStatus("copy failed. select text manually."); }
  }

  function getCases() { try { return JSON.parse(localStorage.getItem(storeKey) || "[]"); } catch { return []; } }
  function setCases(cases) { localStorage.setItem(storeKey,JSON.stringify(cases)); renderCases(); updateStats(); }
  function saveCase() {
    if (!current.triplet) return setStatus("generate a reagent first");
    const cases = getCases();
    cases.unshift({ ...current, savedAt:new Date().toISOString(), promptType:document.getElementById("promptType").value, prompt:selectedPrompt(), toolUsed:document.getElementById("toolUsed").value.trim(), behavior:document.getElementById("behavior").value, citations:document.getElementById("citations").value, risk:document.getElementById("risk").value, useCase:document.getElementById("useCase").value, notes:document.getElementById("notes").value.trim() });
    setCases(cases); setStatus("saved case");
  }
  function deleteCase(id) { setCases(getCases().filter(item => item.id !== id)); }
  function loadCase(id) {
    const item = getCases().find(row => row.id === id); if (!item) return;
    render({ id:item.id, triplet:item.triplet, domains:item.domains || "archived reagent", createdAt:item.createdAt, source:item.source || "archive", concepts:item.concepts || null },false);
    document.getElementById("promptType").value = item.promptType || "audit"; document.getElementById("toolUsed").value = item.toolUsed || "Google AI Search";
    document.getElementById("behavior").value = item.behavior || "untested"; document.getElementById("citations").value = item.citations || "unknown"; document.getElementById("risk").value = item.risk || "unknown"; document.getElementById("useCase").value = item.useCase || "slop-probe"; document.getElementById("notes").value = item.notes || ""; updatePromptPreview(); setStatus("loaded saved case");
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])); }
  function renderCases() {
    const list = document.getElementById("caseList"); const filter = document.getElementById("filter").value.toLowerCase().trim();
    const cases = getCases().filter(item => !filter || JSON.stringify(item).toLowerCase().includes(filter)); list.innerHTML = "";
    if (!cases.length) { list.innerHTML = '<p class="mini">No matching saved cases yet.</p>'; return; }
    cases.forEach(item => {
      const div = document.createElement("div"); div.className = "case";
      div.innerHTML = `<div class="case-title"><span>${escapeHtml(item.triplet)}</span><small>${escapeHtml(item.id)}</small></div><small>${new Date(item.savedAt || item.createdAt).toLocaleString()} · ${escapeHtml(item.useCase || "unknown")} · ${escapeHtml(item.behavior || "untested")} · citations: ${escapeHtml(item.citations || "unknown")} · risk: ${escapeHtml(item.risk || "unknown")}</small>${item.notes ? `<small>${escapeHtml(item.notes).slice(0,260)}${item.notes.length > 260 ? "..." : ""}</small>` : ""}<div class="case-actions"><button data-load="${item.id}">load</button><button data-copy="${item.id}">copy prompt</button><button data-md="${item.id}">copy markdown</button><button class="danger" data-delete="${item.id}">delete</button></div>`;
      list.appendChild(div);
    });
    list.querySelectorAll("[data-load]").forEach(btn => btn.addEventListener("click",() => loadCase(btn.dataset.load)));
    list.querySelectorAll("[data-copy]").forEach(btn => btn.addEventListener("click",() => { const item=getCases().find(row=>row.id===btn.dataset.copy); copyText(item.prompt || auditPrompt(item.triplet),"saved prompt"); }));
    list.querySelectorAll("[data-md]").forEach(btn => btn.addEventListener("click",() => { const item=getCases().find(row=>row.id===btn.dataset.md); copyText(caseToMarkdown(item),"case markdown"); }));
    list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click",() => { if (confirm("Delete this saved case?")) deleteCase(btn.dataset.delete); }));
  }
  function updateStats() {
    const cases=getCases(), total=cases.length; const citationKnown=cases.filter(x=>["yes","no","bad"].includes(x.citations)); const citationYes=cases.filter(x=>x.citations==="yes");
    const riskKnown=cases.filter(x=>["low","medium","high"].includes(x.risk)); const riskBad=cases.filter(x=>["medium","high"].includes(x.risk));
    document.getElementById("totalCases").textContent=total; document.getElementById("totalGenerated").textContent=sessionGenerated;
    document.getElementById("citationRate").textContent=`${citationKnown.length ? Math.round(citationYes.length/citationKnown.length*100) : 0}%`;
    document.getElementById("hallucinationRate").textContent=`${riskKnown.length ? Math.round(riskBad.length/riskKnown.length*100) : 0}%`;
  }
  function caseToMarkdown(item) { return `## ${item.triplet}\n\n- ID: ${item.id}\n- Generated: ${item.createdAt}\n- Saved: ${item.savedAt || ""}\n- Domains: ${item.domains || ""}\n- Source: ${item.source || ""}\n- Tool: ${item.toolUsed || ""}\n- Prompt type: ${item.promptType || ""}\n- Use case: ${item.useCase || ""}\n- Behavior: ${item.behavior || ""}\n- Citations: ${item.citations || ""}\n- Hallucination risk: ${item.risk || ""}\n\n### Prompt\n\n${item.prompt || ""}\n\n### Notes / Response\n\n${item.notes || ""}\n`; }
  function csvCell(value) { return `"${String(value).replace(/"/g,'""')}"`; }
  function dateSlug() { return new Date().toISOString().slice(0,10); }
  function exportCases(format) {
    const cases=getCases();
    if (format==="markdown") return { blob:new Blob([cases.map(caseToMarkdown).join("\n---\n\n")],{type:"text/markdown"}), name:`psr-log-${dateSlug()}.md` };
    if (format==="csv") { const headers=["id","triplet","createdAt","savedAt","domains","source","toolUsed","promptType","useCase","behavior","citations","risk","notes","prompt"]; const rows=[headers.join(",")].concat(cases.map(item=>headers.map(key=>csvCell(item[key]||"")).join(","))); return { blob:new Blob([rows.join("\n")],{type:"text/csv"}), name:`psr-log-${dateSlug()}.csv` }; }
    return { blob:new Blob([JSON.stringify(cases,null,2)],{type:"application/json"}), name:`psr-log-${dateSlug()}.json` };
  }
  function downloadExport() { const format=document.getElementById("exportFormat").value, file=exportCases(format), url=URL.createObjectURL(file.blob), a=document.createElement("a"); a.href=url; a.download=file.name; a.click(); URL.revokeObjectURL(url); }
  async function importJson(file) { const incoming=JSON.parse(await file.text()); if (!Array.isArray(incoming)) return alert("Import failed: JSON must be an array of saved cases."); const byId=new Map(getCases().map(item=>[item.id,item])); incoming.forEach(item=>{ if(item&&item.id) byId.set(item.id,item); }); setCases(Array.from(byId.values()).sort((a,b)=>String(b.savedAt||b.createdAt).localeCompare(String(a.savedAt||a.createdAt)))); setStatus("imported JSON"); }

  document.getElementById("generate").addEventListener("click",()=>generateOne(true));
  document.getElementById("copyTriplet").addEventListener("click",()=>copyText(current.triplet,"triplet"));
  document.getElementById("copyCleanPrompt").addEventListener("click",()=>copyText(auditPrompt(current.triplet),"audit prompt"));
  document.getElementById("openAwd").addEventListener("click",()=>{ if(!current.triplet) return; const boundedTask=`Assess this PSR reagent without inventing a field: ${current.triplet}. Separate factual, metaphorical, and speculative links.`; window.location.href=`../awd/?shape=explain&task=${encodeURIComponent(boundedTask)}`; });
  document.getElementById("copyWildPrompt").addEventListener("click",()=>copyText(bridgePrompt(current.triplet),"bridge prompt"));
  document.getElementById("chaos").addEventListener("click",generateChaos);
  document.getElementById("promptType").addEventListener("change",updatePromptPreview);
  document.getElementById("saveCase").addEventListener("click",saveCase);
  document.getElementById("clearNotes").addEventListener("click",()=>{document.getElementById("notes").value="";});
  document.getElementById("clearAll").addEventListener("click",()=>{if(confirm("Clear every saved PSR case from this browser? Export first if you need the log.")) setCases([]);});
  document.getElementById("filter").addEventListener("input",renderCases);
  document.getElementById("exportData").addEventListener("click",downloadExport);
  document.getElementById("copyMarkdown").addEventListener("click",()=>copyText(getCases().map(caseToMarkdown).join("\n---\n\n"),"full markdown log"));
  document.getElementById("importButton").addEventListener("click",()=>document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change",event=>{const file=event.target.files[0]; if(file) importJson(file); event.target.value="";});
  document.addEventListener("keydown",e=>{const tag=document.activeElement.tagName.toLowerCase(); const typing=["textarea","input","select"].includes(tag); if(!typing&&(e.key===" "||e.key==="Enter")){e.preventDefault(); generateOne(true);}});

  const normalizedPath=window.location.pathname.replace(/\/index\.html$/,"").replace(/\/$/,"");
  document.getElementById("guvHome").hidden=!normalizedPath.endsWith("/psr");
  if(window.matchMedia("(max-width:700px)").matches) document.querySelector(".workflow")?.removeAttribute("open");
  renderCases(); updateStats(); updatePromptPreview(); generateOne(false);
