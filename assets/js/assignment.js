import { saveRecord, getAllRecords, getRecord } from './storage.js';

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class Assignment {
  constructor(payload = {}) {
    this.assignmentId = payload.assignmentId || createId('ASSIGN');
    this.appNo = payload.appNo || '';
    this.customerName = payload.customerName || '';
    this.plan = payload.plan || '';
    this.submissionDate = payload.submissionDate || '';
    this.workType = payload.workType || '';
    this.weight = payload.weight || 0;
    this.assignedUW = payload.assignedUW || '';
    this.batch = payload.batch || '';
    this.status = payload.status || 'pending';
    this.createdAt = payload.createdAt || new Date().toISOString();
    this.updatedAt = payload.updatedAt || this.createdAt;
  }
}

export class AuditLog {
  constructor(payload = {}) {
    this.logId = payload.logId || createId('AUDIT');
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
  assignment.updatedAt = new Date().toISOString();

  if (!assignment.createdAt) {
    assignment.createdAt = assignment.updatedAt;
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
