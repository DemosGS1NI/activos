<script>
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import Header from "./Header.svelte";
  import Sidebar from "./Sidebar.svelte";
  import MenuGroupGrid from "./MenuGroupGrid.svelte";
  import MenuGroupManager from "./MenuGroupManager.svelte";
  import RolesManager from "./RolesManager.svelte";
  import UsersManager from "./UsersManager.svelte";
  import RoleTaskManager from "./RoleTaskManager.svelte";
  import TasksManager from "./TasksManager.svelte";
  import DocumentTypeManager from "./DocumentTypeManager.svelte";
  import AssetStatusManager from "./AssetStatusManager.svelte";
  import AssetCategoryManager from "./AssetCategoryManager.svelte";
  import DepreciationMethodManager from "./DepreciationMethodManager.svelte";
  import DepartmentManager from "./DepartmentManager.svelte";
  import CostCenterManager from "./CostCenterManager.svelte";
  import LocationManager from "./LocationManager.svelte";
  import ResponsibleManager from "./ResponsibleManager.svelte";
  import ProviderManager from "./ProviderManager.svelte";
  import AssetManager from "./AssetManager.svelte";
  import InventoryConditionManager from "./InventoryConditionManager.svelte";
  import InventoryTaking from "./InventoryTaking.svelte";
  import ProfileModal from "./ProfileModal.svelte";
  import menuStore, { setMenu, clearMenu } from "../stores/menuStore.js";

  export let initialView = "overview";

  let user = null;
  let accessToken = null;
  let menu = [];
  let menuLoading = false;
  let isAdmin = false;
  let viewMode = initialView;
  let userReady = false;
  let initialViewApplied = false;

  const unsubscribeMenu = menuStore.subscribe((value) => {
    menu = value;
  });

  onDestroy(() => {
    unsubscribeMenu();
  });

  async function loadMenuFromServer() {
    menuLoading = true;
    try {
      const headers = accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined;
      const res = await fetch("/menu", { headers });
      if (res.ok) {
        const body = await res.json();
        setMenu(body.data?.menu || []);
      } else {
        setMenu([]);
      }
    } catch (e) {
      setMenu([]);
    } finally {
      menuLoading = false;
    }
  }

  onMount(async () => {
    const token = localStorage.getItem("access_token");
    accessToken = token || null;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const roleName =
          (payload.role && payload.role.name) ??
          payload.role_name ??
          payload.roleName ??
          (typeof payload.role === "string" ? payload.role : null);
        const roleId =
          (payload.role && payload.role.id) ??
          payload.role_id ??
          payload.roleId ??
          null;
        user = {
          email: payload.email,
          role: roleName,
          roleName,
          roleId,
          id: payload.sub,
          name: payload.name,
          status: payload.status,
          menu: payload.menu || null,
        };
        if (payload.menu && Array.isArray(payload.menu)) {
          setMenu(payload.menu);
        } else {
          await loadMenuFromServer();
        }
      } catch (e) {
        await loadMenuFromServer();
      }
    } else {
      await loadMenuFromServer();
    }

    userReady = true;
  });

  function doLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    accessToken = null;
    clearMenu();
    window.location.reload();
  }

  $: isAdmin = Boolean(
    user &&
      ((user.role && String(user.role).toLowerCase() === "admin") ||
        (user.roleName && String(user.roleName).toLowerCase() === "admin"))
  );

  function routeForView(mode) {
    if (mode === "roles") return "/roles";
    if (mode === "menuGroups") return "/menu_groups";
    if (mode === "users") return "/users";
    if (mode === "tasks") return "/tasks";
    if (mode === "roleTasks") return "/role_tasks";
    if (mode === "documentTypes") return "/document_types";
    if (mode === "assetStatuses") return "/asset_statuses";
    if (mode === "assetCategories") return "/asset_categories";
    if (mode === "depreciationMethods") return "/depreciation_methods";
    if (mode === "departments") return "/departments";
    if (mode === "costCenters") return "/cost_centers";
    if (mode === "locations") return "/locations";
    if (mode === "responsibles") return "/responsibles";
    if (mode === "providers") return "/providers";
    if (mode === "assets") return "/assets";
    if (mode === "inventoryConditions") return "/inventory_conditions";
    if (mode === "inventoryTaking") return "/inventory/taking";
    return "/";
  }

  function switchView(mode, { syncRoute = true } = {}) {
    viewMode = mode;
    if (!syncRoute || typeof window === "undefined") return;
    const target = routeForView(mode);
    if (target && window.location.pathname !== target) {
      goto(target);
    }
  }

  $: if (
    userReady &&
    !isAdmin &&
    viewMode !== "overview" &&
    viewMode !== "inventoryTaking"
  ) {
    switchView("overview");
  }

  $: if (userReady && !initialViewApplied) {
    if (
      isAdmin &&
      (initialView === "roles" ||
        initialView === "menuGroups" ||
        initialView === "users" ||
        initialView === "tasks" ||
        initialView === "roleTasks" ||
        initialView === "documentTypes" ||
        initialView === "assetStatuses" ||
        initialView === "assetCategories" ||
        initialView === "depreciationMethods" ||
        initialView === "departments" ||
        initialView === "costCenters" ||
        initialView === "locations" ||
        initialView === "responsibles" ||
        initialView === "providers" ||
        initialView === "assets" ||
        initialView === "inventoryConditions" ||
        initialView === "inventoryTaking")
    ) {
      switchView(initialView, { syncRoute: false });
    } else if (!isAdmin && initialView === "inventoryTaking") {
      switchView("inventoryTaking", { syncRoute: false });
    } else {
      switchView("overview", { syncRoute: false });
    }
    initialViewApplied = true;
  }

  let showProfileModal = false;
  function openProfile() {
    showProfileModal = true;
  }

  async function handleAdminChange(event) {
    const refreshMenu = event?.detail?.refreshMenu === true;
    if (!refreshMenu) return;
    await loadMenuFromServer();
  }

  function handleHome() {
    switchView("overview");
  }

  function handleTaskSelection(event) {
    const task = event.detail?.task;
    if (!task) return;
    if (task.route === "/roles") {
      if (isAdmin) {
        switchView("roles");
      } else {
        goto("/roles");
      }
    } else if (task.route === "/tasks") {
      if (isAdmin) {
        switchView("tasks");
      } else {
        goto("/tasks");
      }
    } else if (task.route === "/menu_groups") {
      if (isAdmin) {
        switchView("menuGroups");
      } else {
        goto("/menu_groups");
      }
    } else if (task.route === "/users") {
      if (isAdmin) {
        switchView("users");
      } else {
        goto("/users");
      }
    } else if (task.route === "/inventory_conditions") {
      if (isAdmin) {
        switchView("inventoryConditions");
      } else {
        goto("/inventory_conditions");
      }
    } else if (task.route === "/inventory/taking") {
      switchView("inventoryTaking");
    } else if (
      task.route === "/role_tasks" ||
      task.route === "/role-tasks" ||
      task.route === "/role_task"
    ) {
      if (isAdmin) {
        switchView("roleTasks");
      } else {
        goto("/role_tasks");
      }
    } else if (task.route === "/document_types") {
      if (isAdmin) {
        switchView("documentTypes");
      } else {
        goto("/document_types");
      }
    } else if (task.route === "/asset_statuses") {
      if (isAdmin) {
        switchView("assetStatuses");
      } else {
        goto("/asset_statuses");
      }
    } else if (task.route === "/asset_categories") {
      if (isAdmin) {
        switchView("assetCategories");
      } else {
        goto("/asset_categories");
      }
    } else if (task.route === "/depreciation_methods") {
      if (isAdmin) {
        switchView("depreciationMethods");
      } else {
        goto("/depreciation_methods");
      }
    } else if (task.route === "/departments") {
      if (isAdmin) {
        switchView("departments");
      } else {
        goto("/departments");
      }
    } else if (task.route === "/cost_centers") {
      if (isAdmin) {
        switchView("costCenters");
      } else {
        goto("/cost_centers");
      }
    } else if (task.route === "/locations") {
      if (isAdmin) {
        switchView("locations");
      } else {
        goto("/locations");
      }
    } else if (task.route === "/responsibles") {
      if (isAdmin) {
        switchView("responsibles");
      } else {
        goto("/responsibles");
      }
    } else if (task.route === "/providers") {
      if (isAdmin) {
        switchView("providers");
      } else {
        goto("/providers");
      }
    } else if (task.route === "/assets") {
      if (isAdmin) {
        switchView("assets");
      } else {
        goto("/assets");
      }
    } else if (task.route) {
      goto(task.route);
    }
  }
