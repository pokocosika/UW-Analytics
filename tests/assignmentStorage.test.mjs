import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

global.localStorage = new MemoryStorage();

global.window = {};

global.document = {};

const { initializeStorage, getAllRecords } = await import('../assets/js/storage.js');
const { createAssignment, updateAssignment, deleteAssignment, getAssignments } = await import('../assets/js/assignmentService.js');

test('assignment CRUD persists to LocalStorage and prevents duplicates', async () => {
  await initializeStorage();
  await clearStore('assignments');

  const first = await createAssignment({
    appNo: 'A100',
    customerName: 'Ada Lovelace',
    assignedUW: 'PP',
    workType: 'E-App',
    weight: 1,
    status: 'pending',
  });

  assert.equal(first.appNo, 'A100');
  assert.equal((await getAssignments()).length, 1);
  assert.equal((await getAllRecords('assignments')).length, 1);

  const updated = await updateAssignment({
    assignmentId: first.assignmentId,
    appNo: 'A100',
    customerName: 'Ada Lovelace',
    assignedUW: 'PP',
    workType: 'E-App',
    weight: 2,
    status: 'in-progress',
  });

  assert.equal(updated.weight, 2);
  assert.equal(updated.status, 'in-progress');

  await assert.rejects(
    () => createAssignment({
      appNo: 'A100',
      customerName: 'Grace Hopper',
      assignedUW: 'PP',
      workType: 'Memo',
      weight: 1,
      status: 'pending',
    }),
    /Duplicate application number/i,
  );

  await deleteAssignment(first.assignmentId);
  assert.equal((await getAssignments()).length, 0);
});

async function clearStore(storeName) {
  const { clearStore: clearStoreFn } = await import('../assets/js/storage.js');
  await clearStoreFn(storeName);
}
