import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

import {
  ASSET_IMPORT_TEMPLATE_VERSION,
  SHEET_DEFINITIONS,
  SHEET_SEQUENCE,
  SHEET_COLUMN_SPECS
} from "../src/lib/imports/constants.js";

const { utils, writeFileXLSX } = xlsx;

const SAMPLE_ASSET_COUNT = 100;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(__dirname, "../static/samples");
const OUTPUT_FILENAME = `asset-import-sample-${SAMPLE_ASSET_COUNT}.xlsx`;
const OUTPUT_PATH = path.join(OUTPUT_DIR, OUTPUT_FILENAME);

function buildReferenceData() {
  const depreciationMethods = [
    { code: "DEP_LINEAL", name: "Depreciación lineal", default_period: "mensual" },
    { code: "DEP_ACEL_25", name: "Acelerada 25%", default_period: "mensual" },
    { code: "DEP_ACEL_40", name: "Acelerada 40%", default_period: "mensual" }
  ];

  const assetCategories = [
    {
      code: "CAT_COMPUTO",
      name: "Equipo de cómputo",
      description: "Laptops, desktops y periféricos",
      default_depreciation_method_code: "DEP_LINEAL",
      default_lifespan_months: 48
    },
    {
      code: "CAT_VEHICULOS",
      name: "Vehículos",
      description: "Flota vehicular corporativa",
      default_depreciation_method_code: "DEP_ACEL_25",
      default_lifespan_months: 72
    },
    {
      code: "CAT_MOBILIARIO",
      name: "Mobiliario",
      description: "Muebles de oficina",
      default_depreciation_method_code: "DEP_LINEAL",
      default_lifespan_months: 84
    },
    {
      code: "CAT_MAQUINARIA",
      name: "Maquinaria",
      description: "Equipo industrial y de planta",
      default_depreciation_method_code: "DEP_ACEL_40",
      default_lifespan_months: 60
    },
    {
      code: "CAT_ENERGIA",
      name: "Equipos de energía",
      description: "UPS y generadores",
      default_depreciation_method_code: "DEP_LINEAL",
      default_lifespan_months: 96
    }
  ];

  const assetStatuses = [
    { code: "EST_EN_SERVICIO", name: "En servicio", is_active: true },
    { code: "EST_EN_MANT", name: "En mantenimiento", is_active: true },
    { code: "EST_RESERVA", name: "En reserva", is_active: true },
    { code: "EST_DADO_BAJA", name: "Dado de baja", is_active: false }
  ];

  const documentTypes = [
    { code: "DOC_OC", name: "Orden de compra" },
    { code: "DOC_FACTURA", name: "Factura" },
    { code: "DOC_GARANTIA", name: "Documento de garantía" }
  ];

  const departments = [
    { code: "DEP_FIN", name: "Finanzas" },
    { code: "DEP_TEC", name: "Tecnología" },
    { code: "DEP_OPE", name: "Operaciones" },
    { code: "DEP_RH", name: "Recursos Humanos" }
  ];

  const costCenters = [
    { code: "CC_FIN_CTRL", name: "Control financiero", department_code: "DEP_FIN" },
    { code: "CC_FIN_CONT", name: "Contabilidad", department_code: "DEP_FIN" },
    { code: "CC_TEC_DEV", name: "Desarrollo de software", department_code: "DEP_TEC" },
    { code: "CC_TEC_INF", name: "Infraestructura TI", department_code: "DEP_TEC" },
    { code: "CC_OPE_LOG", name: "Logística", department_code: "DEP_OPE" },
    { code: "CC_OPE_PLT", name: "Operación de planta", department_code: "DEP_OPE" },
    { code: "CC_RH_TAL", name: "Gestión de talento", department_code: "DEP_RH" },
    { code: "CC_RH_BEN", name: "Beneficios", department_code: "DEP_RH" }
  ];

  const locations = [
    {
      code: "LOC_CEN",
      name: "Oficina Central",
      address_line: "Av. Central 123",
      city: "Managua",
      region: "Managua",
      country: "NI"
    },
    {
      code: "LOC_DATACENTER",
      name: "Data Center",
      address_line: "Km 12 Carretera Norte",
      city: "Managua",
      region: "Managua",
      country: "NI"
    },
    {
      code: "LOC_PLANTA_1",
      name: "Planta Industrial 1",
      address_line: "Zona Franca Industrial",
      city: "Granada",
      region: "Granada",
      country: "NI"
    },
    {
      code: "LOC_PLANTA_2",
      name: "Planta Industrial 2",
      address_line: "Parque Industrial Sur",
      city: "León",
      region: "León",
      country: "NI"
    },
    {
      code: "LOC_BODEGA_NORTE",
      name: "Bodega Norte",
      address_line: "Km 5 Carretera Norte",
      city: "Managua",
      region: "Managua",
      country: "NI"
    }
  ];

  const responsibles = [
    { name: "Ana Morales", email: "ana.morales@example.com", phone: "+505 8001 1001", department_code: "DEP_FIN" },
    { name: "Carlos Pérez", email: "carlos.perez@example.com", phone: "+505 8001 1002", department_code: "DEP_FIN" },
    { name: "Lucía Herrera", email: "lucia.herrera@example.com", phone: "+505 8001 2001", department_code: "DEP_TEC" },
    { name: "Diego Silva", email: "diego.silva@example.com", phone: "+505 8001 2002", department_code: "DEP_TEC" },
    { name: "María Gómez", email: "maria.gomez@example.com", phone: "+505 8001 3001", department_code: "DEP_OPE" },
    { name: "José Rivas", email: "jose.rivas@example.com", phone: "+505 8001 3002", department_code: "DEP_OPE" },
    { name: "Paola Ruiz", email: "paola.ruiz@example.com", phone: "+505 8001 4001", department_code: "DEP_RH" },
    { name: "Rodrigo Castro", email: "rodrigo.castro@example.com", phone: "+505 8001 4002", department_code: "DEP_RH" }
  ];

  const providers = [
    {
      name: "Tech Solutions S.A.",
      contact_email: "ventas@techsolutions.example",
      contact_phone: "+505 2299 1100",
      tax_id: "J0312345670001",
      address_line: "Residencial Las Colinas",
      city: "Managua",
      country: "NI"
    },
    {
      name: "Motores y Equipos Centroamericanos",
      contact_email: "info@meca.example",
      contact_phone: "+505 2255 7788",
      tax_id: "J0211122230002",
      address_line: "Km 8 Carretera Masaya",
      city: "Managua",
      country: "NI"
    },
    {
      name: "Insumos Industriales del Pacífico",
      contact_email: "ventas@iip.example",
      contact_phone: "+505 2233 4455",
      tax_id: "J0312345670003",
      address_line: "Zona Franca",
      city: "Chinandega",
      country: "NI"
    },
    {
      name: "OfiMuebles Modernos",
      contact_email: "contacto@ofimuebles.example",
      contact_phone: "+505 2222 3344",
      tax_id: "J0512121210004",
      address_line: "Plaza Comercial Altamira",
      city: "Managua",
      country: "NI"
    },
    {
      name: "Soluciones Energéticas Integrales",
      contact_email: "energia@sei.example",
      contact_phone: "+505 2244 5566",
      tax_id: "J0610101010005",
      address_line: "Km 14 Carretera a Masaya",
      city: "Managua",
      country: "NI"
    }
  ];

  return {
    depreciation_methods: depreciationMethods,
    asset_categories: assetCategories,
    asset_statuses: assetStatuses,
    document_types: documentTypes,
    departments,
    cost_centers: costCenters,
    locations,
    responsibles,
    providers
  };
}

