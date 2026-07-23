// Root-project adapter for the unified GUVs deployment.
// AWD remains the canonical owner of the handler so its standalone
// Vercel project and the root GUVs project execute the same code.
module.exports = require("../awd/api/groq.js");
