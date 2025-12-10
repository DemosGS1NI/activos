<script>
  import { createEventDispatcher, onMount } from "svelte";
  import {
    listMenuGroups,
    listTasks,
    createTask,
    updateTask,
    deleteTask,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const defaultDraft = {
    menu_group_id: "",
    key: "",
    title: "",
    description: "",
    route: "",
    ord: "",
    active: true,
  };

  let menuGroups = [];
  let tasks = [];
  let loadingTasks = true;
  let loadingMenuGroups = true;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "menuGroup";
  let sortDirection = "asc";
  let editingId = null;
  let creating = false;
  let draft = { ...defaultDraft };

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";
  const SUBTEXT_CLASS = "mt-1 text-xs text-sky-700";

  onMount(async () => {
    await Promise.all([loadMenuGroups(), loadTasks()]);
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

  async function loadMenuGroups() {
    loadingMenuGroups = true;
    try {
      const data = await listMenuGroups();
      menuGroups = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(
        err.message || "No fue posible cargar los grupos de menú",
        "error"
      );
    } finally {
      loadingMenuGroups = false;
    }
  }

  async function loadTasks() {
    loadingTasks = true;
    resetMessage();
    try {
      const data = await listTasks();
      tasks = Array.isArray(data) ? data : [];
    } catch (err) {
      showMessage(err.message || "No fue posible cargar las tareas", "error");
      tasks = [];
    } finally {
      loadingTasks = false;
    }
  }

  function valueForSort(task, key) {
    if (key === "menuGroup") {
      return (task?.menu_group_title || "").toString().toLowerCase();
    }
    if (key === "ord") {
      const ord = task?.ord;
      return typeof ord === "number"
        ? ord
        : Number(ord ?? Number.MAX_SAFE_INTEGER);
    }
    if (key === "active") {
      return task?.active ? 1 : 0;
    }
    return (task?.[key] ?? "").toString().toLowerCase();
  }

  function sortedTasks() {
    const data = [...tasks];
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

  function startEdit(task) {
    resetMessage();
    creating = false;
    editingId = task.id;
    draft = {
      menu_group_id: task.menu_group_id || "",
      key: task.key || "",
      title: task.title || "",
      description: task.description || "",
      route: task.route || "",
      ord: task.ord === null || task.ord === undefined ? "" : String(task.ord),
      active: Boolean(task.active),
    };
  }

  function cancelEdit() {
    creating = false;
    editingId = null;
    resetDraft();
  }

  function buildPayload() {
    const payload = {
      menu_group_id: draft.menu_group_id,
      key: draft.key.trim(),
      title: draft.title.trim(),
      description: draft.description?.trim() ?? "",
      route: draft.route?.trim() ?? "",
      active: Boolean(draft.active),
    };
    if (draft.ord !== "" && draft.ord !== null && draft.ord !== undefined) {
      payload.ord = Number(draft.ord);
    }
    return payload;
  }

  async function saveTask() {
    submitting = true;
    resetMessage();
    try {
      if (!draft.menu_group_id) throw new Error("Selecciona un grupo de menú");
      if (!draft.key?.trim()) throw new Error("La clave es requerida");
      if (!draft.title?.trim()) throw new Error("El titulo es requerido");

      const payload = buildPayload();

      if (creating) {
        await createTask(payload);
        showMessage("Tarea creada", "success");
      } else if (editingId) {
        await updateTask(editingId, payload);
        showMessage("Tarea actualizada", "success");
      }

      await loadTasks();
      cancelEdit();
      dispatch("change", { entity: "task", refreshMenu: true });
    } catch (err) {
      showMessage(err.message || "No fue posible guardar la tarea", "error");
    } finally {
      submitting = false;
    }
  }

  async function removeTask(task) {
    const confirmed = confirm(
      `¿Eliminar la tarea "${task.title || task.key}"?`
    );
    if (!confirmed) return;
    submitting = true;
    resetMessage();
    try {
      await deleteTask(task.id);
      showMessage("Tarea eliminada", "success");
      await loadTasks();
      dispatch("change", { entity: "task", refreshMenu: true });
    } catch (err) {
      showMessage(err.message || "No fue posible eliminar la tarea", "error");
    } finally {
      submitting = false;
    }
  }

  function menuGroupLabel(task) {
    if (task?.menu_group_title) {
      if (task.menu_group_key) {
        return `${task.menu_group_title} (${task.menu_group_key})`;
      }
      return task.menu_group_title;
    }
    return "Sin grupo";
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Tareas</h1>
      <p class="text-sm text-sky-700">
        Administra las tareas que definen accesos y rutas del menu.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      on:click={startCreate}
      disabled={submitting || (!loadingMenuGroups && menuGroups.length === 0)}
      type="button"
      aria-label="Nueva tarea"
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
                on:click={() => toggleSort("menuGroup")}
              >
                Grupo
                {#if sortKey === "menuGroup"}
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
                Clave
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
                Título
                {#if sortKey === "title"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("route")}
              >
                Ruta
                {#if sortKey === "route"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2 text-center">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("ord")}
              >
                Orden
                {#if sortKey === "ord"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2 text-center">
              <span class={HEADER_LABEL_CLASS}>Estado</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if loadingTasks}
            <tr>
              <td
                colspan="7"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                Cargando tareas…
              </td>
            </tr>
          {:else if creating}
            <tr class="bg-white">
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <select
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.menu_group_id}
                  disabled={submitting ||
                    loadingMenuGroups ||
                    menuGroups.length === 0}
                  aria-label="Grupo de menú"
                >
                  <option value="" disabled selected={!draft.menu_group_id}>
                    Selecciona…
                  </option>
                  {#each menuGroups as group}
                    <option value={group.id}>
                      {group.title} ({group.key})
                    </option>
                  {/each}
                </select>
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
                <div class="space-y-2">
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.title}
                    placeholder="Titulo"
                    disabled={submitting}
                  />
                  <textarea
                    class="h-16 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.description}
                    placeholder="Descripcion"
                    disabled={submitting}
                  ></textarea>
                </div>
              </td>
              <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                <input
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.route}
                  placeholder="/ruta"
                  disabled={submitting}
                />
              </td>
              <td
                class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
              >
                <input
                  type="number"
                  class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                  bind:value={draft.ord}
                  placeholder="0"
                  disabled={submitting}
                />
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
                    on:click={saveTask}
                    disabled={submitting}
                    type="button"
                    aria-label="Guardar tarea"
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

          {#each sortedTasks() as task (task.id)}
            <tr
              class={`${editingId === task.id ? "bg-white" : "bg-slate-50"} border-b border-sky-100`}
            >
              {#if editingId === task.id}
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <select
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.menu_group_id}
                    disabled={submitting ||
                      loadingMenuGroups ||
                      menuGroups.length === 0}
                    aria-label="Grupo de menú"
                  >
                    <option value="" disabled selected={!draft.menu_group_id}>
                      Selecciona…
                    </option>
                    {#each menuGroups as group}
                      <option value={group.id}>
                        {group.title} ({group.key})
                      </option>
                    {/each}
                  </select>
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
                  <div class="space-y-2">
                    <input
                      class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.title}
                      placeholder="Titulo"
                      disabled={submitting}
                    />
                    <textarea
                      class="h-16 w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                      bind:value={draft.description}
                      placeholder="Descripcion"
                      disabled={submitting}
                    ></textarea>
                  </div>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <input
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.route}
                    placeholder="/ruta"
                    disabled={submitting}
                  />
                </td>
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
                >
                  <input
                    type="number"
                    class="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                    bind:value={draft.ord}
                    placeholder="0"
                    disabled={submitting}
                  />
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
                      on:click={saveTask}
                      disabled={submitting}
                      type="button"
                      aria-label="Guardar tarea"
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
                  <div>{menuGroupLabel(task)}</div>
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {task.key}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  <div>{task.title}</div>
                  {#if task.description}
                    <div class={SUBTEXT_CLASS}>{task.description}</div>
                  {/if}
                </td>
                <td class={`border-r border-sky-100 ${DATA_CELL_CLASS}`}>
                  {task.route || "—"}
                </td>
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
                >
                  {task.ord ?? "—"}
                </td>
                <td
                  class={`border-r border-sky-100 ${DATA_CELL_CLASS} text-center`}
                >
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      task.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {task.active ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td class={`${DATA_CELL_CLASS} text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
                      on:click={() => startEdit(task)}
                      type="button"
                      disabled={submitting}
                      aria-label="Editar tarea"
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-60"
                      on:click={() => removeTask(task)}
                      type="button"
                      disabled={submitting}
                      aria-label="Eliminar tarea"
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}

          {#if !loadingTasks && !tasks.length && !creating}
            <tr>
              <td
                colspan="7"
                class="px-3 py-6 text-center text-sm text-sky-900"
              >
                No hay tareas registradas.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  {#if !loadingMenuGroups && menuGroups.length === 0}
    <div
      class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      No hay grupos de menú disponibles. Crea al menos un grupo antes de agregar
      tareas.
    </div>
  {/if}
</div>
