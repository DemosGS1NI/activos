import crypto from 'node:crypto';

export const ASSET_IMPORT_TEMPLATE_VERSION = '1.0';
export const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB
export const MAX_ASSET_ROWS = 500;

export function createBatchId() {
  return crypto.randomUUID();
}

// Sheets are processed in dependency order. Optional sheets may be omitted.
export const SHEET_SEQUENCE = [
  'depreciation_methods',
  'asset_categories',
  'asset_statuses',
  'document_types',
  'departments',
  'cost_centers',
  'locations',
  'responsibles',
  'providers',
  'assets'
];

export const SHEET_DEFINITIONS = {
  asset_categories: {
    label: 'Categorías de activo',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['description', 'default_depreciation_method_code', 'default_lifespan_months']
  },
  asset_statuses: {
    label: 'Estados de activo',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['is_active']
  },
  depreciation_methods: {
    label: 'Métodos de depreciación',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['description', 'formula_notes', 'default_period']
  },
  document_types: {
    label: 'Tipos de documento',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['description']
  },
  departments: {
    label: 'Departamentos',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['parent_code']
  },
  cost_centers: {
    label: 'Centros de costo',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['department_code']
  },
  locations: {
    label: 'Ubicaciones',
    required: false,
    naturalKey: 'code',
    mandatoryColumns: ['code', 'name'],
    optionalColumns: ['parent_code', 'address_line', 'city', 'region', 'country', 'postal_code', 'latitude', 'longitude']
  },
  responsibles: {
    label: 'Responsables',
    required: false,
    naturalKey: 'name',
    mandatoryColumns: ['name'],
    optionalColumns: ['email', 'phone', 'department_code']
  },
  providers: {
    label: 'Proveedores',
    required: false,
    naturalKey: 'name',
    mandatoryColumns: ['name'],
    optionalColumns: ['contact_email', 'contact_phone', 'tax_id', 'address_line', 'city', 'region', 'country', 'postal_code']
  },
  assets: {
    label: 'Activos',
    required: true,
    naturalKey: 'asset_tag',
    mandatoryColumns: ['asset_tag', 'name', 'asset_category_code', 'asset_status_code'],
    optionalColumns: [
      'description',
      'alternative_number',
      'parent_asset_tag',
      'depreciation_method_code',
      'lifespan_months',
      'depreciation_period',
      'initial_cost',
      'actual_cost',
      'residual_value',
      'actual_book_value',
      'cumulative_depreciation_value',
      'purchase_order_number',
      'transaction_number',
      'provider_name',
      'department_code',
      'cost_center_code',
      'location_code',
      'responsible_name',
      'responsible_email',
      'additional_attributes'
    ]
  }
};

