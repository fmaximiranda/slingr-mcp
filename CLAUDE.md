# slingr-mcp — context for coding agents

Generic MCP server that turns any Slingr App's generated OpenAPI into MCP tools. No App-specific code: everything App-specific comes from configuration (`APP_URL`, `API_TOKEN`, `OPENAPI_URL`, `SLINGR_MCP_OVERRIDES`).

## Working agreements
- Code, comments, docs and commits in **English**. Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `test:`).
- The author is the repository owner. Commits, PRs and files carry **no AI attribution** (no `Co-Authored-By` trailer for an assistant, no "Generated with" line).
- This repo is **public**: never commit tokens, `.env`, real App data or App-specific findings. Private notes and sample specs live in `.local/` (excluded via `.git/info/exclude`, not `.gitignore`).
- Ask before pushing, opening PRs, publishing to npm or deploying anything.
- Keep the generic/App-specific split: Slingr OpenAPI handling in `src/openapi/`, MCP runtime in `src/mcp/`. App semantics only through overrides.

## Pipeline
`src/index.js`: `readConfig()` → `fetchOpenAPI()` (`src/openapi/fetch.js`) → `normalizeOpenAPI()` (`normalize.js`) → `processActions()` (`actions.js` + `overrides.js`) → `startMcpServer()` (`src/mcp/server.js`, wraps `@ivotoby/openapi-mcp-server` `OpenAPIServer` with an inline spec, `token` header, stdio, `toolsMode: "all"`).

`src/index.js` runs `main()` unconditionally on import (it is the entry point).

## Slingr facts (verified 2026-10-19 against a production Slingr App)
- Auth: header `token: <api token>`. `GET /users/current` returns the user, `groups` and `permissions`, but `permissions` only has global flags (`developer`, `usersManagement`); there are **no per-entity permissions** in it.
- Entity access can be detected without side effects: `GET /data/{entity}?_size=1&_fields=id` returns 200 or **403** per entity.
- Write permissions (PUT/POST/DELETE, actions) **cannot** be probed without side effects.
- OpenAPI docs: `GET {APP_URL}/docs/{docSet}` returns the Swagger UI **HTML**, not JSON. The JSON URL comes in the response header `docsSpecUrl` (e.g. `{APP_URL}/files/public/doc-files/{docSet}.json?_rnd=...`); `docsPropertiesUrl` points to `{docSet}Properties.json`. The spec file is public (no token). A doc set can be misconfigured and return HTTP 500.
- In the spec, each operation's first **tag is the entity name** (e.g. `dev.tasks`), plus `users`, `files`, `auth` for platform endpoints. operationIds look like `dev.tasksFindOne`, `dev.tasksUpdate`, `...ActionOne|Many|Query`.
- A full doc set of a mid-size App: ~1 MB, 492 paths, 606 operations (318 PUT, 171 GET, 85 DELETE, 32 POST) → 606 tools, ~790 KB of tool definitions in `tools/list`. Too large to expose wholesale.

## `@ivotoby/openapi-mcp-server` 1.16.1 (verified in `dist/config.d.ts`)
- `toolsMode: "all" | "dynamic" | "explicit"`; filters `includeTools`, `includeTags`, `excludeTags`, `includeResources` (path prefixes), `includeOperations` (HTTP methods).
- `transportType: "stdio" | "http"` with `httpPort`, `httpHost`, `endpointPath`; HTTP has MCP sessions (`mcp-session-id`) but **no OAuth**.
- `authProvider: { getAuthHeaders(), handleAuthError(error) }` takes precedence over `headers`; it is one provider per server instance (not per MCP session).
- `@modelcontextprotocol/sdk` is imported directly by `src/mcp/server.js` but only installed transitively.

## Running
- Node 20+. `npm install`, then `npm start` (reads `.env`; see `.env.example`).
- Smoke test: `node tests/mcp/server.smoke.js`. Tool dump: `scripts/dump-tool-schema.js`.
- Quick manual check: pipe `initialize`, `notifications/initialized`, `tools/list` JSON-RPC lines into `node src/index.js` and count the tools.
- Bundle for Claude Desktop: `npm run build` → `dist/slingr-mcp-<version>.mcpb` (note: `dist/` is in `.gitignore` but the 0.1.0 bundle is tracked).

## Roadmap
See `docs/roadmap.md`: **B (blocking normalization bugs) first**, then small fixes and improvements 1–3. Today 323 of 606 tools of a real App have invalid schemas (`query parameters` name, `type: "file"`, property-level `required: true`) and `aggregate` is documented as GET but needs PUT.
