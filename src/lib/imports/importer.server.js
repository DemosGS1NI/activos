import { extractSheet, readWorkbook } from './workbook.js';
import {
  ASSET_IMPORT_TEMPLATE_VERSION,
  MAX_ASSET_ROWS,
  SHEET_DEFINITIONS,
  SHEET_SEQUENCE,
  createBatchId
} from './constants.js';
import { ImportFailure } from './errors.js';
import {
  normalizeAssetTag,
  normalizeBoolean,
  normalizeCode,
  normalizeDecimal,
  normalizeEmail,
  normalizeInteger,
  normalizeJsonObject,
  normalizeName
} from './sanitize.js';
import { query, withTransaction } from '../db.js';
import { normalizeString } from '../validators.js';

const isBlank = (value) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

const NATURAL_KEY_NORMALIZERS = {
  asset_categories: (row) => normalizeCode(row.code),
  asset_statuses: (row) => normalizeCode(row.code),
  depreciation_methods: (row) => normalizeCode(row.code),
  document_types: (row) => normalizeCode(row.code),
  departments: (row) => normalizeCode(row.code),
  cost_centers: (row) => normalizeCode(row.code),
  locations: (row) => normalizeCode(row.code),
  responsibles: (row) => {
    const name = normalizeName(row.name);
    return name ? name.toLowerCase() : null;
  },
  providers: (row) => {
    const name = normalizeName(row.name);
    return name ? name.toLowerCase() : null;
  },
  assets: (row) => normalizeAssetTag(row.asset_tag)
};

async function loadExistingLookups() {
  const results = await Promise.all([
    query`SELECT id, code, name, default_depreciation_method_id, default_lifespan_months FROM asset_categories`,
    query`SELECT id, code, name, is_active FROM asset_statuses`,
    query`SELECT id, code, name FROM depreciation_methods`,
    query`SELECT id, code, name FROM document_types`,
    query`SELECT id, code, name, parent_id FROM departments`,
    query`SELECT id, code, name, department_id FROM cost_centers`,
    query`SELECT id, code, name, parent_id FROM locations`,
    query`SELECT id, name, email, department_id FROM responsibles`,
    query`SELECT id, name, contact_email, contact_phone FROM providers`,
    query`SELECT id, asset_tag FROM assets`
  ]);

  const [categories, statuses, methods, docs, departments, costCenters, locations, responsibles, providers, assets] = results.map(({ rows }) => rows);

  return {
    asset_categories: buildCodeMap(categories),
    asset_statuses: buildCodeMap(statuses),
    depreciation_methods: buildCodeMap(methods),
    document_types: buildCodeMap(docs),
    departments: buildCodeMap(departments),
    cost_centers: buildCodeMap(costCenters),
    locations: buildCodeMap(locations),
    responsibles: buildNameMap(responsibles),
    providers: buildNameMap(providers),
    assets: buildAssetTagMap(assets)
  };
}

function buildCodeMap(rows) {
  const byCode = new Map();
  rows.forEach((row) => {
    const code = row.code ? String(row.code).trim().toUpperCase() : null;
    if (!code) return;
    byCode.set(code, row);
  });
  return { byKey: byCode };
}

function buildNameMap(rows) {
  const byName = new Map();
  rows.forEach((row) => {
    const key = row.name ? String(row.name).trim().toLowerCase() : null;
    if (!key) return;
    byName.set(key, row);
  });
  return { byKey: byName };
}

function buildAssetTagMap(rows) {
  const byTag = new Map();
  rows.forEach((row) => {
    const tag = normalizeAssetTag(row.asset_tag);
    if (!tag) return;
    byTag.set(tag, row);
  });
  return { byKey: byTag };
}

function getLookupBucket(context, sheetName) {
  return context.lookups[sheetName] || null;
}

function ensureLookupBucket(context, sheetName) {
  const existing = context.lookups[sheetName];
  if (existing) return existing;
  const bucket = { byKey: new Map() };
  context.lookups[sheetName] = bucket;
  return bucket;
}

function registerLookupRecord(context, sheetName, record) {
  const normalizer = NATURAL_KEY_NORMALIZERS[sheetName];
  if (!normalizer) return;
  const key = normalizer(record);
  if (!key) return;
  const bucket = ensureLookupBucket(context, sheetName);
  bucket.byKey.set(key, record);
}

function getLookupRecord(context, sheetName, key) {
  if (!key) return null;
  const bucket = getLookupBucket(context, sheetName);
  if (!bucket) return null;
  return bucket.byKey.get(key) ?? null;
}

function getLookupId(context, sheetName, key) {
  const record = getLookupRecord(context, sheetName, key);
  return record?.id ?? null;
}

