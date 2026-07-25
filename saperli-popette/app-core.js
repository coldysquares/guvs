(() => {
  "use strict";
  const PARTS = 4;
  const fail = (error) => {
    console.error("Saperli failed to wake:", error);
    const status = document.getElementById("status");
    if (status) {
      status.textContent = "Saperli could not start in this browser.";
      status.classList.add("error");
    }
  };
  async function boot() {
    if (!("DecompressionStream" in window)) throw new Error("This browser does not support DecompressionStream.");
    const parts = await Promise.all(Array.from({ length: PARTS }, async (_, index) => {
      const response = await fetch(`./app.payload.${index}.txt`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Payload part ${index} failed with ${response.status}.`);
      return (await response.text()).trim();
    }));
    const encoded = parts.join("");
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source = await new Response(stream).text();
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => { URL.revokeObjectURL(url); fail(new Error("Decoded script could not load.")); };
    document.body.appendChild(script);
  }
  boot().catch(fail);
})();
