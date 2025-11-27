<script>
  import CategoryCard from "./CategoryCard.svelte";
  export let menu = [];

  // Only show up to 9 categories
  $: categories = (menu || []).slice(0, 9);
</script>

<div class="p-6">
  <div
    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center"
  >
    {#each categories as c}
      <CategoryCard category={c} />
    {/each}
  </div>
</div>
