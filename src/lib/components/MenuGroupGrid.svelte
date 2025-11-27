<script>
  import MenuGroupCard from "./MenuGroupCard.svelte";
  export let menu = [];

  // Only show up to 9 menu groups
  $: menuGroups = (menu || []).slice(0, 9);
</script>

<div class="p-6">
  <div
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center"
  >
    {#each menuGroups as group}
      <MenuGroupCard menuGroup={group} />
    {/each}
  </div>
</div>
