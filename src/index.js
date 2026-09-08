#!/usr/bin/env node

import { fetchOpenAPI } from "./openapi/fetch.js";
import { normalizeOpenAPI } from "./openapi/normalize.js";
import { processActions } from "./openapi/actions.js";
import { createOverrides } from "./openapi/overrides.js";

/**
 * First runtime entry point for slingr-mcp.
 *
 * At this stage this entry point prepares the normalized Slingr OpenAPI. MCP
 * transport/tool registration will be wired in after the OpenAPI adapter is
 * stable.
 */

async function main() {
  const config = readConfig(process.env);

  const originalOpenAPI = await fetchOpenAPI(config.openApiUrl);
  const normalized = normalizeOpenAPI(originalOpenAPI);
  const withActions = processActions(normalized.openapi, config.overrides);

  log(config, {
    openApiUrl: config.openApiUrl,
    baseUrl: config.appUrl,
    paths: Object.keys(withActions.openapi.paths ?? {}).length,
    normalized: normalized.stats,
    actions: withActions.stats,
  });

  // This is intentionally not starting an MCP transport yet. Returning the
  // document keeps the first iteration focused on the Slingr adapter.
  return withActions.openapi;
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
    throw new Error(`${name} is required.`);
  }
  return normalized;
}

function requireHttps(value, name) {
  const normalized = required(value, name);
  if (!/^https:\/\//i.test(normalized)) {
    throw new Error(`${name} must be an https:// URL. Received: ${normalized}`);
  }
  return normalized.replace(/\/$/, "");
}

function readJsonEnv(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("SLINGR_MCP_OVERRIDES must contain valid JSON.", {
      cause: error,
    });
  }
}

function log(config, payload) {
  if (!config.debug) return;
  process.stderr.write(`[slingr-mcp] ${JSON.stringify(payload, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`[slingr-mcp] ${error?.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
}

export { main };
