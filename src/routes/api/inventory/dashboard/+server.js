import { success } from "../../../../lib/response.js";
import { query } from "../../../../lib/db.js";
import { requirePermission } from "../../../../lib/rbac.js";
import { isUuid } from "../../../../lib/validators.js";

const DETAIL_LIMIT = 200;

function normalizeUuidArray(value) {
  if (!Array.isArray(value)) return null;
  const result = value
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter((item) => typeof item === "string" && isUuid(item));
  return result.length ? result : null;
}

function pickScopeArray(scope, key) {
  if (!scope || typeof scope !== "object") return null;
  return (scope[key] && normalizeUuidArray(scope[key])) || null;
}

function computePercentage(count, total) {
  if (!total || total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

export async function GET(event) {
  await requirePermission(event, ["inventory.check", "inventory_dashboard"]);

  const params = event.url.searchParams;
  const requestedCampaignId = params.get("campaignId");
  const requestedId = requestedCampaignId && isUuid(requestedCampaignId) ? requestedCampaignId : null;

  const { rows: campaignRows } = await query`
    SELECT id, name, status, scope_filters, starts_at, ends_at
    FROM inventory_campaigns
    WHERE archived_at IS NULL
    ORDER BY (status = 'active') DESC, (status = 'scheduled') DESC, created_at DESC
  `;

  const campaigns = campaignRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at instanceof Date ? row.starts_at.toISOString() : row.starts_at,
    endsAt: row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at,
  }));

  const selectedRow =
    campaignRows.find((row) => row.id === requestedId) ??
    campaignRows.find((row) => row.status === "active") ??
    campaignRows[0] ??
    null;

  if (!selectedRow) {
    return success({
      campaigns,
      selectedCampaignId: null,
      totals: {
        totalAssets: 0,
        checkedAssets: 0,
        pendingAssets: 0,
        progressPercent: 0,
      },
      conditionBreakdown: [],
      takerBreakdown: [],
      assets: [],
      assetsLimit: DETAIL_LIMIT,
      assetsTruncated: false,
    });
  }

  const selectedCampaignId = selectedRow.id;
  const scope = selectedRow.scope_filters || {};
  const locationIds = pickScopeArray(scope, "locations");
  const categoryIds = pickScopeArray(scope, "assetCategories") || pickScopeArray(scope, "asset_categories");
  const responsibleIds = pickScopeArray(scope, "responsibles");

  const totalRes = await query`
    SELECT COUNT(*)::int AS total
    FROM assets a
    WHERE (${locationIds}::uuid[] IS NULL OR a.location_id = ANY(${locationIds}))
      AND (${categoryIds}::uuid[] IS NULL OR a.asset_category_id = ANY(${categoryIds}))
      AND (${responsibleIds}::uuid[] IS NULL OR a.responsible_id = ANY(${responsibleIds}))
  `;
  const totalAssets = totalRes.rows?.[0]?.total ?? 0;

  const checkedRes = await query`
    SELECT COUNT(DISTINCT ic.asset_id)::int AS count
    FROM inventory_checks ic
    JOIN assets a ON a.id = ic.asset_id
    WHERE ic.campaign_id = ${selectedCampaignId}
      AND (${locationIds}::uuid[] IS NULL OR a.location_id = ANY(${locationIds}))
      AND (${categoryIds}::uuid[] IS NULL OR a.asset_category_id = ANY(${categoryIds}))
      AND (${responsibleIds}::uuid[] IS NULL OR a.responsible_id = ANY(${responsibleIds}))
  `;
  const checkedAssets = checkedRes.rows?.[0]?.count ?? 0;
  const pendingAssets = Math.max(totalAssets - checkedAssets, 0);
  const progressPercent = computePercentage(checkedAssets, totalAssets);

  const conditionRes = await query`
    WITH filtered_checks AS (
      SELECT
        ic.asset_id,
        ic.condition_id,
        ROW_NUMBER() OVER (PARTITION BY ic.asset_id ORDER BY ic.checked_at DESC) AS row_num
      FROM inventory_checks ic
      JOIN assets a ON a.id = ic.asset_id
      WHERE ic.campaign_id = ${selectedCampaignId}
        AND (${locationIds}::uuid[] IS NULL OR a.location_id = ANY(${locationIds}))
        AND (${categoryIds}::uuid[] IS NULL OR a.asset_category_id = ANY(${categoryIds}))
        AND (${responsibleIds}::uuid[] IS NULL OR a.responsible_id = ANY(${responsibleIds}))
    )
    SELECT
      COALESCE(c.id, 0) AS condition_id,
      COALESCE(c.label, 'Sin condición') AS label,
      COALESCE(c.slug, 'sin-condicion') AS slug,
      COUNT(*)::int AS count
    FROM filtered_checks fc
    LEFT JOIN inventory_conditions c ON c.id = fc.condition_id
    WHERE fc.row_num = 1
    GROUP BY c.id, c.label, c.slug
    ORDER BY count DESC, label ASC
  `;

  const conditionBreakdown = conditionRes.rows.map((row) => ({
    conditionId: row.condition_id === 0 ? null : row.condition_id,
    label: row.label,
    slug: row.slug,
    count: row.count,
  }));
  const totalCondition = conditionBreakdown.reduce((sum, item) => sum + item.count, 0);
  for (const item of conditionBreakdown) {
    item.percentage = computePercentage(item.count, totalCondition);
  }

  const takerRes = await query`
    WITH filtered_checks AS (
      SELECT
        ic.asset_id,
        ic.checked_by,
        ROW_NUMBER() OVER (PARTITION BY ic.asset_id ORDER BY ic.checked_at DESC) AS row_num
      FROM inventory_checks ic
      JOIN assets a ON a.id = ic.asset_id
      WHERE ic.campaign_id = ${selectedCampaignId}
        AND (${locationIds}::uuid[] IS NULL OR a.location_id = ANY(${locationIds}))
        AND (${categoryIds}::uuid[] IS NULL OR a.asset_category_id = ANY(${categoryIds}))
        AND (${responsibleIds}::uuid[] IS NULL OR a.responsible_id = ANY(${responsibleIds}))
    )
    SELECT
      fc.checked_by AS user_id,
      COALESCE(u.name, 'Inventarista sin nombre') AS name,
      COUNT(*)::int AS count
    FROM filtered_checks fc
    LEFT JOIN users u ON u.id = fc.checked_by
    WHERE fc.row_num = 1
    GROUP BY fc.checked_by, u.name
    ORDER BY count DESC, name ASC
  `;

  const takerBreakdown = takerRes.rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    count: row.count,
    percentage: computePercentage(row.count, checkedAssets),
  }));

  const detailRes = await query`
    WITH filtered_checks AS (
      SELECT
        ic.asset_id,
        ic.checked_at,
        ic.checked_by,
        ic.condition_id,
        ic.comment,
        ROW_NUMBER() OVER (PARTITION BY ic.asset_id ORDER BY ic.checked_at DESC) AS row_num
      FROM inventory_checks ic
      JOIN assets a ON a.id = ic.asset_id
      WHERE ic.campaign_id = ${selectedCampaignId}
        AND (${locationIds}::uuid[] IS NULL OR a.location_id = ANY(${locationIds}))
        AND (${categoryIds}::uuid[] IS NULL OR a.asset_category_id = ANY(${categoryIds}))
        AND (${responsibleIds}::uuid[] IS NULL OR a.responsible_id = ANY(${responsibleIds}))
    ),
    latest_checks AS (
      SELECT *
      FROM filtered_checks
      WHERE row_num = 1
      ORDER BY checked_at DESC
      LIMIT ${DETAIL_LIMIT}
    )
    SELECT
      lc.asset_id,
      lc.checked_at,
      lc.checked_by,
      lc.condition_id,
      lc.comment,
      a.asset_tag,
      a.name AS asset_name,
      l.id AS location_id,
      l.name AS location_name,
      l.code AS location_code,
      r.id AS responsible_id,
      r.name AS responsible_name,
      u.name AS checked_by_name,
      c.label AS condition_label,
      c.slug AS condition_slug
    FROM latest_checks lc
    JOIN assets a ON a.id = lc.asset_id
    LEFT JOIN locations l ON l.id = a.location_id
    LEFT JOIN responsibles r ON r.id = a.responsible_id
    LEFT JOIN users u ON u.id = lc.checked_by
    LEFT JOIN inventory_conditions c ON c.id = lc.condition_id
    ORDER BY lc.checked_at DESC
  `;

  const assets = detailRes.rows.map((row) => ({
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    assetName: row.asset_name,
    checkedAt: row.checked_at instanceof Date ? row.checked_at.toISOString() : row.checked_at,
    checkedById: row.checked_by,
    checkedByName: row.checked_by_name || null,
    conditionId: row.condition_id,
    conditionLabel: row.condition_label || "Sin condición",
    conditionSlug: row.condition_slug || "sin-condicion",
    comment: row.comment || null,
    location: row.location_id
      ? {
          id: row.location_id,
          name: row.location_name || null,
          code: row.location_code || null,
        }
      : null,
    responsible: row.responsible_id
      ? {
          id: row.responsible_id,
          name: row.responsible_name || null,
        }
      : null,
  }));

  const response = {
    campaigns,
    selectedCampaignId,
    totals: {
      totalAssets,
      checkedAssets,
      pendingAssets,
      progressPercent,
    },
    conditionBreakdown,
    takerBreakdown,
    assets,
    assetsLimit: DETAIL_LIMIT,
    assetsTruncated: checkedAssets > assets.length,
  };

  return success(response);
}
