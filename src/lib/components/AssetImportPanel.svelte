<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { fetchAssetImportInfo, submitAssetImport } from "../client/api.js";
  import { icons } from "./icons.js";

  const dispatch = createEventDispatcher();

  const SHEET_LABELS = {
    depreciation_methods: "Métodos de depreciación",
    asset_categories: "Categorías de activo",
    asset_statuses: "Estados de activo",
    document_types: "Tipos de documento",
    departments: "Departamentos",
    cost_centers: "Centros de costo",
    locations: "Ubicaciones",
    responsibles: "Responsables",
    providers: "Proveedores",
    assets: "Activos",
  };

  const STATUS_LABELS = {
    pending: "Pendiente",
    validated: "Validado",
    validated_with_skips: "Validado con omisiones",
    invalid: "Inválido",
    skipped: "Omitido",
    empty: "Vacío",
    committed: "Importado",
    committed_with_skips: "Importado con omisiones",
  };

  const MODE_LABELS = {
    preview: "Vista previa",
    commit: "Confirmación",
  };

  const STATUS_COLORS = {
    validated: "bg-emerald-100 text-emerald-700",
    validated_with_skips: "bg-amber-100 text-amber-700",
    invalid: "bg-rose-100 text-rose-700",
    skipped: "bg-slate-100 text-slate-600",
    empty: "bg-slate-100 text-slate-600",
    committed: "bg-indigo-100 text-indigo-700",
    committed_with_skips: "bg-amber-100 text-amber-700",
    pending: "bg-slate-100 text-slate-600",
  };

  let infoLoading = true;
  let infoError = "";
  let templateVersion = "";
  let templatePath = "";
  let maxFileSizeBytes = null;
  let maxAssetRows = null;

  let selectedFile = null;
  let preview = true;
  let processing = false;
  let clearTables = false;
  let result = null;
  let postImportReady = false;
  let error = "";
  let errorDetails = null;
  let successMessage = "";
  let dragActive = false;

  onMount(async () => {
    await loadInfo();
  });

  async function loadInfo() {
    infoLoading = true;
    infoError = "";
    try {
      const info = await fetchAssetImportInfo();
      if (info) {
        templateVersion = info.templateVersion || "";
        templatePath = info.templatePath || "";
        maxFileSizeBytes = info.maxFileSizeBytes;
        maxAssetRows = info.maxAssetRows;
      } else {
        infoError = "No se pudo obtener la información de la plantilla.";
      }
    } catch (err) {
      infoError = err?.message || "No se pudo obtener la información de la plantilla.";
    } finally {
      infoLoading = false;
    }
  }

  function setFile(file) {
    if (!file) {
      selectedFile = null;
      result = null;
      successMessage = "";
      postImportReady = false;
      return;
    }
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".xlsx")) {
      error = "El archivo debe tener extensión .xlsx";
      selectedFile = null;
      result = null;
      successMessage = "";
      postImportReady = false;
      return;
    }
    error = "";
    errorDetails = null;
    selectedFile = file;
    result = null;
    successMessage = "";
    postImportReady = false;
  }

  function handleInputChange(event) {
    const files = event?.currentTarget?.files;
    if (files && files.length) {
      setFile(files[0]);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    dragActive = true;
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragActive = false;
  }

  function handleDrop(event) {
    event.preventDefault();
    dragActive = false;
    const files = event?.dataTransfer?.files;
    if (files && files.length) {
      setFile(files[0]);
    }
  }

  function clearSelection() {
    selectedFile = null;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatNumber(value) {
    if (value === null || value === undefined) return "0";
    return new Intl.NumberFormat("es-ES").format(value);
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms)) return "";
    if (ms < 1000) return `${ms} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = (seconds % 60).toFixed(0).padStart(2, "0");
    return `${minutes} min ${remaining} s`;
  }

  $: sheetEntries = result ? Object.values(result.sheets || {}) : [];
  $: clearedTables = result?.clearedTables || [];

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function statusClass(status) {
    return STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  }

  function sheetLabel(key) {
    return SHEET_LABELS[key] || key;
  }

  async function executeImport() {
    if (!selectedFile) {
      error = "Selecciona un archivo antes de continuar.";
      return;
    }
    processing = true;
    error = "";
    errorDetails = null;
    successMessage = "";
    result = null;
    postImportReady = false;
    try {
      const response = await submitAssetImport({
        file: selectedFile,
        preview,
        clearTables,
      });
      if (!response?.resumen) {
        throw new Error("Respuesta inválida del servidor.");
      }
      result = response.resumen;
      if (response.plantilla) {
        templateVersion = response.plantilla;
      }
      if (preview) {
        successMessage = "Vista previa completada. Revisa los resultados antes de confirmar.";
        postImportReady = false;
      } else {
        successMessage = clearTables
          ? "Importación confirmada. Las tablas seleccionadas se limpiaron antes de importar."
          : "Importación confirmada.";
        postImportReady = true;
        dispatch("change", {
          entity: "asset_import",
          refreshAssets: true,
          refreshLookups: true,
          stayOnPanel: true,
        });
      }
    } catch (err) {
      error = err?.message || "No fue posible procesar la importación.";
      errorDetails = err?.details || null;
      postImportReady = false;
    } finally {
      processing = false;
    }
  }

  function goToAssets() {
    dispatch("change", { entity: "asset_import", refreshAssets: true });
  }
</script>

<div class="rounded-lg border border-slate-200 bg-white shadow-sm">
  <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-4">
    <div>
      <h2 class="text-lg font-semibold text-sky-900">Importar activos desde Excel</h2>
      <p class="text-sm text-slate-600">
        Valida o registra lotes completos usando la plantilla oficial.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a
        class="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
        href={templatePath || "/templates/asset-import-v1.0.xlsx"}
        download
      >
        <span class="inline-block" aria-hidden="true">{@html icons.download}</span>
        <span>Descargar plantilla{templateVersion ? ` v${templateVersion}` : ""}</span>
      </a>
    </div>
  </div>

  <div class="space-y-4 p-4">
    {#if infoLoading}
      <div class="text-sm text-slate-600">Cargando información de la plantilla…</div>
    {:else if infoError}
      <div class="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        {infoError}
      </div>
    {/if}

    <div
      class={`rounded-md border-2 border-dashed ${dragActive ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50"} p-6 text-center transition`}
      role="group"
      on:dragover|preventDefault={handleDragOver}
      on:dragleave|preventDefault={handleDragLeave}
      on:drop={handleDrop}
    >
      <p class="text-sm text-slate-700">
        Arrastra tu archivo .xlsx aquí o
        <label class="cursor-pointer font-semibold text-indigo-600">
          <input class="hidden" type="file" accept=".xlsx" on:change={handleInputChange} />
          haz clic para seleccionarlo
        </label>
      </p>
      {#if maxFileSizeBytes}
        <p class="mt-1 text-xs text-slate-500">
          Tamaño máximo: {formatBytes(maxFileSizeBytes)}
        </p>
      {/if}
      {#if maxAssetRows}
        <p class="mt-1 text-xs text-slate-500">
          Hasta {formatNumber(maxAssetRows)} activos por lote.
        </p>
      {/if}
    </div>

    {#if selectedFile}
      <div class="flex flex-wrap items-center justify-between gap-3 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
        <div class="font-medium">{selectedFile.name}</div>
        <div class="flex items-center gap-3 text-xs text-indigo-700">
          {#if Number.isFinite(selectedFile.size)}
            <span>{formatBytes(selectedFile.size)}</span>
          {/if}
          <button
            type="button"
            class="rounded border border-indigo-300 px-2 py-1 hover:bg-indigo-100"
            on:click={clearSelection}
          >
            Quitar
          </button>
        </div>
      </div>
    {/if}

    <div class="flex flex-wrap items-center gap-4">
      <label class="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          bind:checked={preview}
          class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Vista previa (no guarda cambios)
      </label>
      <label class="inline-flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          bind:checked={clearTables}
          class="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:opacity-60"
          disabled={processing}
        />
        <span class="flex flex-col leading-tight">
          <span>Limpiar tablas</span>

        </span>
      </label>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        on:click={executeImport}
        disabled={processing}
      >
        <span class="inline-block" aria-hidden="true">{@html icons.upload}</span>
        <span>{processing ? "Procesando…" : preview ? "Validar archivo" : "Confirmar importación"}</span>
      </button>
    </div>

    {#if error}
      <div class="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <p>{error}</p>
        {#if errorDetails}
          <pre class="mt-2 max-h-48 overflow-auto rounded bg-white/60 p-2 text-xs text-rose-800">{JSON.stringify(errorDetails, null, 2)}</pre>
        {/if}
      </div>
    {/if}

    {#if successMessage}
      <div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
        {successMessage}
      </div>
    {/if}

    {#if postImportReady}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-100"
          on:click={goToAssets}
        >
          <span class="inline-block" aria-hidden="true">{@html icons.table}</span>
          <span>Ver activos actualizados</span>
        </button>
      </div>
    {/if}

    {#if result}
      <div class="space-y-4">
        <div class="rounded border border-slate-200 bg-slate-50 p-4">
          <h3 class="text-base font-semibold text-slate-800">Resumen general</h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Archivo</div>
              <div class="text-sm font-medium text-slate-800">{result.fileName}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Modo</div>
              <div class="text-sm font-medium text-slate-800">{MODE_LABELS[result.mode] || result.mode}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Duración</div>
              <div class="text-sm font-medium text-slate-800">{formatDuration(result.durationMs)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Procesadas</div>
              <div class="text-lg font-semibold text-slate-900">{formatNumber(result.totals?.processed)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Insertadas</div>
              <div class="text-lg font-semibold text-emerald-700">{formatNumber(result.totals?.inserted)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Actualizadas</div>
              <div class="text-lg font-semibold text-indigo-700">{formatNumber(result.totals?.updated)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Duplicados</div>
              <div class="text-lg font-semibold text-amber-700">{formatNumber(result.totals?.duplicates)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Omitidos</div>
              <div class="text-lg font-semibold text-slate-800">{formatNumber(result.totals?.skipped)}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-500">Errores</div>
              <div class="text-lg font-semibold text-rose-700">{formatNumber(result.totals?.failed)}</div>
            </div>
          </div>
          {#if Array.isArray(result.clearedTables) && result.clearedTables.length}
            <div class="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p class="font-semibold">
                {result.preview
                  ? "Tablas que se limpiarían antes de importar:"
                  : "Tablas limpiadas antes de importar:"}
              </p>
              <ul class="mt-2 list-disc space-y-1 pl-5">
                {#each result.clearedTables as clearedSheet}
                  <li>{sheetLabel(clearedSheet)}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if result.preview && result.clearTables && Array.isArray(result.clearedTables) && result.clearedTables.length}
            <div class="mt-4 rounded border border-slate-200 bg-slate-100 p-3 text-xs text-slate-600">
              La vista previa ignora duplicados existentes en la base de datos porque se solicitó limpiar las tablas antes de importar.
            </div>
          {/if}
          {#if Array.isArray(result.warnings) && result.warnings.length}
            <div class="mt-4 space-y-1">
              <div class="text-xs uppercase tracking-wide text-amber-600">Avisos generales</div>
              <ul class="list-disc space-y-1 pl-5 text-sm text-amber-700">
                {#each result.warnings as warning}
                  <li>{warning.sheet ? `${warning.sheet}: ${warning.message}` : warning.message}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        {#each sheetEntries as sheet (sheet.sheet)}
          <div class="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-base font-semibold text-slate-900">
                    {sheetLabel(sheet.sheet)}
                  </h4>
                  {#if sheet.cleared}
                    <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {result.preview ? "Se limpiará" : "Tabla limpiada"}
                    </span>
                  {/if}
                </div>
                <p class="text-xs text-slate-500">{sheet.rows?.length || 0} filas analizadas</p>
              </div>
              <span class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass(sheet.status)}`}>
                {statusLabel(sheet.status)}
              </span>
            </div>

            <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Procesadas</dt>
                <dd class="font-semibold text-slate-800">{formatNumber(sheet.processed)}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Insertadas</dt>
                <dd class="font-semibold text-emerald-700">{formatNumber(sheet.inserted)}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Actualizadas</dt>
                <dd class="font-semibold text-indigo-700">{formatNumber(sheet.updated)}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Omitidas</dt>
                <dd class="font-semibold text-slate-700">{formatNumber(sheet.skipped)}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Duplicados</dt>
                <dd class="font-semibold text-amber-700">{formatNumber(sheet.duplicates?.length)}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-slate-500">Errores</dt>
                <dd class="font-semibold text-rose-700">{formatNumber(sheet.failed)}</dd>
              </div>
            </dl>

            {#if Array.isArray(sheet.warnings) && sheet.warnings.length}
              <details class="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <summary class="cursor-pointer font-semibold">Avisos ({sheet.warnings.length})</summary>
                <ul class="mt-2 list-disc space-y-1 pl-4">
                  {#each sheet.warnings as warning}
                    <li>{warning}</li>
                  {/each}
                </ul>
              </details>
            {/if}

            {#if Array.isArray(sheet.duplicates) && sheet.duplicates.length}
              <details class="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <summary class="cursor-pointer font-semibold">Duplicados ({sheet.duplicates.length})</summary>
                <ul class="mt-2 space-y-1">
                  {#each sheet.duplicates as dup}
                    <li>
                      Fila {dup.row}: `{dup.key}` ({dup.source === "database" ? "ya existe" : "duplicado en hoja"})
                    </li>
                  {/each}
                </ul>
              </details>
            {/if}

            {#if Array.isArray(sheet.errors) && sheet.errors.length}
              <details class="mt-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <summary class="cursor-pointer font-semibold">Errores ({sheet.errors.length})</summary>
                <ul class="mt-2 space-y-2">
                  {#each sheet.errors as err}
                    <li>
                      <div class="font-semibold">Fila {err.row}</div>
                      <ul class="list-disc pl-4">
                        {#each err.messages as msg}
                          <li>{msg}</li>
                        {/each}
                      </ul>
                    </li>
                  {/each}
                </ul>
              </details>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
