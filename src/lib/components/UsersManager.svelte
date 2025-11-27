<script>
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import {
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    listRoles,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const STATUS_OPTIONS = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "suspended", label: "Suspended" },
  ];

  const HEADER_BUTTON_CLASS =
    "flex items-center gap-2 font-semibold tracking-wide text-sky-900 transition hover:text-indigo-700";
  const HEADER_LABEL_CLASS = "block font-semibold tracking-wide text-sky-900";
  const DATA_CELL_CLASS = "px-3 py-2 text-sm text-sky-900";

  const defaultForm = {
    id: null,
    email: "",
    name: "",
    status: "active",
    role_id: "",
    password: "",
    force_password_change: false,
    setPassword: true,
    reset_failed_login_attempts: false,
  };

  let users = [];
  let roles = [];
  let usersLoading = false;
  let rolesLoading = false;
  let submitting = false;
  let message = "";
  let messageTone = "";
  let sortKey = "email";
  let sortDirection = "asc";
  let form = { ...defaultForm };
  let creating = false;
  let editingId = null;

  onMount(async () => {
    await Promise.all([loadRoles(), loadUsers()]);
  });

  function resetForm() {
    form = { ...defaultForm };
    creating = false;
    editingId = null;
  }

  function showMessage(text, tone = "success") {
    message = text;
    messageTone = tone;
  }

  function clearMessage() {
    message = "";
    messageTone = "";
  }

  async function loadUsers() {
    usersLoading = true;
    clearMessage();
    try {
      users = await listUsers();
    } catch (err) {
      showMessage(err.message || "Unable to load users", "error");
    } finally {
      usersLoading = false;
    }
  }

  async function loadRoles() {
    rolesLoading = true;
    try {
      roles = await listRoles();
    } catch (err) {
      showMessage(err.message || "Unable to load roles", "error");
      roles = [];
    } finally {
      rolesLoading = false;
    }
  }

  function startCreate() {
    clearMessage();
    resetForm();
    creating = true;
    form.setPassword = true;
  }

  function startEdit(user) {
    clearMessage();
    creating = false;
    editingId = user.id;
    form = {
      id: user.id,
      email: user.email || "",
      name: user.name || "",
      status: user.status || "active",
      role_id: user.role_id || "",
      password: "",
      force_password_change: Boolean(user.force_password_change),
      setPassword: false,
      reset_failed_login_attempts: false,
    };
  }

  function cancelEdit() {
    resetForm();
  }

  function sortedUsers() {
    const data = [...users];
    data.sort((a, b) => {
      const av = (a?.[sortKey] || "").toString().toLowerCase();
      const bv = (b?.[sortKey] || "").toString().toLowerCase();
      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }

  function toggleSort(nextKey) {
    if (sortKey === nextKey) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortKey = nextKey;
      sortDirection = "asc";
    }
  }

  function normalizedRoleId(value) {
    if (!value) return null;
    return value;
  }

  function buildPayload({ includePassword = false } = {}) {
    const payload = {
      email: form.email?.trim() || "",
      name: form.name?.trim() || "",
      status: form.status,
      role_id: normalizedRoleId(form.role_id),
      force_password_change: Boolean(form.force_password_change),
    };

    if (!payload.email) throw new Error("Email is required");
    if (!payload.name) payload.name = null;

    if (includePassword) {
      if (!form.password || form.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      payload.password = form.password;
    }

    if (form.reset_failed_login_attempts) {
      payload.reset_failed_login_attempts = true;
    }

    return payload;
  }

  async function saveUser(event) {
    event.preventDefault();
    clearMessage();
    submitting = true;
    try {
      if (creating) {
        const payload = buildPayload({ includePassword: true });
        await createUser(payload);
        showMessage("User created", "success");
      } else if (editingId) {
        const includePassword = form.setPassword && form.password;
        const payload = buildPayload({ includePassword });
        await updateUser(editingId, payload);
        showMessage("User updated", "success");
      }
      await loadUsers();
      resetForm();
      dispatch("change", { entity: "user" });
    } catch (err) {
      showMessage(err.message || "Unable to save user", "error");
    } finally {
      submitting = false;
    }
  }

  async function removeUser(user) {
    const confirmed = confirm(`Delete user "${user.email}"?`);
    if (!confirmed) return;
    clearMessage();
    submitting = true;
    try {
      await deleteUser(user.id);
      showMessage("User deleted", "success");
      await loadUsers();
      dispatch("change", { entity: "user" });
    } catch (err) {
      showMessage(err.message || "Unable to delete user", "error");
    } finally {
      submitting = false;
    }
  }

  function roleLabel(roleId) {
    if (!roleId) return "—";
    const found = roles.find((r) => r.id === roleId);
    return found ? found.name : "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString();
    } catch (_) {
      return value;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold text-sky-900">Users</h1>
      <p class="text-sm text-sky-700">
        Create and maintain application users and their access options.
      </p>
    </div>
    <button
      class="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
      type="button"
      on:click={startCreate}
      disabled={submitting}
    >
      <span aria-hidden="true">{@html icons.plus}</span>
      <span>New user</span>
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

  {#if creating || editingId}
    <section class="rounded-lg border border-sky-200 bg-white shadow">
      <form class="grid gap-4 p-6 md:grid-cols-2" on:submit={saveUser}>
        <label class="flex flex-col text-sm">
          <span class="mb-1 font-medium">Email</span>
          <input
            class="rounded border px-3 py-2"
            type="email"
            bind:value={form.email}
            required
          />
        </label>

        <label class="flex flex-col text-sm">
          <span class="mb-1 font-medium">Name</span>
          <input
            class="rounded border px-3 py-2"
            bind:value={form.name}
            placeholder="Full name"
          />
        </label>

        <label class="flex flex-col text-sm">
          <span class="mb-1 font-medium">Status</span>
          <select
            class="rounded border px-3 py-2"
            bind:value={form.status}
            required
          >
            {#each STATUS_OPTIONS as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>

        <label class="flex flex-col text-sm">
          <span class="mb-1 font-medium">Role</span>
          <select
            class="rounded border px-3 py-2"
            bind:value={form.role_id}
            disabled={rolesLoading}
          >
            <option value="">No role</option>
            {#each roles as role}
              <option value={role.id}>{role.name}</option>
            {/each}
          </select>
        </label>

        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={form.force_password_change} />
          <span>Require password update on next login</span>
        </label>

        {#if creating}
          <label class="flex flex-col text-sm md:col-span-2">
            <span class="mb-1 font-medium">Temporary password</span>
            <input
              class="rounded border px-3 py-2"
              type="password"
              bind:value={form.password}
              minlength="8"
              required
            />
            <p class="mt-1 text-xs text-sky-600">
              Provide a temporary password (minimum 8 characters).
            </p>
          </label>
        {:else if editingId}
          <div class="md:col-span-2 space-y-3">
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                bind:checked={form.setPassword}
                on:change={() => {
                  if (!form.setPassword) form.password = "";
                }}
              />
              <span>Set a new temporary password</span>
            </label>
            {#if form.setPassword}
              <label class="flex flex-col text-sm">
                <span class="mb-1 font-medium">New password</span>
                <input
                  class="rounded border px-3 py-2"
                  type="password"
                  bind:value={form.password}
                  minlength="8"
                  required={form.setPassword}
                />
              </label>
            {/if}
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                bind:checked={form.reset_failed_login_attempts}
              />
              <span>Reset failed login attempts</span>
            </label>
          </div>
        {/if}

        <div class="md:col-span-2 flex gap-2">
          <button
            type="submit"
            class="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            disabled={submitting}
          >
            {creating ? "Create user" : "Save changes"}
          </button>
          <button
            type="button"
            class="rounded border border-sky-200 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
            on:click={cancelEdit}
            disabled={submitting}
          >
            Cancel
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
                on:click={() => toggleSort("email")}
              >
                EMAIL
                {#if sortKey === "email"}
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
                NAME
                {#if sortKey === "name"}
                  <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                {/if}
              </button>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>ROLE</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>STATUS</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>LAST LOGIN</span>
            </th>
            <th class="border-r border-sky-200 px-3 py-2">
              <span class={HEADER_LABEL_CLASS}>FORCE UPDATE</span>
            </th>
            <th class="px-3 py-2 text-right">
              <span class={HEADER_LABEL_CLASS}>ACTIONS</span>
            </th>
          </tr>
        </thead>
        <tbody class="text-sm text-sky-900">
          {#if usersLoading}
            <tr>
              <td class="px-3 py-4 text-sm text-sky-900" colspan="7">
                Loading users…
              </td>
            </tr>
          {:else if !users.length}
            <tr>
              <td class="px-3 py-4 text-sm text-sky-900" colspan="7">
                No users found
              </td>
            </tr>
          {:else}
            {#each sortedUsers() as user}
              <tr class="border-b border-sky-100 hover:bg-sky-100/60">
                <td class={`${DATA_CELL_CLASS} align-middle`}>{user.email}</td>
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{user.name || "—"}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{roleLabel(user.role_id)}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}>
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                      user.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : user.status === "suspended"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {user.status || "—"}
                  </span>
                </td>
                <td class={`${DATA_CELL_CLASS} align-middle`}
                  >{formatDate(user.last_login)}</td
                >
                <td class={`${DATA_CELL_CLASS} align-middle`}>
                  {#if user.force_password_change}
                    <span
                      class="inline-flex items-center justify-center rounded-full bg-amber-100 p-1 text-amber-700"
                      aria-label="Password update required"
                      >{@html icons.check}</span
                    >
                  {:else}
                    <span
                      class="inline-flex items-center justify-center rounded-full bg-slate-200 p-1 text-slate-500"
                      aria-label="Password update not required"
                      >{@html icons.x}</span
                    >
                  {/if}
                </td>
                <td class={`${DATA_CELL_CLASS} align-middle text-right`}>
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded border border-indigo-200 bg-white p-2 text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                      on:click={() => startEdit(user)}
                      disabled={submitting}
                      aria-label={`Edit ${user.email}`}
                    >
                      {@html icons.edit}
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded border border-rose-200 bg-white p-2 text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                      on:click={() => removeUser(user)}
                      disabled={submitting}
                      aria-label={`Delete ${user.email}`}
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
