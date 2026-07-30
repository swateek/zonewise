import "./style.css";
import {
  DEFAULT_TARGET_IDS,
  browserSourceId,
  cityLabel,
  cityMeta,
  getCityById,
  searchCities,
  type City,
} from "./data/cities";
import { initAnalytics, trackEvent } from "./lib/analytics";
import {
  addMinutes,
  convertForCity,
  formatTimeInput,
  parseFlexibleTime,
  parseTimeInput,
  type MinutesOfDay,
} from "./lib/convert";
import { format12h, formatRange } from "./lib/format";
import {
  createSet,
  getSet,
  loadStore,
  sameCities,
  saveStore,
  type CitySet,
  type SetsStore,
} from "./lib/sets";

type Mode = "point" | "range";

type State = {
  mode: Mode;
  start: string;
  end: string;
  startDraft: string;
  endDraft: string;
  startInvalid: boolean;
  endInvalid: boolean;
  sourceId: string;
  targetIds: string[];
  sourceQuery: string;
  targetQuery: string;
  sourceOpen: boolean;
  targetOpen: boolean;
  activeDuration: number | null;
  sets: CitySet[];
  activeSetId: string | null;
  namingOpen: boolean;
  nameDraft: string;
  deleteConfirmOpen: boolean;
};

const TIME_PLACEHOLDER = "10:30 am or 22:30";
const TIME_HINT = "Use a time like 10:30 am or 22:30";

function prefers24h(draft: string): boolean {
  return !/[ap]\.?m\.?/i.test(draft.trim());
}

function formatWall(minutes: MinutesOfDay, as24h = false): string {
  return as24h ? formatTimeInput(minutes) : format12h(minutes);
}

function displayTime(hhmm: string, as24h = false): string {
  const minutes = parseTimeInput(hhmm);
  return minutes === null ? "" : formatWall(minutes, as24h);
}

