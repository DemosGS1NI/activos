import { normalizeString, toBoolean, toInteger, validateEmail } from '../validators.js';
import { toDecimal, sanitizeAssetTag } from '../../routes/assets/_helpers.js';

export function normalizeCode(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeName(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized : null;
}

export function normalizeBoolean(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  return toBoolean(value, fallback ?? false);
}

export function normalizeInteger(value) {
  const parsed = toInteger(value, null);
  return parsed === null ? null : parsed;
}

export function normalizeDecimal(value) {
  const parsed = toDecimal(value, null);
  return parsed === null ? null : parsed;
}

export function normalizeJsonObject(value) {
  if (value === undefined || value === null || value === '') {
    return { value: null, error: null };
  }
  if (typeof value === 'object') {
    try {
      return { value: JSON.parse(JSON.stringify(value)), error: null };
    } catch (error) {
      return { value: null, error: 'Formato JSON inválido' };
    }
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return { value: parsed, error: null };
      }
      return { value: null, error: 'Formato JSON inválido' };
    } catch (error) {
      return { value: null, error: 'Formato JSON inválido' };
    }
  }
  return { value: null, error: 'Formato JSON inválido' };
}

export function normalizeAssetTag(value) {
  return sanitizeAssetTag(value);
}

export function normalizeEmail(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return { value: null, error: null };
  }
  if (!validateEmail(normalized)) {
    return { value: null, error: 'Correo electrónico inválido' };
  }
  return { value: normalized.toLowerCase(), error: null };
}
