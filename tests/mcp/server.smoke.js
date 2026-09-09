/**
 * Smoke test for startMcpServer.
 *
 * Verifies that the OpenAPIServer can be instantiated and started with an
 * inline spec without throwing. We use a minimal valid OpenAPI 3.0 document.
 *
 * Run: node tests/mcp/server.smoke.js
 */

import { startMcpServer } from "../../src/mcp/server.js";

const MINIMAL_SPEC = {
  openapi: "3.0.3",
  info: { title: "Smoke Test API", version: "1.0.0" },
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        summary: "Health check",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { status: { type: "string" } } },
              },
            },
          },
        },
      },
    },
  },
};

async function smokeTest() {
  console.error("[smoke] Starting MCP server with minimal inline spec...");

  try {
    const server = await startMcpServer({
      openApiSpec: MINIMAL_SPEC,
      appUrl: "https://example.slingrs.io/prod/runtime/api",
      apiToken: "test-token-for-smoke",
    });

    console.error("[smoke] ✅ Server started successfully.");
    console.error("[smoke] Server type:", typeof server);

    // Give the transport a moment, then exit cleanly.
    process.exit(0);
  } catch (error) {
    console.error("[smoke] ❌ Failed to start server:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

smokeTest();
