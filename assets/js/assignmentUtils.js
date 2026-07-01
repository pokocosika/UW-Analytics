export function createId(prefix = 'record') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeAssignmentPayload(payload = {}) {
  const now = new Date().toISOString();
  return {
    assignmentId: payload.assignmentId || createId('ASSIGN'),
    appNo: payload.appNo || '',
    policyNo: payload.policyNo || payload.appNo || '',
    customerName: payload.customerName || '',
    product: payload.product || payload.plan || '',
    idCard: payload.idCard || '',
    plan: payload.plan || '',
    submissionDate: payload.submissionDate || '',
    workType: payload.workType || '',
    weight: Number(payload.weight) || 0,
    assignedUW: payload.assignedUW || '',
    assignedDateTime: payload.assignedDateTime || payload.createdAt || now,
    assignedBy: payload.assignedBy || 'system',
    lastModified: payload.lastModified || payload.updatedAt || payload.createdAt || now,
    batch: payload.batch || '',
    status: payload.status || 'pending',
    createdAt: payload.createdAt || payload.assignedDateTime || now,
    updatedAt: payload.updatedAt || payload.lastModified || payload.createdAt || now,
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
