import { success, badRequest } from "../../../../lib/response.js";
import { query } from "../../../../lib/db.js";
import { requirePermission, requireRole } from "../../../../lib/rbac.js";
import { normalizeString, toBoolean } from "../../../../lib/validators.js";
import {
  sanitizeCampaignName,
  sanitizeCampaignStatus,
  sanitizeScopeFilters,
  sanitizeMetadata,
  serializeCampaign,
  CAMPAIGN_STATUSES,
  parseDate,
} from "./_helpers.js";

export async function GET(event) {
  await requirePermission(event, ["inventory.check", "inventory_campaigns"]);
  const params = event.url.searchParams;
  const statusFilters = params.getAll("status").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const uniqueStatuses = [...new Set(statusFilters)].filter((value) => CAMPAIGN_STATUSES.includes(value));
  const activeOnly = toBoolean(params.get("activeOnly"), false);
  const includeScheduled = toBoolean(params.get("includeScheduled"), true);

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
    ORDER BY created_at DESC
  `;

  const now = new Date();
  let campaigns = rows.map((row) => serializeCampaign(row, { now }));

  if (uniqueStatuses.length) {
    const set = new Set(uniqueStatuses);
    campaigns = campaigns.filter((campaign) => set.has(campaign.status));
  }

  if (activeOnly) {
    campaigns = campaigns.filter((campaign) => campaign.isActive);
  } else if (!includeScheduled) {
    campaigns = campaigns.filter((campaign) => !campaign.isScheduled);
  }

  return success({ campaigns });
}

export async function POST(event) {
  await requireRole(event, "admin");
  const userId = event?.locals?.user?.id || null;

  let payload;
  try {
    payload = await event.request.json();
  } catch (_) {
    return badRequest("Cuerpo JSON inválido");
  }

  const name = sanitizeCampaignName(payload?.name);
  const description = normalizeString(payload?.description);
  const status = sanitizeCampaignStatus(payload?.status, { fallback: "draft" });
  const scopeFilters = sanitizeScopeFilters(payload?.scopeFilters ?? payload?.scope_filters);
  const metadata = sanitizeMetadata(payload?.metadata);
  const startsAt = parseDate(payload?.startsAt ?? payload?.starts_at, "starts_at");
  const endsAt = parseDate(payload?.endsAt ?? payload?.ends_at, "ends_at");

  if (startsAt && endsAt && new Date(startsAt) > new Date(endsAt)) {
    return badRequest("La fecha de inicio no puede ser posterior a la fecha de finalización");
  }

  const now = new Date();

  const { rows } = await query`
    INSERT INTO inventory_campaigns (
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
      updated_at
    )
    VALUES (
      ${name},
      ${description},
      ${status},
      ${scopeFilters},
      ${startsAt},
      ${endsAt},
      ${metadata ?? {}},
      ${null},
      ${userId},
      ${userId},
      ${now},
      ${now}
    )
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

  const campaign = serializeCampaign(rows[0], { now });
  return success({ campaign }, {}, 201);
}
