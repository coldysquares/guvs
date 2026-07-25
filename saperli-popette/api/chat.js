import coreHandler from "./chat-core.js";

function trustedClientIp(req) {
  const headers = req?.headers || {};
  return String(
    headers["x-vercel-forwarded-for"] ||
    headers["x-forwarded-for"] ||
    headers["x-real-ip"] ||
    ""
  ).split(",")[0].trim();
}

export default async function handler(req, res) {
  const headers = req.headers || (req.headers = {});
  const trustedIp = trustedClientIp(req);

  // The implementation's shared-key limiter reads x-saperli-client-id first.
  // Replace any caller-supplied value with Vercel's trusted client IP so the
  // shared Groq quota cannot be bypassed by rotating an arbitrary header.
  if (trustedIp) headers["x-saperli-client-id"] = trustedIp;
  else delete headers["x-saperli-client-id"];

  return coreHandler(req, res);
}
