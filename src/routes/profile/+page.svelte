<script>
  // This route is intentionally kept minimal to avoid duplicating the Profile modal component.
  // The application uses `src/lib/components/ProfileModal.svelte` from the main app frame.
  // Visiting /profile will redirect to the main page where the modal can be opened.
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  onMount(() => {
    goto("/");
  });
</script>

<div></div>
