<script>
  import { onMount } from "svelte";
  import { fetchInventoryDashboard } from "../client/api.js";

  const PIE_COLORS = [
    "#0ea5e9",
    "#6366f1",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#14b8a6",
    "#8b5cf6",
    "#ec4899",
  ];

  const numberFormatter = new Intl.NumberFormat("es-NI");
  const dateFormatter = new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let loading = true;
  let error = "";
  let campaigns = [];
  let selectedCampaignId = "";
  let totals = {
    totalAssets: 0,
    checkedAssets: 0,
    pendingAssets: 0,
    progressPercent: 0,
  };
  let conditionBreakdown = [];
  let takerBreakdown = [];
  let assets = [];
  let assetsLimit = 0;
  let assetsTruncated = false;
  let lastUpdated = null;

  function formatNumber(value) {
    return numberFormatter.format(value ?? 0);
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return dateFormatter.format(date);
    } catch (_) {
      return "";
    }
  }

  function campaignLabel(item) {
    if (!item) return "";
    const pieces = [item.name];
    if (item.status) {
      pieces.push(`(${item.status})`);
    }
    return pieces.filter(Boolean).join(" ");
  }

  async function loadDashboard(campaignId = null) {
    loading = true;
    error = "";
    try {
      const requestId = campaignId ? campaignId : null;
      const data = await fetchInventoryDashboard({ campaignId: requestId });
      campaigns = data.campaigns ?? [];
      selectedCampaignId = data.selectedCampaignId ?? "";
      totals = {
        totalAssets: data?.totals?.totalAssets ?? 0,
        checkedAssets: data?.totals?.checkedAssets ?? 0,
        pendingAssets: data?.totals?.pendingAssets ?? 0,
        progressPercent: data?.totals?.progressPercent ?? 0,
      };
      conditionBreakdown = Array.isArray(data?.conditionBreakdown) ? data.conditionBreakdown : [];
      takerBreakdown = Array.isArray(data?.takerBreakdown) ? data.takerBreakdown : [];
      assets = Array.isArray(data?.assets) ? data.assets : [];
      assetsLimit = data?.assetsLimit ?? 0;
      assetsTruncated = Boolean(data?.assetsTruncated);
      lastUpdated = new Date().toISOString();
    } catch (err) {
      error = err?.message || "No fue posible cargar el dashboard";
    } finally {
      loading = false;
    }
  }

  function handleCampaignChange() {
    const nextId = selectedCampaignId ? selectedCampaignId : null;
    void loadDashboard(nextId);
  }

  function handleRefresh() {
    void loadDashboard(selectedCampaignId ? selectedCampaignId : null);
  }

  $: pieSlices = conditionBreakdown.map((item, index) => ({
    ...item,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  $: pieGradient = (() => {
    if (!pieSlices.length) return "conic-gradient(#e2e8f0 0% 100%)";
    let cursor = 0;
    const segments = [];
    for (const slice of pieSlices) {
      const span = Math.max(slice.percentage ?? 0, 0);
      const end = Math.min(cursor + span, 100);
      segments.push(`${slice.color} ${cursor}% ${end}%`);
      cursor = end;
    }
    if (cursor < 100) {
      segments.push(`#e2e8f0 ${cursor}% 100%`);
    }
    return `conic-gradient(${segments.join(", ")})`;
  })();

  onMount(() => {
    void loadDashboard(null);
  });
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-sky-900">Dashboard de inventario</h1>
      <p class="text-sm text-sky-700">
        Monitorea el avance de las campañas y el estado de los activos inventariados.
      </p>
    </div>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label class="flex flex-col text-sm text-sky-900">
        <span class="font-semibold">Campaña</span>
        <select
          class="mt-1 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none disabled:opacity-60"
          bind:value={selectedCampaignId}
          on:change={handleCampaignChange}
          disabled={loading || !campaigns.length}
        >
          <option value="" disabled>
            {campaigns.length ? "Selecciona una campaña" : "Sin campañas"}
          </option>
          {#each campaigns as campaign}
            <option value={campaign.id}>
              {campaignLabel(campaign)}
            </option>
          {/each}
        </select>
      </label>
      <button
        class="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
        type="button"
        on:click={handleRefresh}
        disabled={loading}
      >
        {loading ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  </div>

  {#if error}
    <div class="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {error}
    </div>
  {/if}

  <div class="rounded-lg border border-sky-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-lg border border-sky-100 bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-sky-600">Total programado</p>
          <p class="mt-2 text-3xl font-semibold text-sky-900">{formatNumber(totals.totalAssets)}</p>
        </div>
        <div class="rounded-lg border border-sky-100 bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600">Verificados</p>
          <p class="mt-2 text-3xl font-semibold text-emerald-600">{formatNumber(totals.checkedAssets)}</p>
        </div>
        <div class="rounded-lg border border-sky-100 bg-slate-50 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-amber-600">Pendientes</p>
          <p class="mt-2 text-3xl font-semibold text-amber-600">{formatNumber(totals.pendingAssets)}</p>
        </div>
      </div>
      <div class="min-w-[220px] rounded-lg border border-sky-100 bg-slate-50 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-600">Avance</p>
        <div class="mt-3 h-3 rounded-full bg-slate-200">
          <div
            class={`h-3 rounded-full bg-indigo-500 transition-[width] duration-500 ease-out`}
            style={`width: ${Math.min(totals.progressPercent, 100)}%;`}
          ></div>
        </div>
        <p class="mt-3 text-sm font-semibold text-sky-900">
          {totals.progressPercent?.toFixed ? totals.progressPercent.toFixed(1) : totals.progressPercent}% completado
        </p>
        {#if lastUpdated}
          <p class="mt-1 text-xs text-slate-500">Actualizado {formatDate(lastUpdated)}</p>
        {/if}
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-3">
    <div class="rounded-lg border border-sky-200 bg-white p-5 shadow-sm lg:col-span-2">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-sky-900">Condición de los activos verificados</h2>
        <span class="text-xs text-slate-500">{formatNumber(totals.checkedAssets)} activos</span>
      </div>
      {#if !pieSlices.length}
        <p class="mt-6 text-sm text-slate-600">Sin datos de verificación para la campaña seleccionada.</p>
      {:else}
        <div class="mt-6 flex flex-col gap-6 md:flex-row md:items-center">
          <div
            class="h-48 w-48 shrink-0 rounded-full border border-slate-200 shadow-inner"
            style={`background: ${pieGradient};`}
          ></div>
          <div class="flex-1 space-y-3">
            {#each pieSlices as slice}
              <div class="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-sky-900">
                <div class="flex items-center gap-3">
                  <span class="h-3 w-3 rounded-sm" style={`background-color: ${slice.color};`}></span>
                  <span>{slice.label}</span>
                </div>
                <span class="font-semibold">{slice.percentage}%</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="rounded-lg border border-sky-200 bg-white p-5 shadow-sm">
      <h2 class="text-lg font-semibold text-sky-900">Productividad por inventarista</h2>
      {#if !takerBreakdown.length}
        <p class="mt-4 text-sm text-slate-600">Sin registros de inventario para la campaña seleccionada.</p>
      {:else}
        <ul class="mt-4 space-y-3 text-sm text-sky-900">
          {#each takerBreakdown as item}
            <li class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div class="flex items-center justify-between">
                <span class="font-semibold">{item.name}</span>
                <span>{formatNumber(item.count)} activos</span>
              </div>
              <div class="mt-2 h-2 rounded-full bg-slate-200">
                <div
                  class="h-2 rounded-full bg-emerald-500"
                  style={`width: ${Math.min(item.percentage ?? 0, 100)}%;`}
                ></div>
              </div>
              <p class="mt-1 text-xs text-slate-500">{item.percentage ?? 0}% del total verificado</p>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="rounded-lg border border-sky-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-lg font-semibold text-sky-900">Detalle de activos inventariados</h2>
      {#if assetsTruncated && assetsLimit}
        <p class="text-xs text-slate-500">Mostrando últimos {assets.length} de {formatNumber(totals.checkedAssets)} activos.</p>
      {/if}
    </div>

    {#if !assets.length}
      <p class="mt-4 text-sm text-slate-600">Sin registros de inventario para mostrar.</p>
    {:else}
      <div class="mt-4 overflow-x-auto">
        <table class="min-w-full border-collapse text-sm text-sky-900">
          <thead class="bg-sky-200/70 text-left text-xs font-semibold uppercase tracking-wide text-sky-800">
            <tr>
              <th class="border-b border-sky-100 px-3 py-2">Activo</th>
              <th class="border-b border-sky-100 px-3 py-2">Nombre</th>
              <th class="border-b border-sky-100 px-3 py-2">Condición</th>
              <th class="border-b border-sky-100 px-3 py-2">Responsable</th>
              <th class="border-b border-sky-100 px-3 py-2">Ubicación</th>
              <th class="border-b border-sky-100 px-3 py-2">Inventarista</th>
              <th class="border-b border-sky-100 px-3 py-2">Fecha</th>
              <th class="border-b border-sky-100 px-3 py-2">Comentario</th>
            </tr>
          </thead>
          <tbody>
            {#each assets as item}
              <tr class="border-b border-slate-100 bg-slate-50/60">
                <td class="px-3 py-2 font-mono text-xs text-slate-600">{item.assetTag}</td>
                <td class="px-3 py-2 font-medium text-sky-900">{item.assetName}</td>
                <td class="px-3 py-2 text-sm text-sky-800">{item.conditionLabel}</td>
                <td class="px-3 py-2 text-sm text-slate-700">{item.responsible?.name ?? "—"}</td>
                <td class="px-3 py-2 text-sm text-slate-700">
                  {#if item.location}
                    {item.location.name}
                    {#if item.location.code}
                      <span class="ml-1 text-xs text-slate-500">({item.location.code})</span>
                    {/if}
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-3 py-2 text-sm text-slate-700">{item.checkedByName ?? "—"}</td>
                <td class="px-3 py-2 text-sm text-slate-700">{formatDate(item.checkedAt)}</td>
                <td class="px-3 py-2 text-xs text-slate-600">
                  {item.comment ?? "—"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
