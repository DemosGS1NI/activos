<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listLocations,
    createLocation,
    updateLocation,
    deleteLocation,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    code: "",
    name: "",
    parent_id: "",
    address_line: "",
    city: "",
    region: "",
    country: "",
    postal_code: "",
    latitude: "",
    longitude: "",
  };

  let locations = [];
  let loading = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "name";
  let sortDirection = "asc";
  let editingId = null;
  let creating = false;
  let draft = { ...defaultDraft };

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  onMount(loadLocations);

  function resetDraft() {
    draft = { ...defaultDraft };
  }

  function resetMessage() {
    message = "";
    messageTone = "";
  }

  function showMessage(text, tone) {
    message = text;
    messageTone = tone;
  }

  async function loadLocations() {
    loading = true;
    resetMessage();
    try {
      const data = await listLocations();
      locations = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar las ubicaciones",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function parentOptions(excludeId = null) {
    return locations
      .filter((loc) => loc.id !== excludeId)
      .map((loc) => ({ value: loc.id, label: loc.name || loc.code }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );
  }

  function valueForSort(item, key) {
    const value = item?.[key];
    return (value ?? "").toString().toLowerCase();
  }

  function sortedLocations() {
    const data = [...locations];
    data.sort((a, b) => {
      const av = valueForSort(a, sortKey);
      const bv = valueForSort(b, sortKey);
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }

  function toggleSort(key) {
    if (sortKey === key) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDirection = "asc";
    }
  }

  function startCreate() {
    resetMessage();
    resetDraft();
    creating = true;
    editingId = null;
  }

  function startEdit(item) {
    resetMessage();
    creating = false;
    editingId = item.id;
    draft = {
      code: item.code || "",
      name: item.name || "",
      parent_id: item.parent_id || "",
      address_line: item.address_line || "",
      city: item.city || "",
      region: item.region || "",
      country: item.country || "",
      postal_code: item.postal_code || "",
      latitude:
        item.latitude === null || item.latitude === undefined
          ? ""
          : String(item.latitude),
      longitude:
        item.longitude === null || item.longitude === undefined
          ? ""
          : String(item.longitude),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function normalizedParent(value) {
    const trimmed = (value ?? "").toString().trim();
    return trimmed.length ? trimmed : null;
  }

  function optionalString(value) {
    const trimmed = (value ?? "").toString().trim();
    return trimmed.length ? trimmed : null;
  }

  function optionalCoordinate(value, label) {
    const trimmed = (value ?? "").toString().trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      throw new Error(`La coordenada ${label} es inválida`);
    }
    return num;
  }

  function buildPayload() {
    return {
      code: draft.code.trim(),
      name: draft.name.trim(),
      parent_id: normalizedParent(draft.parent_id),
      address_line: optionalString(draft.address_line),
      city: optionalString(draft.city),
      region: optionalString(draft.region),
      country: optionalString(draft.country),
      postal_code: optionalString(draft.postal_code),
      latitude: optionalCoordinate(draft.latitude, "de latitud"),
      longitude: optionalCoordinate(draft.longitude, "de longitud"),
    };
  }

  function displayValue(value) {
    if (value === null || value === undefined) return "—";
    const text = value.toString().trim();
    return text.length ? text : "—";
  }

  function coordinateDisplay(value) {
    return value === null || value === undefined ? "—" : value;
  }

  function actionCellClass(isEditing) {
    return `${DATA_CELL_CLASS} sticky right-0 text-right border-l border-sky-200 ${isEditing ? "bg-white" : "bg-slate-50"} shadow-[inset_1px_0_0_rgba(15,23,42,0.1)]`;
  }

  async function saveLocation() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.code?.trim()) throw new Error("El código es requerido");
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");

      const payload = buildPayload();

      if (creating) {
        await createLocation(payload);
        showMessage("Ubicación creada", "success");
      } else if (editingId) {
        await updateLocation(editingId, payload);
        showMessage("Ubicación actualizada", "success");
      }

      await loadLocations();
      cancelEdit();
      dispatch("change", { entity: "location" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible guardar la ubicación",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  async function removeLocation(item) {
    const confirmed = confirm(
      `¿Eliminar la ubicación "${item.name || item.code}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteLocation(item.id);
      showMessage("Ubicación eliminada", "success");
      await loadLocations();
      dispatch("change", { entity: "location" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar la ubicación",
        "error"
      );
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Ubicaciones</h1>
      <p class="text-sm text-sky-700">
        Administra las ubicaciones disponibles para los activos.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nueva ubicación"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nueva ubicación</span>
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
      <table class="w-full min-w-[1200px] border-collapse">
        <thead class="bg-sky-200/80 text-sky-900">
          <tr
            class="border-b border-sky-200 text-left text-xs font-semibold tracking-wide"
          >
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("code")}
              >
                Código
                {#if sortKey === "code"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("name")}
              >
                Nombre
                {#if sortKey === "name"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("parent_name")}
              >
                Padre
                {#if sortKey === "parent_name"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Dirección</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("city")}
              >
                Ciudad
                {#if sortKey === "city"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("region")}
              >
                Región/Estado
                {#if sortKey === "region"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("country")}
              >
                País
                {#if sortKey === "country"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("postal_code")}
              >
                Código postal
                {#if sortKey === "postal_code"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("latitude")}
              >
                Latitud
                {#if sortKey === "latitude"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("longitude")}
              >
                Longitud
                {#if sortKey === "longitude"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="sticky right-0 z-10 bg-sky-200/90 px-3 py-2 text-right shadow-[inset_1px_0_0_rgba(15,23,42,0.18)] backdrop-blur">
              <span class={HEADER_LABEL_CLASS}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loading}
            <tr>
              <td
                colspan="11"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando ubicaciones…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.code}
                  placeholder="código"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.name}
                  placeholder="Nombre"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <select
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.parent_id}
                  disabled={submitting || parentOptions().length === 0}
                >
                  <option value="">Sin padre</option>
                  {#each parentOptions() as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.address_line}
                            placeholder="Dirección"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.city}
                            placeholder="Ciudad"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.region}
                            placeholder="Región/Estado"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.country}
                            placeholder="País"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.postal_code}
                            placeholder="Código postal"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.latitude}
                            placeholder="Latitud"
                            disabled={submitting}
                          />
                        </td>
                        <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                          <input
                            class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                            bind:value={draft.longitude}
                            placeholder="Longitud"
                            disabled={submitting}
                          />
                        </td>
                        <td class={actionCellClass(true)}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveLocation}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar ubicación"
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

          {#each sortedLocations() as item (item.id)}
            <tr
              class={`${editingId === item.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === item.id}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.code}
                    placeholder="código"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.name}
                    placeholder="Nombre"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <select
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.parent_id}
                    disabled={submitting}
                  >
                    <option value="">Sin padre</option>
                    {#each parentOptions(item.id) as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.address_line}
                      placeholder="Dirección"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.city}
                      placeholder="Ciudad"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.region}
                      placeholder="Región/Estado"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.country}
                      placeholder="País"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.postal_code}
                      placeholder="Código postal"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.latitude}
                      placeholder="Latitud"
                      disabled={submitting}
                    />
                  </td>
                  <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.longitude}
                      placeholder="Longitud"
                      disabled={submitting}
                    />
                  </td>
                  <td class={actionCellClass(true)}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveLocation}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar ubicación"
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
              {:else}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.code}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.name}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.parent_name || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {displayValue(item.address_line)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {displayValue(item.city)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {displayValue(item.region)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {displayValue(item.country)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {displayValue(item.postal_code)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {coordinateDisplay(item.latitude)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {coordinateDisplay(item.longitude)}
                </td>
                <td class={actionCellClass(false)}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(item)}
                      type="button"
                      aria-label="Editar ubicación"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeLocation(item)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar ubicación"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !locations.length && !creating}
            <tr>
              <td
                colspan="11"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay ubicaciones registradas.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
