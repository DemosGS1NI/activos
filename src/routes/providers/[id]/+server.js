import { success, badRequest, notFound } from "../../../lib/response.js";
import { query } from "../../../lib/db.js";
import { requireRole } from "../../../lib/rbac.js";
import { isUuid, normalizeString, validateEmail } from "../../../lib/validators.js";

function serializeProvider(row) {
  return {
    id: row.id,
    name: row.name,
    contact_email: row.contact_email || null,
    contact_phone: row.contact_phone || null,
    tax_id: row.tax_id || null,
    address_line: row.address_line || null,
    city: row.city || null,
    region: row.region || null,
    country: row.country || null,
    postal_code: row.postal_code || null,
  };
}

async function fetchProvider(id) {
  const { rows } = await query`
    SELECT id,
           name,
           contact_email,
           contact_phone,
           tax_id,
           address_line,
           city,
           region,
           country,
           postal_code
    FROM providers
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

function optionalString(value) {
  const normalized = normalizeString(value);
  return normalized && normalized.length ? normalized : null;
}

export async function GET(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const provider = await fetchProvider(id);
  if (!provider) return notFound("Proveedor no encontrado");
  return success({ provider: serializeProvider(provider) });
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

  const nameProvided = payload?.name !== undefined;
  const emailProvided = payload?.contact_email !== undefined;
  const phoneProvided = payload?.contact_phone !== undefined;
  const taxProvided = payload?.tax_id !== undefined;
  const addressProvided = payload?.address_line !== undefined;
  const cityProvided = payload?.city !== undefined;
  const regionProvided = payload?.region !== undefined;
  const countryProvided = payload?.country !== undefined;
  const postalProvided = payload?.postal_code !== undefined;

  if (
    !nameProvided &&
    !emailProvided &&
    !phoneProvided &&
    !taxProvided &&
    !addressProvided &&
    !cityProvided &&
    !regionProvided &&
    !countryProvided &&
    !postalProvided
  ) {
    return badRequest("Nada que actualizar");
  }

  const current = await fetchProvider(id);
  if (!current) return notFound("Proveedor no encontrado");

  let nextName = current.name;
  if (nameProvided) {
    const normalized = normalizeString(payload.name);
    if (!normalized) return badRequest("El nombre es requerido");
    nextName = normalized;
  }

  let nextEmail = current.contact_email;
  if (emailProvided) {
    const normalized = optionalString(payload.contact_email);
    if (normalized && !validateEmail(normalized)) {
      return badRequest("El correo del contacto es inválido");
    }
    nextEmail = normalized;
  }

  const nextPhone = phoneProvided
    ? optionalString(payload.contact_phone)
    : current.contact_phone;
  const nextTax = taxProvided ? optionalString(payload.tax_id) : current.tax_id;
  const nextAddress = addressProvided
    ? optionalString(payload.address_line)
    : current.address_line;
  const nextCity = cityProvided ? optionalString(payload.city) : current.city;
  const nextRegion = regionProvided
    ? optionalString(payload.region)
    : current.region;
  const nextCountry = countryProvided
    ? optionalString(payload.country)
    : current.country;
  const nextPostal = postalProvided
    ? optionalString(payload.postal_code)
    : current.postal_code;

  const { rows } = await query`
    UPDATE providers
    SET name = ${nextName},
        contact_email = ${nextEmail},
        contact_phone = ${nextPhone},
        tax_id = ${nextTax},
        address_line = ${nextAddress},
        city = ${nextCity},
        region = ${nextRegion},
        country = ${nextCountry},
        postal_code = ${nextPostal},
        updated_at = now()
    WHERE id = ${id}
    RETURNING id, name, contact_email, contact_phone, tax_id, address_line, city, region, country, postal_code
  `;

  if (!rows.length) return notFound("Proveedor no encontrado");
  return success({ provider: serializeProvider(rows[0]) });
}

export async function DELETE(event) {
  await requireRole(event, "admin");
  const { id } = event.params;
  if (!isUuid(id)) return badRequest("ID inválido");

  const { rows } = await query`
    DELETE FROM providers
    WHERE id = ${id}
    RETURNING id
  `;
  if (!rows.length) return notFound("Proveedor no encontrado");
  return success({ deleted: rows[0].id });
}
