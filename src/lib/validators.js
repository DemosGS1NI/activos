const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_REGEX = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function normalizeString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return String(value).trim();
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function validateEmail(value) {
  if (typeof value !== "string") return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}

export function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

export function toInteger(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function sanitizeKey(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (!KEY_REGEX.test(normalized)) return null;
  return normalized;
}
