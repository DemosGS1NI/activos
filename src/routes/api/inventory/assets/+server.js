import { success, badRequest, notFound } from "../../../../lib/response.js";
import { query } from "../../../../lib/db.js";
import { requirePermission } from "../../../../lib/rbac.js";
import { normalizeString, isUuid, toBoolean } from "../../../../lib/validators.js";
import {
  sanitizeAssetTag,
  serializeAsset,
  fetchAsset,
} from "../../../assets/_helpers.js";

const HISTORY_LIMIT = 5;

function serializeLocation(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    parent_id: row.parent_id || null,
  };
}

function serializeResponsible(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
  };
}

function serializeCondition(row) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    severity: row.severity === null ? null : Number(row.severity),
    description: row.description || null,
  };
}

function serializeCheck(row) {
  return {
    id: row.id,
    asset_id: row.asset_id,
    scanned_code: row.scanned_code || null,
    checked_at: row.checked_at instanceof Date ? row.checked_at.toISOString() : row.checked_at,
    checked_by: row.checked_by,
    checked_by_name: row.checked_by_name || null,
    condition: row.condition_id
      ? {
          id: row.condition_id,
          label: row.condition_label || null,
          severity: row.condition_severity === null ? null : Number(row.condition_severity),
        }
      : null,
    location: row.location_id
      ? {
          id: row.location_id,
          name: row.location_name || null,
          code: row.location_code || null,
        }
      : null,
    comment: row.comment || null,
    responsible_updated: Boolean(row.responsible_updated),
    previous_responsible: row.previous_responsible_id
      ? {
          id: row.previous_responsible_id,
          name: row.previous_responsible_name || null,
        }
      : null,
    new_responsible: row.new_responsible_id
      ? {
          id: row.new_responsible_id,
          name: row.new_responsible_name || null,
        }
      : null,
  };
}

async function findAssetIdByCode(code) {
  const sanitizedTag = sanitizeAssetTag(code);
  if (sanitizedTag) {
    const { rows } = await query`
      SELECT id FROM assets WHERE asset_tag = ${sanitizedTag} LIMIT 1
    `;
    if (rows.length) return rows[0].id;
  }

  if (isUuid(code)) {
    const { rows } = await query`
      SELECT id FROM assets WHERE id = ${code} LIMIT 1
    `;
    if (rows.length) return rows[0].id;
  }

  const altCandidate = normalizeString(code);
  if (altCandidate) {
    const { rows } = await query`
      SELECT id
      FROM assets
      WHERE alternative_number IS NOT NULL AND alternative_number <> ''
        AND UPPER(alternative_number) = UPPER(${altCandidate})
      LIMIT 1
    `;
    if (rows.length) return rows[0].id;
  }

  return null;
}

export async function GET(event) {
  await requirePermission(event, "inventory.check");

  const params = event.url.searchParams;
  const rawCode = normalizeString(params.get("code"));
  if (!rawCode) return badRequest("El parámetro 'code' es requerido");

  const assetId = await findAssetIdByCode(rawCode);
  if (!assetId) return notFound("Activo no encontrado");

  const assetRow = await fetchAsset(assetId);
  if (!assetRow) return notFound("Activo no encontrado");

  const includeHistory = toBoolean(params.get("includeHistory"), false);

  const [locationRes, conditionRes, responsibleRes] = await Promise.all([
    query`
      SELECT id, name, code, parent_id
      FROM locations
      ORDER BY name ASC
    `,
    query`
      SELECT id, slug, label, severity, description
      FROM inventory_conditions
      WHERE active = true
      ORDER BY severity ASC NULLS LAST, label ASC
    `,
    query`
      SELECT id, name, email, phone
      FROM responsibles
      ORDER BY name ASC
    `,
  ]);

  let recentChecks = [];
  if (includeHistory) {
    const { rows } = await query`
      SELECT ic.id,
             ic.asset_id,
             ic.scanned_code,
             ic.checked_at,
             ic.checked_by,
             u.name AS checked_by_name,
             ic.location_id,
             l.name AS location_name,
             l.code AS location_code,
             ic.condition_id,
             c.label AS condition_label,
             c.severity AS condition_severity,
             ic.comment,
             ic.responsible_updated,
             ic.previous_responsible_id,
             pr.name AS previous_responsible_name,
             ic.new_responsible_id,
             nr.name AS new_responsible_name
      FROM inventory_checks ic
      LEFT JOIN users u ON u.id = ic.checked_by
      LEFT JOIN locations l ON l.id = ic.location_id
      LEFT JOIN inventory_conditions c ON c.id = ic.condition_id
      LEFT JOIN responsibles pr ON pr.id = ic.previous_responsible_id
      LEFT JOIN responsibles nr ON nr.id = ic.new_responsible_id
      WHERE ic.asset_id = ${assetId}
      ORDER BY ic.checked_at DESC
      LIMIT ${HISTORY_LIMIT}
    `;
    recentChecks = rows.map(serializeCheck);
  }

  const data = {
    asset: serializeAsset(assetRow),
    locations: locationRes.rows.map(serializeLocation),
    conditions: conditionRes.rows.map(serializeCondition),
    responsibles: responsibleRes.rows.map(serializeResponsible),
  };

  if (includeHistory) {
    data.recentChecks = recentChecks;
  }

  return success(data);
}
