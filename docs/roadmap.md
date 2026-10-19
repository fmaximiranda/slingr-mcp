# Roadmap

Status: planned (2026-10-19). Order suggested: B → 0 → 1 → 2 → 3.

## B. Blocking bugs: spec normalization (verified 2026-10-19)

Found by connecting the server (repo `main` and the `0.1.0` `.mcpb` bundle, same code; `@ivotoby/openapi-mcp-server` 1.16.1) to a production Slingr App: 606 tools generated, **323 rejected by Claude Code** ("invalid input schema", it reports the Anthropic API would reject them). `normalizeOpenAPI` today only migrates `definitions`, fixes `$ref`s, adds find-many params and strips the `token` header; none of the issues below is handled.

| # | Defect in Slingr's generated spec | Effect | Tools hit (sample App) | Scope |
|---|---|---|---|---|
| B1 | Every list/query/action operation declares `{"in": "query", "name": "query parameters", "schema": {"type": "object"}}` (a placeholder for "any filter") | (a) The property name has a space: Anthropic API tool schemas only accept `^[a-zA-Z0-9_.-]{1,64}$`, so Claude clients drop the tool. (b) Where a client keeps it, the library serializes it as `?query parameters[assignees]=...` and Slingr answers `400 Unrecognized parameter [query parameters[assignees]]`. | 309: all `*-find-many`, `*-del-over-qry`, every Action (`*-one`, `*-many`, `*-qry`) | (a) Claude clients; (b) **any client** |
| B2 | File fields typed `{"type": "file"}` (Swagger 2 leftover; not a JSON Schema type) | Invalid JSON Schema (draft-07 and 2020-12 meta-schema) | 33 (14 not already hit by B1: `add`/`upd` of entities with file fields) | Any client that validates schemas (Claude rejects) |
| B3 | Property-level `"required": true` inside `properties` (JSON Schema needs a `required` array on the parent) | Invalid JSON Schema | 8 (user create/update) | Same as B2 |
| B4 | `/data/{entity}/aggregate` documented as **GET** with a body; the API only accepts **PUT** (GET answers `400 ID is not valid`, it reads `aggregate` as a record id; PUT with `[{"count":"total"}]` works) | Tool loads but always fails | every `*-aggregate` | **Any client** |

Net effect today: listing, filtering, aggregating, executing Actions (e.g. workflow status changes) and creating/updating records with file fields are unavailable. Tools that load: find-one by id, audit logs, delete one, download file, import, and create/update of entities without file fields; only find-one was exercised (works).

Fixes (in `normalize.js`, generic, with unit tests on small fixtures):
- [ ] B1. Remove the `query parameters` param. Replace it with a valid, explicit filter input and serialize it exploded (`?field=value&field2=value2`), e.g. one `filters` object param handled by a request hook, or (better for agents) concrete optional params per entity field taken from the entity schema (`assignees`, `status`, `project`…), documenting Slingr's query language operators in the description. Check how the library serializes object query params (`style`/`explode`) before choosing; a custom serializer may be needed.
- [ ] B2. Rewrite `type: "file"` to `type: "string"` (file id) and keep the original in the description.
- [ ] B3. Convert property-level `required: true|false` into the parent's `required` array.
- [ ] B4. Rewrite `get` on paths ending in `/aggregate` to `put` (keep body schema: array of operations).
- [ ] Guard: after normalization, validate every tool input schema against the JSON Schema meta-schema and the property-name pattern; log offenders at startup (and drop them instead of exposing broken tools).
- [ ] Regression check: start the server against a real App, `tools/list` → 0 invalid schemas; `find-many` with a filter returns filtered records; `aggregate` count works; an Action runs (on a test record).

Not verified yet: behavior in non-Claude clients (Cursor, VS Code Copilot, OpenAI/Gemini-based agents) and how Claude Desktop surfaces the rejected tools (likely the same exclusion, since it uses the same API). B1(b) and B4 are server-side and fail in every client.

## 0. Small fixes
- [ ] Declare `@modelcontextprotocol/sdk` as a direct dependency (it is imported in `src/mcp/server.js`).
- [ ] Read the server version from `package.json` instead of the hard-coded `"0.1.0"` in `startMcpServer`.
- [ ] README: the `OPENAPI_URL` example (`.../docs/mcp`) points to the Swagger HTML page; document the JSON URL or implement 2b.
- [ ] Decide whether `dist/*.mcpb` stays tracked (it is in `.gitignore`) or moves to GitHub Releases.
- [ ] Replace the smoke test with a `node --test` suite for `normalize`, `actions`, `overrides`, `readConfig`, plus the new filters (fixtures: small hand-written specs; never real App data).