function pickByDepartment(items, departmentCode, index) {
  const matches = items.filter((item) => item.department_code === departmentCode);
  if (!matches.length) {
    return items[index % items.length];
  }
  return matches[index % matches.length];
}

function buildSampleAssets(baseData) {
  const {
    asset_categories: categories,
    asset_statuses: statuses,
    depreciation_methods: methods,
    departments,
    cost_centers: centers,
    locations,
    responsibles,
    providers
  } = baseData;

  const assets = [];

  for (let index = 0; index < SAMPLE_ASSET_COUNT; index += 1) {
    const sequence = index + 1;
    const category = categories[index % categories.length];
    const status = statuses[index % statuses.length];
    const department = departments[index % departments.length];
    const costCenter = pickByDepartment(centers, department.code, index);
    const responsible = pickByDepartment(responsibles, department.code, index);
    const provider = providers[index % providers.length];
    const location = locations[index % locations.length];
    const method = methods.find((item) => item.code === category.default_depreciation_method_code) ||
      methods[index % methods.length];

    const assetTag = `AST-${String(sequence).padStart(4, "0")}`;
    const shouldLinkParent = sequence > 5 && sequence % 10 === 0;
    const parentTag = shouldLinkParent ? `AST-${String(sequence - 5).padStart(4, "0")}` : null;

    assets.push({
      asset_tag: assetTag,
      name: `Activo de prueba ${sequence}`,
      description: `Activo generado para validar la importación (${category.name}).`,
      asset_category_code: category.code,
      asset_status_code: status.code,
      alternative_number: `ALT-${String(sequence).padStart(4, "0")}`,
      parent_asset_tag: parentTag,
      depreciation_method_code: method?.code ?? null,
      lifespan_months: category.default_lifespan_months,
      depreciation_period: "mensual",
      initial_cost: Number((2500 + (index % 20) * 75).toFixed(2)),
      actual_cost: Number((2200 + (index % 18) * 60).toFixed(2)),
      residual_value: Number((450 + (index % 6) * 40).toFixed(2)),
      actual_book_value: Number((1800 + (index % 15) * 55).toFixed(2)),
      cumulative_depreciation_value: Number((650 + (index % 12) * 35).toFixed(2)),
      purchase_order_number: `PO-${2020 + (index % 5)}-${String(sequence).padStart(4, "0")}`,
      transaction_number: `TR-${2020 + (index % 5)}-${String(sequence).padStart(4, "0")}`,
      provider_name: provider.name,
      department_code: department.code,
      cost_center_code: costCenter.code,
      location_code: location.code,
      responsible_name: responsible.name,
      responsible_email: responsible.email,
      additional_attributes: JSON.stringify({
        modelo: `MD-${100 + (index % 50)}`,
        serie: `SR-${String(5000 + index).padStart(5, "0")}`,
        color: index % 2 === 0 ? "Negro" : "Gris"
      })
    });
  }

  return assets;
}