export const SHEET_COLUMN_SPECS = {
  depreciation_methods: {
    code: { label: 'Código del método de depreciación', type: 'Texto', note: 'máx. 50 caracteres', width: 18 },
    name: { label: 'Nombre del método', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    description: { label: 'Descripción', type: 'Texto', note: 'máx. 255 caracteres', width: 32 },
    formula_notes: { label: 'Notas de cálculo', type: 'Texto', note: 'máx. 255 caracteres', width: 30 },
    default_period: { label: 'Periodo por defecto', type: 'Texto', note: 'máx. 50 caracteres', width: 20 }
  },
  asset_categories: {
    code: { label: 'Código de la categoría', type: 'Texto', note: 'máx. 50 caracteres', width: 20 },
    name: { label: 'Nombre de la categoría', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    description: { label: 'Descripción', type: 'Texto', note: 'máx. 255 caracteres', width: 32 },
    default_depreciation_method_code: {
      label: 'Método de depreciación por defecto (código)',
      type: 'Texto',
      note: 'Debe existir en la hoja MÉTODOS',
      width: 30
    },
    default_lifespan_months: { label: 'Vida útil por defecto (meses)', type: 'Número entero positivo', note: 'Ej. 60', width: 22 }
  },
  asset_statuses: {
    code: { label: 'Código del estado', type: 'Texto', note: 'máx. 50 caracteres', width: 20 },
    name: { label: 'Nombre del estado', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    is_active: { label: 'Activo', type: 'Booleano (TRUE/FALSE)', note: 'Usa TRUE o FALSE', width: 18 }
  },
  document_types: {
    code: { label: 'Código del tipo de documento', type: 'Texto', note: 'máx. 50 caracteres', width: 22 },
    name: { label: 'Nombre del tipo de documento', type: 'Texto', note: 'máx. 120 caracteres', width: 28 },
    description: { label: 'Descripción', type: 'Texto', note: 'máx. 255 caracteres', width: 32 }
  },
  departments: {
    code: { label: 'Código del departamento', type: 'Texto', note: 'máx. 50 caracteres', width: 20 },
    name: { label: 'Nombre del departamento', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    parent_code: { label: 'Departamento padre (código)', type: 'Texto', note: 'Debe existir en DEPARTAMENTOS', width: 28 }
  },
  cost_centers: {
    code: { label: 'Código del centro de costo', type: 'Texto', note: 'máx. 50 caracteres', width: 22 },
    name: { label: 'Nombre del centro de costo', type: 'Texto', note: 'máx. 120 caracteres', width: 28 },
    department_code: { label: 'Departamento (código)', type: 'Texto', note: 'Debe existir en DEPARTAMENTOS', width: 26 }
  },
  locations: {
    code: { label: 'Código de la ubicación', type: 'Texto', note: 'máx. 50 caracteres', width: 20 },
    name: { label: 'Nombre de la ubicación', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    parent_code: { label: 'Ubicación padre (código)', type: 'Texto', note: 'Debe existir en UBICACIONES', width: 28 },
    address_line: { label: 'Dirección', type: 'Texto', note: 'máx. 255 caracteres', width: 36 },
    city: { label: 'Ciudad', type: 'Texto', note: 'máx. 120 caracteres', width: 22 },
    region: { label: 'Región/Estado', type: 'Texto', note: 'máx. 120 caracteres', width: 22 },
    country: { label: 'País', type: 'Texto', note: 'ISO o nombre', width: 20 },
    postal_code: { label: 'Código postal', type: 'Texto', note: 'máx. 20 caracteres', width: 20 },
    latitude: { label: 'Latitud', type: 'Decimal (-90 a 90)', note: 'Usa punto decimal', width: 18 },
    longitude: { label: 'Longitud', type: 'Decimal (-180 a 180)', note: 'Usa punto decimal', width: 18 }
  },
  responsibles: {
    name: { label: 'Nombre del responsable', type: 'Texto', note: 'máx. 120 caracteres', width: 26 },
    email: { label: 'Correo del responsable', type: 'Correo electrónico', note: 'Formato nombre@dominio', width: 30 },
    phone: { label: 'Teléfono', type: 'Texto', note: 'máx. 30 caracteres', width: 22 },
    department_code: { label: 'Departamento (código)', type: 'Texto', note: 'Debe existir en DEPARTAMENTOS', width: 26 }
  },
  providers: {
    name: { label: 'Nombre del proveedor', type: 'Texto', note: 'máx. 150 caracteres', width: 30 },
    contact_email: { label: 'Correo de contacto', type: 'Correo electrónico', note: 'Formato nombre@dominio', width: 30 },
    contact_phone: { label: 'Teléfono de contacto', type: 'Texto', note: 'máx. 30 caracteres', width: 24 },
    tax_id: { label: 'NIT / RUC', type: 'Texto', note: 'máx. 30 caracteres', width: 22 },
    address_line: { label: 'Dirección', type: 'Texto', note: 'máx. 255 caracteres', width: 34 },
    city: { label: 'Ciudad', type: 'Texto', note: 'máx. 120 caracteres', width: 24 },
    region: { label: 'Región/Estado', type: 'Texto', note: 'máx. 120 caracteres', width: 24 },
    country: { label: 'País', type: 'Texto', note: 'ISO o nombre', width: 20 },
    postal_code: { label: 'Código postal', type: 'Texto', note: 'máx. 20 caracteres', width: 20 }
  },
  assets: {
    asset_tag: { label: 'Número de activo', type: 'Texto', note: 'máx. 120 caracteres', width: 28 },
    name: { label: 'Nombre del activo', type: 'Texto', note: 'máx. 200 caracteres', width: 34 },
    description: { label: 'Descripción', type: 'Texto', note: 'máx. 255 caracteres', width: 36 },
    alternative_number: { label: 'Número alterno', type: 'Texto', note: 'máx. 120 caracteres', width: 28 },
    parent_asset_tag: { label: 'Activo padre (asset_tag)', type: 'Texto', note: 'Debe existir previamente', width: 26 },
    asset_category_code: { label: 'Categoría (código)', type: 'Texto', note: 'Debe existir en CATEGORÍAS', width: 28 },
    asset_status_code: { label: 'Estado (código)', type: 'Texto', note: 'Debe existir en ESTADOS', width: 26 },
    depreciation_method_code: {
      label: 'Método de depreciación (código)',
      type: 'Texto',
      note: 'Debe existir en MÉTODOS',
      width: 28
    },
    lifespan_months: { label: 'Vida útil (meses)', type: 'Número entero positivo', note: 'Ej. 60', width: 22 },
    depreciation_period: { label: 'Periodo de depreciación', type: 'Texto', note: 'máx. 50 caracteres', width: 24 },
    initial_cost: { label: 'Costo inicial', type: 'Decimal (##0.00)', note: 'Usa punto decimal', width: 20 },
    actual_cost: { label: 'Costo actual', type: 'Decimal (##0.00)', note: 'Usa punto decimal', width: 20 },
    residual_value: { label: 'Valor residual', type: 'Decimal (##0.00)', note: 'Usa punto decimal', width: 20 },
    actual_book_value: { label: 'Valor en libros', type: 'Decimal (##0.00)', note: 'Usa punto decimal', width: 22 },
    cumulative_depreciation_value: {
      label: 'Depreciación acumulada',
      type: 'Decimal (##0.00)',
      note: 'Usa punto decimal',
      width: 24
    },
    purchase_order_number: { label: 'Número de orden de compra', type: 'Texto', note: 'máx. 120 caracteres', width: 30 },
    transaction_number: { label: 'Número de transacción', type: 'Texto', note: 'máx. 120 caracteres', width: 28 },
    provider_name: { label: 'Proveedor (nombre)', type: 'Texto', note: 'Debe existir en PROVEEDORES', width: 30 },
    department_code: { label: 'Departamento (código)', type: 'Texto', note: 'Debe existir en DEPARTAMENTOS', width: 28 },
    cost_center_code: { label: 'Centro de costo (código)', type: 'Texto', note: 'Debe existir en CENTROS DE COSTO', width: 30 },
    location_code: { label: 'Ubicación (código)', type: 'Texto', note: 'Debe existir en UBICACIONES', width: 28 },
    responsible_name: { label: 'Responsable (nombre)', type: 'Texto', note: 'Debe existir en RESPONSABLES', width: 30 },
    responsible_email: { label: 'Responsable (correo)', type: 'Correo electrónico', note: 'Formato nombre@dominio', width: 30 },
    additional_attributes: {
      label: 'Atributos adicionales',
      type: 'JSON (clave-valor)',
      note: 'Formato {"campo":"valor"}',
      width: 40
    }
  }
};
