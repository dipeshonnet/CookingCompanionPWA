let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('cooking-companion-media', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('media');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

export async function getMedia(scope, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction('media').objectStore('media').get(`${scope}:${key}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function putMedia(scope, key, record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('media', 'readwrite');
    transaction.objectStore('media').put(record, `${scope}:${key}`);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
