// IndexedDB wrapper for stored markdown files.
// Store: `files`, keyPath `id` (auto-increment).
// Record: { id, name, content, size, addedAt }

const DB_NAME = "md-reader";
const DB_VERSION = 1;
const STORE = "files";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        Promise.resolve(fn(store)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function addFile({ name, content }) {
  const record = {
    name,
    content,
    size: new Blob([content]).size,
    addedAt: Date.now(),
  };
  return tx("readwrite", (store) => reqToPromise(store.add(record)));
}

export function listFiles() {
  return tx("readonly", (store) => reqToPromise(store.getAll())).then((rows) =>
    // newest first
    rows.sort((a, b) => b.addedAt - a.addedAt)
  );
}

export function getFile(id) {
  return tx("readonly", (store) => reqToPromise(store.get(Number(id))));
}

export function deleteFile(id) {
  return tx("readwrite", (store) => reqToPromise(store.delete(Number(id))));
}
