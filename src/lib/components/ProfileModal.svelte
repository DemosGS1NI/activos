<script>
  import { createEventDispatcher } from "svelte";
  export let user = null;
  const dispatch = createEventDispatcher();

  let current = "";
  let next = "";
  let confirm = "";
  let loading = false;
  let error = "";
  let message = "";
  // modal is display-only for profile fields; only password change is permitted

  // Derived display name: prefer user.name, otherwise derive from email local part
  function titleCase(s) {
    return s
      .split(/[._\-\s]+/)
      .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ""))
      .join(" ");
  }

  $: displayName = user && user.name && user.name.trim() ? user.name : null;

  // nothing to initialize for editable fields (read-only profile)

  async function changePassword(e) {
    e?.preventDefault?.();
    error = "";
    message = "";
    if (!current || !next) {
      error = "Please fill current and new password";
      return;
    }
    if (next.length < 8) {
      error = "New password must be at least 8 characters";
      return;
    }
    if (next !== confirm) {
      error = "New password and confirmation do not match";
      return;
    }

    loading = true;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch("/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current, next }),
      });
      const body = await res.json();
      if (!res.ok) {
        error = body?.error?.message || "Failed to change password";
        return;
      }
      message = "Password changed successfully";
      current = "";
      next = "";
      confirm = "";
    } catch (e) {
      error = e?.message || "Network error";
    } finally {
      loading = false;
    }
  }

  function close() {
    dispatch("close");
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <div
    class="absolute inset-0 bg-black/40"
    role="button"
    tabindex="0"
    on:click={close}
    on:keydown={(e) => {
      if (e.key === "Escape") close();
    }}
  ></div>

  <div
    class="relative z-10 w-full max-w-[403px] mx-4 bg-white rounded shadow-lg overflow-hidden"
  >
    <div class="p-4">
      {#if error}
        <div class="mb-4 text-sm text-red-700 bg-red-100 p-3 rounded">
          {error}
        </div>
      {/if}
      {#if message}
        <div class="mb-4 text-sm text-green-700 bg-green-100 p-3 rounded">
          {message}
        </div>
      {/if}

      <!-- ID Card-like Container -->
      <div
        class="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-4 space-y-4"
      >
        <!-- Avatar Placeholder (Top) -->
        <div class="flex justify-center">
          <div
            class="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-4xl font-bold border-4 border-indigo-200"
          >
            {(displayName && displayName.charAt(0).toUpperCase()) || "U"}
          </div>
        </div>

        <!-- User Info Section -->
        <div class="text-center space-y-3">
          <!-- Name (Emphasized) -->

          <div>
            <div class="text-xl font-bold text-gray-900">
              {displayName ?? ""}
            </div>
            <div class="text-xs text-gray-500">User Name</div>
          </div>

          <!-- Email -->
          <div class="text-sm text-gray-700">
            Email: <span class="font-semibold">{user?.email || "—"}</span>
          </div>

          <!-- Role -->
          <div class="text-sm text-gray-700">
            Role: <span class="font-semibold text-indigo-700"
              >{user?.role?.name ?? user?.role ?? ""}</span
            >
          </div>

          <!-- Status -->
          <div class="text-sm text-gray-700">
            Status: <span
              class="inline-block px-2 py-1 rounded-full text-xs font-medium {user?.status ===
              'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'}">{user?.status || "—"}</span
            >
          </div>
        </div>

        <!-- Password Change Section (Bottom) -->
        <hr class="border-gray-300" />
        <div class="space-y-3">
          <div class="text-center text-sm text-gray-600 font-medium">
            Change Password
          </div>
          <form on:submit|preventDefault={changePassword} class="space-y-3">
            <div>
              <label for="pm-current" class="block text-xs text-gray-700"
                >Current Password</label
              >
              <input
                id="pm-current"
                name="current"
                type="password"
                bind:value={current}
                class="mt-1 block w-full px-2 py-1 text-sm border rounded"
              />
            </div>

            <div>
              <label for="pm-next" class="block text-xs text-gray-700"
                >New Password</label
              >
              <input
                id="pm-next"
                name="next"
                type="password"
                bind:value={next}
                class="mt-1 block w-full px-2 py-1 text-sm border rounded"
              />
            </div>

            <div>
              <label for="pm-confirm" class="block text-xs text-gray-700"
                >Confirm New Password</label
              >
              <input
                id="pm-confirm"
                name="confirm"
                type="password"
                bind:value={confirm}
                class="mt-1 block w-full px-2 py-1 text-sm border rounded"
              />
            </div>

            <div class="flex justify-end gap-2 mt-4">
              <button
                type="button"
                on:click={close}
                class="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
                >Cancel</button
              >
              <button
                type="submit"
                class="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
                disabled={loading}
                >{#if loading}Updating...{:else}Update{/if}</button
              >
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>
