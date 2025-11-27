<script>
  import { onMount } from "svelte";
  export let email = "";
  export let password = "";
  export let loading = false;
  export let error = "";

  export async function submit(e) {
    e.preventDefault();
    error = "";
    if (!email || !password) {
      error = "Email and password are required";
      return;
    }
    loading = true;
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        error = body?.error?.message || "Login failed";
        return;
      }
      // Persist tokens (client-side demo). For production prefer HttpOnly cookies.
      const tokens = body.data.tokens;
      if (tokens) {
        localStorage.setItem("access_token", tokens.access);
        localStorage.setItem("refresh_token", tokens.refresh);
      }
      // Reload to show logged in state
      window.location.reload();
    } catch (e) {
      error = e.message || "Network error";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Prefill from localStorage if helpful
    const stored = localStorage.getItem("last_email");
    if (stored) email = stored;
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="w-full max-w-md p-8 bg-white rounded-lg shadow">
    <h1 class="text-2xl font-semibold mb-6">Sign in</h1>
    {#if error}
      <div class="mb-4 text-sm text-red-700 bg-red-100 p-3 rounded">
        {error}
      </div>
    {/if}
    <form on:submit|preventDefault={submit} class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700"
          >Email</label
        >
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          class="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="password" class="block text-sm font-medium text-gray-700"
          >Password</label
        >
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          class="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div class="flex items-center justify-between">
        <label class="text-sm">
          <input
            type="checkbox"
            on:change={(e) => {
              if (e.target.checked) localStorage.setItem("last_email", email);
              else localStorage.removeItem("last_email");
            }}
          />
          <span class="ml-2 text-sm text-gray-600">Remember email</span>
        </label>
        <a href="/register" class="text-sm text-indigo-600 hover:underline"
          >Create account</a
        >
      </div>
      <div>
        <button
          type="submit"
          class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          disabled={loading}
        >
          {#if loading}Signing in...{:else}Sign in{/if}
        </button>
      </div>
    </form>
  </div>
</div>