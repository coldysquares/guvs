(() => {
  "use strict";

  if ("AbortController" in window) {
    const prototype = window.AbortController.prototype;
    if (!prototype.__saperliAbortNormalized) {
      const nativeAbort = prototype.abort;
      Object.defineProperty(prototype, "__saperliAbortNormalized", { value: true });
      prototype.abort = function abortWithoutCustomReason() {
        // Request state already records whether this was a timeout, user stop,
        // session deletion, or local-data clear. Omitting a custom reason keeps
        // fetch rejection interoperable as a standard AbortError in browsers.
        return nativeAbort.call(this);
      };
    }
  }

  const script = document.createElement("script");
  script.src = "./app-core.js";
  script.async = false;
  script.onerror = () => {
    const status = document.getElementById("status");
    if (status) {
      status.textContent = "Saperli could not start in this browser.";
      status.classList.add("error");
    }
  };
  document.body.appendChild(script);
})();