function ensureMandatoryColumns(definition, headers, sheetName) {
  const presentKeys = new Set(headers.map((header) => header.key).filter(Boolean));
  const missing = definition.mandatoryColumns.filter((column) => !presentKeys.has(column));
  if (missing.length) {
    throw new ImportFailure(
      `La hoja "${sheetName}" no incluye las columnas obligatorias: ${missing.join(', ')}`
    );
  }
  return presentKeys;
}

function registerPending(context, sheetName, key, data) {
  if (!key) return;
  if (!context.pending[sheetName]) {
    context.pending[sheetName] = new Map();
  }
  context.pending[sheetName].set(key, data);
}

function findExisting(context, sheetName, key) {
  if (!key) return null;
  const pending = context.pending[sheetName]?.get(key);
  if (pending) {
    return { source: 'import', record: pending };
  }
  const lookup = context.lookups[sheetName]?.byKey?.get(key) ?? null;
  if (lookup) {
    return { source: 'database', record: lookup };
  }
  return null;
}

function processAssetCategories(row, context) {
  const errors = [];
  const warnings = [];

  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');

  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');

  const description = normalizeString(row.description) ?? null;

  let defaultDepMethodCode = null;
  if (!isBlank(row.default_depreciation_method_code)) {
    defaultDepMethodCode = normalizeCode(row.default_depreciation_method_code);
    if (!defaultDepMethodCode) {
      errors.push('El campo default_depreciation_method_code es inválido.');
    } else {
      const reference = findExisting(context, 'depreciation_methods', defaultDepMethodCode);
      if (!reference) {
        errors.push(`El método de depreciación ${defaultDepMethodCode} no existe.`);
      }
    }
  }

  let defaultLifespanMonths = null;
  if (!isBlank(row.default_lifespan_months)) {
    const parsed = normalizeInteger(row.default_lifespan_months);
    if (parsed === null || parsed <= 0) {
      errors.push('El campo default_lifespan_months debe ser un entero positivo.');
    } else {
      defaultLifespanMonths = parsed;
    }
  }

  return {
    errors,
    warnings,
    data: {
      code,
      name,
      description,
      default_depreciation_method_code: defaultDepMethodCode,
      default_lifespan_months: defaultLifespanMonths
    }
  };
}

function processAssetStatuses(row) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  let isActive = true;
  if (!isBlank(row.is_active)) {
    const parsed = normalizeBoolean(row.is_active, null);
    if (parsed === null) {
      errors.push('El campo is_active es inválido.');
    } else {
      isActive = parsed;
    }
  }
  return {
    errors,
    warnings,
    data: {
      code,
      name,
      is_active: isActive
    }
  };
}

function processDepreciationMethods(row) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  const description = normalizeString(row.description) ?? null;
  const formulaNotes = normalizeString(row.formula_notes) ?? null;
  const defaultPeriod = normalizeString(row.default_period) ?? null;
  return {
    errors,
    warnings,
    data: {
      code,
      name,
      description,
      formula_notes: formulaNotes,
      default_period: defaultPeriod
    }
  };
}

function processDocumentTypes(row) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  const description = normalizeString(row.description) ?? null;
  return {
    errors,
    warnings,
    data: { code, name, description }
  };
}

function processDepartments(row, context) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');

  let parentCode = null;
  if (!isBlank(row.parent_code)) {
    parentCode = normalizeCode(row.parent_code);
    if (!parentCode) {
      errors.push('El campo parent_code es inválido.');
    } else if (!findExisting(context, 'departments', parentCode)) {
      warnings.push(`El departamento padre ${parentCode} no existe.`);
    }
  }

  return {
    errors,
    warnings,
    data: {
      code,
      name,
      parent_code: parentCode
    }
  };
}

function processCostCenters(row, context) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');

  let departmentCode = null;
  if (!isBlank(row.department_code)) {
    departmentCode = normalizeCode(row.department_code);
    if (!departmentCode) {
      errors.push('El campo department_code es inválido.');
    } else if (!findExisting(context, 'departments', departmentCode)) {
      errors.push(`El departamento ${departmentCode} no existe.`);
    }
  }

  return {
    errors,
    warnings,
    data: {
      code,
      name,
      department_code: departmentCode
    }
  };
}

