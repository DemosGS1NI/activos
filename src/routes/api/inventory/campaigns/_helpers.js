import { badRequest } from "../../../../lib/response.js";
import { normalizeString } from "../../../../lib/validators.js";

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "archived",
];

const STATUS_TRANSITIONS = new Set(CAMPAIGN_STATUSES);

export function sanitizeCampaignName(value) {
  const name = normalizeString(value);
  if (!name) throw badRequest("El nombre de la campaña es requerido");
  if (name.length > 160) throw badRequest("El nombre de la campaña es demasiado largo");
  return name;
}

export function sanitizeCampaignStatus(value, { fallback = "draft" } = {}) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    if (!STATUS_TRANSITIONS.has(fallback)) {
      throw badRequest("Estado de campaña inválido");
    }
    return fallback;
  }
  if (!STATUS_TRANSITIONS.has(normalized)) {
    throw badRequest("Estado de campaña inválido");
  }
  return normalized;
}

export function sanitizeScopeFilters(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("scope_filters debe ser un objeto");
  }
  const output = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    if (Array.isArray(raw)) {
      const items = raw
        .map((item) => {
          if (item === null || item === undefined) return null;
          if (typeof item === "string") {
            const trimmed = item.trim();
            return trimmed ? trimmed : null;
          }
          if (typeof item === "number" || typeof item === "boolean") return item;
          return null;
        })
        .filter((item) => item !== null);
      if (items.length) output[key] = items;
      continue;
    }
    if (typeof raw === "object") {
      const nested = sanitizeScopeFilters(raw);
      if (Object.keys(nested).length) output[key] = nested;
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) output[key] = trimmed;
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean") {
      output[key] = raw;
    }
  }
  return output;
}

export function sanitizeMetadata(value) {
  if (value === undefined) return undefined;
  if (value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("metadata debe ser un objeto");
  }
  return { ...value };
}

export function computeIsActive(row, now = new Date()) {
  if (!row) return false;
  const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  if (!status || status === "archived" || status === "completed" || status === "paused") return false;

  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const ends = row.ends_at ? new Date(row.ends_at) : null;

  if (status === "draft") return false;

  if (status === "active") {
    if (starts && starts > now) return false;
    if (ends && ends < now) return false;
    return true;
  }

  if (status === "scheduled") {
    if (!starts) return false;
    if (starts > now) return false;
    if (ends && ends < now) return false;
    return true;
  }

  return false;
}

export function computeIsScheduled(row, now = new Date()) {
  if (!row) return false;
  const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  if (status !== "scheduled") return false;
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  if (!starts) return false;
  return starts > now;
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  try {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } catch (_) {
    return null;
  }
}

export function serializeCampaign(row, { now = new Date() } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    status: row.status,
    scopeFilters: row.scope_filters || {},
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    metadata: row.metadata || {},
    progressSnapshot: row.progress_snapshot || null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    archivedAt: toIso(row.archived_at),
    isActive: computeIsActive(row, now),
    isScheduled: computeIsScheduled(row, now),
  };
}

export function parseDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : value;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} debe ser una fecha válida`);
  }
  return date.toISOString();
}
