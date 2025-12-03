<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listInventoryConditions,
    createInventoryCondition,
    updateInventoryCondition,
    deleteInventoryCondition,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    slug: "",
    label: "",
    severity: 0,
    description: "",
    active: true,
  };

  let conditions = [];
  let loading = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "label";
  let sortDirection = "asc";
  let editingId = null;
  let creating = false;
  let draft = { ...defaultDraft };

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  onMount(loadConditions);

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

  async function loadConditions() {
    loading = true;
    resetMessage();
    try {
      const data = await listInventoryConditions();
      conditions = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar las condiciones de inventario",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function valueForSort(item, key) {
    const value = item?.[key];
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    return (value ?? "").toString().toLowerCase();
  }

  function sortedConditions() {
    const data = [...conditions];
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
      slug: item.slug || "",
      label: item.label || "",
      severity:
        typeof item.severity === "number" && Number.isFinite(item.severity)
          ? item.severity
          : 0,
      description: item.description || "",
      active: Boolean(item.active),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function buildPayload() {
    return {
      slug: draft.slug.trim().toLowerCase(),
      label: draft.label.trim(),
      severity: Number.parseInt(draft.severity, 10),
      description: draft.description?.trim() || null,
      active: Boolean(draft.active),
    };
  }

  function validateDraft() {
    const slug = draft.slug?.trim();
    if (!slug) throw new Error("El slug es requerido");
    if (!/^[a-z0-9][a-z0-9_.-]*$/.test(slug.toLowerCase())) {
      throw new Error("El slug debe ser alfanumérico (con -, _, . opcionales)");
    }

    const label = draft.label?.trim();
    if (!label) throw new Error("El nombre es requerido");

    const severityValue = Number.parseInt(draft.severity, 10);
    if (Number.isNaN(severityValue)) {
      throw new Error("La severidad debe ser un número");
    }
    if (severityValue < 0 || severityValue > 10) {
      throw new Error("La severidad debe estar entre 0 y 10");
    }
  }

  async function saveCondition() {
    submitting = true;
    resetMessage();
    try {
      validateDraft();
      const payload = buildPayload();

      if (creating) {
        await createInventoryCondition(payload);
        showMessage("Condición de inventario creada", "success");
      } else if (editingId) {
        await updateInventoryCondition(editingId, payload);
        showMessage("Condición de inventario actualizada", "success");
      }

      await loadConditions();
      cancelEdit();
      dispatch("change", { entity: "inventory-condition" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible guardar la condición de inventario",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  async function removeCondition(item) {
    const confirmed = confirm(
      `¿Eliminar la condición "${item.label || item.slug}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteInventoryCondition(item.id);
      showMessage("Condición de inventario eliminada", "success");
      await loadConditions();
      dispatch("change", { entity: "inventory-condition" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar la condición de inventario",
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
      <h1 class="text-xl font-semibold text-sky-900">Condiciones de inventario</h1>
      <p class="text-sm text-sky-700">
        Define las opciones disponibles cuando se registra un control de inventario.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nueva condición de inventario"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nueva condición</span>
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
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("slug")}
              >
                Slug
                {#if sortKey === "slug"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("label")}
              >
                Nombre
                {#if sortKey === "label"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("severity")}
              >
                Severidad
                {#if sortKey === "severity"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("active")}
              >
                Estado
                {#if sortKey === "active"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Descripción</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loading}
            <tr>
              <td
                colspan="6"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando condiciones de inventario…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.slug}
                  placeholder="slug"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.label}
                  placeholder="Nombre"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  type="number"
                  min="0"
                  max="10"
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.severity}
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <label class="inline-flex items-center gap-2 text-sm text-sky-900">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                    bind:checked={draft.active}
                    disabled={submitting}
                  />
                  <span>Activo</span>
                </label>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <textarea
                  rows="2"
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.description}
                  placeholder="Descripción (opcional)"
                  disabled={submitting}
                ></textarea>
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveCondition}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar condición"
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

          {#each sortedConditions() as item (item.id)}
            <tr
              class={`${editingId === item.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === item.id}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.slug}
                    placeholder="slug"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.label}
                    placeholder="Nombre"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.severity}
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <label class="inline-flex items-center gap-2 text-sm text-sky-900">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                      bind:checked={draft.active}
                      disabled={submitting}
                    />
                    <span>Activo</span>
                  </label>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <textarea
                    rows="2"
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.description}
                    placeholder="Descripción (opcional)"
                    disabled={submitting}
                  ></textarea>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveCondition}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar condición"
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
                  {item.slug}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.label}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <span class="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    {item.severity}
                  </span>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <span
                    class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      item.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      class={`h-2 w-2 rounded-full ${
                        item.active ? "bg-emerald-500" : "bg-slate-500"
                      }`}
                    ></span>
                    {item.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div class="max-w-xs whitespace-pre-wrap text-sm text-sky-900">
                    {item.description || "—"}
                  </div>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm transition hover:bg-indigo-400 disabled:opacity-60"
                      on:click={() => startEdit(item)}
                      disabled={submitting}
                      type="button"
                      aria-label="Editar condición"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-400 disabled:opacity-60"
                      on:click={() => removeCondition(item)}
                      disabled={submitting}
                      type="button"
                      aria-label="Eliminar condición"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !creating && !conditions.length}
            <tr>
              <td
                colspan="6"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay condiciones registradas.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
