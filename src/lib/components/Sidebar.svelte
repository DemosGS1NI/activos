<script>
  import { createEventDispatcher } from "svelte";
  import { slide } from "svelte/transition";
  import { page } from "$app/stores";

  export let menu = [];
  export let loading = false;

  const dispatch = createEventDispatcher();
  let expandedCategoryId = null;
  let categoriesInitialized = false;

  const iconMap = {
    dashboard:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path fill-rule="evenodd" d="M4 3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4Zm9-1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4Zm-5 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4ZM4 11a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4Z" clip-rule="evenodd"/></svg>',
    users:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-9-2a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2a5 5 0 0 0-5 5v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1a5 5 0 0 0-5-5Zm-9-1a5 5 0 0 0-5 5v1a2 2 0 0 0 2 2h3.34A6.53 6.53 0 0 1 6 16v-1.28A6.52 6.52 0 0 1 6.8 10"/></svg>',
    admin:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M11.012 2.222a1 1 0 0 1 1.976 0l.215 1.165a6.93 6.93 0 0 1 1.8.746l1.017-.708a1 1 0 0 1 1.39.28l1.111 1.803a1 1 0 0 1-.28 1.39l-1.017.708c.155.59.236 1.21.236 1.84s-.081 1.25-.236 1.84l1.017.708a1 1 0 0 1 .28 1.39l-1.11 1.803a1 1 0 0 1-1.39.28l-1.018-.708a6.93 6.93 0 0 1-1.8.746l-.215 1.165a1 1 0 0 1-1.976 0l-.215-1.165a6.93 6.93 0 0 1-1.8-.746l-1.017.708a1 1 0 0 1-1.39-.28l-1.111-1.803a1 1 0 0 1 .28-1.39l1.017-.708A6.93 6.93 0 0 1 4.959 12c0-.63.081-1.25.236-1.84l-1.017-.708a1 1 0 0 1-.28-1.39l1.11-1.803a1 1 0 0 1 1.39-.28l1.018.708a6.93 6.93 0 0 1 1.8-.746l.215-1.165Zm.988 4.778a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>',
    default:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M6 4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v16a1 1 0 0 1-1.447.895L12 18.618l-4.553 2.277A1 1 0 0 1 6 20V4Z"/></svg>',
  };

  $: currentPath = $page.url.pathname;

  function getCategoryIcon(key) {
    if (!key) return iconMap.default;
    const normalized = String(key).toLowerCase();
    return iconMap[normalized] || iconMap.default;
  }

  function tasksForCategory(category) {
    if (!category || !Array.isArray(category.tasks)) return [];
    return category.tasks.filter(Boolean);
  }

  function isActive(route) {
    if (!route) return false;
    try {
      return currentPath === route;
    } catch (_) {
      return false;
    }
  }

  function handleHome() {
    dispatch("home");
  }

  function handleTaskClick(event, task) {
    if (!task) return;
    const route = task.route || "";
    if (!route || route === "#" || route === "/roles" || route === "/users") {
      event.preventDefault();
    }
    dispatch("task", { task });
  }

  function toggleCategory(categoryId) {
    if (!categoryId) return;
    expandedCategoryId = expandedCategoryId === categoryId ? null : categoryId;
    categoriesInitialized = true;
  }

  $: if (Array.isArray(menu)) {
    const validIds = menu.map((category) => category?.id).filter(Boolean);

    if (!validIds.includes(expandedCategoryId)) {
      expandedCategoryId = null;
    }

    if (!categoriesInitialized) {
      const activeCategory = menu.find((category) =>
        tasksForCategory(category).some((task) => isActive(task?.route))
      );
      if (activeCategory?.id) {
        expandedCategoryId = activeCategory.id;
      } else {
        expandedCategoryId = validIds[0] ?? null;
      }
      categoriesInitialized = true;
    }
  }
</script>

<aside
  class="w-64 bg-sky-100 border-r border-sky-200 text-sky-900 h-screen flex flex-col overflow-hidden"
>
  <div class="px-4 py-4 shrink-0">
    <div class="text-lg font-semibold text-sky-900">Activos</div>
    <button
      type="button"
      class="mt-3 inline-flex items-center gap-2 rounded-md border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-800 transition-colors hover:border-sky-400 hover:bg-sky-200"
      on:click={handleHome}
    >
      <span>Home</span>
    </button>
  </div>
  <nav class="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
    <div class="space-y-6">
      {#if loading}
        <div class="text-sm text-sky-700">Loading menu…</div>
      {:else if menu && menu.length}
        {#each menu as category}
          <section class="space-y-2">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-indigo-100"
              on:click={() => toggleCategory(category?.id)}
              aria-expanded={expandedCategoryId === category?.id}
            >
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700"
              >
                {@html getCategoryIcon(category?.key)}
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-semibold text-sky-900 truncate">
                  {category?.title || "Untitled"}
                </h2>
                {#if category?.description}
                  <p class="text-xs text-sky-700 truncate">
                    {category.description}
                  </p>
                {/if}
              </div>
              <span
                class={`text-xs font-medium text-sky-600 transition-transform ${
                  expandedCategoryId === category?.id ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              >
                ▶
              </span>
            </button>
            {#if tasksForCategory(category).length}
              {#if expandedCategoryId === category?.id}
                <ul class="pr-1 space-y-1" transition:slide>
                  {#each tasksForCategory(category) as t}
                    <li>
                      <a
                        href={t?.route || "#"}
                        class={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                          isActive(t?.route)
                            ? "bg-indigo-100 text-indigo-800 font-semibold"
                            : "text-sky-800 hover:bg-sky-200 hover:text-sky-900"
                        }`}
                        aria-current={isActive(t?.route) ? "page" : undefined}
                        on:click={(event) => handleTaskClick(event, t)}
                      >
                        <span class="truncate"
                          >{t?.title || "Untitled Task"}</span
                        >
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            {:else if expandedCategoryId === category?.id}
              <p class="text-xs text-sky-700" transition:slide>
                No tasks assigned
              </p>
            {/if}
          </section>
        {/each}
      {:else}
        <div class="text-sm text-sky-700">No menu items</div>
      {/if}
    </div>
  </nav>
</aside>
