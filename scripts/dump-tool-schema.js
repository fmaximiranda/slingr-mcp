/**
 * Dumps the actual tool inputSchema that the OpenAPIServer generates,
 * so we can see exactly what fields MCP Inspector sees.
 *
 * Run: node --env-file=.env scripts/dump-tool-schema.js
 */

import { OpenAPIServer } from "@ivotoby/openapi-mcp-server";
import { fetchOpenAPI } from "../src/openapi/fetch.js";
import { normalizeOpenAPI } from "../src/openapi/normalize.js";
import { processActions } from "../src/openapi/actions.js";

async function dumpToolSchema() {
  const spec = await fetchOpenAPI(process.env.OPENAPI_URL);
  const normalized = normalizeOpenAPI(spec);
  const withActions = processActions(normalized.openapi, {});

  const server = new OpenAPIServer({
    name: "debug",
    version: "0.1.0",
    apiBaseUrl: process.env.APP_URL,
    specInputMethod: "inline",
    inlineSpecContent: JSON.stringify(withActions.openapi),
    headers: { token: process.env.API_TOKEN },
    transportType: "stdio",
    toolsMode: "all",
  });

  // Initialize the tools manager without connecting transport
  await server.toolsManager.initialize();

  // Find the createBom tool
  const allTools = server.toolsManager.getToolsWithIds();
  for (const [id, tool] of allTools) {
    if (id.toLowerCase().includes("createbom") || tool.name.toLowerCase().includes("crt-bom")) {
      console.log(`\n=== Tool: ${id} (${tool.name}) ===`);
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }
  }

  process.exit(0);
}

dumpToolSchema().catch(e => { console.error(e); process.exit(1); });
