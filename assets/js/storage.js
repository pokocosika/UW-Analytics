const DB_NAME = 'UWAnalyticsDB';
const DB_VERSION = 1;

const STORE_NAMES = ['assignments', 'auditLogs', 'settings', 'businessRules', 'capacity'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open database.'));
  });
}

export async function initializeStorage() {
  const db = await openDatabase();
  db.close();
  return true;
}

export async function saveRecord(storeName, record) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const key = record.id || record.assignmentId || record.logId || record.key;

  const payload = { ...record };
  if (key) {
    payload.id = key;
  }

  const request = store.put(payload);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve({ ...payload, id: request.result });
      db.close();
    };
    request.onerror = () => {
      reject(request.error || new Error(`Unable to save record in ${storeName}.`));
      db.close();
    };
  });
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(request.result || []);
      db.close();
    };
    request.onerror = () => {
      reject(request.error || new Error(`Unable to read records from ${storeName}.`));
      db.close();
    };
  });
}

export async function getRecord(storeName, id) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result || null);
      db.close();
    };
    request.onerror = () => {
      reject(request.error || new Error(`Unable to read record ${id} from ${storeName}.`));
      db.close();
    };
  });
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => {
      resolve(true);
      db.close();
    };
    request.onerror = () => {
      reject(request.error || new Error(`Unable to clear ${storeName}.`));
      db.close();
    };
  });
}

export async function deleteRecord(storeName, id) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => {
      resolve(true);
      db.close();
    };
    request.onerror = () => {
      reject(request.error || new Error(`Unable to delete record ${id} from ${storeName}.`));
      db.close();
    };
  });
}

export { DB_NAME, DB_VERSION, STORE_NAMES };
