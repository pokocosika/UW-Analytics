import { saveRecord, getAllRecords, getRecord, deleteRecord } from './storage.js';
import { addAuditLog } from './assignment.js';
import { normalizeAssignmentPayload } from './assignmentUtils.js';

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

async function assertUniqueAssignment(assignment, ignoreAssignmentId = null) {
  const records = await getAllRecords('assignments');
  const targetAppNo = String(assignment.appNo || '').trim().toLowerCase();
  const duplicate = records.find((record) => {
    if (ignoreAssignmentId && record.assignmentId === ignoreAssignmentId) {
      return false;
    }

    return String(record.appNo || '').trim().toLowerCase() === targetAppNo;
  });

  if (duplicate) {
    throw new Error(`Duplicate application number ${assignment.appNo} already exists.`);
  }
}

export async function createAssignment(payload) {
  const assignment = normalizeAssignmentPayload({ ...payload, createdAt: payload.createdAt || new Date().toISOString() });
  assignment.updatedAt = new Date().toISOString();
  assignment.lastModified = assignment.updatedAt;
  assignment.assignedDateTime = assignment.assignedDateTime || assignment.createdAt;

  await assertUniqueAssignment(assignment);

  const saved = await saveRecord('assignments', assignment);
  await addAuditLog({ assignmentId: saved.assignmentId, action: 'create', appNo: assignment.appNo, before: null, after: saved, user: assignment.assignedBy || 'system' });
  return saved;
}

export async function updateAssignment(payload) {
  const existing = await getRecord('assignments', payload.assignmentId);
  if (!existing) {
    throw new Error('Assignment not found.');
  }

  const updated = normalizeAssignmentPayload({ ...existing, ...payload, updatedAt: new Date().toISOString(), lastModified: new Date().toISOString() });
  await assertUniqueAssignment(updated, existing.assignmentId);

  const saved = await saveRecord('assignments', updated);
  await addAuditLog({ assignmentId: saved.assignmentId, action: 'edit', appNo: updated.appNo, before: existing, after: saved, user: updated.assignedBy || 'system' });
  return saved;
}

export async function deleteAssignment(id) {
  const existing = await getRecord('assignments', id);
  if (!existing) {
    return true;
  }

  await deleteRecord('assignments', id);
  await addAuditLog({ assignmentId: existing.assignmentId, action: 'delete', appNo: existing?.appNo || '', before: existing, after: null, user: existing.assignedBy || 'system' });
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
    const haystack = [assignment.appNo, assignment.policyNo, assignment.customerName, assignment.product, assignment.plan, assignment.assignedUW, assignment.batch, assignment.status, assignment.assignedBy]
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
