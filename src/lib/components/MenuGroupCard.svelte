<script>
  export let menuGroup = null;
</script>

<div class="group cursor-pointer">
  <div
    class="flex items-center justify-center h-28 w-28 mx-auto rounded-lg bg-indigo-50 hover:bg-indigo-100"
  >
    <div class="text-indigo-600 text-xl font-bold">
      {menuGroup?.key ? menuGroup.key.charAt(0).toUpperCase() : "M"}
    </div>
  </div>
  <div class="mt-3 text-center text-sm font-medium text-gray-700">
    {menuGroup?.title}
  </div>
</div>
