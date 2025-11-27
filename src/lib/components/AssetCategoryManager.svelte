<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listAssetCategories,
    createAssetCategory,
    updateAssetCategory,
    deleteAssetCategory,
    listDepreciationMethods,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    code: "",
    name: "",
    description: "",
    default_depreciation_method_id: "",
    default_lifespan_months: "",
  };

  let categories = [];
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

  onMount(loadAll);

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

  async function loadAll() {
    loading = true;
    resetMessage();
    try {
      const [categoryData, methodData] = await Promise.all([
        listAssetCategories(),
        listDepreciationMethods(),
      ]);
      categories = Array.isArray(categoryData) ? categoryData : [];
      methods = Array.isArray(methodData) ? methodData : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar las categorías de activos",
        "error"
      );
      categories = [];
      methods = [];
    } finally {
      loading = false;
    }
  }

  function valueForSort(category, key) {
    if (key === "default_lifespan_months") {
      const value = category?.default_lifespan_months;
      return value === null || value === undefined
        ? Number.MAX_SAFE_INTEGER
        : Number(value);
    }
    return (category?.[key] ?? "").toString().toLowerCase();
  }

  function sortedCategories() {
    const data = [...categories];
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

  function startEdit(category) {
    resetMessage();
    creating = false;
    editingId = category.id;
    draft = {
      code: category.code || "",
      name: category.name || "",
      description: category.description || "",
      default_depreciation_method_id:
        category.default_depreciation_method_id || "",
      default_lifespan_months:
        category.default_lifespan_months === null ||
        category.default_lifespan_months === undefined
          ? ""
          : String(category.default_lifespan_months),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function buildPayload() {
    const payload = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      default_depreciation_method_id:
        draft.default_depreciation_method_id || null,
      default_lifespan_months:
        draft.default_lifespan_months === "" ||
        draft.default_lifespan_months === null
          ? null
          : Number(draft.default_lifespan_months),
    };
    return payload;
  }

  async function saveCategory() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.code?.trim()) throw new Error("El código es requerido");
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");

      if (creating) {
        await createAssetCategory(buildPayload());
        showMessage("Categoría creada", "success");
      } else if (editingId) {
        await updateAssetCategory(editingId, buildPayload());
        showMessage("Categoría actualizada", "success");
      }

      await loadAll();
      cancelEdit();
      dispatch("change", { entity: "asset_category" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible guardar la categoría",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  async function removeCategory(category) {
    const confirmed = confirm(
      `¿Eliminar la categoría "${category.name || category.code}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteAssetCategory(category.id);
      showMessage("Categoría eliminada", "success");
      await loadAll();
      dispatch("change", { entity: "asset_category" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar la categoría",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  function methodName(methodId) {
    if (!methodId) return "—";
    const found = methods.find((m) => m.id === methodId);
    return found?.name || "—";
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Categorías de Activos</h1>
      <p class="text-sm text-sky-700">
        Define categorías y parámetros por defecto para los activos.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nueva categoría de activo"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nueva categoría</span>
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
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("default_depreciation_method_name")}
              >
                Método de depreciación
                {#if sortKey === "default_depreciation_method_name"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("default_lifespan_months")}
              >
                Vida útil (meses)
                {#if sortKey === "default_lifespan_months"}
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
                Cargando categorías de activos…
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
                  class="h-16 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.description}
                  placeholder="Descripción"
                  disabled={submitting}
                ></textarea>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <select
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.default_depreciation_method_id}
                  disabled={submitting}
                >
                  <option value="">Sin método por defecto</option>
                  {#each methods as method}
                    <option value={method.id}>{method.name}</option>
                  {/each}
                </select>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.default_lifespan_months}
                  type="number"
                  min="1"
                  placeholder="Meses"
                  disabled={submitting}
                />
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveCategory}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar categoría"
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

          {#each sortedCategories() as category (category.id)}
            <tr
              class={`${editingId === category.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === category.id}
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
                    class="h-16 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.description}
                    placeholder="Descripción"
                    disabled={submitting}
                  ></textarea>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <select
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.default_depreciation_method_id}
                    disabled={submitting}
                  >
                    <option value="">Sin método por defecto</option>
                    {#each methods as method}
                      <option value={method.id}>{method.name}</option>
                    {/each}
                  </select>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.default_lifespan_months}
                    type="number"
                    min="1"
                    placeholder="Meses"
                    disabled={submitting}
                  />
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveCategory}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar categoría"
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
                  {category.code}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.name}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.description || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.default_depreciation_method_name ||
                    methodName(category.default_depreciation_method_id)}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.default_lifespan_months ?? "—"}
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(category)}
                      type="button"
                      aria-label="Editar categoría"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeCategory(category)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar categoría"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !categories.length && !creating}
            <tr>
              <td
                colspan="6"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay categorías registradas.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
