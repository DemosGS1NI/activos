import { success, badRequest } from "../../lib/response.js";
import { query } from "../../lib/db.js";
import { requireRole } from "../../lib/rbac.js";
import { normalizeString, validateEmail } from "../../lib/validators.js";

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

function optionalString(value) {
  const normalized = normalizeString(value);
  return normalized && normalized.length ? normalized : null;
}

export async function GET(event) {
  await requireRole(event, "admin");
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
    ORDER BY name
  `;
  return success({ providers: rows.map(serializeProvider) });
}

export async function POST(event) {
  await requireRole(event, "admin");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Invalid JSON body");
  }

  const name = normalizeString(payload?.name);
  if (!name) return badRequest("El nombre es requerido");

  const contactEmail = optionalString(payload?.contact_email);
  if (contactEmail && !validateEmail(contactEmail)) {
    return badRequest("El correo del contacto es inválido");
  }

  const contactPhone = optionalString(payload?.contact_phone);
  const taxId = optionalString(payload?.tax_id);
  const addressLine = optionalString(payload?.address_line);
  const city = optionalString(payload?.city);
  const region = optionalString(payload?.region);
  const country = optionalString(payload?.country);
  const postalCode = optionalString(payload?.postal_code);

  const { rows } = await query`
    INSERT INTO providers (
      name,
      contact_email,
      contact_phone,
      tax_id,
      address_line,
      city,
      region,
      country,
      postal_code
    )
    VALUES (
      ${name},
      ${contactEmail},
      ${contactPhone},
      ${taxId},
      ${addressLine},
      ${city},
      ${region},
      ${country},
      ${postalCode}
    )
    RETURNING id, name, contact_email, contact_phone, tax_id, address_line, city, region, country, postal_code
  `;

  return success({ provider: serializeProvider(rows[0]) }, {}, 201);
}