function processLocations(row, context) {
  const errors = [];
  const warnings = [];
  const code = normalizeCode(row.code);
  if (!code) errors.push('El campo code es obligatorio.');
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');

  let parentCode = null;
  if (!isBlank(row.parent_code)) {
    parentCode = normalizeCode(row.parent_code);
    if (!parentCode) {
      errors.push('El campo parent_code es inválido.');
    } else if (!findExisting(context, 'locations', parentCode)) {
      warnings.push(`La ubicación padre ${parentCode} no existe.`);
    }
  }

  const addressLine = normalizeString(row.address_line) ?? null;
  const city = normalizeString(row.city) ?? null;
  const region = normalizeString(row.region) ?? null;
  const country = normalizeString(row.country) ?? null;
  const postalCode = normalizeString(row.postal_code) ?? null;

  let latitude = null;
  if (!isBlank(row.latitude)) {
    const parsed = normalizeDecimal(row.latitude);
    if (parsed === null) {
      errors.push('El campo latitude es inválido.');
    } else {
      latitude = parsed;
    }
  }

  let longitude = null;
  if (!isBlank(row.longitude)) {
    const parsed = normalizeDecimal(row.longitude);
    if (parsed === null) {
      errors.push('El campo longitude es inválido.');
    } else {
      longitude = parsed;
    }
  }

  return {
    errors,
    warnings,
    data: {
      code,
      name,
      parent_code: parentCode,
      address_line: addressLine,
      city,
      region,
      country,
      postal_code: postalCode,
      latitude,
      longitude
    }
  };
}

function processResponsibles(row, context) {
  const errors = [];
  const warnings = [];
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  const normalizedName = name ? name.toLowerCase() : null;

  let email = null;
  if (!isBlank(row.email)) {
    const { value, error } = normalizeEmail(row.email);
    if (error) {
      errors.push(error);
    } else {
      email = value ?? null;
    }
  }

  const phone = normalizeString(row.phone) ?? null;

  let departmentCode = null;
  if (!isBlank(row.department_code)) {
    departmentCode = normalizeCode(row.department_code);
    if (!departmentCode) {
      errors.push('El campo department_code es inválido.');
    } else if (!findExisting(context, 'departments', departmentCode)) {
      errors.push(`El departamento ${departmentCode} no existe.`);
    }
  }

  return {
    errors,
    warnings,
    data: {
      name,
      normalized_name: normalizedName,
      email,
      phone,
      department_code: departmentCode
    }
  };
}

function processProviders(row) {
  const errors = [];
  const warnings = [];
  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  const normalizedName = name ? name.toLowerCase() : null;
  let contactEmail = null;
  if (!isBlank(row.contact_email)) {
    const { value, error } = normalizeEmail(row.contact_email);
    if (error) {
      errors.push(error);
    } else {
      contactEmail = value ?? null;
    }
  }
  const contactPhone = normalizeString(row.contact_phone) ?? null;
  const taxId = normalizeString(row.tax_id) ?? null;
  const addressLine = normalizeString(row.address_line) ?? null;
  const city = normalizeString(row.city) ?? null;
  const region = normalizeString(row.region) ?? null;
  const country = normalizeString(row.country) ?? null;
  const postalCode = normalizeString(row.postal_code) ?? null;

  return {
    errors,
    warnings,
    data: {
      name,
      normalized_name: normalizedName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      tax_id: taxId,
      address_line: addressLine,
      city,
      region,
      country,
      postal_code: postalCode
    }
  };
}