function minutesFromBrowserNow(): MinutesOfDay {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function defaultTargetIds(sourceId: string): string[] {
  return DEFAULT_TARGET_IDS.filter((id) => id !== sourceId);
}

function initialSourceId(): string {
  return browserSourceId();
}

const initialSource = initialSourceId();
const initialStart = minutesFromBrowserNow();
const initialEnd = addMinutes(initialStart, 60);

const state: State = {
  mode: "point",
  start: formatTimeInput(initialStart),
  end: formatTimeInput(initialEnd),
  startDraft: formatWall(initialStart),
  endDraft: formatWall(initialEnd),
  startInvalid: false,
  endInvalid: false,
  sourceId: initialSource,
  targetIds: defaultTargetIds(initialSource),
  sourceQuery: "",
  targetQuery: "",
  sourceOpen: false,
  targetOpen: false,
  activeDuration: 60,
  sets: [],
  activeSetId: null,
  namingOpen: false,
  nameDraft: "",
  deleteConfirmOpen: false,
};

const appEl = document.querySelector<HTMLDivElement>("#app");
if (!appEl) throw new Error("#app missing");
const app: HTMLDivElement = appEl;

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function persistSets(lastUsedSetId: string | null = state.activeSetId): void {
  const store: SetsStore = {
    version: 1,
    sets: state.sets,
    lastUsedSetId,
  };
  saveStore(store);
}

function isDirty(): boolean {
  if (!state.activeSetId) return false;
  const active = state.sets.find((s) => s.id === state.activeSetId);
  if (!active) return false;
  return !sameCities(
    { sourceId: state.sourceId, targetIds: state.targetIds },
    active,
  );
}

/** Sets need at least one destination city. */
function canSaveSet(): boolean {
  return state.targetIds.length > 0;
}

function applySetCities(set: CitySet): void {
  state.sourceId = set.sourceId;
  state.targetIds = [...set.targetIds];
  state.activeSetId = set.id;
  state.namingOpen = false;
  state.nameDraft = "";
  state.deleteConfirmOpen = false;
  state.sourceQuery = "";
  state.sourceOpen = false;
  state.targetOpen = false;
  state.targetQuery = "";
}

function applyDefaults(): void {
  const sourceId = browserSourceId();
  state.sourceId = sourceId;
  state.targetIds = defaultTargetIds(sourceId);
  state.activeSetId = null;
  state.namingOpen = false;
  state.nameDraft = "";
  state.deleteConfirmOpen = false;
}

function applyNow(): void {
  const minutes = minutesFromBrowserNow();
  state.start = formatTimeInput(minutes);
  state.startDraft = formatWall(minutes);
  state.startInvalid = false;
  if (state.mode === "range") {
    const duration = state.activeDuration ?? 60;
    syncEndFromDuration(duration);
  } else {
    state.end = formatTimeInput(addMinutes(minutes, 60));
    state.endDraft = formatWall(addMinutes(minutes, 60));
    state.endInvalid = false;
    state.activeDuration = 60;
  }
  syncTimeInput("start");
  syncTimeInput("end");
  updateDurationChips();
  updateResults();
  trackEvent("time_now", { mode: state.mode });
}

function syncSourceInput(): void {
  const sourceCity = getCityById(state.sourceId);
  const input = app.querySelector<HTMLInputElement>("#source-city");
  if (input && sourceCity) input.value = cityLabel(sourceCity);
}

function afterCityChange(): void {
  if (!canSaveSet() && state.namingOpen) {
    state.namingOpen = false;
    state.nameDraft = "";
  }
  updateSetsBar();
  updateTargetPanel();
  updateResults();
}

function syncEndFromDuration(minutes: number): void {
  const start = parseTimeInput(state.start);
  if (start === null) return;
  state.end = formatTimeInput(addMinutes(start, minutes));
  state.endDraft = displayTime(state.end);
  state.endInvalid = false;
  state.activeDuration = minutes;
}

function timeFieldHtml(id: "start" | "end"): string {
  const draft = id === "start" ? state.startDraft : state.endDraft;
  const invalid = id === "start" ? state.startInvalid : state.endInvalid;
  const label = id === "start" ? "Start time" : "End time";
  return `
    <div class="time-field">
      <label class="visually-hidden" for="${id}-time">${label}</label>
      <input
        type="text"
        id="${id}-time"
        class="time-input${invalid ? " invalid" : ""}"
        inputmode="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="${TIME_PLACEHOLDER}"
        value="${escapeHtml(draft)}"
        aria-invalid="${invalid}"
        aria-describedby="${id}-time-hint"
      />
      <p class="time-hint${invalid ? " error" : ""}" id="${id}-time-hint" ${invalid ? "" : "hidden"}>
        ${TIME_HINT}
      </p>
    </div>`;
}

function syncTimeInput(id: "start" | "end"): void {
  const input = app.querySelector<HTMLInputElement>(`#${id}-time`);
  if (!input) return;
  const draft = id === "start" ? state.startDraft : state.endDraft;
  const invalid = id === "start" ? state.startInvalid : state.endInvalid;
  if (document.activeElement !== input) {
    input.value = draft;
  }
  input.classList.toggle("invalid", invalid);
  input.setAttribute("aria-invalid", String(invalid));
  const hint = app.querySelector(`#${id}-time-hint`);
  if (hint) {
    hint.classList.toggle("error", invalid);
    hint.toggleAttribute("hidden", !invalid);
  }
}

function applyTimeDraft(
  id: "start" | "end",
  draft: string,
  normalize: boolean,
): void {
  if (id === "start") state.startDraft = draft;
  else state.endDraft = draft;

  const parsed = parseFlexibleTime(draft);
  if (parsed === null) {
    if (id === "start") state.startInvalid = true;
    else state.endInvalid = true;
    syncTimeInput(id);
    updateResults();
    return;
  }

  const hhmm = formatTimeInput(parsed);
  const as24h = prefers24h(draft);
  if (id === "start") {
    state.start = hhmm;
    state.startInvalid = false;
    if (normalize) state.startDraft = formatWall(parsed, as24h);
    if (state.mode === "range" && state.activeDuration != null) {
      syncEndFromDuration(state.activeDuration);
    } else {
      state.activeDuration = detectActiveDuration();
    }
  } else {
    state.end = hhmm;
    state.endInvalid = false;
    if (normalize) state.endDraft = formatWall(parsed, as24h);
    state.activeDuration = detectActiveDuration();
  }

  syncTimeInput("start");
  syncTimeInput("end");
  updateDurationChips();
  updateResults();
  if (normalize) {
    trackEvent("time_edit", { field: id, mode: state.mode });
  }
}

function detectActiveDuration(): number | null {
  const start = parseTimeInput(state.start);
  const end = parseTimeInput(state.end);
  if (start === null || end === null) return null;
  const delta = (((end - start) % 1440) + 1440) % 1440;
  if (delta === 30 || delta === 60 || delta === 120) return delta;
  return null;
}

function resultsHtml(): string {
  const startMinutes = parseTimeInput(state.start);
  if (startMinutes === null) {
    return `<p class="error" role="alert">Enter a valid start time.</p>`;
  }

  let endMinutes: MinutesOfDay | undefined;
  if (state.mode === "range") {
    endMinutes = parseTimeInput(state.end) ?? undefined;
    if (endMinutes === undefined) {
      return `<p class="error" role="alert">Enter a valid end time.</p>`;
    }
    if (endMinutes === startMinutes) {
      return `<p class="error" role="alert">End time must differ from start.</p>`;
    }
  }

  const source = getCityById(state.sourceId);
  if (!source) {
    return `<p class="error" role="alert">Pick a source city.</p>`;
  }

  if (state.targetIds.length === 0) {
    return `<p class="hint">Add a city to convert.</p>`;
  }

  const blocks = state.targetIds
    .map((id) => getCityById(id))
    .filter((c): c is City => Boolean(c))
    .map((city) => {
      const result = convertForCity(
        {
          mode: state.mode,
          startMinutes,
          endMinutes,
          sourceIana: source.iana,
          targetIana: city.iana,
          targetName: city.name,
          targetId: city.id,
        },
        format12h,
      );

      const lines = result.lines
        .map((line) => {
          const time = formatRange(line.startText, line.endText);
          const kind = line.label
            ? `<span class="kind">${escapeHtml(line.label)}</span>`
            : `<span class="kind"></span>`;
          return `<li class="result-line"><span>${escapeHtml(time)}</span>${kind}</li>`;
        })
        .join("");

      return `
        <article class="result" data-city="${escapeHtml(city.id)}">
          <h2 class="result-city">${escapeHtml(city.name)}</h2>
          <ul class="result-lines">${lines}</ul>
        </article>`;
    })
    .join("");

  return `<div class="results" aria-live="polite">${blocks}</div>`;
}

function comboOptionsHtml(cities: City[], emptyLabel: string): string {
  if (cities.length === 0) {
    return `<li><button type="button" class="combo-option" disabled>${escapeHtml(emptyLabel)}</button></li>`;
  }
  return cities
    .slice(0, 20)
    .map(
      (c) => `
      <li role="presentation">
        <button type="button" class="combo-option" role="option" data-city-id="${escapeHtml(c.id)}">
          ${escapeHtml(c.name)}
          <span class="meta">${escapeHtml(cityMeta(c))}</span>
        </button>
      </li>`,
    )
    .join("");
}

function setsBarHtml(): string {
  const dirty = isDirty();
  const chips =
    state.sets.length === 0
      ? `<span class="sets-empty">No saved sets</span>`
      : state.sets
          .map((set) => {
            const pressed = set.id === state.activeSetId;
            return `<button type="button" class="chip set-chip" data-select-set="${escapeHtml(set.id)}" aria-pressed="${pressed}">${escapeHtml(set.name)}</button>`;
          })
          .join("");

  const naming = state.namingOpen
    ? `
      <div class="sets-naming">
        <label class="visually-hidden" for="set-name">Set name</label>
        <input
          type="text"
          id="set-name"
          class="set-name-input"
          maxlength="40"
          placeholder="Name this set"
          value="${escapeHtml(state.nameDraft)}"
          autocomplete="off"
        />
        <button type="button" class="text-btn" id="confirm-save-as">Create</button>
        <button type="button" class="text-btn muted" id="cancel-save-as">Cancel</button>
      </div>`
    : "";

  const active = state.sets.find((s) => s.id === state.activeSetId);
  const deleting =
    state.deleteConfirmOpen && active
      ? `
      <div class="sets-confirm" role="group" aria-label="Confirm delete">
        <p class="sets-confirm-copy">Delete <span class="sets-confirm-name">${escapeHtml(active.name)}</span>?</p>
        <div class="sets-confirm-actions">
          <button type="button" class="text-btn danger" id="confirm-delete-set">Delete</button>
          <button type="button" class="text-btn muted" id="cancel-delete-set">Cancel</button>
        </div>
      </div>`
      : "";

  const showDelete =
    Boolean(state.activeSetId) && !state.deleteConfirmOpen && !state.namingOpen;

  return `
    <div class="field sets-field">
      <span class="field-label" id="sets-label">Sets</span>
      <div class="sets-row" role="group" aria-labelledby="sets-label">
        <div class="sets-chips">${chips}</div>
        <div class="sets-actions">
          <button type="button" class="text-btn" id="save-set" ${dirty && canSaveSet() && !state.deleteConfirmOpen ? "" : "hidden"}>Save</button>
          <button type="button" class="text-btn" id="save-as-set" ${state.namingOpen || state.deleteConfirmOpen || !canSaveSet() ? "hidden" : ""}>Save as</button>
          <button type="button" class="text-btn danger" id="delete-set" ${showDelete ? "" : "hidden"} aria-label="Delete active set">Delete</button>
        </div>
      </div>
      ${naming}
      ${deleting}
    </div>`;
}

function updateSetsBar(): void {
  const mount = app.querySelector("#sets-mount");
  if (!mount) return;
  const nameInput = app.querySelector<HTMLInputElement>("#set-name");
  const hadNameFocus = Boolean(
    state.namingOpen && nameInput && document.activeElement === nameInput,
  );
  if (hadNameFocus && nameInput) {
    state.nameDraft = nameInput.value;
  }
  mount.innerHTML = setsBarHtml();
  if (state.namingOpen) {
    const input = app.querySelector<HTMLInputElement>("#set-name");
    if (!input) return;
    queueMicrotask(() => {
      input.focus();
      if (hadNameFocus) {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      } else {
        input.select();
      }
    });
  } else if (state.deleteConfirmOpen) {
    queueMicrotask(() =>
      app.querySelector<HTMLButtonElement>("#cancel-delete-set")?.focus(),
    );
  }
}

function updateResults(): void {
  const mount = app.querySelector("#results-mount");
  if (mount) mount.innerHTML = resultsHtml();
}

function updateDurationChips(): void {
  const duration = state.activeDuration ?? detectActiveDuration();
  app.querySelectorAll<HTMLButtonElement>("[data-duration]").forEach((btn) => {
    btn.setAttribute(
      "aria-pressed",
      String(Number(btn.dataset.duration) === duration),
    );
  });
  syncTimeInput("end");
}

function updateSourceList(): void {
  const list = app.querySelector("#source-list");
  if (!list) return;
  const matches = searchCities(state.sourceQuery, []);
  list.innerHTML = comboOptionsHtml(matches, "No cities found");
  list.toggleAttribute("hidden", !state.sourceOpen);
  const input = app.querySelector<HTMLInputElement>("#source-city");
  if (input) input.setAttribute("aria-expanded", String(state.sourceOpen));
}

function updateTargetPanel(): void {
  const chips = app.querySelector("#target-chips");
  if (chips) {
    const targetChips = state.targetIds
      .map((id) => getCityById(id))
      .filter((c): c is City => Boolean(c))
      .map(
        (c) => `
        <span class="city-chip">
          ${escapeHtml(c.name)}
          <button type="button" class="remove" data-remove-target="${escapeHtml(c.id)}" aria-label="Remove ${escapeHtml(c.name)}">×</button>
        </span>`,
      )
      .join("");
    chips.innerHTML =
      targetChips +
      `<button type="button" class="add-city-btn" id="add-city" aria-expanded="${state.targetOpen}" aria-controls="target-list">+ Add city</button>`;
  }

  const combo = app.querySelector("#target-combo");
  if (combo) {
    combo.toggleAttribute("hidden", !state.targetOpen);
  }
  const list = app.querySelector("#target-list");
  if (list) {
    const matches = searchCities(state.targetQuery, [
      state.sourceId,
      ...state.targetIds,
    ]);
    list.innerHTML = comboOptionsHtml(matches, "No cities found");
    list.toggleAttribute("hidden", !state.targetOpen);
  }
  const input = app.querySelector<HTMLInputElement>("#target-city");
  if (input) {
    input.setAttribute("aria-expanded", String(state.targetOpen));
    if (document.activeElement !== input) {
      input.value = state.targetQuery;
    }
  }
}

function updateTimeFieldsVisibility(): void {
  const row = app.querySelector(".time-row");
  const rangeExtras = app.querySelector("#range-extras");
  const label = app.querySelector("#time-label");
  row?.classList.toggle("range", state.mode === "range");
  if (rangeExtras) {
    rangeExtras.toggleAttribute("hidden", state.mode !== "range");
  }
  if (label) {
    label.textContent = state.mode === "range" ? "Time range" : "Time";
  }
  app.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.mode));
  });

  const endWrap = app.querySelector("#end-wrap");
  if (endWrap) {
    endWrap.toggleAttribute("hidden", state.mode !== "range");
  }
}

