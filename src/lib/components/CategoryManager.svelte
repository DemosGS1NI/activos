<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    key: "",
    title: "",
    description: "",
    ord: "",
    active: true,
  };

  let categories = [];
  let loading = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "ord";
  let sortDirection = "asc";
  let editingId = null;
  let creating = false;
  let draft = { ...defaultDraft };

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  onMount(loadCategories);

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

  async function loadCategories() {
    loading = true;
    resetMessage();
    try {
      const data = await listCategories();
      categories = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar las categorías",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function valueForSort(category, key) {
    if (key === "ord") {
      const ord = category?.ord;
      return typeof ord === "number"
        ? ord
        : Number(ord ?? Number.MAX_SAFE_INTEGER);
    }
    if (key === "active") {
      return category?.active ? 1 : 0;
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
      sortDirection = key === "ord" ? "asc" : "asc";
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
      key: category.key || "",
      title: category.title || "",
      description: category.description || "",
      ord:
        category.ord === null || category.ord === undefined
          ? ""
          : String(category.ord),
      active: Boolean(category.active),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function buildPayload() {
    const payload = {
      key: draft.key.trim(),
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      active: Boolean(draft.active),
    };
    if (draft.ord !== "" && draft.ord !== null && draft.ord !== undefined) {
      payload.ord = Number(draft.ord);
    }
    return payload;
  }

  async function saveCategory() {
    submitting = true;
    try {
      if (!draft.key?.trim()) throw new Error("La clave es requerida");
      if (!draft.title?.trim()) throw new Error("El título es requerido");

      if (creating) {
        await createCategory(buildPayload());
        showMessage("Categoría creada", "success");
      } else if (editingId) {
        await updateCategory(editingId, buildPayload());
        showMessage("Categoría actualizada", "success");
      }

      await loadCategories();
      cancelEdit();
      dispatch("change", { entity: "category" });
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
      `¿Eliminar la categoría "${category.title || category.key}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteCategory(category.id);
      showMessage("Categoría eliminada", "success");
      await loadCategories();
      dispatch("change", { entity: "category" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar la categoría",
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
      <h1 class="text-xl font-semibold text-sky-900">Categorías</h1>
      <p class="text-sm text-sky-700">
        Administra las categorías que agrupan las opciones del menú.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nueva categoría"
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
                on:click={() => toggleSort("ord")}
              >
                ORDEN
                {#if sortKey === "ord"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("key")}
              >
                CLAVE
                {#if sortKey === "key"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("title")}
              >
                TÍTULO
                {#if sortKey === "title"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>DESCRIPCIÓN</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2 text-center">
              <span class={HEADER_LABEL_CLASS}>ESTADO</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>ACCIONES</span>
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
                Cargando categorías…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.ord}
                  type="number"
                  placeholder="0"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.key}
                  placeholder="clave"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.title}
                  placeholder="Título"
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
              <td
                class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-indigo-600"
                  bind:checked={draft.active}
                  disabled={submitting}
                  aria-label="Activo"
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
                    bind:value={draft.ord}
                    type="number"
                    placeholder="0"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.key}
                    placeholder="clave"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.title}
                    placeholder="Título"
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
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 accent-indigo-600"
                    bind:checked={draft.active}
                    disabled={submitting}
                    aria-label="Activo"
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
                  {category.ord ?? "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.key}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.title}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {category.description || "—"}
                </td>
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
                >
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      category.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {category.active ? "Activa" : "Inactiva"}
                  </span>
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