function processAssets(row, context) {
  const errors = [];
  const warnings = [];
  const data = {};

  const assetTag = normalizeAssetTag(row.asset_tag);
  if (!assetTag) errors.push('El campo asset_tag es obligatorio.');
  data.asset_tag = assetTag;

  const name = normalizeName(row.name);
  if (!name) errors.push('El campo name es obligatorio.');
  data.name = name;

  data.description = normalizeString(row.description) ?? null;
  data.alternative_number = normalizeString(row.alternative_number) ?? null;

  if (!isBlank(row.parent_asset_tag)) {
    const parentTag = normalizeAssetTag(row.parent_asset_tag);
    if (!parentTag) {
      errors.push('El campo parent_asset_tag es inválido.');
    } else {
      const reference = findExisting(context, 'assets', parentTag);
      if (!reference) {
        warnings.push(`El activo padre ${parentTag} no existe todavía.`);
      }
      data.parent_asset_tag = parentTag;
    }
  }

  const categoryCode = normalizeCode(row.asset_category_code);
  if (!categoryCode) {
    errors.push('El campo asset_category_code es obligatorio.');
  } else if (!findExisting(context, 'asset_categories', categoryCode)) {
    errors.push(`La categoría ${categoryCode} no existe.`);
  }
  data.asset_category_code = categoryCode;

  const statusCode = normalizeCode(row.asset_status_code);
  if (!statusCode) {
    errors.push('El campo asset_status_code es obligatorio.');
  } else if (!findExisting(context, 'asset_statuses', statusCode)) {
    errors.push(`El estado ${statusCode} no existe.`);
  }
  data.asset_status_code = statusCode;

  if (!isBlank(row.depreciation_method_code)) {
    const depCode = normalizeCode(row.depreciation_method_code);
    if (!depCode) {
      errors.push('El campo depreciation_method_code es inválido.');
    } else if (!findExisting(context, 'depreciation_methods', depCode)) {
      errors.push(`El método de depreciación ${depCode} no existe.`);
    }
    data.depreciation_method_code = depCode;
  } else {
    data.depreciation_method_code = null;
  }

  if (!isBlank(row.lifespan_months)) {
    const lifespan = normalizeInteger(row.lifespan_months);
    if (lifespan === null || lifespan <= 0) {
      errors.push('El campo lifespan_months debe ser un entero positivo.');
    } else {
      data.lifespan_months = lifespan;
    }
  } else {
    data.lifespan_months = null;
  }

  data.depreciation_period = normalizeString(row.depreciation_period) ?? null;

  const decimalFields = [
    'initial_cost',
    'actual_cost',
    'residual_value',
    'actual_book_value',
    'cumulative_depreciation_value'
  ];

  decimalFields.forEach((field) => {
    if (isBlank(row[field])) {
      data[field] = null;
      return;
    }
    const parsed = normalizeDecimal(row[field]);
    if (parsed === null) {
      errors.push(`El campo ${field} es inválido.`);
    } else {
      data[field] = parsed;
    }
  });

  data.purchase_order_number = normalizeString(row.purchase_order_number) ?? null;
  data.transaction_number = normalizeString(row.transaction_number) ?? null;

  const providerName = normalizeName(row.provider_name);
  if (providerName) {
    const reference = findExisting(context, 'providers', providerName.toLowerCase());
    if (!reference) {
      warnings.push(`El proveedor ${providerName} no existe.`);
    }
    data.provider_name = providerName;
  } else {
    data.provider_name = null;
  }

  const departmentCode = normalizeCode(row.department_code);
  if (departmentCode) {
    if (!findExisting(context, 'departments', departmentCode)) {
      warnings.push(`El departamento ${departmentCode} no existe.`);
    }
  }
  data.department_code = departmentCode ?? null;

  const costCenterCode = normalizeCode(row.cost_center_code);
  if (costCenterCode) {
    if (!findExisting(context, 'cost_centers', costCenterCode)) {
      warnings.push(`El centro de costo ${costCenterCode} no existe.`);
    }
  }
  data.cost_center_code = costCenterCode ?? null;

  const locationCode = normalizeCode(row.location_code);
  if (locationCode) {
    if (!findExisting(context, 'locations', locationCode)) {
      warnings.push(`La ubicación ${locationCode} no existe.`);
    }
  }
  data.location_code = locationCode ?? null;

  const responsibleName = normalizeName(row.responsible_name);
  if (responsibleName) {
    if (!findExisting(context, 'responsibles', responsibleName.toLowerCase())) {
      warnings.push(`El responsable ${responsibleName} no existe.`);
    }
  }
  data.responsible_name = responsibleName ?? null;

  if (!isBlank(row.responsible_email)) {
    const { value, error } = normalizeEmail(row.responsible_email);
    if (error) {
      errors.push(error);
    } else {
      data.responsible_email = value ?? null;
    }
  } else {
    data.responsible_email = null;
  }

  if (!isBlank(row.additional_attributes)) {
    const { value, error } = normalizeJsonObject(row.additional_attributes);
    if (error) {
      errors.push(error);
    } else {
      data.additional_attributes = value;
    }
  } else {
    data.additional_attributes = null;
  }

  return {
    errors,
    warnings,
    data
  };
}

const SHEET_PROCESSORS = {
  asset_categories: processAssetCategories,
  asset_statuses: processAssetStatuses,
  depreciation_methods: processDepreciationMethods,
  document_types: processDocumentTypes,
  departments: processDepartments,
  cost_centers: processCostCenters,
  locations: processLocations,
  responsibles: processResponsibles,
  providers: processProviders,
  assets: processAssets
};

function createSheetResult(sheetName, present) {
  return {
    sheet: sheetName,
    present,
    status: present ? 'pending' : 'skipped',
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    warnings: [],
    errors: [],
    duplicates: [],
    rows: [],
    cleared: false
  };
}

