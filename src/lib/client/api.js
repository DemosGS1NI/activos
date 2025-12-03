const JSON_HEADERS = { "Content-Type": "application/json" };

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

export async function apiFetch(path, { method = "GET", headers = {}, body } = {}) {
  const baseHeaders = { ...authHeaders(), ...headers };
  const finalHeaders = body && !(body instanceof FormData) ? { ...JSON_HEADERS, ...baseHeaders } : baseHeaders;
  const init = { method, headers: finalHeaders };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(path, init);
  const data = await parseJson(res);

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.details = data?.error?.details || null;
    throw error;
  }

  return data?.data ?? null;
}

export async function listMenuGroups() {
  const data = await apiFetch("/menu_groups");
  return data?.menu_groups || [];
}

export async function createMenuGroup(payload) {
  const data = await apiFetch("/menu_groups", { method: "POST", body: payload });
  return data?.menu_group || null;
}

export async function updateMenuGroup(id, payload) {
  const data = await apiFetch(`/menu_groups/${id}`, { method: "PATCH", body: payload });
  return data?.menu_group || null;
}

export async function deleteMenuGroup(id) {
  await apiFetch(`/menu_groups/${id}`, { method: "DELETE" });
}

export async function listDocumentTypes() {
  const data = await apiFetch("/document_types");
  return data?.document_types || [];
}

export async function createDocumentType(payload) {
  const data = await apiFetch("/document_types", { method: "POST", body: payload });
  return data?.document_type || null;
}

export async function updateDocumentType(id, payload) {
  const data = await apiFetch(`/document_types/${id}`, { method: "PATCH", body: payload });
  return data?.document_type || null;
}

export async function deleteDocumentType(id) {
  await apiFetch(`/document_types/${id}`, { method: "DELETE" });
}

export async function listAssetStatuses() {
  const data = await apiFetch("/asset_statuses");
  return data?.asset_statuses || [];
}

export async function createAssetStatus(payload) {
  const data = await apiFetch("/asset_statuses", { method: "POST", body: payload });
  return data?.asset_status || null;
}

export async function updateAssetStatus(id, payload) {
  const data = await apiFetch(`/asset_statuses/${id}`, { method: "PATCH", body: payload });
  return data?.asset_status || null;
}

export async function deleteAssetStatus(id) {
  await apiFetch(`/asset_statuses/${id}`, { method: "DELETE" });
}

export async function listInventoryConditions() {
  const data = await apiFetch("/inventory_conditions");
  return data?.inventory_conditions || [];
}

export async function createInventoryCondition(payload) {
  const data = await apiFetch("/inventory_conditions", {
    method: "POST",
    body: payload,
  });
  return data?.inventory_condition || null;
}