function buildSheet(sheetKey, records) {
  const definition = SHEET_DEFINITIONS[sheetKey];
  if (!definition) {
    throw new Error(`No sheet definition found for: ${sheetKey}`);
  }
  const headers = [...definition.mandatoryColumns, ...definition.optionalColumns];
  const rows = [headers];

  for (const record of records) {
    const row = headers.map((columnKey) => {
      const value = record[columnKey];
      if (value === undefined || value === null || value === "") {
        return null;
      }
      if (typeof value === "number" || typeof value === "boolean") {
        return value;
      }
      if (value instanceof Date) {
        return value;
      }
      return value;
    });
    rows.push(row);
  }

  const sheet = utils.aoa_to_sheet(rows);
  const columnSpecs = SHEET_COLUMN_SPECS[sheetKey] ?? {};
  sheet["!cols"] = headers.map((columnKey) => {
    const width = columnSpecs[columnKey]?.width ?? Math.min(Math.max(columnKey.length, 14), 40);
    return { wch: width };
  });
  sheet["!freeze"] = { ySplit: 1, topLeftCell: "A2" };

  if (rows.length > 1) {
    sheet["!autofilter"] = {
      ref: utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: headers.length - 1 }
      })
    };
  }

  return sheet;
}

function buildReadmeSheet() {
  const now = new Date();
  const generatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const rows = [
    ["Muestra de importación de activos", `Versión de plantilla ${ASSET_IMPORT_TEMPLATE_VERSION}`],
    ["Generado", generatedAt],
    [],
    [
      "Descripción",
      [
        "Este archivo contiene datos de referencia y 100 activos generados para probar el flujo de importación.",
        "Puedes modificar los registros o agregar nuevos siguiendo los encabezados y las referencias establecidas.",
        "Los códigos utilizados coinciden entre las diferentes hojas para facilitar las validaciones."
      ].join("\n")
    ],
    [],
    ["Contenido", "Incluye hojas de catálogos básicos, proveedores, responsables y la hoja de activos."],
    ["Advertencia", "No elimines filas de encabezado ni cambies los nombres de las hojas antes de importar."],
    [],
    ["Total de activos", SAMPLE_ASSET_COUNT]
  ];

  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 32 }, { wch: 90 }];
  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const address = utils.encode_cell({ c: columnIndex, r: rowIndex });
      const cell = sheet[address];
      if (!cell) return;
      if (rowIndex === 0 && columnIndex === 0) {
        cell.s = {
          font: { bold: true, sz: 14 },
          alignment: { vertical: "center" }
        };
      } else if (typeof value === "string" && value.includes("\n")) {
        cell.s = { alignment: { wrapText: true, vertical: "top" } };
      }
    });
  });
  return sheet;
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const referenceData = buildReferenceData();
  const assets = buildSampleAssets(referenceData);

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, buildReadmeSheet(), "README");

  for (const sheetKey of SHEET_SEQUENCE) {
    const records = sheetKey === "assets" ? assets : referenceData[sheetKey] ?? [];
    const sheet = buildSheet(sheetKey, records);
    utils.book_append_sheet(workbook, sheet, sheetKey);
  }

  writeFileXLSX(workbook, OUTPUT_PATH, { bookType: "xlsx" });
  console.log(`Sample workbook generated at ${OUTPUT_PATH}`);
}

main();
