import { success, badRequest, notFound } from "../../../../../lib/response.js";
import { query } from "../../../../../lib/db.js";
import { requirePermission, requireRole } from "../../../../../lib/rbac.js";
import { isUuid, normalizeString } from "../../../../../lib/validators.js";
import {
  sanitizeCampaignName,
  sanitizeCampaignStatus,
  sanitizeScopeFilters,
  sanitizeMetadata,
  serializeCampaign,
  parseDate,
} from "../_helpers.js";

async function fetchCampaign(id) {
  const { rows } = await query`
    SELECT id,
           name,
           description,
           status,
           scope_filters,
           starts_at,
           ends_at,
           metadata,
           progress_snapshot,
           created_by,
           updated_by,
           created_at,
           updated_at,
           archived_at
    FROM inventory_campaigns
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(event) {
  await requirePermission(event, "inventory.check");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Identificador de campaña inválido");

  const row = await fetchCampaign(id);
  if (!row) return notFound("Campaña no encontrada");

  return success({ campaign: serializeCampaign(row) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("Identificador de campaña inválido");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Cuerpo JSON inválido");
  }

  const provided = {
    name: Object.prototype.hasOwnProperty.call(payload ?? {}, "name"),
    description: Object.prototype.hasOwnProperty.call(payload ?? {}, "description"),
    status:
      Object.prototype.hasOwnProperty.call(payload ?? {}, "status") ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, "estado"),
    scopeFilters:
      Object.prototype.hasOwnProperty.call(payload ?? {}, "scopeFilters") ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, "scope_filters"),
    metadata: Object.prototype.hasOwnProperty.call(payload ?? {}, "metadata"),
    startsAt:
      Object.prototype.hasOwnProperty.call(payload ?? {}, "startsAt") ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, "starts_at"),
    endsAt:
      Object.prototype.hasOwnProperty.call(payload ?? {}, "endsAt") ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, "ends_at"),
  };

  if (!Object.values(provided).some(Boolean)) {
    return badRequest("No hay cambios para actualizar");
  }

  const current = await fetchCampaign(id);
  if (!current) return notFound("Campaña no encontrada");

  let nextName = current.name;
  if (provided.name) {
    nextName = sanitizeCampaignName(payload?.name);
  }

  const nextDescription = provided.description
    ? normalizeString(payload?.description)
    : current.description;

  let nextStatus = current.status;
  if (provided.status) {
    nextStatus = sanitizeCampaignStatus(payload?.status, { fallback: current.status });
  }

  let nextScopeFilters = current.scope_filters || {};
  if (provided.scopeFilters) {
    nextScopeFilters = sanitizeScopeFilters(payload?.scopeFilters ?? payload?.scope_filters);
  }

  let nextMetadata = current.metadata || {};
  if (provided.metadata) {
    const sanitized = sanitizeMetadata(payload?.metadata);
    if (sanitized !== undefined) {
      nextMetadata = sanitized;
    }
  }

  let nextStartsAt = current.starts_at;
  if (provided.startsAt) {
    nextStartsAt = parseDate(payload?.startsAt ?? payload?.starts_at, "starts_at");
  }

  let nextEndsAt = current.ends_at;
  if (provided.endsAt) {
    nextEndsAt = parseDate(payload?.endsAt ?? payload?.ends_at, "ends_at");
  }

  if (nextStartsAt && nextEndsAt && new Date(nextStartsAt) > new Date(nextEndsAt)) {
    return badRequest("La fecha de inicio no puede ser posterior a la fecha de finalización");
  }

  let nextArchivedAt = current.archived_at;
  if (nextStatus === "archived" && !nextArchivedAt) {
    nextArchivedAt = new Date().toISOString();
  } else if (nextStatus !== "archived") {
    nextArchivedAt = null;
  }

  const userId = event?.locals?.user?.id || null;
  const now = new Date();

  const { rows } = await query`
    UPDATE inventory_campaigns
    SET name = ${nextName},
        description = ${nextDescription},
        status = ${nextStatus},
        scope_filters = ${nextScopeFilters},
        starts_at = ${nextStartsAt},
        ends_at = ${nextEndsAt},
        metadata = ${nextMetadata},
        archived_at = ${nextArchivedAt},
        updated_by = ${userId},
        updated_at = ${now}
    WHERE id = ${id}
    RETURNING id,
              name,
              description,
              status,
              scope_filters,
              starts_at,
              ends_at,
              metadata,
              progress_snapshot,
              created_by,
              updated_by,
              created_at,
              updated_at,
              archived_at
  `;

  if (!rows.length) return notFound("Campaña no encontrada");

  return success({ campaign: serializeCampaign(rows[0]) });
}