export async function updateInventoryCondition(id, payload) {
  const data = await apiFetch(`/inventory_conditions/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return data?.inventory_condition || null;
}

export async function deleteInventoryCondition(id) {
  await apiFetch(`/inventory_conditions/${id}`, { method: "DELETE" });
}

export async function lookupInventoryAsset(code, { includeHistory = true } = {}) {
  const trimmed = (code ?? "").toString().trim();
  const params = new URLSearchParams();
  if (trimmed) params.set("code", trimmed);
  if (includeHistory) params.set("includeHistory", "true");
  const qs = params.toString();
  const data = await apiFetch(`/api/inventory/assets${qs ? `?${qs}` : ""}`);
  return data || {};
}

export async function submitInventoryCheck(payload) {
  const data = await apiFetch("/api/inventory/checks", {
    method: "POST",
    body: payload,
  });
  return data?.check || null;
}

export async function listAssetCategories() {
  const data = await apiFetch("/asset_categories");
  return data?.asset_categories || [];
}

export async function createAssetCategory(payload) {
  const data = await apiFetch("/asset_categories", { method: "POST", body: payload });
  return data?.asset_category || null;
}

export async function updateAssetCategory(id, payload) {
  const data = await apiFetch(`/asset_categories/${id}`, { method: "PATCH", body: payload });
  return data?.asset_category || null;
}

export async function deleteAssetCategory(id) {
  await apiFetch(`/asset_categories/${id}`, { method: "DELETE" });
}

export async function listDepreciationMethods() {
  const data = await apiFetch("/depreciation_methods");
  return data?.depreciation_methods || [];
}

export async function createDepreciationMethod(payload) {
  const data = await apiFetch("/depreciation_methods", { method: "POST", body: payload });
  return data?.depreciation_method || null;
}

export async function updateDepreciationMethod(id, payload) {
  const data = await apiFetch(`/depreciation_methods/${id}`, { method: "PATCH", body: payload });
  return data?.depreciation_method || null;
}

export async function deleteDepreciationMethod(id) {
  await apiFetch(`/depreciation_methods/${id}`, { method: "DELETE" });
}

export async function listDepartments() {
  const data = await apiFetch("/departments");
  return data?.departments || [];
}

export async function createDepartment(payload) {
  const data = await apiFetch("/departments", { method: "POST", body: payload });
  return data?.department || null;
}

export async function updateDepartment(id, payload) {
  const data = await apiFetch(`/departments/${id}`, { method: "PATCH", body: payload });
  return data?.department || null;
}

export async function deleteDepartment(id) {
  await apiFetch(`/departments/${id}`, { method: "DELETE" });
}

export async function listCostCenters() {
  const data = await apiFetch("/cost_centers");
  return data?.cost_centers || [];
}

export async function createCostCenter(payload) {
  const data = await apiFetch("/cost_centers", { method: "POST", body: payload });
  return data?.cost_center || null;
}

export async function updateCostCenter(id, payload) {
  const data = await apiFetch(`/cost_centers/${id}`, { method: "PATCH", body: payload });
  return data?.cost_center || null;
}

export async function deleteCostCenter(id) {
  await apiFetch(`/cost_centers/${id}`, { method: "DELETE" });
}

export async function listLocations() {
  const data = await apiFetch("/locations");
  return data?.locations || [];
}

export async function createLocation(payload) {
  const data = await apiFetch("/locations", { method: "POST", body: payload });
  return data?.location || null;
}

export async function updateLocation(id, payload) {
  const data = await apiFetch(`/locations/${id}`, { method: "PATCH", body: payload });
  return data?.location || null;
}

export async function deleteLocation(id) {
  await apiFetch(`/locations/${id}`, { method: "DELETE" });
}

export async function listResponsibles() {
  const data = await apiFetch("/responsibles");
  return data?.responsibles || [];
}

export async function createResponsible(payload) {
  const data = await apiFetch("/responsibles", {
    method: "POST",
    body: payload,
  });
  return data?.responsible || null;
}

export async function updateResponsible(id, payload) {
  const data = await apiFetch(`/responsibles/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return data?.responsible || null;
}

export async function deleteResponsible(id) {
  await apiFetch(`/responsibles/${id}`, { method: "DELETE" });
}

export async function listProviders() {
  const data = await apiFetch("/providers");
  return data?.providers || [];
}

export async function createProvider(payload) {
  const data = await apiFetch("/providers", { method: "POST", body: payload });
  return data?.provider || null;
}

export async function updateProvider(id, payload) {
  const data = await apiFetch(`/providers/${id}`, { method: "PATCH", body: payload });
  return data?.provider || null;
}

export async function deleteProvider(id) {
  await apiFetch(`/providers/${id}`, { method: "DELETE" });
}

export async function listAssets() {
  const data = await apiFetch("/assets");
  return data?.assets || [];
}

export async function createAsset(payload) {
  const data = await apiFetch("/assets", { method: "POST", body: payload });
  return data?.asset || null;
}

export async function updateAsset(id, payload) {
  const data = await apiFetch(`/assets/${id}`, { method: "PATCH", body: payload });
  return data?.asset || null;
}

export async function deleteAsset(id) {
  await apiFetch(`/assets/${id}`, { method: "DELETE" });
}

export async function listTasks() {
  const data = await apiFetch("/tasks");
  return data?.tasks || [];
}

export async function createTask(payload) {
  const data = await apiFetch("/tasks", { method: "POST", body: payload });
  return data?.task || null;
}

export async function updateTask(id, payload) {
  const data = await apiFetch(`/tasks/${id}`, { method: "PATCH", body: payload });
  return data?.task || null;
}

export async function deleteTask(id) {
  await apiFetch(`/tasks/${id}`, { method: "DELETE" });
}

export async function listRoles() {
  const data = await apiFetch("/roles");
  return data?.roles || [];
}

export async function createRole(payload) {
  const data = await apiFetch("/roles", { method: "POST", body: payload });
  return data?.role || null;
}

export async function updateRole(id, payload) {
  const data = await apiFetch(`/roles/${id}`, { method: "PATCH", body: payload });
  return data?.role || null;
}

export async function deleteRole(id) {
  await apiFetch(`/roles/${id}`, { method: "DELETE" });
}

export async function listUsers() {
  const data = await apiFetch("/users");
  return data?.users || [];
}

export async function createUser(payload) {
  const data = await apiFetch("/users", { method: "POST", body: payload });
  return data?.user || null;
}

export async function updateUser(id, payload) {
  const data = await apiFetch(`/users/${id}`, { method: "PATCH", body: payload });
  return data?.user || null;
}

export async function deleteUser(id) {
  await apiFetch(`/users/${id}`, { method: "DELETE" });
}

export async function listRoleTasks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.role_id) params.set("role_id", filters.role_id);
  if (filters.task_id) params.set("task_id", filters.task_id);
  const qs = params.toString();
  const data = await apiFetch(`/role_tasks${qs ? `?${qs}` : ""}`);
  return data?.mappings || [];
}

export async function addRoleTask(roleId, taskId) {
  await apiFetch("/role_tasks", { method: "POST", body: { role_id: roleId, task_id: taskId } });
}

export async function removeRoleTask(roleId, taskId) {
  await apiFetch("/role_tasks", { method: "DELETE", body: { role_id: roleId, task_id: taskId } });
}