function confirmDiscardDirty(): boolean {
  if (!isDirty()) return true;
  return window.confirm("Discard unsaved changes to this set?");
}

function switchToSet(id: string): void {
  if (id === state.activeSetId) return;
  if (!confirmDiscardDirty()) return;
  const set = state.sets.find((s) => s.id === id);
  if (!set) return;
  applySetCities(set);
  persistSets(set.id);
  syncSourceInput();
  afterCityChange();
  trackEvent("set_select", {
    target_count: set.targetIds.length,
    set_count: state.sets.length,
  });
}

function closeDeleteConfirm(): void {
  if (!state.deleteConfirmOpen) return;
  state.deleteConfirmOpen = false;
  updateSetsBar();
}

function saveActiveSet(): void {
  if (!state.activeSetId || !isDirty() || !canSaveSet()) return;
  const idx = state.sets.findIndex((s) => s.id === state.activeSetId);
  if (idx < 0) return;
  const current = state.sets[idx]!;
  state.sets[idx] = {
    ...current,
    sourceId: state.sourceId,
    targetIds: [...state.targetIds],
  };
  persistSets(state.activeSetId);
  updateSetsBar();
  trackEvent("set_save", {
    target_count: state.targetIds.length,
  });
}

function saveAsNewSet(name: string): void {
  const trimmed = name.trim();
  if (!trimmed || !canSaveSet()) return;
  const set = createSet(trimmed, state.sourceId, state.targetIds);
  state.sets = [...state.sets, set];
  state.activeSetId = set.id;
  state.namingOpen = false;
  state.nameDraft = "";
  persistSets(set.id);
  updateSetsBar();
  trackEvent("set_save_as", {
    target_count: state.targetIds.length,
    set_count: state.sets.length,
  });
}

