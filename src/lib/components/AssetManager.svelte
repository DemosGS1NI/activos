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
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

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
      throw new Error("Los atributos adicionales deben ser JSON válido");
    }
  }

  function buildPayload() {
    const tag = String(draft.asset_tag || "")
      .trim()
      .toUpperCase();
    if (!tag) throw new Error("El número de activo es requerido");

    const name = String(draft.name || "").trim();
    if (!name) throw new Error("El nombre del activo es requerido");

    if (!draft.asset_category_id) {
      throw new Error("La categoría del activo es requerida");
    }

    if (!draft.asset_status_id) {
      throw new Error("El estado del activo es requerido");
    }

    return {
      asset_tag: tag,
      name,
      description: emptyToNull(draft.description),
      alternative_number: emptyToNull(draft.alternative_number),
      parent_asset_id: idOrNull(draft.parent_asset_id),
      asset_category_id: String(draft.asset_category_id),
      asset_status_id: String(draft.asset_status_id),
      depreciation_method_id: idOrNull(draft.depreciation_method_id),
      lifespan_months: integerOrNull(draft.lifespan_months, "La vida útil"),
      depreciation_period: emptyToNull(draft.depreciation_period),
      initial_cost: decimalOrNull(draft.initial_cost, "El costo inicial"),
      actual_cost: decimalOrNull(draft.actual_cost, "El costo actual"),
      residual_value: decimalOrNull(draft.residual_value, "El valor residual"),
      actual_book_value: decimalOrNull(
        draft.actual_book_value,
        "El valor en libros"
      ),
      cumulative_depreciation_value: decimalOrNull(
        draft.cumulative_depreciation_value,
        "La depreciación acumulada"
      ),
      purchase_order_number: emptyToNull(draft.purchase_order_number),
      transaction_number: emptyToNull(draft.transaction_number),
      provider_id: idOrNull(draft.provider_id),
      department_id: idOrNull(draft.department_id),
      cost_center_id: idOrNull(draft.cost_center_id),
      location_id: idOrNull(draft.location_id),
      responsible_id: idOrNull(draft.responsible_id),
      additional_attributes: parseAdditionalAttributes(
        draft.additional_attributes
      ),
    };
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
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Activos</h1>
      <p class="text-sm text-sky-700">
        Gestiona el inventario de activos y su información principal.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      type="button"
      on:click={openCreate}
      disabled={submitting || loadingLookups}
      aria-label="Nuevo activo"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nuevo activo</span>
    </button>
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
      <table class="min-w-full border-collapse">
        <thead class="bg-sky-200/80 text-sky-900">
          <tr
            class="border-b border-sky-200 text-left text-xs font-semibold tracking-wide"
          >
            <th class="border-r border-sky-200 px-3 py-2">
              <button type="button" class={HEADER_BUTTON_CLASS}>
                Código
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Nombre</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Categoría</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Estado</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Ubicación</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Responsable</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>Valor</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loadingAssets}
            <tr>
              <td
                colspan="8"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando activos…
              </td>
            </tr>
          {:else if !sortedAssets.length}
            <tr>
              <td
                colspan="8"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay activos registrados.
              </td>
            </tr>
          {:else}
            {#each sortedAssets as item (item.id)}
              <tr class="border-b border-sky-100 bg-white">
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div class="font-semibold text-sky-900">{item.asset_tag}</div>
                  {#if item.alternative_number}
                    <div class="text-xs text-sky-600">
                      Alt: {item.alternative_number}
                    </div>
                  {/if}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div class="font-medium">{item.name}</div>
                  {#if item.description}
                    <div class="text-xs text-sky-600">
                      {item.description}
                    </div>
                  {/if}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.asset_category_name ||
                    labelFor(categories, item.asset_category_id)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
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
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.location_name || labelFor(locations, item.location_id)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.responsible_name ||
                    labelFor(responsibles, item.responsible_id)}
                </td>
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-right`}
                >
                  {formatAmount(
                    item.actual_book_value ??
                      item.actual_cost ??
                      item.initial_cost
                  )}
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
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
