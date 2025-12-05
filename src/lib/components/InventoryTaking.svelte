<script>
  import { onMount } from "svelte";
  import {
    lookupInventoryAsset,
    submitInventoryCheck,
    listInventoryCampaigns,
  } from "../client/api.js";
  import { icons } from "./icons.js";

  let code = "";
  let lastScannedCode = "";
  let codeInput;

  let asset = null;
  let conditions = [];
  let locations = [];
  let responsibles = [];
  let recentChecks = [];
  let campaigns = [];

  let loadingAsset = false;
  let submitting = false;
  let campaignsLoading = false;

  let lookupError = "";
  let submitError = "";
  let successMessage = "";
  let campaignError = "";

  let selectedConditionId = "";
  let comment = "";

  let editingLocation = false;
  let selectedLocationId = "";

  let editingResponsible = false;
  let selectedResponsibleId = "";
  let selectedCampaignId = "";
  let campaignsInitialized = false;

  onMount(() => {
    focusInput();
    void loadCampaigns({ silent: false });
  });

  function focusInput() {
    if (codeInput) {
      codeInput.focus();
      codeInput.select?.();
    }
  }

  async function loadCampaigns({ silent = false } = {}) {
    campaignsLoading = true;
    if (!silent) {
      campaignError = "";
    }

    try {
      const result = await listInventoryCampaigns({ activeOnly: true });
      const items = Array.isArray(result) ? result : [];
      campaigns = items;
      campaignError = "";

      const previous = selectedCampaignId;
      const hasPrevious = previous && items.some((campaign) => campaign.id === previous);
      if (!hasPrevious) {
        if (!campaignsInitialized && items.length === 1) {
          selectedCampaignId = items[0].id;
        } else if (previous) {
          selectedCampaignId = "";
        }
      }
      if (!campaignsInitialized) {
        campaignsInitialized = true;
      }
    } catch (err) {
      if (!silent) {
        campaignError = err?.message || "No fue posible cargar las campañas activas";
      }
    } finally {
      campaignsLoading = false;
    }
  }

  function refreshCampaigns() {
    loadCampaigns({ silent: false });
  }

  function campaignStatusSuffix(campaign) {
    if (!campaign) return "";
    if (campaign.isActive) return " (Activa)";
    if (campaign.isScheduled) return " (Programada)";
    const status = typeof campaign.status === "string" ? campaign.status.trim() : "";
    if (!status) return "";
    const formatted = status.charAt(0).toUpperCase() + status.slice(1);
    return ` (${formatted})`;
  }

  function clearState() {
    asset = null;
    conditions = [];
    locations = [];
    responsibles = [];
    recentChecks = [];
    selectedConditionId = "";
    comment = "";
    editingLocation = false;
    selectedLocationId = "";
    editingResponsible = false;
    selectedResponsibleId = "";
  }

  async function loadAssetByCode(inputCode, { silent = false } = {}) {
    const trimmed = (inputCode ?? "").toString().trim();
    if (!silent) {
      loadingAsset = true;
      lookupError = "";
      submitError = "";
      successMessage = "";
    } else {
      submitError = "";
    }

    if (!trimmed) {
      if (!silent) {
        lookupError = "Escanea o ingresa un código";
        clearState();
      }
      loadingAsset = false;
      return;
    }

    try {
      const data = await lookupInventoryAsset(trimmed, {
        includeHistory: true,
      });
      asset = data.asset || null;
      conditions = Array.isArray(data.conditions) ? data.conditions : [];
      locations = Array.isArray(data.locations) ? data.locations : [];
      responsibles = Array.isArray(data.responsibles)
        ? data.responsibles
        : [];
      recentChecks = Array.isArray(data.recentChecks)
        ? data.recentChecks
        : [];
      lastScannedCode = trimmed;
      code = trimmed;
      selectedConditionId = "";
      comment = "";
      editingLocation = false;
      selectedLocationId = asset?.location_id || "";
      editingResponsible = false;
      selectedResponsibleId = asset?.responsible_id || "";
      lookupError = "";
    } catch (err) {
      clearState();
      lastScannedCode = trimmed;
      lookupError = err?.message || "No fue posible localizar el activo";
    } finally {
      loadingAsset = false;
      focusInput();
    }
  }

  async function handleLookup(event) {
    event?.preventDefault?.();
    await loadAssetByCode(code, { silent: false });
  }

  function resetAll() {
    code = "";
    lastScannedCode = "";
    lookupError = "";
    submitError = "";
    successMessage = "";
    clearState();
    focusInput();
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!asset) return;

    submitError = "";
    successMessage = "";

    if (!selectedConditionId) {
      submitError = "Selecciona la condición del activo";
      return;
    }

    const payload = {
      assetId: asset.id,
      scannedCode: lastScannedCode || code.trim() || null,
      conditionId: Number.parseInt(selectedConditionId, 10),
    };

    if (Number.isNaN(payload.conditionId)) {
      submitError = "La condición seleccionada es inválida";
      return;
    }

    const trimmedComment = comment.trim();
    if (trimmedComment) {
      payload.comment = trimmedComment;
    }

    if (editingLocation) {
      payload.locationId = selectedLocationId || null;
    }

    if (editingResponsible) {
      payload.newResponsibleId = selectedResponsibleId || null;
    }

    if (selectedCampaignId) {
      payload.campaignId = selectedCampaignId;
    }

    submitting = true;
    try {
      await submitInventoryCheck(payload);
      const activeCampaign = selectedCampaignId
        ? campaigns.find((item) => item.id === selectedCampaignId)
        : null;
      successMessage = activeCampaign
        ? `Control de inventario registrado para la campaña ${activeCampaign.name}`
        : "Control de inventario registrado";
      await loadAssetByCode(lastScannedCode, { silent: true });
      comment = "";
      selectedConditionId = "";
      editingLocation = false;
      selectedLocationId = asset?.location_id || "";
      editingResponsible = false;
      selectedResponsibleId = asset?.responsible_id || "";
    } catch (err) {
      submitError = err?.message || "No fue posible registrar el control";
    } finally {
      submitting = false;
      focusInput();
    }
  }

  $: if (!editingLocation) {
    selectedLocationId = asset?.location_id || "";
  }

  $: if (!editingResponsible) {
    selectedResponsibleId = asset?.responsible_id || "";
  }

  function formatDateTime(value) {
    if (!value) return "";
    try {
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat("es-NI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch (err) {
      return value;
    }
  }

  const buttonClass =
    "inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60";
  const secondaryButtonClass =
    "inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60";
  const tertiaryButtonClass =
    "text-xs font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline disabled:opacity-60";
</script>

<div class="space-y-6">
  <section class="rounded-lg border border-sky-200 bg-white p-4 shadow-sm">
    <form class="space-y-4" on:submit|preventDefault={handleLookup}>
      <div class="space-y-1">
        <label for="inventory-code" class="text-sm font-medium text-sky-900"
          >Código del activo</label
        >
        <input
          id="inventory-code"
          bind:this={codeInput}
          bind:value={code}
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          class="w-full rounded-md border border-sky-300 px-3 py-2 text-base tracking-wide text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Escanea o escribe el código"
          disabled={loadingAsset || submitting}
        />
      </div>
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <label for="inventory-campaign" class="text-sm font-medium text-sky-900"
            >Campaña</label
          >
          <button
            type="button"
            class={tertiaryButtonClass}
            on:click={refreshCampaigns}
            disabled={campaignsLoading || submitting || loadingAsset}
          >
            Actualizar
          </button>
        </div>
        {#if campaignsLoading}
          <div class="text-sm text-sky-600">Cargando campañas…</div>
        {:else if !campaigns.length}
          <div class="rounded-md border border-dashed border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            No hay campañas activas en este momento. Puedes registrar controles sin campaña.
          </div>
        {:else}
          <select
            id="inventory-campaign"
            bind:value={selectedCampaignId}
            class="w-full rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={campaignsLoading || submitting || loadingAsset}
          >
            <option value="">Sin campaña</option>
            {#each campaigns as campaign}
              <option value={campaign.id}>
                {campaign.name}{campaignStatusSuffix(campaign)}
              </option>
            {/each}
          </select>
        {/if}
        {#if campaignError}
          <p class="text-sm text-rose-600">{campaignError}</p>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          class={buttonClass}
          disabled={loadingAsset || submitting}
        >
          {@html icons.check}
          <span class="ml-2">Buscar activo</span>
        </button>
        <button
          type="button"
          class={secondaryButtonClass}
          on:click={resetAll}
          disabled={loadingAsset || submitting}
        >
          Limpiar
        </button>
        {#if loadingAsset}
          <span class="text-sm text-sky-600">Buscando activo…</span>
        {/if}
      </div>
    </form>
    {#if lookupError}
      <div class="mt-4 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700">
        {lookupError}
      </div>
    {/if}
  </section>

  {#if asset}
    <section class="rounded-lg border border-sky-200 bg-white p-4 shadow-sm space-y-4">
      <header>
        <h2 class="text-lg font-semibold text-sky-900">Activo identificado</h2>
        <p class="text-sm text-sky-700">
          Verifica que los datos coinciden con el activo frente a ti.
        </p>
      </header>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
            Código / Tag
          </dt>
          <dd class="mt-0.5 text-sky-900">{asset.asset_tag}</dd>
        </div>
        {#if asset.alternative_number}
          <div>
            <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
              Número alterno
            </dt>
            <dd class="mt-0.5 text-sky-900">{asset.alternative_number}</dd>
          </div>
        {/if}
        <div>
          <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
            Nombre
          </dt>
          <dd class="mt-0.5 text-sky-900">{asset.name}</dd>
        </div>
        {#if asset.asset_category_name}
          <div>
            <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
              Categoría
            </dt>
            <dd class="mt-0.5 text-sky-900">{asset.asset_category_name}</dd>
          </div>
        {/if}
        {#if asset.asset_status_name}
          <div>
            <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
              Estado
            </dt>
            <dd class="mt-0.5 text-sky-900">{asset.asset_status_name}</dd>
          </div>
        {/if}
        {#if asset.description}
          <div class="sm:col-span-2">
            <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
              Descripción
            </dt>
            <dd class="mt-0.5 whitespace-pre-wrap text-sky-900">
              {asset.description}
            </dd>
          </div>
        {/if}
        <div>
          <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
            Ubicación actual
          </dt>
          <dd class="mt-0.5 text-sky-900">
            {asset.location_name || "Sin registro"}
          </dd>
        </div>
        <div>
          <dt class="font-semibold text-sky-800 uppercase tracking-wide text-xs">
            Responsable actual
          </dt>
          <dd class="mt-0.5 text-sky-900">
            {asset.responsible_name || "Sin asignar"}
          </dd>
        </div>
      </dl>

      {#if recentChecks.length}
        {@const lastCheck = recentChecks[0]}
        {#if lastCheck}
          <div class="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-semibold text-sky-900">Último control</span>
              <span class="text-xs uppercase tracking-wide text-sky-700">
                {formatDateTime(lastCheck.checked_at)}
              </span>
            </div>
            <div class="mt-2 space-y-1">
              {#if lastCheck.condition}
                <p>
                  <strong>Condición:&nbsp;</strong>{lastCheck.condition.label}
                </p>
              {/if}
              {#if lastCheck.checked_by_name}
                <p>
                  <strong>Registrado por:&nbsp;</strong>{lastCheck.checked_by_name}
                </p>
              {/if}
              {#if lastCheck.campaign}
                <p>
                  <strong>Campaña:&nbsp;</strong>{lastCheck.campaign.name}
                </p>
              {/if}
              {#if lastCheck.comment}
                <p>
                  <strong>Comentario:&nbsp;</strong>{lastCheck.comment}
                </p>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
    </section>
  {/if}

  {#if asset}
    <section class="rounded-lg border border-sky-200 bg-white p-4 shadow-sm space-y-4">
      <header>
        <h2 class="text-lg font-semibold text-sky-900">
          Registrar toma de inventario
        </h2>
        <p class="text-sm text-sky-700">
          Selecciona la condición encontrada y agrega comentarios si es necesario.
        </p>
      </header>

      {#if successMessage}
        <div class="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      {/if}

      {#if submitError}
        <div class="rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700">
          {submitError}
        </div>
      {/if}

      <form class="space-y-5" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <label for="inventory-condition" class="text-sm font-medium text-sky-900"
            >Condición encontrada</label
          >
          <select
            id="inventory-condition"
            bind:value={selectedConditionId}
            class="w-full rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={submitting}
            required
          >
            <option value="" disabled>Selecciona una condición</option>
            {#each conditions as condition}
              <option value={condition.id}>{condition.label}</option>
            {/each}
          </select>
        </div>

        <div class="space-y-1">
          <label for="inventory-comment" class="text-sm font-medium text-sky-900"
            >Comentario (opcional)</label
          >
          <textarea
            id="inventory-comment"
            bind:value={comment}
            rows="3"
            class="w-full rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Notas sobre el hallazgo, incidente o evidencia"
            disabled={submitting}
          ></textarea>
        </div>

        <div class="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-sky-900">
                Ubicación asignada
              </p>
              <p class="text-xs text-sky-700">
                {asset.location_name || "Sin registro"}
              </p>
            </div>
            <label class="flex items-center gap-2 text-sm text-sky-900">
              <input
                type="checkbox"
                bind:checked={editingLocation}
                class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                disabled={submitting}
              />
              <span>Actualizar</span>
            </label>
          </div>
          <select
            bind:value={selectedLocationId}
            class="w-full rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={!editingLocation || submitting}
          >
            <option value="">Sin ubicación</option>
            {#each locations as location}
              <option value={location.id}>{location.name}</option>
            {/each}
          </select>
        </div>

        <div class="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-sky-900">
                Responsable asignado
              </p>
              <p class="text-xs text-sky-700">
                {asset.responsible_name || "Sin asignar"}
              </p>
            </div>
            <label class="flex items-center gap-2 text-sm text-sky-900">
              <input
                type="checkbox"
                bind:checked={editingResponsible}
                class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                disabled={submitting}
              />
              <span>Actualizar</span>
            </label>
          </div>
          <select
            bind:value={selectedResponsibleId}
            class="w-full rounded-md border border-sky-300 px-3 py-2 text-sm text-sky-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            disabled={!editingResponsible || submitting}
          >
            <option value="">Sin responsable</option>
            {#each responsibles as person}
              <option value={person.id}>{person.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="submit"
            class={buttonClass}
            disabled={submitting}
          >
            Registrar control
          </button>
        </div>
      </form>
    </section>
  {/if}
</div>
