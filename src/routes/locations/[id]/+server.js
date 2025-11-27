import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, sanitizeKey } from "../../../lib/validators.js";

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

async function fetchLocation(id) {
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
    WHERE l.id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function validateParent(id, candidate) {
  if (!candidate) return { value: null };
  if (!isUuid(candidate)) {
    return { error: badRequest("La ubicación padre es inválida") };
  }
  if (candidate === id) {
    return { error: badRequest("La ubicación no puede ser su propio padre") };
  }
  const { rows } = await query`
    SELECT id FROM locations WHERE id = ${candidate} LIMIT 1
  `;
  if (!rows.length) {
    return { error: badRequest("La ubicación padre no existe") };
  }
  return { value: candidate };
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const location = await fetchLocation(id);
  if (!location) return notFound("Ubicación no encontrada");
  return success({ location: serializeLocation(location) });
}

export async function PATCH(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const codeProvided = payload?.code !== undefined;
  const nameProvided = payload?.name !== undefined;
  const parentProvided = payload?.parent_id !== undefined;
  const addressProvided = payload?.address_line !== undefined;
  const cityProvided = payload?.city !== undefined;
  const regionProvided = payload?.region !== undefined;
  const countryProvided = payload?.country !== undefined;
  const postalProvided = payload?.postal_code !== undefined;
  const latitudeProvided = payload?.latitude !== undefined;
  const longitudeProvided = payload?.longitude !== undefined;

  if (
    !codeProvided &&
    !nameProvided &&
    !parentProvided &&
    !addressProvided &&
    !cityProvided &&
    !regionProvided &&
    !countryProvided &&
    !postalProvided &&
    !latitudeProvided &&
    !longitudeProvided
  ) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchLocation(id);
  if (!current) return notFound("Ubicación no encontrada");

  let nextCode = current.code;
  if (codeProvided) {
    const sanitized = sanitizeKey(payload.code);
    if (!sanitized) return badRequest("El código debe ser alfanumérico");
    nextCode = sanitized;
  }

  let nextName = current.name;
  if (nameProvided) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre es requerido");
    nextName = normalized;
  }

  let nextParentId = current.parent_id;
  if (parentProvided) {
    if (!payload.parent_id) {
      nextParentId = null;
    } else {
      const validation = await validateParent(id, payload.parent_id);
      if (validation.error) return validation.error;
      nextParentId = validation.value;
    }
  }

  const nextAddress = addressProvided
    ? normalizeString(payload.address_line)
    : current.address_line;
  const nextCity = cityProvided ? normalizeString(payload.city) : current.city;
  const nextRegion = regionProvided
    ? normalizeString(payload.region)
    : current.region;
  const nextCountry = countryProvided
    ? normalizeString(payload.country)
    : current.country;
  const nextPostal = postalProvided
    ? normalizeString(payload.postal_code)
    : current.postal_code;

  let nextLatitude = current.latitude;
  let nextLongitude = current.longitude;
  try {
    if (latitudeProvided) {
      nextLatitude = toCoordinate(payload.latitude, "latitud");
    }
    if (longitudeProvided) {
      nextLongitude = toCoordinate(payload.longitude, "longitud");
    }
  } catch (err) {
    if (err?.status) return err;
    throw err;
  }

  try {
    const { rows } = await query`
      UPDATE locations
      SET code = ${nextCode},
          name = ${nextName},
          parent_id = ${nextParentId},
          address_line = ${nextAddress},
          city = ${nextCity},
          region = ${nextRegion},
          country = ${nextCountry},
          postal_code = ${nextPostal},
          latitude = ${nextLatitude},
          longitude = ${nextLongitude},
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, name, parent_id, address_line, city, region, country, postal_code, latitude, longitude
    `;
    if (!rows.length) return notFound("Ubicación no encontrada");

    const updated = rows[0];
    let parentName = null;
    if (updated.parent_id) {
      const { rows: parentRows } = await query`
        SELECT name FROM locations WHERE id = ${updated.parent_id} LIMIT 1
      `;
      parentName = parentRows[0]?.name || null;
    }

    return success({
      location: serializeLocation({ ...updated, parent_name: parentName }),
    });
  } catch (err) {
    if (err?.code === "23505") {
      return badRequest("El código ya existe");
    }
    throw err;
  }
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const { rows } = await query`
    DELETE FROM locations
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Ubicación no encontrada");
  return success({ deleted: rows[0].id });
}