function deleteActiveSet(): void {
  if (!state.activeSetId) return;
  const removingId = state.activeSetId;
  const remaining = state.sets.filter((s) => s.id !== removingId);
  state.sets = remaining;
  trackEvent("set_delete", {
    set_count: remaining.length,
  });
  if (remaining.length > 0) {
    const next = remaining[0]!;
    applySetCities(next);
    persistSets(next.id);
  } else {
    applyDefaults();
    persistSets(null);
  }
  syncSourceInput();
  afterCityChange();
}

function restoreFromStorage(): void {
  const store = loadStore();
  state.sets = store.sets;
  if (store.lastUsedSetId) {
    const set = getSet(store, store.lastUsedSetId);
    if (set) {
      applySetCities(set);
      trackEvent("set_restored", {
        set_count: store.sets.length,
        target_count: set.targetIds.length,
      });
      return;
    }
  }
  state.activeSetId = null;
}

function renderShell(): void {
  const sourceCity = getCityById(state.sourceId);

  app.innerHTML = `
    <main class="page">
      <h1 class="brand">Zonewise</h1>
      <p class="tagline">See the same moment in every city.</p>

      <div class="stack">
        <div class="field">
          <span class="field-label" id="mode-label">Mode</span>
          <div class="segmented" role="group" aria-labelledby="mode-label">
            <button type="button" data-mode="point" aria-pressed="${state.mode === "point"}">Point</button>
            <button type="button" data-mode="range" aria-pressed="${state.mode === "range"}">Range</button>
          </div>
        </div>

        <div id="sets-mount"></div>

        <div class="field">
          <span class="field-label" id="time-label">${state.mode === "range" ? "Time range" : "Time"}</span>
          <div class="time-row ${state.mode === "range" ? "range" : ""}">
            ${timeFieldHtml("start")}
            <div id="end-wrap" ${state.mode === "range" ? "" : "hidden"}>
              ${timeFieldHtml("end")}
            </div>
            <button type="button" class="chip time-now" id="time-now" title="Use current time">Now</button>
          </div>
          <div id="range-extras" ${state.mode === "range" ? "" : "hidden"}>
            <div class="duration-chips" role="group" aria-label="Set range length">
              <button type="button" class="chip" data-duration="30" aria-pressed="false">+30m</button>
              <button type="button" class="chip" data-duration="60" aria-pressed="true">+1h</button>
              <button type="button" class="chip" data-duration="120" aria-pressed="false">+2h</button>
            </div>
          </div>
        </div>

        <div class="field">
          <label for="source-city">From</label>
          <div class="combo" id="source-combo">
            <input
              class="combo-input"
              id="source-city"
              type="search"
              autocomplete="off"
              placeholder="Search city or zone"
              value="${escapeHtml(sourceCity ? cityLabel(sourceCity) : "")}"
              aria-expanded="false"
              aria-controls="source-list"
              aria-autocomplete="list"
              role="combobox"
            />
            <ul id="source-list" class="combo-list" role="listbox" hidden></ul>
          </div>
        </div>

        <div class="field">
          <span class="field-label" id="to-label">To</span>
          <div class="targets" id="target-chips" aria-labelledby="to-label"></div>
          <div class="combo" id="target-combo" hidden>
            <input
              class="combo-input"
              id="target-city"
              type="search"
              autocomplete="off"
              placeholder="Search city"
              value=""
              aria-expanded="false"
              aria-controls="target-list"
              aria-autocomplete="list"
              role="combobox"
            />
            <ul id="target-list" class="combo-list" role="listbox" hidden></ul>
          </div>
        </div>

        <hr class="divider" />
        <div id="results-mount"></div>
      </div>
    </main>
  `;

  updateSetsBar();
  updateTargetPanel();
  updateDurationChips();
  updateResults();
}

