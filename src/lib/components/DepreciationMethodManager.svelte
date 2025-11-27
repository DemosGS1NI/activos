<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listDepreciationMethods,
    createDepreciationMethod,
    updateDepreciationMethod,
    deleteDepreciationMethod,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    code: "",
    name: "",
    description: "",
    formula_notes: "",
    default_period: "",
  };

  let methods = [];
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

  onMount(loadMethods);

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

  async function loadMethods() {
    loading = true;
    resetMessage();
    try {
      const data = await listDepreciationMethods();
      methods = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los métodos de depreciación",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function valueForSort(item, key) {
    const value = item?.[key];
    return (value ?? "").toString().toLowerCase();
  }

  function sortedMethods() {
    const data = [...methods];
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
      description: item.description || "",
      formula_notes: item.formula_notes || "",
      default_period: item.default_period || "",
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
      description: draft.description?.trim() || null,
      formula_notes: draft.formula_notes?.trim() || null,
      default_period: draft.default_period?.trim() || null,
    };
  }

  async function saveMethod() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.code?.trim()) throw new Error("El código es requerido");
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");

      const payload = buildPayload();

      if (creating) {
        await createDepreciationMethod(payload);
        showMessage("Método de depreciación creado", "success");
      } else if (editingId) {
        await updateDepreciationMethod(editingId, payload);
        showMessage("Método de depreciación actualizado", "success");
      }

      await loadMethods();
      cancelEdit();
      dispatch("change", { entity: "depreciation-method" });
    } catch (err) {
      showMessage(err.message || "No fue posible guardar el método", "error");
    } finally {
      submitting = false;
    }
  }

  async function removeMethod(item) {
    const confirmed = confirm(
      `¿Eliminar el método de depreciación "${item.name || item.code}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteDepreciationMethod(item.id);
      showMessage("Método de depreciación eliminado", "success");
      await loadMethods();
      dispatch("change", { entity: "depreciation-method" });
    } catch (err) {
      showMessage(err.message || "No fue posible eliminar el método", "error");
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">
        Métodos de depreciación
      </h1>
      <p class="text-sm text-sky-700">
        Administra los métodos utilizados para calcular la depreciación.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nuevo método de depreciación"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nuevo método</span>
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
              <span class={HEADER_LABEL_CLASS}>Descripción</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>Notas de fórmula</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("default_period")}
              >
                Periodo por defecto
                {#if sortKey === "default_period"}
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
                colspan="6"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando métodos de depreciación…
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
                <textarea
                  class="h-24 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.description}
                  placeholder="Descripción"
                  disabled={submitting}
                ></textarea>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <textarea
                  class="h-24 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.formula_notes}
                  placeholder="Notas sobre la fórmula"
                  disabled={submitting}
                ></textarea>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.default_period}
                  placeholder="Periodo (ej. mensual)"
                  disabled={submitting}
                />
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveMethod}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar método"
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

          {#each sortedMethods() as item (item.id)}
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
                  <textarea
                    class="h-24 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.description}
                    placeholder="Descripción"
                    disabled={submitting}
                  ></textarea>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <textarea
                    class="h-24 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.formula_notes}
                    placeholder="Notas sobre la fórmula"
                    disabled={submitting}
                  ></textarea>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.default_period}
                    placeholder="Periodo (ej. mensual)"
                    disabled={submitting}
                  />
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveMethod}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar método"
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
                  {item.description || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.formula_notes || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.default_period || "—"}
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(item)}
                      type="button"
                      aria-label="Editar método"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeMethod(item)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar método"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !methods.length && !creating}
            <tr>
              <td
                colspan="6"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay métodos registrados.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
