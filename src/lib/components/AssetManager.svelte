<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import {
    listAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    listAssetCategories,
    listAssetStatuses,
    listDepreciationMethods,
    listProviders,
    listDepartments,
    listCostCenters,
    listLocations,
    listResponsibles,
  } from "../client/api.js";
  import { openSymbolWindow } from "../symbols.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    asset_tag: "",
    name: "",
    description: "",
    alternative_number: "",
    parent_asset_id: "",
    asset_category_id: "",
    asset_status_id: "",
    depreciation_method_id: "",
    lifespan_months: "",
    depreciation_period: "",
    initial_cost: "",
    actual_cost: "",
    residual_value: "",
    actual_book_value: "",
    cumulative_depreciation_value: "",
    purchase_order_number: "",
    transaction_number: "",
    provider_id: "",
    department_id: "",
    cost_center_id: "",
    location_id: "",
    responsible_id: "",
    additional_attributes: "",
  };

  let assets = [];
  let categories = [];
  let statuses = [];
  let depreciationMethods = [];
  let providers = [];
  let departments = [];
  let costCenters = [];
  let locations = [];
  let responsibles = [];

  let loadingAssets = true;
  let loadingLookups = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let showForm = false;
  let editingId = null;
  let draft = { ...defaultDraft };
  let formError = "";
  const ADDITIONAL_PLACEHOLDER = "Ej. { 'color': 'rojo', 'modelo': 'XYZ' }";

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900 whitespace-nowrap";

  // Metadata drives which columns are available and their default visibility.
  const COLUMN_DEFINITIONS = [
    {
      id: "asset_tag",
      label: "Código",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "alternative_number",
      label: "Número alterno",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "name",
      label: "Nombre",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[12rem]",
    },
    {
      id: "description",
      label: "Descripción",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[18rem]",
    },
    {
      id: "asset_category",
      label: "Categoría",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "asset_status",
      label: "Estado",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[9rem]",
    },
    {
      id: "location",
      label: "Ubicación",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "responsible",
      label: "Responsable",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "actual_book_value",
      label: "Valor",
      defaultVisible: true,
      align: "right",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "initial_cost",
      label: "Costo inicial",
      defaultVisible: true,
      align: "right",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "actual_cost",
      label: "Costo actual",
      defaultVisible: true,
      align: "right",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "residual_value",
      label: "Valor residual",
      defaultVisible: true,
      align: "right",
      widthClass: "min-w-[8rem]",
    },
    {
      id: "depreciation_method",
      label: "Método depreciación",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "lifespan_months",
      label: "Vida útil (meses)",
      defaultVisible: true,
      align: "right",
      widthClass: "min-w-[7rem]",
    },
    {
      id: "depreciation_period",
      label: "Periodo de depreciación",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[9rem]",
    },
    {
      id: "provider",
      label: "Proveedor",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "department",
      label: "Departamento",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "cost_center",
      label: "Centro de costo",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[10rem]",
    },
    {
      id: "purchase_order_number",
      label: "Orden de compra",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[9rem]",
    },
    {
      id: "transaction_number",
      label: "Número de transacción",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[9rem]",
    },
    {
      id: "parent_asset",
      label: "Activo padre",
      defaultVisible: true,
      align: "left",
      widthClass: "min-w-[12rem]",
    },
  ];

  let visibleColumnIds = COLUMN_DEFINITIONS.filter((column) => column.defaultVisible).map((column) => column.id);
  let columnMenuOpen = false;
  let columnMenuButtonElement;
  let columnMenuElement;

  // Supported pagination sizes keep the data grid responsive without extra requests.
  const PAGE_SIZES = [10, 20, 50, 100];
  let pageSize = 10;
  let currentPage = 1;

  const currencyFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  onMount(async () => {
    await Promise.all([loadLookups(), loadAssets()]);
  });

  function resetMessage() {
    message = "";
    messageTone = "";
  }

  function showMessage(text, tone) {
    message = text;
    messageTone = tone;
  }

  async function loadAssets() {
    loadingAssets = true;
    try {
      const data = await listAssets();
      assets = Array.isArray(data) ? data : [];
      currentPage = 1;
    } catch (err) {
      showMessage(err.message || "No fue posible cargar los activos", "error");
    } finally {
      loadingAssets = false;
    }
  }

  async function loadLookups() {
    loadingLookups = true;
    try {
      const [cats, stats, methods, provs, deps, centers, locs, resps] =
        await Promise.all([
          listAssetCategories(),
          listAssetStatuses(),
          listDepreciationMethods(),
          listProviders(),
          listDepartments(),
          listCostCenters(),
          listLocations(),
          listResponsibles(),
        ]);
      categories = Array.isArray(cats) ? cats : [];
      statuses = Array.isArray(stats) ? stats : [];
      depreciationMethods = Array.isArray(methods) ? methods : [];
      providers = Array.isArray(provs) ? provs : [];
      departments = Array.isArray(deps) ? deps : [];
      costCenters = Array.isArray(centers) ? centers : [];
      locations = Array.isArray(locs) ? locs : [];
      responsibles = Array.isArray(resps) ? resps : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los catálogos de activos",
        "error"
      );
    } finally {
      loadingLookups = false;
    }
  }

  function formatAmount(value) {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    return currencyFormatter.format(num);
  }

  function emptyToNull(value) {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  function idOrNull(value) {
    const normalized = emptyToNull(value);
    return normalized ? String(normalized) : null;
  }

  function integerOrNull(value, label) {
    const normalized = emptyToNull(value);
    if (normalized === null) return null;
    const parsed = Number.parseInt(normalized, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`${label} debe ser un entero válido`);
    }
    return parsed;
  }

  function decimalOrNull(value, label) {
    const normalized = emptyToNull(value);
    if (normalized === null) return null;
    const str = normalized.replace(/,/g, ".");
    const parsed = Number.parseFloat(str);
    if (Number.isNaN(parsed)) {
      throw new Error(`${label} debe ser un número válido`);
    }
    return parsed;
  }

  function parseAdditionalAttributes(raw) {
    if (raw === undefined || raw === null) return undefined;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new Error("Atributos adicionales deben ser un JSON válido");
    }
  }

  function resetDraft() {
    draft = { ...defaultDraft };
    formError = "";
  }

  function openCreate() {
    resetMessage();
    resetDraft();
    editingId = null;
    showForm = true;
  }

  function openEdit(asset) {
    resetMessage();
    editingId = asset.id;
    draft = {
      asset_tag: asset.asset_tag || "",
      name: asset.name || "",
      description: asset.description || "",
      alternative_number: asset.alternative_number || "",
      parent_asset_id: asset.parent_asset_id || "",
      asset_category_id: asset.asset_category_id || "",
      asset_status_id: asset.asset_status_id || "",
      depreciation_method_id: asset.depreciation_method_id || "",
      lifespan_months:
        asset.lifespan_months === null || asset.lifespan_months === undefined
          ? ""
          : String(asset.lifespan_months),
      depreciation_period: asset.depreciation_period || "",
      initial_cost:
        asset.initial_cost === null || asset.initial_cost === undefined
          ? ""
          : String(asset.initial_cost),
      actual_cost:
        asset.actual_cost === null || asset.actual_cost === undefined
          ? ""
          : String(asset.actual_cost),
      residual_value:
        asset.residual_value === null || asset.residual_value === undefined
          ? ""
          : String(asset.residual_value),
      actual_book_value:
        asset.actual_book_value === null ||
        asset.actual_book_value === undefined
          ? ""
          : String(asset.actual_book_value),
      cumulative_depreciation_value:
        asset.cumulative_depreciation_value === null ||
        asset.cumulative_depreciation_value === undefined
          ? ""
          : String(asset.cumulative_depreciation_value),
      purchase_order_number: asset.purchase_order_number || "",
      transaction_number: asset.transaction_number || "",
      provider_id: asset.provider_id || "",
      department_id: asset.department_id || "",
      cost_center_id: asset.cost_center_id || "",
      location_id: asset.location_id || "",
      responsible_id: asset.responsible_id || "",
      additional_attributes: asset.additional_attributes
        ? JSON.stringify(asset.additional_attributes, null, 2)
        : "",
    };
    formError = "";
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingId = null;
    resetDraft();
  }

  async function saveAsset() {
    submitting = true;
    formError = "";
    resetMessage();
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateAsset(editingId, payload);
        showMessage("Activo actualizado", "success");
      } else {
        await createAsset(payload);
        showMessage("Activo creado", "success");
      }
      await loadAssets();
      closeForm();
      dispatch("change", { entity: "asset" });
    } catch (err) {
      formError = err?.message || "No fue posible guardar el activo";
    } finally {
      submitting = false;
    }
  }

  async function removeAsset(asset) {
    const confirmed = confirm(
      `¿Eliminar el activo "${asset.asset_tag || asset.name}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteAsset(asset.id);
      showMessage("Activo eliminado", "success");
      await loadAssets();
      dispatch("change", { entity: "asset" });
    } catch (err) {
      showMessage(err?.message || "No fue posible eliminar el activo", "error");
    } finally {
      submitting = false;
    }
  }

  function labelFor(list, id, fallback = "—") {
    if (!id) return fallback;
    const item = list.find((entry) => entry?.id === id);
    if (!item) return fallback;
    return item.name || item.title || fallback;
  }

  $: sortedAssets = [...assets].sort((a, b) => {
    const tagA = (a.asset_tag || "").toString();
    const tagB = (b.asset_tag || "").toString();
    return tagA.localeCompare(tagB, "es", { sensitivity: "base" });
  });

  $: visibleColumns = COLUMN_DEFINITIONS.filter((column) =>
    visibleColumnIds.includes(column.id)
  );
  $: visibleColumnCount = visibleColumns.length;
  $: allColumnsSelected = visibleColumnIds.length === COLUMN_DEFINITIONS.length;

  $: if (!PAGE_SIZES.includes(pageSize)) {
    pageSize = PAGE_SIZES[0];
  }

  $: totalPages = Math.max(
    1,
    Math.ceil((sortedAssets?.length || 0) / pageSize) || 1
  );

  $: {
    const normalizedPage = Math.min(Math.max(1, currentPage), totalPages);
    if (normalizedPage !== currentPage) {
      currentPage = normalizedPage;
    }
  }

  $: pageStart = (currentPage - 1) * pageSize;
  $: pageEnd = pageStart + pageSize;
  $: paginatedAssets = sortedAssets.slice(pageStart, pageEnd);

  function toggleColumn(columnId) {
    if (visibleColumnIds.includes(columnId)) {
      if (visibleColumnIds.length === 1) {
        return;
      }
      visibleColumnIds = visibleColumnIds.filter((id) => id !== columnId);
    } else {
      visibleColumnIds = [...visibleColumnIds, columnId];
    }
  }

  function selectAllColumns() {
    visibleColumnIds = COLUMN_DEFINITIONS.map((column) => column.id);
  }

  function resetColumnsToDefault() {
    visibleColumnIds = COLUMN_DEFINITIONS.filter((column) => column.defaultVisible).map(
      (column) => column.id
    );
  }

  function handlePageSizeChange(event) {
    const next = Number(event?.currentTarget?.value);
    pageSize = Number.isFinite(next) && next > 0 ? next : PAGE_SIZES[0];
    currentPage = 1;
  }

  function goToPreviousPage() {
    if (currentPage > 1) {
      currentPage = currentPage - 1;
    }
  }

  function goToNextPage() {
    if (currentPage < totalPages) {
      currentPage = currentPage + 1;
    }
  }

  function handleWindowClick(event) {
    if (!columnMenuOpen) return;
    const target = event?.target;
    if (
      columnMenuElement?.contains(target) ||
      columnMenuButtonElement?.contains(target)
    ) {
      return;
    }
    columnMenuOpen = false;
  }

  function handleWindowKeydown(event) {
    if (event?.key === "Escape" && columnMenuOpen) {
      columnMenuOpen = false;
    }
  }
  
</script>

<svelte:window on:click={handleWindowClick} on:keydown={handleWindowKeydown} />

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Activos</h1>
      <p class="text-sm text-sky-700">Gestion de Activos</p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <button
        class="order-last flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
        type="button"
        on:click={openCreate}
        disabled={submitting || loadingLookups}
        aria-label="Nuevo activo"
      >
        <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
        <span>Nuevo</span>
      </button>
      <div class="relative order-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-100"
          on:click={() => (columnMenuOpen = !columnMenuOpen)}
          aria-haspopup="true"
          aria-expanded={columnMenuOpen}
          bind:this={columnMenuButtonElement}
        >
          <span class="inline-block" aria-hidden="true">{@html icons.table}</span>
          <span>Columnas</span>
        </button>
        {#if columnMenuOpen}
          <div
            class="absolute right-0 z-20 mt-2 w-64 rounded-md border border-sky-200 bg-white p-3 text-sky-900 shadow-xl"
            role="dialog"
            aria-label="Configurar columnas"
            bind:this={columnMenuElement}
          >
            <div class="flex items-center justify-between gap-2 pb-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-sky-700">
                Columnas visibles
              </span>
              <button
                type="button"
                class="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
                on:click={resetColumnsToDefault}
              >
                Restablecer
              </button>
            </div>
            <div class="max-h-60 space-y-2 overflow-y-auto pr-1 text-sm text-sky-800">
              {#each COLUMN_DEFINITIONS as column (column.id)}
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                    checked={visibleColumnIds.includes(column.id)}
                    on:change={() => toggleColumn(column.id)}
                  />
                  <span>{column.label}</span>
                </label>
              {/each}
            </div>
            <div class="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                class="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
                on:click={selectAllColumns}
                disabled={allColumnsSelected}
              >
                Seleccionar todas
              </button>
              <button
                type="button"
                class="text-xs font-medium text-sky-700 transition hover:text-sky-900"
                on:click={() => (columnMenuOpen = false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        {/if}
      </div>
      <div class="order-2 flex items-center gap-2">
        <label for="asset-page-size" class="sr-only">Filas por página</label>
        <select
          id="asset-page-size"
          class="rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 shadow-sm transition focus:border-indigo-400 focus:outline-none min-w-[5.5rem]"
          on:change={handlePageSizeChange}
        >
          {#each PAGE_SIZES as size}
            <option value={size} selected={size === pageSize}>{size} filas</option>
          {/each}
        </select>
      </div>
      <div class="order-first flex flex-wrap items-center justify-end gap-2 text-sm text-sky-900">
        <span class="flex items-center gap-1">
          <span>Mostrando</span>
          <span class="font-semibold text-sky-800">
            {sortedAssets.length ? pageStart + 1 : 0}
          </span>
          <span>-</span>
          <span class="font-semibold text-sky-800">
            {Math.min(pageEnd, sortedAssets.length)}
          </span>
          <span>de</span>
          <span class="font-semibold text-sky-800">{sortedAssets.length}</span>
        </span>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          on:click={goToPreviousPage}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span class="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          on:click={goToNextPage}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  </div>

  {#if message}
    <div
      class={`rounded-md px-4 py-2 text-sm ${
        messageTone === "success"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {message}
    </div>
  {/if}

  <div class="rounded-lg border border-sky-200 bg-slate-50 shadow-sm">
    <div class="overflow-x-auto">
      <table class="min-w-[1400px] border-collapse">
        <thead class="bg-sky-200/80 text-sky-900">
          <tr
            class="border-b border-sky-200 text-left text-xs font-semibold tracking-wide"
          >
            {#each visibleColumns as column (column.id)}
              <th
                class={`border-r border-sky-200 px-3 py-2 ${
                  column.align === "right" ? "text-right" : ""
                } ${column.widthClass || ""}`}
              >
                {#if column.id === "asset_tag"}
                  <button type="button" class={HEADER_BUTTON_CLASS}>
                    {column.label}
                  </button>
                {:else}
                  <span class={`${HEADER_LABEL_CLASS} whitespace-nowrap`}>
                    {column.label}
                  </span>
                {/if}
              </th>
            {/each}
            <th
              class="sticky right-0 z-10 px-3 py-2 text-right bg-sky-200/80 border-l border-sky-200"
            >
              <span class={HEADER_LABEL_CLASS}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loadingAssets}
            <tr>
              <td
                colspan={visibleColumnCount + 1}
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando activos…
              </td>
            </tr>
          {:else if !sortedAssets.length}
            <tr>
              <td
                colspan={visibleColumnCount + 1}
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay activos registrados.
              </td>
            </tr>
          {:else}
            {#each paginatedAssets as item (item.id)}
              <tr class="border-b border-sky-100 bg-white">
                {#each visibleColumns as column (column.id)}
                  <td
                    class={`border-r border-sky-100 ${DATA_CELL_CLASS} ${
                      column.align === "right" ? "text-right" : ""
                    } ${column.widthClass || ""}`}
                  >
                    {#if column.id === "asset_tag"}
                      <span class="text-sky-800">
                        {item.asset_tag || "—"}
                      </span>
                    {:else if column.id === "alternative_number"}
                      {#if item.alternative_number}
                        <span class="text-sky-800">{item.alternative_number}</span>
                      {:else}
                        <span class="text-slate-500">—</span>
                      {/if}
                    {:else if column.id === "name"}
                      {#if item.name}
                        <span class="text-sky-800">{item.name}</span>
                      {:else}
                        <span class="text-slate-500">—</span>
                      {/if}
                    {:else if column.id === "description"}
                      {#if item.description}
                        <span class="text-sky-800">{item.description}</span>
                      {:else}
                        <span class="text-slate-500">—</span>
                      {/if}
                    {:else if column.id === "asset_category"}
                      {item.asset_category_name ||
                        labelFor(categories, item.asset_category_id)}
                    {:else if column.id === "asset_status"}
                      <span
                        class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                          item.asset_status_name === "Retirado" ||
                          item.asset_status_name === "Dado de baja"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        <span
                          class={`h-2 w-2 rounded-full ${
                            item.asset_status_name === "Retirado" ||
                            item.asset_status_name === "Dado de baja"
                              ? "bg-rose-500"
                              : "bg-emerald-500"
                          }`}
                        ></span>
                        {item.asset_status_name ||
                          labelFor(statuses, item.asset_status_id)}
                      </span>
                    {:else if column.id === "location"}
                      {item.location_name || labelFor(locations, item.location_id)}
                    {:else if column.id === "responsible"}
                      {item.responsible_name ||
                        labelFor(responsibles, item.responsible_id)}
                    {:else if column.id === "actual_book_value"}
                      {formatAmount(
                        item.actual_book_value ??
                          item.actual_cost ??
                          item.initial_cost
                      )}
                    {:else if column.id === "initial_cost"}
                      {formatAmount(item.initial_cost)}
                    {:else if column.id === "actual_cost"}
                      {formatAmount(item.actual_cost)}
                    {:else if column.id === "residual_value"}
                      {formatAmount(item.residual_value)}
                    {:else if column.id === "provider"}
                      {item.provider_name || labelFor(providers, item.provider_id)}
                    {:else if column.id === "department"}
                      {item.department_name || labelFor(departments, item.department_id)}
                    {:else if column.id === "cost_center"}
                      {item.cost_center_name || labelFor(costCenters, item.cost_center_id)}
                    {:else if column.id === "depreciation_method"}
                      {item.depreciation_method_name ||
                        labelFor(depreciationMethods, item.depreciation_method_id)}
                    {:else if column.id === "lifespan_months"}
                      {item.lifespan_months ?? "—"}
                    {:else if column.id === "depreciation_period"}
                      {item.depreciation_period || "—"}
                    {:else if column.id === "purchase_order_number"}
                      {item.purchase_order_number || "—"}
                    {:else if column.id === "transaction_number"}
                      {item.transaction_number || "—"}
                    {:else if column.id === "parent_asset"}
                      {@const parentLabel = labelFor(assets, item.parent_asset_id)}
                      {#if item.parent_asset_tag || item.parent_asset_name}
                        <span class="text-sky-800">
                          {(item.parent_asset_tag && `${item.parent_asset_tag} — `) || ""}
                          {item.parent_asset_name || ""}
                        </span>
                      {:else if item.parent_asset_id}
                        <span class="text-sky-800">
                          {parentLabel !== "—" ? parentLabel : item.parent_asset_id}
                        </span>
                      {:else}
                        <span class="text-slate-500">—</span>
                      {/if}
                    {:else}
                      <span class="text-slate-500">—</span>
                    {/if}
                  </td>
                {/each}
                <td
                  class={`${DATA_CELL_CLASS} text-right sticky right-0 bg-white border-l border-sky-200`}
                >
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                      type="button"
                      on:click={() => openSymbolWindow({ type: 'code128', code: item.asset_tag })}
                      aria-label="Generar código de barras"
                      title="Generar código de barras"
                    >
                      <span class="text-xs font-semibold">BC</span>
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                      type="button"
                      on:click={() => openSymbolWindow({ type: 'qr', code: item.asset_tag })}
                      aria-label="Generar QR"
                      title="Generar QR"
                    >
                      <span class="text-xs font-semibold">QR</span>
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      type="button"
                      on:click={() => openEdit(item)}
                      aria-label="Editar activo"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      type="button"
                      on:click={() => removeAsset(item)}
                      disabled={submitting}
                      aria-label="Eliminar activo"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if showForm}
  <div
    class="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4"
  >
    <div
      class="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
    >
      <div
        class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4"
      >
        <div>
          <h2 class="text-lg font-semibold text-sky-900">
            {editingId ? "Editar activo" : "Nuevo activo"}
          </h2>
          <p class="text-sm text-sky-700">
            Completa los datos principales del activo para mantener un
            inventario consistente.
          </p>
        </div>
        <button
          class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300"
          type="button"
          on:click={closeForm}
          aria-label="Cerrar formulario"
        >
          {@html icons.x}
        </button>
      </div>

      {#if formError}
        <div
          class="mt-4 rounded-md bg-rose-100 px-4 py-2 text-sm text-rose-700"
        >
          {formError}
        </div>
      {/if}

      <form class="mt-4 space-y-6" on:submit|preventDefault={saveAsset}>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <label
              for="asset-tag"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Número de activo
            </label>
            <input
              id="asset-tag"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.asset_tag}
              required
              placeholder="Ej. ACT-1001"
              autocomplete="off"
              spellcheck={false}
            />
          </div>
          <div class="space-y-1">
            <label
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
              for="asset-name-input"
            >
              Nombre
            </label>
            <input
              id="asset-name-input"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.name}
              required
              placeholder="Nombre descriptivo"
            />
          </div>
          <div class="md:col-span-2 space-y-1">
            <label
              for="asset-description"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Descripción
            </label>
            <textarea
              id="asset-description"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              rows="2"
              bind:value={draft.description}
              placeholder="Detalles adicionales"
            ></textarea>
          </div>
          <div class="space-y-1">
            <label
              for="asset-alternative-number"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Número alterno
            </label>
            <input
              id="asset-alternative-number"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.alternative_number}
              placeholder="Código secundario"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-parent"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Activo padre
            </label>
            <select
              id="asset-parent"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.parent_asset_id}
              disabled={loadingAssets}
            >
              <option value="">(Sin padre)</option>
              {#each assets as item (item.id)}
                {#if !editingId || item.id !== editingId}
                  <option value={item.id}>
                    {item.asset_tag} — {item.name}
                  </option>
                {/if}
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-category"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Categoría
            </label>
            <select
              id="asset-category"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.asset_category_id}
              required
              disabled={loadingLookups}
            >
              <option value="" disabled>Selecciona categoría</option>
              {#each categories as cat (cat.id)}
                <option value={cat.id}>{cat.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-status"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Estado
            </label>
            <select
              id="asset-status"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.asset_status_id}
              required
              disabled={loadingLookups}
            >
              <option value="" disabled>Selecciona estado</option>
              {#each statuses as st (st.id)}
                <option value={st.id}>{st.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-depreciation-method"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Método de depreciación
            </label>
            <select
              id="asset-depreciation-method"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.depreciation_method_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin método)</option>
              {#each depreciationMethods as method (method.id)}
                <option value={method.id}>{method.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-lifespan"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Vida útil (meses)
            </label>
            <input
              id="asset-lifespan"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.lifespan_months}
              type="number"
              min="0"
              placeholder="Ej. 48"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-depreciation-period"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Periodo de depreciación
            </label>
            <input
              id="asset-depreciation-period"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.depreciation_period}
              placeholder="Ej. Mensual"
            />
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <label
              for="asset-initial-cost"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Costo inicial
            </label>
            <input
              id="asset-initial-cost"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.initial_cost}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-actual-cost"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Costo actual
            </label>
            <input
              id="asset-actual-cost"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.actual_cost}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-residual-value"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Valor residual
            </label>
            <input
              id="asset-residual-value"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.residual_value}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-book-value"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Valor en libros
            </label>
            <input
              id="asset-book-value"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.actual_book_value}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-cumulative-depreciation"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Depreciación acumulada
            </label>
            <input
              id="asset-cumulative-depreciation"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.cumulative_depreciation_value}
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-purchase-order"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Orden de compra
            </label>
            <input
              id="asset-purchase-order"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.purchase_order_number}
              placeholder="Referencia"
            />
          </div>
          <div class="space-y-1">
            <label
              for="asset-transaction-number"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Número de transacción
            </label>
            <input
              id="asset-transaction-number"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.transaction_number}
              placeholder="Documento contable"
            />
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <label
              for="asset-provider"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Proveedor
            </label>
            <select
              id="asset-provider"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.provider_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin proveedor)</option>
              {#each providers as provider (provider.id)}
                <option value={provider.id}>{provider.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-department"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Departamento
            </label>
            <select
              id="asset-department"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.department_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin departamento)</option>
              {#each departments as dept (dept.id)}
                <option value={dept.id}>{dept.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-cost-center"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Centro de costos
            </label>
            <select
              id="asset-cost-center"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.cost_center_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin centro)</option>
              {#each costCenters as center (center.id)}
                <option value={center.id}>{center.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-location"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Ubicación
            </label>
            <select
              id="asset-location"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.location_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin ubicación)</option>
              {#each locations as loc (loc.id)}
                <option value={loc.id}>{loc.name}</option>
              {/each}
            </select>
          </div>
          <div class="space-y-1">
            <label
              for="asset-responsible"
              class="text-xs font-semibold uppercase tracking-wide text-sky-700"
            >
              Responsable
            </label>
            <select
              id="asset-responsible"
              class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              bind:value={draft.responsible_id}
              disabled={loadingLookups}
            >
              <option value="">(Sin responsable)</option>
              {#each responsibles as resp (resp.id)}
                <option value={resp.id}>{resp.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="space-y-1">
          <label
            for="asset-additional-attributes"
            class="text-xs font-semibold uppercase tracking-wide text-sky-700"
          >
            Atributos adicionales (JSON)
          </label>
          <textarea
            id="asset-additional-attributes"
            class="w-full rounded border border-sky-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            rows="4"
            bind:value={draft.additional_attributes}
            placeholder={ADDITIONAL_PLACEHOLDER}
          ></textarea>
        </div>

        <div
          class="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white pt-4 pb-2"
        >
          <button
            class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            type="button"
            on:click={closeForm}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
