#!/usr/bin/env node

import { fetchOpenAPI } from "./openapi/fetch.js";
import { normalizeOpenAPI } from "./openapi/normalize.js";
import { processActions } from "./openapi/actions.js";
import { createOverrides } from "./openapi/overrides.js";
import { startMcpServer } from "./mcp/server.js";

/**
 * Main entry point for slingr-mcp.
 *
 * Pipeline:
 *   readConfig() → fetchOpenAPI() → normalizeOpenAPI() → processActions() → startMcpServer()
 *
 * The normalized OpenAPI spec is passed inline to the MCP server so no
 * temporary file is needed. The API token is injected as a header by the
 * server and never exposed to the model as a tool parameter.
 */

async function main() {
  console.error("[slingr-mcp] Initializing Slingr MCP server...");

  const config = readConfig(process.env);
  console.error(`[slingr-mcp] Config validated. Fetching OpenAPI from: ${config.openApiUrl}`);

  const originalOpenAPI = await fetchOpenAPI(config.openApiUrl);
  console.error("[slingr-mcp] OpenAPI fetched successfully. Normalizing...");

  const normalized = normalizeOpenAPI(originalOpenAPI);
  const withActions = processActions(normalized.openapi, config.overrides);

  console.error(
    `[slingr-mcp] Spec ready (${Object.keys(withActions.openapi.paths ?? {}).length} paths). Starting MCP transport...`,
  );

  const server = await startMcpServer({
    openApiSpec: withActions.openapi,
    appUrl: config.appUrl,
    apiToken: config.apiToken,
  });

  console.error("[slingr-mcp] MCP server is running and ready for requests.");

  return server;
}

export function readConfig(env = process.env) {
  const appUrl = requireHttps(env.APP_URL ?? env.SOLUTIONS_API_BASE_URL, "APP_URL");
  const apiToken = required(env.API_TOKEN ?? env.SOLUTIONS_API_TOKEN, "API_TOKEN");
  const openApiUrl = requireHttps(
    env.OPENAPI_URL ?? env.SOLUTIONS_OPENAPI_SPEC,
    "OPENAPI_URL",
  );

  return {
    appUrl,
    apiToken,
    openApiUrl,
    overrides: createOverrides(readJsonEnv(env.SLINGR_MCP_OVERRIDES, {})),
    debug: env.SLINGR_MCP_DEBUG === "true" || env.SOLUTIONS_DEBUG === "true",
  };
}

function required(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Configuration error: ${name} environment variable is required.`);
  }
  return normalized;
}

function requireHttps(value, name) {
  const normalized = required(value, name);
  if (!/^https:\/\//i.test(normalized)) {
    throw new Error(`Configuration error: ${name} must be an https:// URL. Received: "${normalized}"`);
  }
  return normalized.replace(/\/$/, "");
}

function readJsonEnv(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("Configuration error: SLINGR_MCP_OVERRIDES must contain valid JSON.", {
      cause: error,
    });
  }
}

// Unconditional execution on process start:
// src/index.js is the executable entry point. Running unconditionally eliminates
// fragile path/URL/symlink comparisons across Windows, macOS, and Linux.
main().catch((error) => {
  console.error("[slingr-mcp FATAL ERROR]", error?.stack ?? error?.message ?? String(error));
  process.exit(1);
});

export { main };
