<script>
  import { createEventDispatcher } from "svelte";
  import { slide } from "svelte/transition";
  import { page } from "$app/stores";
  import { MENU_CATEGORY_ICONS } from "./icons.js";

  export let menu = [];
  export let loading = false;
  export let collapsed = false;

  const dispatch = createEventDispatcher();
  let expandedCategoryId = null;
  let categoriesInitialized = false;

  function collapsedCategoryClasses(category) {
    const classes = [
      "flex w-full flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
      "border-sky-300 text-sky-800",
    ];

    if (categoryHasActive(category)) {
      classes.push("border-indigo-300 bg-indigo-100 text-indigo-800");
    } else {
      classes.push("hover:border-sky-400 hover:bg-sky-200 hover:text-sky-900");
    }

    return classes.join(" ");
  }

  function expandedCategoryClasses(category) {
    const classes = [
      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
    ];

    if (categoryHasActive(category)) {
      classes.push("bg-indigo-100 text-indigo-800");
    } else {
      classes.push("text-sky-900 hover:bg-indigo-100");
    }

    return classes.join(" ");
  }

  $: currentPath = $page.url.pathname;

  function getCategoryIcon(key) {
    if (!key) return MENU_CATEGORY_ICONS.default;

    const normalized = String(key).toLowerCase();
    if (MENU_CATEGORY_ICONS[normalized]) {
      return MENU_CATEGORY_ICONS[normalized];
    }

    const heuristics = [
      { match: /asset/, icon: "assets" },
      { match: /inventario|inventory/, icon: "inventory" },
      { match: /categoria|catalog/, icon: "catalogs" },
      { match: /document/, icon: "documents" },
      { match: /condicion|condition|estado|status/, icon: "inventory_conditions" },
      { match: /depreci|deprecia/, icon: "depreciation" },
      { match: /ubic|location/, icon: "locations" },
      { match: /proveedor|provider/, icon: "providers" },
      { match: /respons/, icon: "responsibles" },
      { match: /usuario|user/, icon: "users" },
      { match: /rol|role/, icon: "roles" },
      { match: /tarea|task/, icon: "tasks" },
      { match: /seguridad|security/, icon: "security" },
      { match: /depart/, icon: "departments" },
      { match: /grupo|group/, icon: "menu" },
      { match: /menu/, icon: "menu" },
      { match: /reporte|report/, icon: "reports" },
      { match: /config|ajuste|setting/, icon: "settings" },
      { match: /admin/, icon: "admin" },
      { match: /finan|conta|costo|cost/, icon: "finance" },
    ];

    for (const rule of heuristics) {
      if (rule.match.test(normalized) && MENU_CATEGORY_ICONS[rule.icon]) {
        return MENU_CATEGORY_ICONS[rule.icon];
      }
    }

    return MENU_CATEGORY_ICONS.default;
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

  function handleToggleSidebar() {
    dispatch("toggleSidebar");
  }

  function toggleCategory(categoryId) {
    if (!categoryId) return;
    expandedCategoryId = expandedCategoryId === categoryId ? null : categoryId;
    categoriesInitialized = true;
  }

  function categoryHasActive(category) {
    return tasksForCategory(category).some((task) => isActive(task?.route));
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
  class={`bg-sky-100 border-r border-sky-200 text-sky-900 h-screen flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? "w-24" : "w-64"}`}
>
  <div class={`shrink-0 ${collapsed ? "px-2 py-4" : "px-4 py-4"}`}>
    <div
      class={`font-semibold text-sky-900 ${collapsed ? "text-center text-sm" : "text-lg"}`}
    >
      Activos
    </div>
    <button
      type="button"
      class={`mt-3 flex rounded-md border border-sky-300 text-sm font-medium text-sky-800 transition-colors hover:border-sky-400 hover:bg-sky-200 ${collapsed ? "w-full flex-col items-center gap-1 px-2 py-2 text-xs" : "items-center gap-2 px-3 py-1.5"}`}
      on:click={handleToggleSidebar}
      aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
      aria-pressed={!collapsed}
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      >
        <path d="M3 6h14"></path>
        <path d="M3 10h14"></path>
        <path d="M3 14h14"></path>
      </svg>
      <span class={collapsed ? "text-[11px]" : ""}>Menu</span>
    </button>


    <button
      type="button"
      class={`mt-3 flex rounded-md border border-sky-300 text-sm font-medium text-sky-800 transition-colors hover:border-sky-400 hover:bg-sky-200 ${collapsed ? "w-full flex-col items-center gap-1 px-2 py-2 text-xs" : "items-center gap-2 px-3 py-1.5"}`}
      on:click={handleHome}
      aria-label="Ir al inicio"
    >
      <svg
        class="h-5 w-5"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 11.5 12 4l9 7.5"></path>
        <path d="M5 10.5V20h5v-4h4v4h5v-9.5"></path>
      </svg>
      <span class={collapsed ? "text-[11px]" : ""}>Home</span>
    </button>
  </div>
  <nav
    class={`flex-1 min-h-0 overflow-y-auto pb-6 ${collapsed ? "px-2" : "px-4"}`}
  >
    <div class={collapsed ? "space-y-4" : "space-y-6"}>
      {#if loading}
        <div class="text-sm text-sky-700">Loading menu…</div>
      {:else if menu && menu.length}
        {#each menu as category}
          <section class={collapsed ? "space-y-1" : "space-y-2"}>
            <button
              type="button"
              class={collapsed
                ? collapsedCategoryClasses(category)
                : expandedCategoryClasses(category)}
              on:click={() => toggleCategory(category?.id)}
              aria-expanded={collapsed ? undefined : expandedCategoryId === category?.id}
            >
              <div
                class={`flex shrink-0 items-center justify-center ${
                  collapsed
                    ? "h-9 w-9"
                    : "h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700"
                }`}
              >
                {@html getCategoryIcon(category?.key)}
              </div>
              {#if !collapsed}
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
              {:else}
                <span
                  class="max-w-[4.5rem] text-center text-[11px] font-medium leading-tight text-current"
                >
                  {category?.title || "Untitled"}
                </span>
              {/if}
            </button>
            {#if !collapsed}
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
            {/if}
          </section>
        {/each}
      {:else}
        <div class="text-sm text-sky-700">No menu items</div>
      {/if}
    </div>
  </nav>
</aside>
