<script>
  export let user = null;
  export let onLogout = () => {};
  export let onProfile = () => {};
</script>

<header
  class="flex items-center justify-end px-4 py-3 bg-sky-100 border-b border-sky-200"
>
  <div class="flex items-center gap-4">
    {#if user}
      <div class="text-sm text-sky-900">{user.email}</div>
      <button
        on:click={onProfile}
        class="px-3 py-1 rounded bg-indigo-100 text-indigo-700 text-sm font-medium hover:bg-indigo-200"
      >
        Perfil
      </button>
      <button
        on:click={onLogout}
        class="px-3 py-1 rounded bg-rose-100 text-rose-700 text-sm font-medium hover:bg-rose-200"
      >
        Cerrar Sesión
      </button>
    {:else}
      <a
        href="/login"
        class="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Sign in</a
      >
    {/if}
  </div>
</header>