function checkWorksheet(definition, sheetName, sheet, context) {
  const sheetResult = createSheetResult(sheetName, sheet.present);
  if (!sheet.present) {
    if (definition.required) {
      throw new ImportFailure(`La hoja "${sheetName}" es obligatoria en la plantilla.`);
    }
    sheetResult.status = 'skipped';
    sheetResult.warnings.push(`La hoja "${sheetName}" no está presente; se omite.`);
    context.results.warnings.push({ sheet: sheetName, message: sheetResult.warnings[0] });
    context.results.sheets[sheetName] = sheetResult;
    return;
  }

  if (context.clearTables && sheet.present) {
    if (!context.sheetsToClear) {
      context.sheetsToClear = new Set();
    }
    context.sheetsToClear.add(sheetName);
    if (!context.clearedSheets) {
      context.clearedSheets = new Set();
    }
    context.clearedSheets.add(sheetName);
    if (!context.preview) {
      const bucket = context.lookups[sheetName];
      if (bucket?.byKey?.clear) {
        bucket.byKey.clear();
      }
    }
  }

  const presentKeys = ensureMandatoryColumns(definition, sheet.headers, sheetName);
  const missingOptional = definition.optionalColumns.filter((column) => !presentKeys.has(column));
  if (missingOptional.length) {
    sheetResult.warnings.push(`Columnas opcionales ausentes: ${missingOptional.join(', ')}`);
  }

  const processor = SHEET_PROCESSORS[sheetName];
  if (!processor) {
    throw new ImportFailure(`No existe un procesador para la hoja "${sheetName}".`);
  }

  const seenKeys = new Set();
  sheet.rows.forEach(({ rowNumber, values }) => {
    const outcome = processor(values, context);
    const key = NATURAL_KEY_NORMALIZERS[sheetName](outcome.data);
    if (key && seenKeys.has(key)) {
      outcome.errors.push(`Clave duplicada dentro de la hoja: ${key}.`);
      sheetResult.duplicates.push({ row: rowNumber, key, source: 'worksheet' });
    }
    if (key) seenKeys.add(key);

    if (outcome.errors.length) {
      sheetResult.failed += 1;
      sheetResult.errors.push({ row: rowNumber, messages: outcome.errors });
      return;
    }

    let duplicateSource = null;
    if (key && (!context.clearTables || !context.preview) && context.lookups[sheetName]?.byKey?.has(key)) {
      duplicateSource = 'database';
    }

    if (duplicateSource) {
      sheetResult.skipped += 1;
      sheetResult.duplicates.push({ row: rowNumber, key, source: duplicateSource });
      sheetResult.rows.push({ rowNumber, key, status: 'duplicate', data: outcome.data, warnings: outcome.warnings });
      return;
    }

    sheetResult.rows.push({ rowNumber, key, status: 'pending', data: outcome.data, warnings: outcome.warnings });
    sheetResult.processed += 1;
    if (outcome.warnings.length) {
      outcome.warnings.forEach((message) => {
        sheetResult.warnings.push(`Fila ${rowNumber}: ${message}`);
      });
    }
    registerPending(context, sheetName, key, outcome.data);
  });

  if (sheetResult.failed > 0) {
    sheetResult.status = 'invalid';
  } else if (sheetResult.processed > 0) {
    sheetResult.status = sheetResult.skipped > 0 ? 'validated_with_skips' : 'validated';
  } else if (sheetResult.skipped > 0) {
    sheetResult.status = 'skipped';
  } else {
    sheetResult.status = 'empty';
  }

  if (context.clearTables && context.sheetsToClear?.has(sheetName)) {
    sheetResult.cleared = true;
  }

  context.results.sheets[sheetName] = sheetResult;
}

function ensureReferenceId(context, sheetName, key, message) {
  if (!key) return null;
  const id = getLookupId(context, sheetName, key);
  if (!id) {
    throw new ImportFailure(message || `Referencia faltante: ${sheetName} → ${key}`);
  }
  return id;
}

async function insertDepreciationMethod({ tx, data }) {
  const { rows } = await tx.sql`
    INSERT INTO depreciation_methods (code, name, description, formula_notes, default_period)
    VALUES (${data.code}, ${data.name}, ${data.description}, ${data.formula_notes}, ${data.default_period})
    RETURNING id, code, name, description, formula_notes, default_period
  `;
  return rows[0];
}

async function insertAssetCategory({ tx, data, context }) {
  let defaultDepMethodId = null;
  if (data.default_depreciation_method_code) {
    defaultDepMethodId = ensureReferenceId(
      context,
      'depreciation_methods',
      data.default_depreciation_method_code,
      `El método de depreciación ${data.default_depreciation_method_code} no existe.`
    );
  }

  const { rows } = await tx.sql`
    INSERT INTO asset_categories (
      code,
      name,
      description,
      default_depreciation_method_id,
      default_lifespan_months
    )
    VALUES (
      ${data.code},
      ${data.name},
      ${data.description},
      ${defaultDepMethodId},
      ${data.default_lifespan_months}
    )
    RETURNING id, code, name, default_depreciation_method_id, default_lifespan_months
  `;
  return rows[0];
}

async function insertAssetStatus({ tx, data }) {
  const { rows } = await tx.sql`
    INSERT INTO asset_statuses (code, name, is_active)
    VALUES (${data.code}, ${data.name}, ${data.is_active})
    RETURNING id, code, name, is_active
  `;
  return rows[0];
}

async function insertDocumentType({ tx, data }) {
  const { rows } = await tx.sql`
    INSERT INTO document_types (code, name, description)
    VALUES (${data.code}, ${data.name}, ${data.description})
    RETURNING id, code, name
  `;
  return rows[0];
}

