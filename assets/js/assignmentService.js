import { saveRecord, getAllRecords, getRecord, deleteRecord } from './storage.js';
import { addAuditLog } from './assignment.js';

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_WEIGHT_RULES = {
  'E-App': 1,
  Memo: 1,
  TSS: 2,
  'F2F': 2,
  Voice: 1,
  PA: 2,
  Medical: 3,
  'Internet Sale': 1,
  Claim: 10,
  APS: 5,
};

function normalizeAssignment(payload) {
  return {
    assignmentId: payload.assignmentId || createId('ASSIGN'),
    appNo: payload.appNo || '',
    customerName: payload.customerName || '',
    idCard: payload.idCard || '',
    plan: payload.plan || '',
    submissionDate: payload.submissionDate || '',
    workType: payload.workType || '',
    weight: Number(payload.weight) || 0,
    assignedUW: payload.assignedUW || '',
    batch: payload.batch || '',
    status: payload.status || 'pending',
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || payload.createdAt || new Date().toISOString(),
  };
}

export async function createAssignment(payload) {
  const assignment = normalizeAssignment({ ...payload, createdAt: payload.createdAt || new Date().toISOString() });
  assignment.updatedAt = new Date().toISOString();
  const saved = await saveRecord('assignments', assignment);
  await addAuditLog({ action: 'create', appNo: assignment.appNo, before: null, after: saved, user: 'system' });
  return saved;
}

export async function updateAssignment(payload) {
  const existing = await getRecord('assignments', payload.assignmentId);
  const updated = normalizeAssignment({ ...existing, ...payload, updatedAt: new Date().toISOString() });
  const saved = await saveRecord('assignments', updated);
  await addAuditLog({ action: 'edit', appNo: updated.appNo, before: existing, after: saved, user: 'system' });
  return saved;
}

export async function deleteAssignment(id) {
  const existing = await getRecord('assignments', id);
  await deleteRecord('assignments', id);
  await addAuditLog({ action: 'delete', appNo: existing?.appNo || '', before: existing, after: null, user: 'system' });
  return true;
}

export async function getAssignments() {
  const records = await getAllRecords('assignments');
  return records.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

export async function searchAssignment(query) {
  const assignments = await getAssignments();
  const term = String(query || '').trim().toLowerCase();
  if (!term) return assignments;

  return assignments.filter((assignment) => {
    const haystack = [assignment.appNo, assignment.customerName, assignment.plan, assignment.assignedUW, assignment.batch, assignment.status]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

export async function loadWeightRules() {
  const records = await getAllRecords('settings');
  const stored = records.find((record) => record.key === 'weightRules');
  return stored?.value || DEFAULT_WEIGHT_RULES;
}

export async function saveWeightRules(rules) {
  const payload = { key: 'weightRules', value: rules };
  const saved = await saveRecord('settings', payload);
  return saved;
}
