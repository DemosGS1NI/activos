import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx-js-style';

const { utils, writeFileXLSX } = xlsx;

import {
  ASSET_IMPORT_TEMPLATE_VERSION,
  SHEET_DEFINITIONS,
  SHEET_SEQUENCE,
  SHEET_COLUMN_SPECS
} from '../src/lib/imports/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILENAME = `asset-import-v${ASSET_IMPORT_TEMPLATE_VERSION}.xlsx`;
const OUTPUT_PATH = path.resolve(__dirname, '../static/templates', OUTPUT_FILENAME);

const HEADER_FONT = { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FF1F2937' } };
const REQUIRED_FILL = { patternType: 'solid', fgColor: { rgb: 'FFFDE68A' } }; // Amber 200
const OPTIONAL_FILL = { patternType: 'solid', fgColor: { rgb: 'FFE2E8F0' } }; // Slate 200
const HEADER_BORDER = { style: 'thin', color: { rgb: 'FFCBD5F5' } };
const HEADER_ALIGNMENT = { horizontal: 'center', vertical: 'center', wrapText: true };

function withHeaderStyle(cell, isRequired) {
  cell.s = {
    font: HEADER_FONT,
    alignment: HEADER_ALIGNMENT,
    border: {
      top: HEADER_BORDER,
      bottom: HEADER_BORDER,
      left: HEADER_BORDER,
      right: HEADER_BORDER
    },
    fill: isRequired ? REQUIRED_FILL : OPTIONAL_FILL
  };
}

function buildSheet(sheetKey) {
  const definition = SHEET_DEFINITIONS[sheetKey];
  if (!definition) {
    throw new Error(`No sheet definition found for key: ${sheetKey}`);
  }
  const columnSpecs = SHEET_COLUMN_SPECS[sheetKey] ?? {};
  const headers = [...definition.mandatoryColumns, ...definition.optionalColumns];
  const sheet = utils.aoa_to_sheet([headers]);

  sheet['!cols'] = headers.map((columnKey) => {
    const spec = columnSpecs[columnKey];
    return { wch: spec?.width ?? 20 };
  });
  sheet['!rows'] = [{ hpt: 28 }];

  headers.forEach((columnKey, index) => {
    const address = utils.encode_cell({ c: index, r: 0 });
    const cell = sheet[address];
    if (!cell) return;

    const isRequired = definition.mandatoryColumns.includes(columnKey);
    withHeaderStyle(cell, isRequired);

    const spec = columnSpecs[columnKey];
    if (spec) {
      const lines = [spec.label];
      lines.push(`Tipo: ${spec.type}`);
      if (spec.note) {
        lines.push(`Notas: ${spec.note}`);
      }
      lines.push(isRequired ? 'Campo obligatorio' : 'Campo opcional');
      cell.c = [
        {
          a: 'Plantilla',
          t: lines.join('\n')
        }
      ];
    }
  });

  if (headers.length) {
    sheet['!autofilter'] = {
      ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } })
    };
  }
  sheet['!freeze'] = { ySplit: 1, topLeftCell: 'A2' };

  return sheet;
}

function buildReadmeSheet() {
  const now = new Date();
  const generatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = [
    ['Plantilla de importacion de activos', `Version ${ASSET_IMPORT_TEMPLATE_VERSION}`],
    ['Generado', generatedAt],
    [],
    [
      'Instrucciones',
      [
        '1. Respeta los encabezados tal como aparecen, no renombres ni elimines hojas.',
        '2. Completa primero las hojas de referencia y deja al final la hoja de activos.',
        '3. Las celdas en amarillo son obligatorias; las grises son opcionales.',
        '4. Maximo 500 filas en la hoja de activos.'
      ].join('\n')
    ],
    [],
    ['Clave de colores', ''],
    ['Obligatorio', 'Celdas resaltadas en amarillo deben completarse antes de importar.'],
    ['Opcional', 'Celdas en gris pueden quedar vacías si no aplica.'],
    [],
    ['Orden de carga sugerido', SHEET_SEQUENCE.join(' -> ')],
    ['Hoja obligatoria', 'assets (debe incluir asset_tag, name, asset_category_code, asset_status_code)'],
    [
      'Notas',
      'El sistema valida referencias entre hojas. Usa la misma version de plantilla al registrar la importacion.'
    ]
  ];

  const sheet = utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 80 }];

  rows.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      const cellAddress = utils.encode_cell({ c: colIndex, r: rowIndex });
      const cell = sheet[cellAddress];
      if (!cell) return;

      if (rowIndex === 0 && colIndex <= 1) {
        cell.s = {
          font: { name: 'Segoe UI', sz: 14, bold: true, color: { rgb: 'FF0F172A' } }
        };
      } else if (rowIndex === 5) {
        cell.s = {
          font: { ...HEADER_FONT }
        };
      } else if (rowIndex === 6 || rowIndex === 7) {
        const isRequiredRow = rowIndex === 6;
        cell.s = {
          font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FF1F2937' } },
          fill: isRequiredRow ? REQUIRED_FILL : OPTIONAL_FILL,
          alignment: HEADER_ALIGNMENT
        };
      } else if (Array.isArray(value) || String(value).includes('\n')) {
        cell.s = {
          alignment: { wrapText: true, vertical: 'top' }
        };
      }
    });
  });

  sheet['!rows'] = rows.map((_, index) => {
    if (index === 0) return { hpt: 26 };
    if (index === 3) return { hpt: 72 };
    if (index === 6 || index === 7) return { hpt: 22 };
    return {};
  });

  return sheet;
}

function main() {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, buildReadmeSheet(), 'README');

  for (const sheetKey of SHEET_SEQUENCE) {
    const sheet = buildSheet(sheetKey);
    utils.book_append_sheet(workbook, sheet, sheetKey);
  }

  writeFileXLSX(workbook, OUTPUT_PATH, { bookType: 'xlsx' });
  console.log(`Template generated at ${OUTPUT_PATH}`);
}

main();
