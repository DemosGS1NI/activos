<script>
  import { onMount } from "svelte";
  import {
    listRoles,
    createRole,
    updateRole,
    deleteRole,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  let roles = [];
  let loading = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "name";
  let sortDirection = "asc";
  let editingId = null;
  let creating = false;
  let draft = { name: "", description: "" };

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  onMount(loadRoles);

  async function loadRoles() {
    loading = true;
    resetMessage();
    try {
      roles = await listRoles();
    } catch (err) {
      showMessage(err.message || "No fue posible cargar los roles", "error");
    } finally {
      loading = false;
    }
  }

  function resetDraft() {
    draft = { name: "", description: "" };
  }

  function resetMessage() {
    message = "";
    messageTone = "";
  }

  function showMessage(text, tone) {
    message = text;
    messageTone = tone;
  }

  function sortedRoles() {
    const data = [...roles];
    data.sort((a, b) => {
      const av = (a?.[sortKey] || "").toString().toLowerCase();
      const bv = (b?.[sortKey] || "").toString().toLowerCase();
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

  function startEdit(role) {
    resetMessage();
    creating = false;
    editingId = role.id;
    draft = { name: role.name || "", description: role.description || "" };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  async function saveRole() {
    submitting = true;
    try {
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");
      if (creating) {
        await createRole({
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
        });
        showMessage("Rol creado", "success");
      } else if (editingId) {
        await updateRole(editingId, {
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
        });
        showMessage("Rol actualizado", "success");
      }
      await loadRoles();
      cancelEdit();
    } catch (err) {
      showMessage(err.message || "No fue posible guardar el rol", "error");
    } finally {
      submitting = false;
    }
  }

  async function removeRole(role) {
    const confirmed = confirm(`¿Eliminar el rol "${role.name}"?`);
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteRole(role.id);
      showMessage("Rol eliminado", "success");
      await loadRoles();
    } catch (err) {
      showMessage(err.message || "No fue posible eliminar el rol", "error");
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Roles</h1>
      <p class="text-sm text-sky-700">
        Administra los roles disponibles en el sistema.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nuevo rol"
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
                on:click={() => toggleSort("description")}
              >
                Descripción
                {#if sortKey === "description"}
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
                colspan="3"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando roles…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.name}
                  placeholder="Nombre del rol"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <textarea
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  rows="2"
                  bind:value={draft.description}
                  placeholder="Descripción opcional"
                  disabled={submitting}
                ></textarea>
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveRole}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar rol"
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

          {#each sortedRoles() as role (role.id)}
            <tr
              class={`${editingId === role.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === role.id}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.name}
                    placeholder="Nombre del rol"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <textarea
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    rows="2"
                    bind:value={draft.description}
                    placeholder="Descripción opcional"
                    disabled={submitting}
                  ></textarea>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveRole}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar rol"
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
                  {role.name}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {role.description || "—"}
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(role)}
                      type="button"
                      aria-label="Editar rol"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeRole(role)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar rol"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !roles.length && !creating}
            <tr>
              <td
                colspan="3"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay roles registrados.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
