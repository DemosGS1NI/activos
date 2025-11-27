<script>
  export let category = null;
</script>

<div class="group cursor-pointer">
  <div
    class="flex items-center justify-center h-28 w-28 mx-auto rounded-lg bg-indigo-50 hover:bg-indigo-100"
  >
    <!-- simple icon: initials or circle -->
    <div class="text-indigo-600 text-xl font-bold">
      {category.key ? category.key.charAt(0).toUpperCase() : "C"}
    </div>
  </div>
  <div class="mt-3 text-center text-sm font-medium text-gray-700">
    {category.title}
  </div>
</div>
