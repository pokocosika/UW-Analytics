const DB_NAME = 'UWAnalyticsDB';
const DB_VERSION = 1;

const STORE_NAMES = ['assignments', 'auditLogs', 'settings', 'businessRules', 'capacity'];

function createStorageKey(storeName) {
  return `uw-analytics:${storeName}`;
}

function createRecordId(prefix = 'record') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore(storeName) {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(createStorageKey(storeName));
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Unable to read ${storeName} from LocalStorage.`, error);
    return [];
  }
}

function writeStore(storeName, records) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(createStorageKey(storeName), JSON.stringify(records));
}

function findRecord(items, id) {
  return items.find((item) => {
    if (!id) {
      return false;
    }

    if (item.id === id) {
      return true;
    }

    if (item.assignmentId && item.assignmentId === id) {
      return true;
    }

    if (item.logId && item.logId === id) {
      return true;
    }

    if (item.key && item.key === id) {
      return true;
    }

    return false;
  });
}

export async function initializeStorage() {
  if (typeof localStorage === 'undefined') {
    throw new Error('LocalStorage is not available in this environment.');
  }

  STORE_NAMES.forEach((storeName) => {
    if (!readStore(storeName).length) {
      writeStore(storeName, []);
    }
  });

  return true;
}

export async function saveRecord(storeName, record) {
  const normalizedStoreName = String(storeName || '').trim();
  const payload = { ...record };
  const key = payload.id || payload.assignmentId || payload.logId || payload.key || null;

  if (!payload.id) {
    payload.id = key || createRecordId(normalizedStoreName || 'record');
  }

  const items = readStore(normalizedStoreName);
  const existingIndex = items.findIndex((item) => item.id === payload.id);

  if (existingIndex >= 0) {
    items[existingIndex] = payload;
  } else {
    items.push(payload);
  }

  writeStore(normalizedStoreName, items);
  return payload;
}

export async function getAllRecords(storeName) {
  return readStore(String(storeName || '').trim());
}

export async function getRecord(storeName, id) {
  const items = readStore(String(storeName || '').trim());
  return findRecord(items, id) || null;
}

export async function clearStore(storeName) {
  writeStore(String(storeName || '').trim(), []);
  return true;
}

export async function deleteRecord(storeName, id) {
  const normalizedStoreName = String(storeName || '').trim();
  const items = readStore(normalizedStoreName);
  const nextItems = items.filter((item) => !findRecord([item], id));
  writeStore(normalizedStoreName, nextItems);
  return true;
}

export { DB_NAME, DB_VERSION, STORE_NAMES };