async function insertDepartment({ tx, data, context }) {
  let parentId = null;
  if (data.parent_code) {
    parentId = getLookupId(context, 'departments', data.parent_code) ?? null;
  }

  const { rows } = await tx.sql`
    INSERT INTO departments (code, name, parent_id)
    VALUES (${data.code}, ${data.name}, ${parentId})
    RETURNING id, code, name, parent_id
  `;
  return rows[0];
}

async function insertCostCenter({ tx, data, context }) {
  const departmentId = ensureReferenceId(
    context,
    'departments',
    data.department_code,
    `El departamento ${data.department_code} no existe para el centro de costo ${data.code}.`
  );

  const { rows } = await tx.sql`
    INSERT INTO cost_centers (code, name, department_id)
    VALUES (${data.code}, ${data.name}, ${departmentId})
    RETURNING id, code, name, department_id
  `;
  return rows[0];
}

async function insertLocation({ tx, data, context }) {
  let parentId = null;
  if (data.parent_code) {
    parentId = getLookupId(context, 'locations', data.parent_code) ?? null;
  }

  const { rows } = await tx.sql`
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
      ${data.code},
      ${data.name},
      ${parentId},
      ${data.address_line},
      ${data.city},
      ${data.region},
      ${data.country},
      ${data.postal_code},
      ${data.latitude},
      ${data.longitude}
    )
    RETURNING id, code, name, parent_id
  `;
  return rows[0];
}

async function insertResponsible({ tx, data, context }) {
  let departmentId = null;
  if (data.department_code) {
    departmentId = ensureReferenceId(
      context,
      'departments',
      data.department_code,
      `El departamento ${data.department_code} no existe para el responsable ${data.name}.`
    );
  }

  const { rows } = await tx.sql`
    INSERT INTO responsibles (name, email, phone, department_id)
    VALUES (${data.name}, ${data.email}, ${data.phone}, ${departmentId})
    RETURNING id, name, email, department_id
  `;
  return rows[0];
}

async function insertProvider({ tx, data }) {
  const { rows } = await tx.sql`
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
      ${data.name},
      ${data.contact_email},
      ${data.contact_phone},
      ${data.tax_id},
      ${data.address_line},
      ${data.city},
      ${data.region},
      ${data.country},
      ${data.postal_code}
    )
    RETURNING id, name
  `;
  return rows[0];
}

async function insertAsset({ tx, data, context, userId }) {
  const assetCategoryId = ensureReferenceId(
    context,
    'asset_categories',
    data.asset_category_code,
    `La categoría ${data.asset_category_code} no existe.`
  );

  const assetStatusId = ensureReferenceId(
    context,
    'asset_statuses',
    data.asset_status_code,
    `El estado ${data.asset_status_code} no existe.`
  );

  let depreciationMethodId = null;
  if (data.depreciation_method_code) {
    depreciationMethodId = getLookupId(context, 'depreciation_methods', data.depreciation_method_code) ?? null;
  }

  let parentAssetId = null;
  if (data.parent_asset_tag) {
    parentAssetId = getLookupId(context, 'assets', data.parent_asset_tag) ?? null;
  }

  let providerId = null;
  if (data.provider_name) {
    providerId = getLookupId(context, 'providers', data.provider_name.toLowerCase()) ?? null;
  }

  let departmentId = null;
  if (data.department_code) {
    departmentId = getLookupId(context, 'departments', data.department_code) ?? null;
  }

  let costCenterId = null;
  if (data.cost_center_code) {
    costCenterId = getLookupId(context, 'cost_centers', data.cost_center_code) ?? null;
  }

  let locationId = null;
  if (data.location_code) {
    locationId = getLookupId(context, 'locations', data.location_code) ?? null;
  }

  let responsibleId = null;
  if (data.responsible_name) {
    responsibleId = getLookupId(context, 'responsibles', data.responsible_name.toLowerCase()) ?? null;
  }

  const { rows } = await tx.sql`
    INSERT INTO assets (
      asset_tag,
      name,
      description,
      alternative_number,
      parent_asset_id,
      asset_category_id,
      asset_status_id,
      depreciation_method_id,
      lifespan_months,
      depreciation_period,
      initial_cost,
      actual_cost,
      residual_value,
      actual_book_value,
      cumulative_depreciation_value,
      purchase_order_number,
      transaction_number,
      provider_id,
      department_id,
      cost_center_id,
      location_id,
      responsible_id,
      created_by,
      updated_by,
      additional_attributes
    )
    VALUES (
      ${data.asset_tag},
      ${data.name},
      ${data.description},
      ${data.alternative_number},
      ${parentAssetId},
      ${assetCategoryId},
      ${assetStatusId},
      ${depreciationMethodId},
      ${data.lifespan_months},
      ${data.depreciation_period},
      ${data.initial_cost},
      ${data.actual_cost},
      ${data.residual_value},
      ${data.actual_book_value},
      ${data.cumulative_depreciation_value},
      ${data.purchase_order_number},
      ${data.transaction_number},
      ${providerId},
      ${departmentId},
      ${costCenterId},
      ${locationId},
      ${responsibleId},
      ${userId},
      ${userId},
      ${data.additional_attributes}
    )
    RETURNING id, asset_tag
  `;
  return rows[0];
}

