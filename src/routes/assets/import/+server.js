import { badRequest, success, ResponseError } from '../../../lib/response.js';
import { requireRole } from '../../../lib/rbac.js';
import {
  ASSET_IMPORT_TEMPLATE_VERSION,
  MAX_IMPORT_FILE_SIZE_BYTES,
  MAX_ASSET_ROWS
} from '../../../lib/imports/constants.js';
import { runAssetImport } from '../../../lib/imports/importer.server.js';
import { ImportFailure } from '../../../lib/imports/errors.js';

function resolvePreviewFlag(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'boolean') return value;
  return true;
}

function resolveBooleanFlag(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  if (typeof value === 'boolean') return value;
  return defaultValue;
}

function isExcelFile(fileName) {
  if (!fileName) return false;
  return fileName.toLowerCase().endsWith('.xlsx');
}

async function ensureAdmin(event) {
  try {
    await requireRole(event, 'admin');
    return null;
  } catch (error) {
    if (error instanceof ResponseError) {
      return error.response;
    }
    throw error;
  }
}

export async function POST(event) {
  const guardResponse = await ensureAdmin(event);
  if (guardResponse) return guardResponse;

  const userId = event.locals?.user?.id || null;
  let formData;
  try {
    formData = await event.request.formData();
  } catch (error) {
    return badRequest('No se pudo leer el formulario de carga.');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return badRequest('Debe adjuntar el archivo de Excel a importar.');
  }

  if (!isExcelFile(file.name)) {
    return badRequest('El archivo debe tener extensión .xlsx.');
  }

  if (typeof file.size === 'number' && file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return badRequest('El archivo supera el límite permitido de 5 MB.');
  }

  const preview = resolvePreviewFlag(formData.get('preview'));
  const clearTables = resolveBooleanFlag(formData.get('clearTables'));

  let buffer;
  try {
    buffer = new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    return badRequest('No se pudo leer el contenido del archivo.');
  }

  try {
    const importResult = await runAssetImport({
      buffer,
      preview,
      fileName: file.name || 'import.xlsx',
      userId,
      clearTables
    });

    return success(
      {
        resumen: importResult,
        plantilla: ASSET_IMPORT_TEMPLATE_VERSION
      },
      {
        preview,
        template_version: ASSET_IMPORT_TEMPLATE_VERSION,
        clear_tables: clearTables,
        effective_clear_tables: !preview && clearTables
      }
    );
  } catch (error) {
    if (error instanceof ImportFailure) {
      return badRequest(error.message, error.details);
    }
    throw error;
  }
}

export async function GET(event) {
  return success({
    template_version: ASSET_IMPORT_TEMPLATE_VERSION,
    template_path: `/templates/asset-import-v${ASSET_IMPORT_TEMPLATE_VERSION}.xlsx`,
    max_file_size_bytes: MAX_IMPORT_FILE_SIZE_BYTES,
    max_asset_rows: MAX_ASSET_ROWS
  });
}