</script>

<div class="min-h-screen flex bg-gray-50">
  <Sidebar
    {menu}
    loading={menuLoading}
    on:home={handleHome}
    on:task={handleTaskSelection}
  />
  <div class="flex-1 flex flex-col">
    <Header {user} onLogout={doLogout} onProfile={openProfile} />
    <main class="flex-1 overflow-auto p-6 space-y-4">
      {#if isAdmin && viewMode === "menuGroups"}
        <MenuGroupManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "roles"}
        <RolesManager />
      {:else if isAdmin && viewMode === "users"}
        <UsersManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "tasks"}
        <TasksManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "roleTasks"}
        <RoleTaskManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "documentTypes"}
        <DocumentTypeManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "assetStatuses"}
        <AssetStatusManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "assetCategories"}
        <AssetCategoryManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "depreciationMethods"}
        <DepreciationMethodManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "departments"}
        <DepartmentManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "costCenters"}
        <CostCenterManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "locations"}
        <LocationManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "responsibles"}
        <ResponsibleManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "providers"}
        <ProviderManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "assets"}
        <AssetManager on:change={handleAdminChange} />
      {:else if isAdmin && viewMode === "inventoryConditions"}
        <InventoryConditionManager on:change={handleAdminChange} />
      {:else if viewMode === "inventoryTaking"}
        <InventoryTaking />
      {:else}
        <MenuGroupGrid {menu} />
      {/if}
    </main>
  </div>
  {#if showProfileModal}
    <ProfileModal {user} on:close={() => (showProfileModal = false)} />
  {/if}
</div>