function closeMenus(except?: "source" | "target"): void {
  if (except !== "source" && state.sourceOpen) {
    state.sourceOpen = false;
    state.sourceQuery = "";
    const sourceCity = getCityById(state.sourceId);
    const input = app.querySelector<HTMLInputElement>("#source-city");
    if (input && sourceCity) input.value = cityLabel(sourceCity);
    updateSourceList();
  }
  if (except !== "target" && state.targetOpen) {
    state.targetOpen = false;
    state.targetQuery = "";
    updateTargetPanel();
  }
}

function bindGlobal(): void {
  app.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    const modeBtn = t.closest<HTMLButtonElement>("[data-mode]");
    if (modeBtn?.dataset.mode) {
      state.mode = modeBtn.dataset.mode as Mode;
      if (state.mode === "range" && state.activeDuration == null) {
        syncEndFromDuration(60);
      }
      updateTimeFieldsVisibility();
      updateDurationChips();
      updateResults();
      trackEvent("mode_change", { mode: state.mode });
      return;
    }

    const durBtn = t.closest<HTMLButtonElement>("[data-duration]");
    if (durBtn?.dataset.duration) {
      const minutes = Number(durBtn.dataset.duration);
      syncEndFromDuration(minutes);
      updateDurationChips();
      updateResults();
      trackEvent("duration_select", { minutes });
      return;
    }

    if (t.closest("#time-now")) {
      applyNow();
      return;
    }

    const selectSet = t.closest<HTMLButtonElement>("[data-select-set]");
    if (selectSet?.dataset.selectSet) {
      switchToSet(selectSet.dataset.selectSet);
      return;
    }

    if (t.closest("#save-set")) {
      saveActiveSet();
      return;
    }

    if (t.closest("#save-as-set")) {
      if (!canSaveSet()) return;
      state.deleteConfirmOpen = false;
      state.namingOpen = true;
      state.nameDraft = "";
      updateSetsBar();
      return;
    }

    if (t.closest("#cancel-save-as")) {
      state.namingOpen = false;
      state.nameDraft = "";
      updateSetsBar();
      return;
    }

    if (t.closest("#confirm-save-as")) {
      const input = app.querySelector<HTMLInputElement>("#set-name");
      saveAsNewSet(input?.value ?? state.nameDraft);
      return;
    }

    if (t.closest("#delete-set")) {
      if (!state.activeSetId) return;
      state.namingOpen = false;
      state.nameDraft = "";
      state.deleteConfirmOpen = true;
      updateSetsBar();
      return;
    }

    if (t.closest("#cancel-delete-set")) {
      closeDeleteConfirm();
      return;
    }

    if (t.closest("#confirm-delete-set")) {
      state.deleteConfirmOpen = false;
      deleteActiveSet();
      return;
    }

    const removeBtn = t.closest<HTMLButtonElement>("[data-remove-target]");
    if (removeBtn?.dataset.removeTarget) {
      const cityId = removeBtn.dataset.removeTarget;
      state.targetIds = state.targetIds.filter((id) => id !== cityId);
      afterCityChange();
      trackEvent("target_city_remove", {
        city_id: cityId,
        target_count: state.targetIds.length,
      });
      return;
    }

    if (t.closest("#add-city")) {
      state.targetOpen = !state.targetOpen;
      state.targetQuery = "";
      if (state.targetOpen) closeMenus("target");
      updateTargetPanel();
      if (state.targetOpen) {
        queueMicrotask(() =>
          app.querySelector<HTMLInputElement>("#target-city")?.focus(),
        );
        trackEvent("add_city_open");
      }
      return;
    }

    const sourceOpt = t.closest<HTMLButtonElement>(
      "#source-list [data-city-id]",
    );
    if (sourceOpt?.dataset.cityId) {
      const id = sourceOpt.dataset.cityId;
      state.sourceId = id;
      state.sourceQuery = "";
      state.sourceOpen = false;
      state.targetIds = state.targetIds.filter((x) => x !== id);
      const city = getCityById(id);
      const input = app.querySelector<HTMLInputElement>("#source-city");
      if (input && city) input.value = cityLabel(city);
      updateSourceList();
      afterCityChange();
      trackEvent("source_city_change", { city_id: id });
      return;
    }

    const targetOpt = t.closest<HTMLButtonElement>(
      "#target-list [data-city-id]",
    );
    if (targetOpt?.dataset.cityId) {
      const id = targetOpt.dataset.cityId;
      if (!state.targetIds.includes(id)) state.targetIds.push(id);
      state.targetQuery = "";
      state.targetOpen = false;
      afterCityChange();
      trackEvent("target_city_add", {
        city_id: id,
        target_count: state.targetIds.length,
      });
      return;
    }
  });

  app.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;

    if (t.id === "start-time") {
      applyTimeDraft("start", (t as HTMLInputElement).value, false);
      return;
    }

    if (t.id === "end-time") {
      applyTimeDraft("end", (t as HTMLInputElement).value, false);
      return;
    }

    if (t.id === "set-name") {
      state.nameDraft = (t as HTMLInputElement).value;
      return;
    }

    if (t.id === "source-city") {
      state.sourceOpen = true;
      state.sourceQuery = (t as HTMLInputElement).value;
      closeMenus("source");
      updateSourceList();
      return;
    }

    if (t.id === "target-city") {
      state.targetOpen = true;
      state.targetQuery = (t as HTMLInputElement).value;
      updateTargetPanel();
      return;
    }
  });

  app.addEventListener("focusout", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "start-time") {
      const draft = (t as HTMLInputElement).value;
      if (parseFlexibleTime(draft) !== null) {
        applyTimeDraft("start", draft, true);
      } else {
        state.startDraft = displayTime(state.start);
        state.startInvalid = false;
        syncTimeInput("start");
      }
      return;
    }
    if (t.id === "end-time") {
      const draft = (t as HTMLInputElement).value;
      if (parseFlexibleTime(draft) !== null) {
        applyTimeDraft("end", draft, true);
      } else {
        state.endDraft = displayTime(state.end);
        state.endInvalid = false;
        syncTimeInput("end");
      }
    }
  });

  app.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.deleteConfirmOpen) {
      e.preventDefault();
      closeDeleteConfirm();
      return;
    }
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.id === "start-time" || t.id === "end-time") {
      e.preventDefault();
      (t as HTMLInputElement).blur();
      return;
    }
    if (t.id === "set-name") {
      e.preventDefault();
      saveAsNewSet((t as HTMLInputElement).value);
    }
  });

  app.addEventListener("focusin", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "source-city") {
      state.sourceOpen = true;
      state.sourceQuery = "";
      (t as HTMLInputElement).select();
      closeMenus("source");
      updateSourceList();
    }
  });

  document.addEventListener("pointerdown", (e) => {
    const t = e.target as Node;
    const sourceCombo = app.querySelector("#source-combo");
    const targetCombo = app.querySelector("#target-combo");
    const addBtn = app.querySelector("#add-city");
    const inSource = sourceCombo?.contains(t);
    const inTarget = targetCombo?.contains(t) || addBtn?.contains(t);
    if (!inSource && !inTarget) closeMenus();
    else if (!inSource) closeMenus("target");
    else if (!inTarget) closeMenus("source");
  });
}

initAnalytics();
restoreFromStorage();
renderShell();
bindGlobal();
