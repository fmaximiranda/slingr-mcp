# Slingr MCP

A generic [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for **any Slingr application**.

Slingr MCP connects an AI agent to a Slingr App directly from its generated OpenAPI documentation. No App-specific code is required.

## How it works

```text
Slingr App
   │
   ├── APP_URL
   ├── API_TOKEN
   └── OPENAPI_URL
          │
          ▼
     Slingr MCP
          │
          ├── Fetch OpenAPI
          ├── Normalize Slingr-specific OpenAPI
          ├── Handle Actions and optional overrides
          └── Expose API operations as MCP tools
                    │
                    ▼
                 AI Agent
```

The OpenAPI specification is loaded dynamically, so the MCP reflects the current version of the Slingr App without generating or uploading a modified OpenAPI file manually.

## Features

- Works with any Slingr App that exposes the standard OpenAPI documentation.
- Dynamically loads the App's OpenAPI specification.
- Normalizes Slingr-specific OpenAPI structures before exposing tools.
- Handles Slingr authentication without exposing the API token as a tool parameter.
- Exposes App endpoints and Actions automatically.
- Supports optional App-specific overrides for information that cannot be inferred from OpenAPI alone.
- Keeps Slingr-specific logic separate from the MCP transport and runtime.

## Configuration

The MCP requires three values:

```text
APP_URL
API_TOKEN
OPENAPI_URL
```

Example:

```env
APP_URL=https://example.slingrs.io/prod/runtime/api
API_TOKEN=your-slingr-api-token
OPENAPI_URL=https://example.slingrs.io/prod/runtime/api/files/public/doc-files/mcp.json
```

Optional debugging and App-specific configuration can also be provided.

## Claude Desktop

Install `slingr-mcp` as an MCP package (`.mcpb`) and configure the Slingr App during setup.

Once configured, Claude can use the App's API through MCP tools without installing or maintaining any App-specific integration.

## Other MCP Clients

For MCP clients that support manual server configuration, provide the same Slingr App configuration:

```text
APP_URL
API_TOKEN
OPENAPI_URL
```

The same `slingr-mcp` server can be reused for different Slingr Apps by changing only the configuration.

## OpenAPI normalization

Slingr generates its OpenAPI documentation dynamically. Some structures require normalization before they can be consumed reliably by an MCP adapter.

The Slingr MCP normalization layer handles these transformations automatically at runtime. The normalized specification is kept in memory; no manual intermediate OpenAPI file is required.

## Actions

Slingr Actions can be represented in OpenAPI in more than one form. Some App-specific semantics cannot be determined from the generated documentation alone.

Slingr MCP therefore supports optional overrides for these cases while keeping the default behavior fully generic.

## Architecture

```text
src/
├── index.js
├── openapi/
│   ├── fetch.js
│   ├── normalize.js
│   ├── actions.js
│   └── overrides.js
├── mcp/
│   └── server.js
└── api/
    └── client.js
```

The project is intentionally split into Slingr-specific OpenAPI handling and MCP-specific functionality so both layers can evolve independently.

## Development

Requirements:

- Node.js 20+
- A Slingr App with API access
- Its OpenAPI documentation URL

Run locally with the required environment variables:

```bash
npm install
npm start
```

## Project goal

Provide a single, reusable MCP integration for Slingr so that an AI agent can work with any Slingr App through configuration alone, without custom MCP code per application.
