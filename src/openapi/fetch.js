/**
 * Fetch an OpenAPI document from a remote URL.
 *
 * This module intentionally knows nothing about MCP or Slingr-specific
 * normalization. It only retrieves and parses the document.
 */

export async function fetchOpenAPI(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  let response;

  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(`Failed to fetch OpenAPI specification: ${error?.message ?? String(error)}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI specification: HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  let document;

  try {
    document = await response.json();
  } catch (error) {
    throw new Error("The OpenAPI endpoint did not return valid JSON.", {
      cause: error,
    });
  }

  validateOpenAPIDocument(document);
  return document;
}

function validateOpenAPIDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The OpenAPI response must be a JSON object.");
  }

  if (typeof document.openapi !== "string") {
    throw new Error("The OpenAPI document is missing a valid `openapi` field.");
  }

  if (!document.paths || typeof document.paths !== "object" || Array.isArray(document.paths)) {
    throw new Error("The OpenAPI document is missing a valid `paths` object.");
  }
}
