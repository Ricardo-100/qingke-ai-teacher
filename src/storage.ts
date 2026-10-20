export async function fileStore(value?: { name: string; data: ArrayBuffer } | null): Promise<{ name: string; data: ArrayBuffer } | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('qingke-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('files');
      const request = value === undefined ? store.get('current') : value === null ? store.delete('current') : store.put(value, 'current');
      let result: { name: string; data: ArrayBuffer } | null = null;
      request.onsuccess = () => { result = value === undefined ? request.result || null : value; };
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
