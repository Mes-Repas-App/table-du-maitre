/* Mini-enveloppe IndexedDB : une seule base, une valeur par clé (campagnes, index,
   copies de secours, dossier de sauvegarde…). Des centaines de Mo disponibles. */

const DB_NAME = "table-du-maitre";
const STORE = "campagne";

function idb(mode, op) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export const get = (k) => idb("readonly", (s) => s.get(k));
export const put = (k, v) => idb("readwrite", (s) => s.put(v, k));
export const del = (k) => idb("readwrite", (s) => s.delete(k));
