<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listAssetStatuses,
    createAssetStatus,
    updateAssetStatus,
    deleteAssetStatus,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    code: "",
    name: "",
    is_active: true,
  };

  let statuses = [];
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

  onMount(loadStatuses);

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

  async function loadStatuses() {
    loading = true;
    resetMessage();
    try {
      const data = await listAssetStatuses();
      statuses = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los estados de activos",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function valueForSort(item, key) {
    const value = item?.[key];
    if (typeof value === "boolean") return value ? "1" : "0";
    return (value ?? "").toString().toLowerCase();
  }

  function sortedStatuses() {
    const data = [...statuses];
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
      is_active: Boolean(item.is_active),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function buildPayload() {
    return {
      code: draft.code.trim(),
      name: draft.name.trim(),
      is_active: Boolean(draft.is_active),
    };
  }

  async function saveStatus() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.code?.trim()) throw new Error("El código es requerido");
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");

      const payload = buildPayload();

      if (creating) {
        await createAssetStatus(payload);
        showMessage("Estado de activo creado", "success");
      } else if (editingId) {
        await updateAssetStatus(editingId, payload);
        showMessage("Estado de activo actualizado", "success");
      }

      await loadStatuses();
      cancelEdit();
      dispatch("change", { entity: "asset-status" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible guardar el estado de activo",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  async function removeStatus(item) {
    const confirmed = confirm(
      `¿Eliminar el estado de activo "${item.name || item.code}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteAssetStatus(item.id);
      showMessage("Estado de activo eliminado", "success");
      await loadStatuses();
      dispatch("change", { entity: "asset-status" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar el estado de activo",
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
      <h1 class="text-xl font-semibold text-sky-900">Estados de activos</h1>
      <p class="text-sm text-sky-700">
        Administra los estados disponibles para clasificar los activos.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nuevo estado de activo"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nuevo</span>
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
                on:click={() => toggleSort("is_active")}
              >
                Estado
                {#if sortKey === "is_active"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
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
                colspan="4"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando estados de activos…
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
                <label
                  class="inline-flex items-center gap-2 text-sm text-sky-900"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                    bind:checked={draft.is_active}
                    disabled={submitting}
                  />
                  <span>Activo</span>
                </label>
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveStatus}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar estado"
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

          {#each sortedStatuses() as item (item.id)}
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
                  <label
                    class="inline-flex items-center gap-2 text-sm text-sky-900"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-sky-300 text-indigo-600 focus:ring-indigo-500"
                      bind:checked={draft.is_active}
                      disabled={submitting}
                    />
                    <span>Activo</span>
                  </label>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveStatus}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar estado"
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
                  <span
                    class={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      item.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span
                      class={`h-2 w-2 rounded-full ${
                        item.is_active ? "bg-emerald-500" : "bg-slate-500"
                      }`}
                    ></span>
                    {item.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(item)}
                      type="button"
                      aria-label="Editar estado"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeStatus(item)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar estado"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !statuses.length && !creating}
            <tr>
              <td
                colspan="4"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay estados registrados.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
