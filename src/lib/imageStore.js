// IndexedDB store for image *pixels*. localStorage holds the small editing
// metadata (filters, crops, layout); the actual full-resolution blobs and
// thumbnails live here so a page refresh can fully restore the session without
// re-importing. Gracefully degrades to no-op if IndexedDB is unavailable.
const DB_NAME = 'printgod';
const STORE = 'images';
const VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function asPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    return await fn(store);
  } catch (err) {
    console.warn('PrintGod: IndexedDB op failed', err);
    return null;
  }
}

// rec: { id, name, origSize, w, h, fullBlob, thumbUrl }
export function putImage(rec) {
  return withStore('readwrite', (store) => asPromise(store.put(rec)));
}

export async function getAllImages() {
  const res = await withStore('readonly', (store) => asPromise(store.getAll()));
  return res || [];
}

export function deleteImages(ids) {
  return withStore('readwrite', (store) => {
    ids.forEach((id) => store.delete(id));
    return Promise.resolve();
  });
}

// Delete any stored pixels whose id is not in keepIds.
export async function pruneExcept(keepIds) {
  const keep = new Set(keepIds);
  const keys = await withStore('readonly', (store) => asPromise(store.getAllKeys()));
  if (!keys) return;
  const toDelete = keys.filter((k) => !keep.has(k));
  if (toDelete.length) await deleteImages(toDelete);
}

export function clearAll() {
  return withStore('readwrite', (store) => asPromise(store.clear()));
}