const INSERT_HANDLERS = {
  depreciation_methods: insertDepreciationMethod,
  asset_categories: insertAssetCategory,
  asset_statuses: insertAssetStatus,
  document_types: insertDocumentType,
  departments: insertDepartment,
  cost_centers: insertCostCenter,
  locations: insertLocation,
  responsibles: insertResponsible,
  providers: insertProvider,
  assets: insertAsset
};

const CLEAR_TABLE_STATEMENTS = {
  assets: (tx) => tx.sql`DELETE FROM assets`,
  providers: (tx) => tx.sql`DELETE FROM providers`,
  responsibles: (tx) => tx.sql`DELETE FROM responsibles`,
  locations: (tx) => tx.sql`DELETE FROM locations`,
  cost_centers: (tx) => tx.sql`DELETE FROM cost_centers`,
  departments: (tx) => tx.sql`DELETE FROM departments`,
  document_types: (tx) => tx.sql`DELETE FROM document_types`,
  asset_statuses: (tx) => tx.sql`DELETE FROM asset_statuses`,
  asset_categories: (tx) => tx.sql`DELETE FROM asset_categories`,
  depreciation_methods: (tx) => tx.sql`DELETE FROM depreciation_methods`
};

function determineSheetsToClear(context) {
  if (!context?.clearTables || context.preview) return [];
  const candidates = context.sheetsToClear ?? new Set();
  return [...SHEET_SEQUENCE]
    .reverse()
    .filter((sheetName) => candidates.has(sheetName) && CLEAR_TABLE_STATEMENTS[sheetName]);
}

async function clearImportTables(tx, sheetsToClear, context) {
  if (!sheetsToClear.length) return;
  for (const sheetName of sheetsToClear) {
    const clearStatement = CLEAR_TABLE_STATEMENTS[sheetName];
    if (!clearStatement) continue;
    await clearStatement(tx);
    const sheetResult = context.results.sheets[sheetName];
    if (sheetResult) {
      sheetResult.cleared = true;
    }
    const bucket = context.lookups[sheetName];
    if (bucket?.byKey?.clear) {
      bucket.byKey.clear();
    }
  }
}

async function persistData(context, userId, { clearTables = false } = {}) {
  await withTransaction(async (tx) => {
    const sheetsToClear = clearTables ? determineSheetsToClear(context) : [];
    if (sheetsToClear.length) {
      await clearImportTables(tx, sheetsToClear, context);
      const clearedSet = new Set(sheetsToClear);
      context.clearedSheets = clearedSet;
      context.results.clearedTables = SHEET_SEQUENCE.filter((sheet) => clearedSet.has(sheet));
    }
    for (const sheetName of SHEET_SEQUENCE) {
      const sheetResult = context.results.sheets[sheetName];
      if (!sheetResult || !sheetResult.present) continue;
      const handler = INSERT_HANDLERS[sheetName];
      if (!handler) continue;

      for (const rowEntry of sheetResult.rows) {
        if (rowEntry.status !== 'pending') continue;
        try {
          const insertedRecord = await handler({ tx, data: rowEntry.data, context, userId, row: rowEntry });
          sheetResult.inserted += 1;
          rowEntry.status = 'inserted';
          if (insertedRecord?.id) {
            rowEntry.recordId = insertedRecord.id;
          }
          if (insertedRecord) {
            registerLookupRecord(context, sheetName, insertedRecord);
          }
        } catch (error) {
          if (error?.code === '23505') {
            sheetResult.skipped += 1;
            sheetResult.duplicates.push({ row: rowEntry.rowNumber, key: rowEntry.key, source: 'database' });
            rowEntry.status = 'duplicate';
            continue;
          }
          throw new ImportFailure(
            `Error al guardar la hoja "${sheetName}" en la fila ${rowEntry.rowNumber}`,
            { details: { sheet: sheetName, row: rowEntry.rowNumber, message: error.message } }
          );
        }
      }

      if (!context.preview) {
        if (sheetResult.inserted > 0) {
          sheetResult.status = sheetResult.skipped > 0 ? 'committed_with_skips' : 'committed';
        } else if (sheetResult.processed === 0 && sheetResult.skipped > 0) {
          sheetResult.status = 'skipped';
        }
      }
    }
  });
}

