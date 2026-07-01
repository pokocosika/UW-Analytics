import { saveRecord, getAllRecords, getRecord } from './storage.js';
import { createId, normalizeAssignmentPayload } from './assignmentUtils.js';

export class Assignment {
  constructor(payload = {}) {
    Object.assign(this, normalizeAssignmentPayload(payload));
  }
}

export class AuditLog {
  constructor(payload = {}) {
    this.logId = payload.logId || createId('AUDIT');
    this.assignmentId = payload.assignmentId || '';
    this.action = payload.action || 'unknown';
    this.appNo = payload.appNo || '';
    this.before = payload.before || null;
    this.after = payload.after || null;
    this.user = payload.user || 'system';
    this.timestamp = payload.timestamp || new Date().toISOString();
  }
}

export async function saveAssignment(payload) {
  const assignment = payload instanceof Assignment ? payload : new Assignment(payload);
  const now = new Date().toISOString();
  assignment.updatedAt = now;
  assignment.lastModified = now;
  assignment.assignedDateTime = assignment.assignedDateTime || now;

  if (!assignment.createdAt) {
    assignment.createdAt = assignment.assignedDateTime;
  }

  return saveRecord('assignments', assignment);
}

export async function assignCase(payload) {
  const assignment = payload instanceof Assignment ? payload : new Assignment(payload);
  return saveAssignment(assignment);
}

export async function loadAssignments() {
  return getAllRecords('assignments');
}

export async function loadAssignmentById(id) {
  return getRecord('assignments', id);
}

export async function addAuditLog(payload) {
  const audit = payload instanceof AuditLog ? payload : new AuditLog(payload);
  return saveRecord('auditLogs', audit);
}

export async function loadAuditLogs() {
  return getAllRecords('auditLogs');
}