## 1. Expose only what the token can use

Problem: the doc set documents every endpoint, including entities the token has no access to; with a full App that is 600+ tools.

What Slingr gives us (see `CLAUDE.md`): no per-entity permission list, but `GET /data/{entity}?_size=1&_fields=id` answers 200/403 without side effects. Write access cannot be probed.

Proposal (layers, each optional and combinable):
1. **Access probe (read).** At startup, collect the entity tags from the spec, probe each entity in parallel (bounded concurrency, short timeout), and drop every operation of entities that return 401/403. Map the result to `excludeTags`, or remove the paths before building the server. Log a summary to stderr (`kept N, dropped M: ...`). Config: `SLINGR_MCP_PROBE_ACCESS=true` (default on?), behavior on network errors: keep the entity and warn.
2. **Platform endpoints off by default.** Remove `users`, `files`, `auth` tags (user management, login/logout) unless enabled (`includePlatform: true` in overrides).
3. **Read-only mode.** `SLINGR_MCP_READ_ONLY=true` → `includeOperations: ["get"]` (actions excluded). The safe default for agents.
4. **Explicit allowlists in overrides.** `includeEntities`, `excludeEntities`, `includeMethods`, `includeActions`: for write scopes the probe cannot discover.
5. **Builder doc sets per role** (Slingr-native, no code): create a doc set per audience in the App Builder and point `OPENAPI_URL` to it. Document it in the README as the first option.
6. **Size:** expose `toolsMode` (`dynamic` gives a few meta-tools to list, describe and invoke endpoints; `explicit` + `includeTools`). Measure `tools/list` size before/after.

Acceptance: with a token that gets 403 on some entities, `tools/list` contains no tool for them; read-only mode lists only GET tools; tests cover the filter logic with a fake fetch.

Open questions: should the probe be the default? Re-probe on 403 at call time (token permissions changed) or only at startup?

## 2. Install without cloning (any CLI client)
- [ ] 2a. Add `"bin": { "slingr-mcp": "src/index.js" }` to `package.json` (the file already has the shebang). Then `npx -y github:fmaximiranda/slingr-mcp` works for any stdio client (Claude Code, Cursor, VS Code, Codex…). Today, without `bin`, it needs a workaround: `npx -y -p github:fmaximiranda/slingr-mcp -c 'node "$(dirname "${PATH%%:*}")/slingr-mcp/src/index.js"'`.
- [ ] 2b. Accept the doc set page as `OPENAPI_URL`: if the response is HTML and has a `docsSpecUrl` header, follow it. Optionally derive it from `APP_URL` + `SLINGR_MCP_DOC_SET`.
- [ ] 2c. Optional: publish to npm (`npx -y slingr-mcp`); check name availability; add `files` to `package.json` to keep the tarball small.
- [ ] 2d. Optional: `API_TOKEN_FILE` (read the token from a file) so client configs don't hold the token.
- [ ] README: config snippets for Claude Code (`claude mcp add ... -- npx -y ...`), Claude Desktop (`.mcpb`), and generic `mcpServers` JSON.

Note: a stdio server always lands in a local cache (npx); only a remote server (3) avoids local installs.

## 3. Installable in any agent, including the web (remote MCP)
- [ ] 3a. Transport: `SLINGR_MCP_TRANSPORT=http` → library `transportType: "http"` (`httpHost`, `httpPort`, `endpointPath`, Streamable HTTP). Health endpoint for the host.
- [ ] 3b. Auth per user. Web clients (e.g. claude.ai custom connectors) take a URL plus optional OAuth, not custom headers, so a static `API_TOKEN` would make everyone act as one user. Options:
  - OAuth 2.1 authorization server in front of the MCP (MCP auth spec: protected resource metadata, dynamic client registration, PKCE), mapping the user's login to a Slingr token (Slingr `/auth/login` returns a token; or the user pastes an API token once on the authorization page).
  - Per-session `AuthProvider`: the library has one provider per server instance, so per-user tokens need a server instance per MCP session or a provider that reads the session's token (needs a look at how the library routes requests).
  - Tool filtering (1) then depends on the user: compute it per session.
- [ ] 3c. Hosting: container + Cloud Run (or similar), secrets in a secret manager, no token logging, rate limits, allowed App URLs list (avoid acting as an open proxy to any Slingr App).
- [ ] 3d. Security review before exposing it publicly.

Acceptance: a web client connects with only a URL, logs in as its own Slingr user, and sees only that user's tools.