async function buildProcessingContext(preview, fileName, clearTables) {
  const lookups = await loadExistingLookups();
  const requestedClear = Boolean(clearTables);
  return {
    preview,
    clearTables: requestedClear,
    fileName,
    batchId: createBatchId(),
    lookups,
    pending: {},
    sheetsToClear: new Set(),
    clearedSheets: new Set(),
    results: {
      batchId: null,
      templateVersion: ASSET_IMPORT_TEMPLATE_VERSION,
      preview,
      mode: preview ? 'preview' : 'commit',
      clearTables: requestedClear,
      clearedTables: [],
      fileName,
      totals: {
        processed: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        duplicates: 0
      },
      warnings: [],
      errors: [],
      sheets: {},
      startedAt: new Date().toISOString()
    }
  };
}

function finalizeResults(context) {
  const durationMs = Date.now() - context.startedAtTs;
  context.results.durationMs = durationMs;
  context.results.completedAt = new Date().toISOString();

  const totals = context.results.totals;
  totals.processed = 0;
  totals.inserted = 0;
  totals.updated = 0;
  totals.failed = 0;
  totals.skipped = 0;
  totals.duplicates = 0;

  Object.values(context.results.sheets).forEach((sheet) => {
    totals.processed += sheet.processed;
    totals.inserted += sheet.inserted;
    totals.updated += sheet.updated;
    totals.failed += sheet.failed;
    totals.skipped += sheet.skipped;
    totals.duplicates += sheet.duplicates.length;
  });

  if (context.clearTables) {
    const clearedSet = context.clearedSheets ?? new Set();
    const clearedList = context.results.clearedTables?.length
      ? context.results.clearedTables
      : SHEET_SEQUENCE.filter((sheet) => clearedSet.has(sheet));
    context.results.clearedTables = clearedList;
  } else {
    context.results.clearedTables = [];
  }

  context.results.clearTables = Boolean(context.clearTables);
}

async function persistLogs(context, userId) {
  const sheets = Object.values(context.results.sheets);
  await Promise.all(
    sheets.map((sheet) =>
      query`
        INSERT INTO imports_log (
          batch_id,
          sheet_name,
          file_name,
          template_version,
          preview,
          status,
          totals,
          warnings,
          errors,
          duplicates,
          metadata,
          duration_ms,
          requested_by
        ) VALUES (
          ${context.results.batchId},
          ${sheet.sheet},
          ${context.fileName},
          ${ASSET_IMPORT_TEMPLATE_VERSION},
          ${context.preview},
          ${sheet.status ?? (sheet.failed > 0 ? 'invalid' : sheet.present ? 'validated' : 'skipped')},
          ${JSON.stringify({
            processed: sheet.processed,
            inserted: sheet.inserted,
            updated: sheet.updated,
            failed: sheet.failed,
            skipped: sheet.skipped,
            duplicates: sheet.duplicates.length,
            warnings: sheet.warnings.length
          })},
          ${JSON.stringify(sheet.warnings)},
          ${JSON.stringify(sheet.errors)},
          ${JSON.stringify(sheet.duplicates)},
          ${JSON.stringify({
            preview: context.preview,
            mode: context.preview ? 'preview' : 'commit',
            clearTables: context.clearTables,
            sheetCleared: !context.preview && sheet.cleared,
            sheetClearRequested: context.clearTables && sheet.cleared
          })},
          ${context.results.durationMs},
          ${userId}
        )
      `
    )
  );
}

export async function runAssetImport({ buffer, preview, fileName, userId, clearTables = false }) {
  if (!buffer || !(buffer instanceof Uint8Array) && !(buffer instanceof ArrayBuffer)) {
    throw new ImportFailure('Archivo inválido.');
  }

  const workbook = readWorkbook(buffer);
  const context = await buildProcessingContext(preview, fileName, clearTables);
  context.results.batchId = context.batchId;
  context.fileName = fileName;
  context.startedAtTs = Date.now();

  for (const sheetName of SHEET_SEQUENCE) {
    const definition = SHEET_DEFINITIONS[sheetName];
    const sheet = extractSheet(workbook, sheetName);
    checkWorksheet(definition, sheetName, sheet, context);
  }

  if (context.results.sheets.assets?.rows?.length > MAX_ASSET_ROWS) {
    throw new ImportFailure(`El archivo supera el límite de ${MAX_ASSET_ROWS} activos.`);
  }

  if (!preview) {
    await persistData(context, userId, { clearTables: !context.preview && context.clearTables });
  } else {
    Object.values(context.results.sheets).forEach((sheet) => {
      if (!sheet) return;
      sheet.rows.forEach((row) => {
        if (row.status === 'pending') {
          row.status = 'validated';
        }
      });
    });
  }

  finalizeResults(context);

  await persistLogs(context, userId);

  return context.results;
}
