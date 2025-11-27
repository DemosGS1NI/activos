<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listResponsibles,
    createResponsible,
    updateResponsible,
    deleteResponsible,
    listDepartments,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    name: "",
    email: "",
    phone: "",
    department_id: "",
  };

  let responsibles = [];
  let departments = [];
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

  onMount(async () => {
    await Promise.all([loadDepartments(), loadResponsibles()]);
  });

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

  async function loadDepartments() {
    try {
      const data = await listDepartments();
      departments = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los departamentos",
        "error"
      );
      departments = [];
    }
  }

  async function loadResponsibles() {
    loading = true;
    resetMessage();
    try {
      const data = await listResponsibles();
      responsibles = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los responsables",
        "error"
      );
    } finally {
      loading = false;
    }
  }

  function departmentOptions() {
    return departments
      .map((dept) => ({ value: dept.id, label: dept.name || dept.code }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );
  }

  function valueForSort(item, key) {
    const value = item?.[key];
    return (value ?? "").toString().toLowerCase();
  }

  function sortedResponsibles() {
    const data = [...responsibles];
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
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      department_id: item.department_id || "",
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function optionalString(value) {
    const trimmed = (value ?? "").toString().trim();
    return trimmed.length ? trimmed : null;
  }

  function buildPayload() {
    return {
      name: draft.name.trim(),
      email: optionalString(draft.email),
      phone: optionalString(draft.phone),
      department_id: optionalString(draft.department_id),
    };
  }

  async function saveResponsible() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.name?.trim()) throw new Error("El nombre es requerido");

      const payload = buildPayload();

      if (creating) {
        await createResponsible(payload);
        showMessage("Responsable creado", "success");
      } else if (editingId) {
        await updateResponsible(editingId, payload);
        showMessage("Responsable actualizado", "success");
      }

      await loadResponsibles();
      cancelEdit();
      dispatch("change", { entity: "responsible" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible guardar el responsable",
        "error"
      );
    } finally {
      submitting = false;
    }
  }

  async function removeResponsible(item) {
    const confirmed = confirm(`¿Eliminar al responsable "${item.name}"?`);
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteResponsible(item.id);
      showMessage("Responsable eliminado", "success");
      await loadResponsibles();
      dispatch("change", { entity: "responsible" });
    } catch (err) {
      showMessage(
        err.message || "No fue posible eliminar el responsable",
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
      <h1 class="text-xl font-semibold text-sky-900">Responsables</h1>
      <p class="text-sm text-sky-700">
        Gestiona las personas responsables de los activos.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting}
      type="button"
      aria-label="Nuevo responsable"
    >
      <span class="inline-block" aria-hidden="true">{@html icons.plus}</span>
      <span>Nuevo responsable</span>
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
                on:click={() => toggleSort("email")}
              >
                Correo
                {#if sortKey === "email"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("phone")}
              >
                Teléfono
                {#if sortKey === "phone"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("department_name")}
              >
                Departamento
                {#if sortKey === "department_name"}
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
                colspan="5"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando responsables…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.name}
                  placeholder="Nombre"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.email}
                  placeholder="correo@ejemplo.com"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.phone}
                  placeholder="Teléfono"
                  disabled={submitting}
                />
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <select
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.department_id}
                  disabled={submitting || departmentOptions().length === 0}
                >
                  <option value="">Sin departamento</option>
                  {#each departmentOptions() as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </td>
              <td class={`${DATA_CELL_CLASS} text-right`}>
                <div class="flex justify-end gap-2">
                  <button
                    class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                    on:click={saveResponsible}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar responsable"
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

          {#each sortedResponsibles() as item (item.id)}
            <tr
              class={`${editingId === item.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === item.id}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.name}
                    placeholder="Nombre"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.email}
                    placeholder="correo@ejemplo.com"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.phone}
                    placeholder="Teléfono"
                    disabled={submitting}
                  />
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <select
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.department_id}
                    disabled={submitting}
                  >
                    <option value="">Sin departamento</option>
                    {#each departmentOptions() as option}
                      <option value={option.value}>{option.label}</option>
                    {/each}
                  </select>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-60"
                      on:click={saveResponsible}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar responsable"
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
                  {item.name}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.email || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.phone || "—"}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {item.department_name || "—"}
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(item)}
                      type="button"
                      aria-label="Editar responsable"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeResponsible(item)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar responsable"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loading && !responsibles.length && !creating}
            <tr>
              <td
                colspan="5"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay responsables registrados.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
