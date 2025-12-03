import { success, badRequest, notFound } from "../../../../lib/response.js";
import { query } from "../../../../lib/db.js";
import { requirePermission } from "../../../../lib/rbac.js";
import { normalizeString, isUuid, toInteger } from "../../../../lib/validators.js";
import { fetchAsset, ensureExists } from "../../../assets/_helpers.js";

function sanitizeMetadata(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("El campo metadata debe ser un objeto");
  }
  return { ...value };
}

function normalizeScannedCode(value) {
  return normalizeString(value);
}

export async function POST(event) {
  const user = await requirePermission(event, "inventory.check");
  const userId = user?.id;
  if (!userId) return badRequest("Usuario inválido");

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Cuerpo JSON inválido");
  }

  const assetIdRaw = payload?.assetId ? String(payload.assetId) : null;
  if (!assetIdRaw || !isUuid(assetIdRaw)) return badRequest("assetId es requerido");

  const assetRow = await fetchAsset(assetIdRaw);
  if (!assetRow) return notFound("Activo no encontrado");

  const scannedCode = normalizeScannedCode(payload?.scannedCode);

  let locationId = assetRow.location_id || null;
  if (Object.prototype.hasOwnProperty.call(payload, "locationId")) {
    const candidate = payload.locationId;
    if (candidate === null || candidate === "") {
      locationId = null;
    } else {
      const value = String(candidate);
      if (!isUuid(value)) return badRequest("locationId inválido");
      await ensureExists("locations", value, "Ubicación no encontrada");
      locationId = value;
    }
  }

  let conditionId = null;
  if (Object.prototype.hasOwnProperty.call(payload, "conditionId")) {
    const candidate = payload.conditionId;
    if (candidate !== null && candidate !== "" && candidate !== undefined) {
      const parsed = toInteger(candidate, null);
      if (parsed === null) return badRequest("conditionId debe ser un entero");
      const { rows } = await query`
        SELECT id FROM inventory_conditions WHERE id = ${parsed} LIMIT 1
      `;
      if (!rows.length) return badRequest("Condición no encontrada");
      conditionId = parsed;
    }
  }

  let comment = null;
  if (Object.prototype.hasOwnProperty.call(payload, "comment")) {
    comment = normalizeString(payload.comment);
  }

  let newResponsibleId = assetRow.responsible_id || null;
  let previousResponsibleId = null;
  let responsibleUpdated = false;
  if (Object.prototype.hasOwnProperty.call(payload, "newResponsibleId")) {
    await requirePermission(event, "assets.update_responsible");
    const candidate = payload.newResponsibleId;
    if (candidate === null || candidate === "") {
      newResponsibleId = null;
    } else {
      const value = String(candidate);
      if (!isUuid(value)) return badRequest("newResponsibleId inválido");
      await ensureExists("responsibles", value, "Responsable no encontrado");
      newResponsibleId = value;
    }

    if (newResponsibleId !== assetRow.responsible_id) {
      previousResponsibleId = assetRow.responsible_id || null;
      responsibleUpdated = true;
    }
  }

  const metadata = sanitizeMetadata(payload?.metadata);
  const userAgent = event.request.headers.get("user-agent");
  if (userAgent && !metadata.userAgent) metadata.userAgent = userAgent;
  const ip = typeof event.getClientAddress === "function" ? event.getClientAddress() : null;
  if (ip && !metadata.clientIp) metadata.clientIp = ip;

  const now = new Date();

  await query`BEGIN`;
  try {
    if (responsibleUpdated || newResponsibleId !== assetRow.responsible_id || locationId !== assetRow.location_id) {
      await query`
        UPDATE assets
        SET location_id = ${locationId},
            responsible_id = ${newResponsibleId},
            updated_by = ${userId},
            updated_at = NOW()
        WHERE id = ${assetIdRaw}
      `;
    }

    const { rows } = await query`
      INSERT INTO inventory_checks (
        asset_id,
        scanned_code,
        checked_by,
        checked_at,
        location_id,
        condition_id,
        comment,
        previous_responsible_id,
        new_responsible_id,
        responsible_updated,
        metadata,
        created_at
      )
      VALUES (
        ${assetIdRaw},
        ${scannedCode},
        ${userId},
        ${now},
        ${locationId},
        ${conditionId},
        ${comment},
        ${previousResponsibleId},
        ${newResponsibleId},
        ${responsibleUpdated},
        ${metadata},
        ${now}
      )
      RETURNING id, checked_at, responsible_updated
    `;

    await query`COMMIT`;

    const inserted = rows[0];
    return success(
      {
        check: {
          id: inserted.id,
          checkedAt: inserted.checked_at instanceof Date ? inserted.checked_at.toISOString() : inserted.checked_at,
          responsibleUpdated: Boolean(inserted.responsible_updated),
        },
      },
      {},
      201
    );
  } catch (err) {
    await query`ROLLBACK`;
    throw err;
  }
}
