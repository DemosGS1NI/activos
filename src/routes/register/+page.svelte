<script>
  let email = "";
  let password = "";
  let name = "";
  let loading = false;
  let error = "";

  async function submit(e) {
    e.preventDefault();
    error = "";
    if (!email || !password) {
      error = "Correo y contraseña son obligatorios";
      return;
    }
    loading = true;
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const body = await res.json();
      if (!res.ok) {
        error = body?.error?.message || "Error al registrarse";
        return;
      }
      const tokens = body.data.tokens;
      if (tokens) {
        localStorage.setItem("access_token", tokens.access);
        localStorage.setItem("refresh_token", tokens.refresh);
      }
      window.location.href = "/";
    } catch (e) {
      error = e.message || "Error de red";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
  <div class="w-full max-w-md p-8 bg-white rounded-lg shadow">
    <h1 class="text-2xl font-semibold mb-6">Crear cuenta</h1>
    {#if error}
      <div class="mb-4 text-sm text-red-700 bg-red-100 p-3 rounded">
        {error}
      </div>
    {/if}
    <form on:submit|preventDefault={submit} class="space-y-4">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700"
          >Nombre completo</label
        >
        <input
          id="name"
          type="text"
          bind:value={name}
          class="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="email" class="block text-sm font-medium text-gray-700"
          >Correo electrónico</label
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
          >Contraseña</label
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
        <a href="/login" class="text-sm text-indigo-600 hover:underline"
          >Iniciar sesión</a
        >
      </div>
      <div>
        <button
          type="submit"
          class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          disabled={loading}
        >
          {#if loading}Creando...{:else}Crear cuenta{/if}
        </button>
      </div>
    </form>
  </div>
</div>
