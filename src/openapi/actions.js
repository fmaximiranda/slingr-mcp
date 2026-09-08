/**
 * Slingr Action handling.
 *
 * Important: whether an Action is global or record-scoped cannot always be
 * inferred from Slingr's generated OpenAPI. This module therefore uses the
 * OpenAPI structure where possible and explicit app overrides where necessary.
 */

const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
]);

export function processActions(openapi, overrides = {}) {
  const config = {
    actionMode: overrides.actionMode ?? "blacklist",
    globalActions: new Set((overrides.globalActions ?? []).map(normalizeName)),
    recordScopedActions: new Set((overrides.recordScopedActions ?? []).map(normalizeName)),
  };

  const stats = {
    actionsFound: 0,
    actionsRemoved: [],
    actionsKeptByPrecondition: [],
  };

  for (const [pathKey, pathItem] of Object.entries(openapi.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) continue;

    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;

      const operation = pathItem[method];
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) continue;

      const variant = actionVariant(operation.operationId);
      if (!variant) continue;

      stats.actionsFound += 1;

      // We only manipulate ActionOne/ActionMany here. ActionQuery is retained
      // because it represents a different invocation shape and needs separate
      // treatment once we have more real-world examples.
      if (variant !== "One" && variant !== "Many") continue;

      const name = actionName(pathKey, operation);
      const hasPrecondition = hasPreconditions(operation);
      const shouldRemove = shouldDelete(name, hasPrecondition, config);

      if (!shouldRemove) {
        if (hasPrecondition && config.globalActions.has(normalizeName(name))) {
          stats.actionsKeptByPrecondition.push({
            method: method.toUpperCase(),
            path: pathKey,
            operationId: operation.operationId ?? null,
            action: name,
          });
        }
        continue;
      }

      delete pathItem[method];
      stats.actionsRemoved.push({
        method: method.toUpperCase(),
        path: pathKey,
        operationId: operation.operationId ?? null,
        action: name,
      });
    }
  }

  return { openapi, stats };
}

export function actionVariant(operationId = "") {
  const match = /Action(One|Many|Query)$/.exec(operationId);
  return match ? match[1] : null;
}

export function actionName(pathKey, operation = {}) {
  const segments = String(pathKey).split("/").filter(Boolean);
  const last = segments.at(-1);

  if (last && !last.includes("{")) {
    return last;
  }

  const operationId = operation.operationId ?? "";
  const tag = operation.tags?.[0] ?? "";

  let name = operationId;
  if (tag && operationId.toLowerCase().startsWith(tag.toLowerCase())) {
    name = operationId.slice(tag.length);
  }

  return name.replace(/Action(One|Many|Query)$/, "");
}

export function hasPreconditions(operation = {}) {
  return /precondition/i.test(operation.description ?? "");
}

function shouldDelete(name, hasPrecondition, config) {
  // The conservative default: do not delete an Action merely because its
  // OpenAPI variant says ActionOne/ActionMany.
  if (hasPrecondition) return false;

  const normalizedName = normalizeName(name);

  if (config.actionMode === "all") return true;
  if (config.actionMode === "whitelist") {
    return !config.recordScopedActions.has(normalizedName);
  }

  // blacklist: only remove Actions explicitly identified as global.
  return config.globalActions.has(normalizedName);
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}
