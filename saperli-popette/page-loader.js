(() => {
  "use strict";
  const PARTS = 2;
  const mount = document.getElementById("boot-status");
  const fail = (error) => {
    console.error("Saperli page failed to load:", error);
    if (mount) mount.textContent = "Saperli could not open in this browser.";
  };
  async function boot() {
    if (!("DecompressionStream" in window)) throw new Error("This browser does not support DecompressionStream.");
    const parts = await Promise.all(Array.from({ length: PARTS }, async (_, index) => {
      const response = await fetch(`./page.payload.${index}.txt`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Page payload part ${index} failed with ${response.status}.`);
      return (await response.text()).trim();
    }));
    const bytes = Uint8Array.from(atob(parts.join("")), (character) => character.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const source = await new Response(stream).text();
    document.open();
    document.write(source);
    document.close();
  }
  boot().catch(fail);
})();
