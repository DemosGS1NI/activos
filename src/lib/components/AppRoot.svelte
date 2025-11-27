<script>
  import { onMount } from "svelte";
  import AppFrame from "./AppFrame.svelte";
  import Login from "./Login.svelte";

  export let initialView = "overview";

  let isLoggedIn = false;

  function evaluateToken() {
    const token = localStorage.getItem("access_token");
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp > Date.now() / 1000) {
        return true;
      }
    } catch (_) {
      // Fall through to token removal below
    }

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return false;
  }

  if (typeof window !== "undefined") {
    isLoggedIn = evaluateToken();
  }

  onMount(() => {
    isLoggedIn = evaluateToken();
  });
</script>

{#if isLoggedIn}
  <AppFrame {initialView} />
{:else}
  <Login />
{/if}
