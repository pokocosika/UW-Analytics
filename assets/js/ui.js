import { addAuditLog, loadAssignments } from './assignment.js';
import { searchPolicy } from './policyLookup.js';

function updateAssignStatus(message, variant = 'info') {
  const statusNode = document.getElementById('assign-status');
  if (!statusNode) return;

  statusNode.textContent = message;
  statusNode.dataset.variant = variant;
}

export function setupAssignTab() {
  const searchInput = document.getElementById('assign-policy-search');
  const searchButton = document.getElementById('assign-policy-search-btn');

  if (!searchInput || !searchButton) {
    return;
  }

  searchButton.addEventListener('click', async () => {
    const appNo = searchInput.value.trim();
    if (!appNo) {
      updateAssignStatus('Enter an application number to look up a policy.', 'info');
      return;
    }

    try {
      updateAssignStatus('Searching policy...', 'info');
      const policy = await searchPolicy(appNo);
      const resultNode = document.getElementById('assign-policy-result');
      if (!resultNode) return;

      if (policy) {
        resultNode.innerHTML = `
          <div class="space-y-1">
            <div class="font-semibold text-white">${policy.appNo}</div>
            <div>${policy.customerName || 'No customer name available'}</div>
            <div>Plan: ${policy.plan || '—'}</div>
            <div>Status: ${policy.status || 'pending'}</div>
          </div>
        `;
        await addAuditLog({
          action: 'policyLookup',
          appNo: policy.appNo,
          before: null,
          after: policy,
          user: 'system',
        });
        updateAssignStatus('Policy located and queued for assignment workflow.', 'success');
      } else {
        resultNode.innerHTML = '<div class="text-amber-400">No matching policy was found.</div>';
        updateAssignStatus('No matching policy was found.', 'warning');
      }
    } catch (error) {
      updateAssignStatus(error.message || 'Policy lookup failed.', 'error');
    }
  });
}

export async function renderAssignments() {
  const assignments = await loadAssignments();
  const listNode = document.getElementById('assign-queue-list');
  if (!listNode) return;

  if (!assignments.length) {
    listNode.innerHTML = '<div class="text-xs text-[var(--text-muted)]">No assignments have been saved yet.</div>';
    return;
  }

  listNode.innerHTML = assignments
    .map((assignment) => `
      <div class="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3 text-xs text-[var(--text-muted)]">
        <div class="font-semibold text-white">${assignment.appNo || 'No application number'}</div>
        <div>${assignment.customerName || '—'}</div>
        <div>Status: ${assignment.status || 'pending'}</div>
      </div>
    `)
    .join('');
}

export async function initializeAssignmentUi() {
  setupAssignTab();
  await renderAssignments();
  updateAssignStatus('Assignment foundation ready.', 'success');
}
