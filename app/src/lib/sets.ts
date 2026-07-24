import { DEFAULT_SOURCE_ID, getCityById } from "../data/cities";

export type CitySet = {
  id: string;
  name: string;
  sourceId: string;
  targetIds: string[];
};

export type SetsStore = {
  version: 1;
  sets: CitySet[];
  lastUsedSetId: string | null;
};

export const STORAGE_KEY = "zonewise.citySets.v1";

function emptyStore(): SetsStore {
  return { version: 1, sets: [], lastUsedSetId: null };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Drop unknown city ids; ensure a valid source. */
export function sanitizeSet(raw: unknown): CitySet | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) return null;

  const sourceRaw = typeof raw.sourceId === "string" ? raw.sourceId : "";
  const sourceId = getCityById(sourceRaw) ? sourceRaw : DEFAULT_SOURCE_ID;

  const targets = Array.isArray(raw.targetIds) ? raw.targetIds : [];
  const targetIds = targets.filter(
    (tid): tid is string =>
      typeof tid === "string" && tid !== sourceId && Boolean(getCityById(tid)),
  );
  if (targetIds.length === 0) return null;

  return { id, name, sourceId, targetIds };
}

export function sanitizeStore(raw: unknown): SetsStore {
  if (!isRecord(raw) || raw.version !== 1) return emptyStore();

  const sets: CitySet[] = [];
  if (Array.isArray(raw.sets)) {
    for (const item of raw.sets) {
      const set = sanitizeSet(item);
      if (set) sets.push(set);
    }
  }

  let lastUsedSetId: string | null =
    typeof raw.lastUsedSetId === "string" ? raw.lastUsedSetId : null;
  if (lastUsedSetId && !sets.some((s) => s.id === lastUsedSetId)) {
    lastUsedSetId = null;
  }

  return { version: 1, sets, lastUsedSetId };
}

export function loadStore(): SetsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return sanitizeStore(JSON.parse(raw) as unknown);
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: SetsStore): void {
  const sanitized = sanitizeStore(store);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function getSet(store: SetsStore, id: string): CitySet | undefined {
  return store.sets.find((s) => s.id === id);
}

export function createSet(
  name: string,
  sourceId: string,
  targetIds: string[],
): CitySet {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    sourceId,
    targetIds: [...targetIds],
  };
}

export function sameCities(
  a: { sourceId: string; targetIds: string[] },
  b: { sourceId: string; targetIds: string[] },
): boolean {
  if (a.sourceId !== b.sourceId) return false;
  if (a.targetIds.length !== b.targetIds.length) return false;
  return a.targetIds.every((id, i) => id === b.targetIds[i]);
}
