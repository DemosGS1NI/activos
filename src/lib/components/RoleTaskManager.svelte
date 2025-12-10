<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import {
    listRoleTasks,
    addRoleTask,
    removeRoleTask,
    listRoles,
    listTasks,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  const defaultForm = {
    role_id: "",
    task_id: "",
  };

  let mappings = [];
  let roles = [];
  let tasks = [];

  let rolesLoading = false;
  let tasksLoading = false;
  let mappingsLoading = false;
  let submitting = false;

  let message = "";
  let messageTone = "";

  let creating = false;
  let editingOriginal = null;
  let form = { ...defaultForm };

  let sortKey = "role";
  let sortDirection = "asc";

  onMount(async () => {
    await Promise.all([loadRoles(), loadTasks()]);
    await loadMappings();
  });

  function resetForm() {
    form = { ...defaultForm };
    creating = false;
    editingOriginal = null;
  }

  function showMessage(text, tone = "success") {
    message = text;
    messageTone = tone;
  }

  function clearMessage() {
    message = "";
    messageTone = "";
  }

  async function loadRoles() {
    rolesLoading = true;
    try {
      roles = await listRoles();
    } catch (err) {
      roles = [];
      showMessage(err.message || "No fue posible cargar los roles", "error");
    } finally {
      rolesLoading = false;
    }
  }

  async function loadTasks() {
    tasksLoading = true;
    try {
      tasks = await listTasks();
    } catch (err) {
      tasks = [];
      showMessage(err.message || "No fue posible cargar las tareas", "error");
    } finally {
      tasksLoading = false;
    }
  }

  async function loadMappings() {
    mappingsLoading = true;
    try {
      mappings = await listRoleTasks();
    } catch (err) {
      mappings = [];
      showMessage(err.message || "No fue posible cargar las asignaciones", "error");
    } finally {
      mappingsLoading = false;
    }
  }

  function startCreate() {
    clearMessage();
    form = { ...defaultForm };
    creating = true;
    editingOriginal = null;
  }

  function mappingKey(mapping) {
    return `${mapping.role_id}:${mapping.task_id}`;
  }

  function startEdit(mapping) {
    clearMessage();
    creating = false;
    editingOriginal = {
      role_id: mapping.role_id,
      task_id: mapping.task_id,
    };
    form = {
      role_id: mapping.role_id,
      task_id: mapping.task_id,
    };
  }

  function cancelEdit() {
    resetForm();
    clearMessage();
  }

  function valueForSort(mapping, key) {
    switch (key) {
      case "role":
        return (mapping.role_name || "").toLowerCase();
      case "task":
        return (mapping.task_title || "").toLowerCase();
      case "category":
        return (mapping.category_title || "").toLowerCase();
      case "task_key":
        return (mapping.task_key || "").toLowerCase();
      default:
        return valueForSort(mapping, "role");
    }
  }

  function sortedMappings() {
    const data = [...mappings];
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

  function taskLabel(task) {
    if (!task) return "Tarea sin nombre";
    return task.title || task.key;
  }

  async function saveMapping(event) {
    event.preventDefault();
    clearMessage();
    submitting = true;
    try {
      if (!form.role_id) throw new Error("El rol es obligatorio");
      if (!form.task_id) throw new Error("La tarea es obligatoria");

      if (creating) {
        await addRoleTask(form.role_id, form.task_id);
        showMessage("Asignación creada", "success");
      } else if (editingOriginal) {
        const sameRole = form.role_id === editingOriginal.role_id;
        const sameTask = form.task_id === editingOriginal.task_id;
        if (sameRole && sameTask) {
          showMessage("No hay cambios para guardar", "success");
        } else {
          await removeRoleTask(
            editingOriginal.role_id,
            editingOriginal.task_id
          );
          try {
            await addRoleTask(form.role_id, form.task_id);
          } catch (err) {
            // Attempt to restore the original mapping if creation fails
            try {
              await addRoleTask(
                editingOriginal.role_id,
                editingOriginal.task_id
              );
            } catch (_) {
              // ignore secondary error
            }
            throw err;
          }
          showMessage("Asignación actualizada", "success");
        }
      }

      await loadMappings();
      resetForm();
      dispatch("change", { entity: "role-task", refreshMenu: true });
    } catch (err) {
      showMessage(err.message || "No fue posible guardar la asignación", "error");
    } finally {
      submitting = false;
    }
  }

  async function removeMapping(mapping) {
    const confirmDelete = confirm(
      `¿Eliminar la asignación del rol "${mapping.role_name || mapping.role_id}" y la tarea "${mapping.task_title || mapping.task_id}"?`
    );
    if (!confirmDelete) return;
    clearMessage();
    submitting = true;
    try {
      await removeRoleTask(mapping.role_id, mapping.task_id);
      showMessage("Asignación eliminada", "success");
      await loadMappings();
      dispatch("change", { entity: "role-task", refreshMenu: true });
      if (
        editingOriginal &&
        editingOriginal.role_id === mapping.role_id &&
        editingOriginal.task_id === mapping.task_id
      ) {
        resetForm();
      }
    } catch (err) {
      showMessage(err.message || "No fue posible eliminar la asignación", "error");
    } finally {
      submitting = false;
    }
  }

  function roleName(roleId) {
    const role = roles.find((r) => r.id === roleId);
    return role?.name || "—";
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Tareas por rol</h1>
      <p class="text-sm text-sky-700">
        Administra qué tareas están asignadas a cada rol.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      type="button"
      on:click={startCreate}
      disabled={submitting}
    >
      <span aria-hidden="true">{@html icons.plus}</span>
      <span>Nueva asignación</span>
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

  {#if creating || editingOriginal}
    <section class="rounded-lg border border-sky-200 bg-white shadow">
      <form class="grid gap-4 p-6 md:grid-cols-2" on:submit={saveMapping}>
        <label class="flex flex-col text-sm">
          <span class="mb-1 font-medium">Rol</span>
          <select
            class="rounded border px-3 py-2"
            bind:value={form.role_id}
            disabled={rolesLoading || submitting}
            required
          >
            <option value="" disabled>Selecciona un rol</option>
            {#each roles as role}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
        </label>

        <label class="flex flex-col text-sm md:col-span-2">
          <span class="mb-1 font-medium">Tarea</span>
          <select
            class="rounded border px-3 py-2"
            bind:value={form.task_id}
            disabled={tasksLoading || submitting}
            required
          >
            <option value="" disabled>Selecciona una tarea</option>
            {#each tasks as task}
              <option value={task.id}>{taskLabel(task)}</option>
            {/each}
          </select>
        </label>

        <div class="md:col-span-2 flex gap-2">
          <button
            type="submit"
            class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            disabled={submitting}
          >
            {creating ? "Crear asignación" : "Guardar cambios"}
          </button>
          <button
            type="button"
            class="rounded border border-sky-200 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
            on:click={cancelEdit}
            disabled={submitting}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  {/if}

  <section class="rounded-lg border border-sky-200 bg-slate-50 shadow-sm">
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
                on:click={() => toggleSort("role")}
              >
                Rol
                {#if sortKey === "role"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("task")}
              >
                Tarea
                {#if sortKey === "task"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("category")}
              >
                Categoría
                {#if sortKey === "category"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <button
                type="button"
                class={HEADER_BUTTON_CLASS}
                on:click={() => toggleSort("task_key")}
              >
                Clave de tarea
                {#if sortKey === "task_key"}
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
          {#if mappingsLoading}
            <tr>
              <td class="px-3 py-4 text-sm text-sky-900" colspan="5">
                Cargando asignaciones…
              </td>
            </tr>
          {:else if !mappings.length}
            <tr>
              <td class="px-3 py-4 text-sm text-sky-900" colspan="5">
                No hay asignaciones
              </td>
            </tr>
          {:else}
            {#each sortedMappings() as mapping (mappingKey(mapping))}
              <tr class="border-b border-sky-100 hover:bg-sky-100/60">
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{mapping.role_name || roleName(mapping.role_id)}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{mapping.task_title || mapping.task_key || "—"}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{mapping.category_title || mapping.category_key || "—"}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{mapping.task_key || "—"}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded border border-indigo-200 bg-white p-2 text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(mapping)}
                      disabled={submitting}
                      aria-label={`Editar asignación de ${mapping.role_name || mapping.role_id}`}
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded border border-rose-200 bg-white p-2 text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeMapping(mapping)}
                      disabled={submitting}
                      aria-label={`Eliminar asignación de ${mapping.role_name || mapping.role_id}`}
                    >
                      {@html icons.trash}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </section>
</div>
