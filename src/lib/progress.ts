const STORAGE_KEY = "if:completed";

const EMPTY: readonly string[] = [];

type Listener = () => void;

const listeners = new Set<Listener>();

let snapshot: readonly string[] = EMPTY;
let hydrated = false;

export function lessonKey(topic: string, slug: string) {
  return `${topic}/${slug}`;
}

function persist(next: readonly string[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — the in-memory snapshot still works for this session.
  }
  listeners.forEach((listener) => listener());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      snapshot = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    snapshot = EMPTY;
  }
}

export function subscribeCompleted(listener: Listener) {
  hydrate();
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    hydrated = false;
    hydrate();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getCompletedSnapshot(): readonly string[] {
  hydrate();
  return snapshot;
}

export function getCompletedServerSnapshot(): readonly string[] {
  return EMPTY;
}

export function setCompleted(key: string, completed: boolean) {
  hydrate();
  const has = snapshot.includes(key);
  if (has === completed) return;
  persist(completed ? [...snapshot, key] : snapshot.filter((item) => item !== key));
}
