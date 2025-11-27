import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, sanitizeKey, isUuid } from "../../lib/validators.js";

function serializeLocation(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parent_id: row.parent_id,
    parent_name: row.parent_name || null,
    address_line: row.address_line || null,
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    postal_code: row.postal_code || null,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function toCoordinate(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw badRequest(`La coordenada ${label} es inválida`);
  }
  return num;
}

async function ensureParent(parentId) {
  if (!parentId) return { value: null };
  if (!isUuid(parentId)) {
    return { error: badRequest("La ubicación padre es inválida") };
  }
  const { rows } = await query`
    SELECT id FROM locations WHERE id = ${parentId} LIMIT 1
  `;
  if (!rows.length) {
    return { error: badRequest("La ubicación padre no existe") };
  }
  return { value: parentId };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { rows } = await query`
    SELECT l.id,
           l.code,
           l.name,
          l.parent_id,
           p.name AS parent_name,
           l.address_line,
           l.city,
           l.region,
           l.country,
           l.postal_code,
           l.latitude,
           l.longitude
    FROM locations l
    LEFT JOIN locations p ON p.id = l.parent_id
    ORDER BY l.name
  `;
  return success({ locations: rows.map(serializeLocation) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const code = sanitizeKey(payload?.code);
  if (!code) return badRequest("El código debe ser alfanumérico");

  const name = normalizeString(payload?.name);
  if (!name) return badRequest("El nombre es requerido");

  const parentValidation = await ensureParent(payload?.parent_id || null);
  if (parentValidation.error) return parentValidation.error;
  const parentId = parentValidation.value;

  let latitude;
  let longitude;
  try {
    latitude = toCoordinate(payload?.latitude, "latitud");
    longitude = toCoordinate(payload?.longitude, "longitud");
  } catch (err) {
    if (err?.status) return err;
    throw err;
  }

  const addressLine = normalizeString(payload?.address_line);
  const city = normalizeString(payload?.city);
  const region = normalizeString(payload?.region);
  const country = normalizeString(payload?.country);
  const postalCode = normalizeString(payload?.postal_code);

  try {
    const { rows } = await query`
      INSERT INTO locations (
        code,
        name,
        parent_id,
        address_line,
        city,
        region,
        country,
        postal_code,
        latitude,
        longitude
      )
      VALUES (
        ${code},
        ${name},
        ${parentId},
        ${addressLine},
        ${city},
        ${region},
        ${country},
        ${postalCode},
        ${latitude},
        ${longitude}
      )
      RETURNING id, code, name, parent_id, address_line, city, region, country, postal_code, latitude, longitude
    `;

    const created = rows[0];
    let parentName = null;
    if (created.parent_id) {
      const { rows: parentRows } = await query`
        SELECT name FROM locations WHERE id = ${created.parent_id} LIMIT 1
      `;
      parentName = parentRows[0]?.name || null;
    }

    return success(
      {
        location: serializeLocation({ ...created, parent_name: parentName }),
      },
      {},
      201
    );
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}
