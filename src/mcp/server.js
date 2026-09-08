import { OpenAPIServer } from "@ivotoby/openapi-mcp-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Creates and starts the OpenAPI-based MCP server using an already
 * normalized OpenAPI specification.
 *
 * The specification is passed inline so no temporary OpenAPI file
 * needs to be created.
 */
export async function startMcpServer({
  openApiSpec,
  appUrl,
  apiToken,
  name = "slingr-mcp",
  version = "0.1.0",
}) {
  if (!openApiSpec || typeof openApiSpec !== "object") {
    throw new TypeError("openApiSpec must be a valid OpenAPI object.");
  }

  if (!appUrl) {
    throw new Error("appUrl is required.");
  }

  if (!apiToken) {
    throw new Error("apiToken is required.");
  }

  const server = new OpenAPIServer({
    name,
    version,

    apiBaseUrl: appUrl,

    openApiSpec: JSON.stringify(openApiSpec),
    specInputMethod: "inline",

    headers: {
      token: apiToken,
    },

    transportType: "stdio",

    toolsMode: "all",
  });

  const transport = new StdioServerTransport();

  await server.start(transport);

  return server;
}
