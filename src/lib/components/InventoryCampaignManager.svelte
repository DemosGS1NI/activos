<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listInventoryCampaigns,
    createInventoryCampaign,
    updateInventoryCampaign,
    listLocations,
    listAssetCategories,
    listResponsibles,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const STATUS_OPTIONS = [
    { value: "draft", label: "Borrador" },
    { value: "scheduled", label: "Programada" },
    { value: "active", label: "Activa" },
    { value: "paused", label: "Pausada" },
    { value: "completed", label: "Completada" },
    { value: "archived", label: "Archivada" },
  ];

  const ALL_OPTION_VALUE = "__ALL__";

  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  function uniqueStrings(items) {
    return Array.from(
      new Set((Array.isArray(items) ? items : []).map((item) => String(item)).filter(Boolean))
    );
  }

  function toStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (item === null || item === undefined) return null;
        return String(item);
      })
      .filter((item) => Boolean(item));
  }

  function createDefaultDraft() {
    return {
      name: "",
      description: "",
      status: "draft",
      startsAt: "",
      endsAt: "",
      metadataText: "{\n}\n",
      selectedLocationIds: [],
      selectedAssetCategoryIds: [],
      selectedResponsibleIds: [],
    };
  }

  let campaigns = [];
  let loading = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let creating = false;
  let editingId = null;
  let draft = createDefaultDraft();

  let referenceLoading = true;
  let referenceError = "";
  let locationOptions = [];
  let assetCategoryOptions = [];
  let responsibleOptions = [];
  let locationMap = new Map();
  let assetCategoryMap = new Map();
  let responsibleMap = new Map();
  let preservedScopeFilters = {};

  onMount(() => {
    void loadReferenceData();
    void loadCampaigns();
  });

  function resetDraft() {
    draft = createDefaultDraft();
    preservedScopeFilters = {};
  }

  function resetMessage() {
    message = "";
    messageTone = "";
  }

  async function loadReferenceData() {
    referenceLoading = true;
    referenceError = "";
    try {
      const [locations, categories, responsibles] = await Promise.all([
        listLocations(),
        listAssetCategories(),
        listResponsibles(),
      ]);

      locationOptions = (Array.isArray(locations) ? locations : [])
        .map((item) => ({
          id: item?.id ? String(item.id) : "",
          name: item?.name || item?.label || item?.code || "",
          code: item?.code || "",
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

      assetCategoryOptions = (Array.isArray(categories) ? categories : [])
        .map((item) => ({
          id: item?.id ? String(item.id) : "",
          name: item?.name || item?.label || item?.code || "",
          code: item?.code || "",
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));

      responsibleOptions = (Array.isArray(responsibles) ? responsibles : [])
        .map((item) => ({
          id: item?.id ? String(item.id) : "",
          name: item?.name || item?.email || "",
        }))
        .filter((item) => item.id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    } catch (err) {
      referenceError = err?.message || "No fue posible cargar las listas de referencia";
    } finally {
      referenceLoading = false;
    }
  }

  $: locationMap = new Map(
    locationOptions.map((item) => [item.id, item.name || item.code || item.id])
  );

  $: assetCategoryMap = new Map(
    assetCategoryOptions.map((item) => [item.id, item.name || item.code || item.id])
  );

  $: responsibleMap = new Map(
    responsibleOptions.map((item) => [item.id, item.name || item.id])
  );

  async function loadCampaigns() {
    loading = true;
    resetMessage();
    try {
      const data = await listInventoryCampaigns();
      campaigns = Array.isArray(data) ? data : [];
    } catch (err) {
      message = err?.message || "No fue posible cargar las campañas de inventario";
      messageTone = "error";
    } finally {
      loading = false;
    }
  }

  function startCreate() {
    resetMessage();
    resetDraft();
    creating = true;
    editingId = null;
  }

  function startEdit(campaign) {
    resetMessage();
    creating = false;
    editingId = campaign.id;
    const scope = campaign.scopeFilters && typeof campaign.scopeFilters === "object"
      ? campaign.scopeFilters
      : {};

    const {
      locations: scopeLocations,
      assetCategories: scopeCategories,
      responsibles: scopeResponsibles,
      ...restScope
    } = scope || {};

    preservedScopeFilters = { ...restScope };

    draft = {
      name: campaign.name || "",
      description: campaign.description || "",
      status: campaign.status || "draft",
      startsAt: toInputValue(campaign.startsAt),
      endsAt: toInputValue(campaign.endsAt),
      metadataText: formatJson(campaign.metadata),
      selectedLocationIds: toStringArray(scopeLocations),
      selectedAssetCategoryIds: toStringArray(scopeCategories),
      selectedResponsibleIds: toStringArray(scopeResponsibles),
    };

    if (!draft.metadataText || !draft.metadataText.trim()) {
      draft = { ...draft, metadataText: "{\n}\n" };
    }
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function formatJson(value) {
    try {
      if (value === null || value === undefined) return "{\n}\n";
      return JSON.stringify(value, null, 2) + "\n";
    } catch (_) {
      return "{\n}\n";
    }
  }

  function toInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - tzOffset * 60000);
    return local.toISOString().slice(0, 16);
  }

  function toIsoValue(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Ingresa una fecha válida");
    }
    return date.toISOString();
  }

  function toDateInputValue(value) {
    if (!value) return "";
    if (value.includes("T")) {
      return value.split("T")[0];
    }
    return value.slice(0, 10);
  }

  function extractTimeFragment(value) {
    if (!value || !value.includes("T")) return "";
    const [, timePart = ""] = value.split("T");
    return timePart.replace(/Z$/i, "");
  }

  function updateDraftDate(field, dateValue) {
    if (!dateValue) {
      draft = { ...draft, [field]: "" };
      return;
    }
    const current = draft?.[field] ?? "";
    const timeFragment = extractTimeFragment(current) || "00:00";
    const combined = `${dateValue}T${timeFragment}`;
    draft = { ...draft, [field]: combined };
  }

  function parseMetadataField(text) {
    const trimmed = (text ?? "").trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      return parsed;
    } catch (_) {
      throw new Error("Metadata debe ser un JSON válido");
    }
  }

  function validateDraft() {
    if (!draft.name || !draft.name.trim()) {
      throw new Error("El nombre de la campaña es requerido");
    }
    if (!STATUS_OPTIONS.some((option) => option.value === draft.status)) {
      throw new Error("Selecciona un estado válido");
    }
    if (draft.startsAt && draft.endsAt) {
      const start = new Date(draft.startsAt);
      const end = new Date(draft.endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Ingresa fechas válidas");
      }
      if (start.getTime() > end.getTime()) {
        throw new Error("La fecha de inicio no puede ser posterior a la fecha de finalización");
      }
    }
  }

  function buildScopeFilters() {
    const scope = {
      ...(preservedScopeFilters && typeof preservedScopeFilters === "object"
        ? preservedScopeFilters
        : {}),
    };

    const locations = uniqueStrings(draft.selectedLocationIds);
    const categories = uniqueStrings(draft.selectedAssetCategoryIds);
    const responsibles = uniqueStrings(draft.selectedResponsibleIds);

    if (locations.length) scope.locations = locations;
    if (categories.length) scope.assetCategories = categories;
    if (responsibles.length) scope.responsibles = responsibles;

    return scope;
  }

  function buildPayload() {
    const scopeFilters = buildScopeFilters();
    const metadata = parseMetadataField(draft.metadataText);
    return {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      scopeFilters,
      metadata,
      startsAt: draft.startsAt ? toIsoValue(draft.startsAt) : null,
      endsAt: draft.endsAt ? toIsoValue(draft.endsAt) : null,
    };
  }

  async function saveCampaign() {
    submitting = true;
    resetMessage();
    try {
      validateDraft();
      const payload = buildPayload();
      if (creating) {
        await createInventoryCampaign(payload);
        message = "Campaña creada";
      } else if (editingId) {
        await updateInventoryCampaign(editingId, payload);
        message = "Campaña actualizada";
      }
      messageTone = "success";
      await loadCampaigns();
      cancelEdit();
      dispatch("change", { entity: "inventory-campaign" });
    } catch (err) {
      message = err?.message || "No fue posible guardar la campaña";
      messageTone = "error";
    } finally {
      submitting = false;
    }
  }

  async function updateCampaignStatus(campaign, nextStatus) {
    if (campaign.status === nextStatus) return;
    submitting = true;
    resetMessage();
    try {
      await updateInventoryCampaign(campaign.id, { status: nextStatus });
      message = `Estado actualizado a ${statusLabel(nextStatus)}`;
      messageTone = "success";
      await loadCampaigns();
      dispatch("change", { entity: "inventory-campaign" });
    } catch (err) {
      message = err?.message || "No fue posible actualizar el estado";
      messageTone = "error";
    } finally {
      submitting = false;
    }
  }

  function handleMultiSelectChange(event, field) {
    const selectedValues = Array.from(event?.target?.selectedOptions ?? []).map(
      (option) => option.value
    );
    if (selectedValues.includes(ALL_OPTION_VALUE)) {
      draft = { ...draft, [field]: [] };
    } else {
      draft = { ...draft, [field]: uniqueStrings(selectedValues) };
    }
  }

  function statusLabel(status) {
    const option = STATUS_OPTIONS.find((item) => item.value === status);
    return option ? option.label : status;
  }

  function statusBadgeClass(status) {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "scheduled":
        return "bg-amber-100 text-amber-700";
      case "paused":
        return "bg-sky-100 text-sky-700";
      case "completed":
        return "bg-indigo-100 text-indigo-700";
      case "archived":
        return "bg-slate-200 text-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("es-NI", {
        dateStyle: "medium",
      }).format(date);
    } catch (_) {
      return "";
    }
  }

  function describePeriod(campaign) {
    const { startsAt, endsAt } = campaign;
    if (startsAt && endsAt) {
      return `Del ${formatDate(startsAt)} al ${formatDate(endsAt)}`;
    }
    if (startsAt) {
      return `Desde ${formatDate(startsAt)}`;
    }
    if (endsAt) {
      return `Hasta ${formatDate(endsAt)}`;
    }
    return "Sin ventana definida";
  }

  function scopeEntries(filters) {
    const results = [];
    if (!filters || typeof filters !== "object") return results;

    const pushKnown = (label, ids, map) => {
      if (!Array.isArray(ids) || !ids.length) return;
      const values = ids
        .map((id) => String(id))
        .map((id) => map.get(id) || id)
        .join(", ");
      if (values) {
        results.push({ key: label, value: values });
      }
    };

    pushKnown("Ubicaciones", filters.locations, locationMap);
    pushKnown("Tipos de activo", filters.assetCategories, assetCategoryMap);
    pushKnown("Responsables", filters.responsibles, responsibleMap);

    for (const [key, value] of Object.entries(filters)) {
      if (key === "locations" || key === "assetCategories" || key === "responsibles") continue;
      if (Array.isArray(value)) {
        results.push({ key, value: value.join(", ") });
      } else if (value && typeof value === "object") {
        const nested = scopeEntries(value);
        if (nested.length) {
          results.push(
            ...nested.map((entry) => ({
              key: `${key}.${entry.key}`,
              value: entry.value,
            }))
          );
        }
      } else if (value !== undefined && value !== null) {
        results.push({ key, value: String(value) });
      }
    }

    return results;
  }

  function statusActions(campaign) {
    const actions = [];
    const add = (value, label) => {
      if (!actions.some((action) => action.value === value)) {
        actions.push({ value, label });
      }
    };

    if (campaign.status === "paused") {
      add("active", "Reanudar");
    } else if (campaign.status === "completed") {
      add("active", "Reabrir");
    } else if (campaign.status !== "active" && campaign.status !== "archived") {
      add("active", "Activar");
    }

    if (campaign.status === "active") {
      add("paused", "Pausar");
      add("completed", "Completar");
    }

    if (campaign.status !== "archived") {
      add("archived", "Archivar");
    }

    return actions;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Campañas de inventario</h1>
      <p class="text-sm text-sky-700">
        Administra campañas de inventario con la misma vista tipo catálogo.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      type="button"
      on:click={startCreate}
      disabled={submitting || creating || editingId !== null}
      aria-label="Nueva campaña"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nueva campaña</span>
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

  {#if referenceError}
    <div class="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
      {referenceError}
    </div>
  {/if}

  <div class="rounded-lg border border-sky-200 bg-slate-50 shadow-sm">
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse">
        <thead class="bg-sky-200/80 text-sky-900">
          <tr class="border-b border-sky-200 text-left text-xs font-semibold tracking-wide">
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>NOMBRE</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>DESCRIPCIÓN</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>ESTADO</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>EMPIEZA</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>TERMINA</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>ALCANCE</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>ACCIONES</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loading}
            <tr>
              <td colspan="7" class="px-3 py-6 text-center text-sm text-sky-900">
                Cargando campañas…
              </td>
            </tr>
          {:else}
            {#if creating}
              <tr class="bg-white border-b border-sky-100">
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.name}
                    placeholder="Nombre de la campaña"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div class="space-y-2">
                    <textarea
                      rows="3"
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.description}
                      placeholder="Descripción"
                      disabled={submitting}
                    ></textarea>
                    <div class="space-y-1">
                      <span class="text-xs font-semibold text-sky-700">Metadata (JSON opcional)</span>
                      <textarea
                        rows="4"
                        class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                        bind:value={draft.metadataText}
                        disabled={submitting}
                      ></textarea>
                    </div>
                  </div>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <select
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.status}
                    disabled={submitting}
                  >
                    {#each STATUS_OPTIONS as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    type="date"
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    value={toDateInputValue(draft.startsAt)}
                    on:input={(event) => updateDraftDate("startsAt", event.currentTarget.value)}
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    type="date"
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    value={toDateInputValue(draft.endsAt)}
                    on:input={(event) => updateDraftDate("endsAt", event.currentTarget.value)}
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div class="space-y-3">
                    <div class="space-y-1">
                      <span class="text-xs font-semibold text-sky-700">Ubicaciones</span>
                      {#if referenceLoading}
                        <div class="rounded border border-dashed border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
                          Cargando…
                        </div>
                      {:else}
                        <select
                          multiple
                          size={Math.min(5, Math.max(locationOptions.length + 1, 4))}
                          bind:value={draft.selectedLocationIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedLocationIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todas las ubicaciones</option>
                          {#each locationOptions as option}
                            <option value={option.id}>
                              {option.name}{option.code ? ` (${option.code})` : ""}
                            </option>
                          {/each}
                        </select>
                      {/if}
                    </div>
                    <div class="space-y-1">
                      <span class="text-xs font-semibold text-sky-700">Categorías</span>
                      {#if referenceLoading}
                        <div class="rounded border border-dashed border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
                          Cargando…
                        </div>
                      {:else}
                        <select
                          multiple
                          size={Math.min(5, Math.max(assetCategoryOptions.length + 1, 4))}
                          bind:value={draft.selectedAssetCategoryIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedAssetCategoryIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todas las categorías</option>
                          {#each assetCategoryOptions as option}
                            <option value={option.id}>
                              {option.name}{option.code ? ` (${option.code})` : ""}
                            </option>
                          {/each}
                        </select>
                      {/if}
                    </div>
                    <div class="space-y-1">
                      <span class="text-xs font-semibold text-sky-700">Responsables</span>
                      {#if referenceLoading}
                        <div class="rounded border border-dashed border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-700">
                          Cargando…
                        </div>
                      {:else}
                        <select
                          multiple
                          size={Math.min(6, Math.max(responsibleOptions.length + 1, 5))}
                          bind:value={draft.selectedResponsibleIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedResponsibleIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todos los responsables</option>
                          {#each responsibleOptions as option}
                            <option value={option.id}>{option.name}</option>
                          {/each}
                        </select>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveCampaign}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar campaña"
                    >
                      {@html icons.check}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 shadow-sm transition hover:bg-slate-300"
                      on:click={cancelEdit}
                      type="button"
                      aria-label="Cancelar"
                    >
                      {@html icons.x}
                    </button>
                  </div>
                </td>
              </tr>
            {/if}

            {#if !creating && !campaigns.length}
              <tr>
                <td colspan="7" class="px-3 py-6 text-center text-sm text-sky-900">
                  No hay campañas registradas.
                </td>
              </tr>
            {/if}

            {#each campaigns as campaign (campaign.id)}
              {#if editingId === campaign.id}
                <tr class="bg-white border-b border-sky-100">
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.name}
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <div class="space-y-2">
                      <textarea
                        rows="3"
                        class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                        bind:value={draft.description}
                        disabled={submitting}
                      ></textarea>
                      <div class="space-y-1">
                        <span class="text-xs font-semibold text-sky-700">Metadata (JSON opcional)</span>
                        <textarea
                          rows="4"
                          class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          bind:value={draft.metadataText}
                          disabled={submitting}
                        ></textarea>
                      </div>
                    </div>
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <select
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.status}
                      disabled={submitting}
                    >
                      {#each STATUS_OPTIONS as option}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      type="date"
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      value={toDateInputValue(draft.startsAt)}
                      on:input={(event) => updateDraftDate("startsAt", event.currentTarget.value)}
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      type="date"
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      value={toDateInputValue(draft.endsAt)}
                      on:input={(event) => updateDraftDate("endsAt", event.currentTarget.value)}
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <div class="space-y-3">
                      <div class="space-y-1">
                        <span class="text-xs font-semibold text-sky-700">Ubicaciones</span>
                        <select
                          multiple
                          size={Math.min(5, Math.max(locationOptions.length + 1, 4))}
                          bind:value={draft.selectedLocationIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedLocationIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todas las ubicaciones</option>
                          {#each locationOptions as option}
                            <option value={option.id}>
                              {option.name}{option.code ? ` (${option.code})` : ""}
                            </option>
                          {/each}
                        </select>
                      </div>
                      <div class="space-y-1">
                        <span class="text-xs font-semibold text-sky-700">Categorías</span>
                        <select
                          multiple
                          size={Math.min(5, Math.max(assetCategoryOptions.length + 1, 4))}
                          bind:value={draft.selectedAssetCategoryIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedAssetCategoryIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todas las categorías</option>
                          {#each assetCategoryOptions as option}
                            <option value={option.id}>
                              {option.name}{option.code ? ` (${option.code})` : ""}
                            </option>
                          {/each}
                        </select>
                      </div>
                      <div class="space-y-1">
                        <span class="text-xs font-semibold text-sky-700">Responsables</span>
                        <select
                          multiple
                          size={Math.min(6, Math.max(responsibleOptions.length + 1, 5))}
                          bind:value={draft.selectedResponsibleIds}
                          class="h-full w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          disabled={submitting || referenceLoading}
                          on:change={(event) => handleMultiSelectChange(event, "selectedResponsibleIds")}
                        >
                          <option value={ALL_OPTION_VALUE}>Todos los responsables</option>
                          {#each responsibleOptions as option}
                            <option value={option.id}>{option.name}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                  </td>
                  <td class={`${DATA_CELL_CLASS} text-right`}>
                    <div class="flex justify-end gap-2">
                      <button
                        class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                        on:click={saveCampaign}
                        disabled={submitting}
                        type="button"
                        aria-label="Guardar campaña"
                      >
                        {@html icons.check}
                      </button>
                      <button
                        class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 shadow-sm transition hover:bg-slate-300"
                        on:click={cancelEdit}
                        type="button"
                        aria-label="Cancelar"
                      >
                        {@html icons.x}
                      </button>
                    </div>
                  </td>
                </tr>
              {:else}
                <tr class="border-b border-sky-100 bg-slate-50">
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <span class="font-semibold text-sky-900">{campaign.name}</span>
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <span class="text-sm text-slate-700">{campaign.description || "Sin descripción"}</span>
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <span class={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(campaign.status)}`}>
                      {statusLabel(campaign.status)}
                    </span>
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    {formatDate(campaign.startsAt) || "—"}
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    {formatDate(campaign.endsAt) || "—"}
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    {#if scopeEntries(campaign.scopeFilters).length}
                      <ul class="space-y-1 text-sm text-slate-800">
                        {#each scopeEntries(campaign.scopeFilters) as item (item.key)}
                          <li>
                            <span class="font-semibold text-slate-700">{item.key}:</span>
                            <span class="ml-1">{item.value}</span>
                          </li>
                        {/each}
                      </ul>
                    {:else}
                      <span class="text-sm text-slate-600">Todos los activos</span>
                    {/if}
                  </td>
                  <td class={`${DATA_CELL_CLASS} text-right`}>
                    <div class="flex flex-wrap justify-end gap-2">
                      <button
                        class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                        type="button"
                        on:click={() => startEdit(campaign)}
                        disabled={submitting || creating}
                        aria-label={`Editar campaña ${campaign.name}`}
                      >
                        {@html icons.edit}
                      </button>
                      {#each statusActions(campaign) as action (action.value)}
                        <button
                          class="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
                          type="button"
                          on:click={() => updateCampaignStatus(campaign, action.value)}
                          disabled={submitting || campaign.status === action.value}
                          aria-label={`Cambiar estado a ${action.label}`}
                        >
                          <span class="inline-flex items-center gap-1">
                            <span aria-hidden="true">{@html icons.refresh}</span>
                            <span>{action.label}</span>
                          </span>
                        </button>
                      {/each}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
