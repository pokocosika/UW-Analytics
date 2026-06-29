import { searchPolicy } from './policyLookup.js';
import { createAssignment, deleteAssignment, getAssignments, searchAssignment, updateAssignment, DEFAULT_WEIGHT_RULES, loadWeightRules, saveWeightRules } from './assignmentService.js';
import { getSummary } from './workloadEngine.js';
import { renderWorkloadCharts } from './charts.js';

let activeAssignmentId = null;
let weightRules = { ...DEFAULT_WEIGHT_RULES };

function updateAssignStatus(message, variant = 'info') {
  const statusNode = document.getElementById('assign-status');
  if (!statusNode) return;

  statusNode.textContent = message;
  statusNode.dataset.variant = variant;
}

function setFormValues(values) {
  const form = document.getElementById('assignment-form');
  if (!form) return;

  [...form.elements].forEach((field) => {
    if (!field.name) return;
    const value = values[field.name] ?? '';
    if (field.type === 'select-one') {
      field.value = value;
    } else {
      field.value = value;
    }
  });
}

function getFormValues() {
  const form = document.getElementById('assignment-form');
  if (!form) return {};

  const values = {};
  [...form.elements].forEach((field) => {
    if (!field.name) return;
    values[field.name] = field.value;
  });
  return values;

}

function calculateWeight(workType) {
  const normalized = String(workType || '').trim();
  return Number(weightRules[normalized] || 0) || 0;
}

function bindWeightRules() {
  const workTypeSelect = document.getElementById('workType');
  const weightInput = document.getElementById('weight');
  if (!workTypeSelect || !weightInput) return;

  workTypeSelect.addEventListener('change', () => {
    weightInput.value = calculateWeight(workTypeSelect.value);
  });
}

function renderWeightRules() {
  const container = document.getElementById('weight-rules');
  if (!container) return;

  container.innerHTML = `
    <div class="space-y-2">
      ${Object.entries(weightRules).map(([rule, value]) => `
        <label class="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-2">
          <span>${rule}</span>
          <input data-rule="${rule}" type="number" min="0" value="${value}" class="w-20 rounded border border-[var(--border)] bg-transparent px-2 py-1 text-right text-white">
        </label>
      `).join('')}
    </div>
    <button id="assign-weight-rules-save" type="button" class="mt-3 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[var(--bg)]">Save Weight Rules</button>
  `;

  container.querySelector('#assign-weight-rules-save')?.addEventListener('click', async () => {
    const nextRules = {};
    container.querySelectorAll('input[data-rule]').forEach((input) => {
      nextRules[input.getAttribute('data-rule')] = Number(input.value) || 0;
    });
    weightRules = nextRules;
    await saveWeightRules(weightRules);
    updateAssignStatus('Weight rules updated.', 'success');
    const workTypeSelect = document.getElementById('workType');
    const weightInput = document.getElementById('weight');
    if (workTypeSelect && weightInput) {
      weightInput.value = calculateWeight(workTypeSelect.value);
    }
  });
}

function renderHistory(assignments) {
  const listNode = document.getElementById('assign-history-body');
  if (!listNode) return;

  if (!assignments.length) {
    listNode.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-xs text-[var(--text-muted)]">No assignments found.</td></tr>';
    return;
  }

  listNode.innerHTML = assignments.map((assignment) => `
    <tr class="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
      <td class="p-3 text-white">${assignment.appNo || '—'}</td>
      <td class="p-3">${assignment.customerName || '—'}</td>
      <td class="p-3">${assignment.workType || '—'}</td>
      <td class="p-3">${assignment.weight || 0}</td>
      <td class="p-3">${assignment.assignedUW || '—'}</td>
      <td class="p-3">${assignment.batch || '—'}</td>
      <td class="p-3">${assignment.status || 'pending'}</td>
      <td class="p-3 flex gap-2">
        <button data-action="edit" data-id="${assignment.assignmentId}" class="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-white">Edit</button>
        <button data-action="delete" data-id="${assignment.assignmentId}" class="rounded-lg border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function refreshHistory() {
  const query = document.getElementById('assign-history-search')?.value || '';
  const sort = document.getElementById('assign-history-sort')?.value || 'newest';
  let assignments = await searchAssignment(query);

  assignments = [...assignments].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  if (sort === 'oldest') {
    assignments.reverse();
  }

  renderHistory(assignments);
  await refreshWorkloadDashboard();
}

async function refreshWorkloadDashboard() {
  const summary = await getSummary();
  const body = document.getElementById('workload-summary-body');
  if (body) {
    body.innerHTML = summary.map((item) => `
      <tr class="border-b border-[var(--border)]">
        <td class="p-2 text-white">${item.uw}</td>
        <td class="p-2">${item.capacity}</td>
        <td class="p-2">${item.currentWeight}</td>
        <td class="p-2">${item.remaining}</td>
        <td class="p-2">${item.percentage}%</td>
        <td class="p-2">${item.status}</td>
      </tr>
    `).join('');
  }
  renderWorkloadCharts(summary);
}

async function populatePolicyDetails(appNo) {
  const policy = await searchPolicy(appNo);
  const customerNameInput = document.getElementById('customerName');
  const planInput = document.getElementById('plan');
  const submissionDateInput = document.getElementById('submissionDate');
  const idCardInput = document.getElementById('idCard');

  if (policy) {
    if (customerNameInput) customerNameInput.value = policy.customerName || '';
    if (planInput) planInput.value = policy.plan || '';
    if (submissionDateInput) submissionDateInput.value = policy.submissionDate || '';
    if (idCardInput) idCardInput.value = policy.idCard || '';
    updateAssignStatus(`Policy found for ${policy.appNo}.`, 'success');
  } else {
    if (customerNameInput) customerNameInput.value = '';
    if (planInput) planInput.value = '';
    if (submissionDateInput) submissionDateInput.value = '';
    if (idCardInput) idCardInput.value = '';
    updateAssignStatus('No matching policy found.', 'warning');
  }
}

export function setupAssignTab() {
  const appNoInput = document.getElementById('appNo');
  const appNoField = document.getElementById('appNoField');
  const form = document.getElementById('assignment-form');
  const searchButton = document.getElementById('assign-policy-search-btn');
  const historySearch = document.getElementById('assign-history-search');
  const historySort = document.getElementById('assign-history-sort');
  const resetButton = document.getElementById('assign-reset-btn');

  const syncAppNo = (value) => {
    if (appNoInput) appNoInput.value = value;
    if (appNoField) appNoField.value = value;
  };

  if (appNoInput) {
    appNoInput.addEventListener('input', (event) => {
      syncAppNo(event.target.value);
      if (event.target.value.trim().length >= 4) {
        window.clearTimeout(appNoInput.dataset.timer);
        appNoInput.dataset.timer = window.setTimeout(() => populatePolicyDetails(event.target.value.trim()), 250);
      }
    });

    appNoInput.addEventListener('blur', async () => {
      const appNo = appNoInput.value.trim();
      if (!appNo) return;
      await populatePolicyDetails(appNo);
    });
  }

  if (appNoField) {
    appNoField.addEventListener('input', (event) => {
      syncAppNo(event.target.value);
    });
  }

  if (searchButton) {
    searchButton.addEventListener('click', async () => {
      const appNo = (appNoInput?.value || appNoField?.value || '').trim();
      if (!appNo) {
        updateAssignStatus('Enter an application number to look up a policy.', 'info');
        return;
      }
      syncAppNo(appNo);
      await populatePolicyDetails(appNo);
    });
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = getFormValues();
      const payload = {
        ...values,
        weight: Number(values.weight) || calculateWeight(values.workType),
        assignmentId: activeAssignmentId || undefined,
      };

      try {
        if (activeAssignmentId) {
          await updateAssignment(payload);
          updateAssignStatus('Assignment updated.', 'success');
        } else {
          await createAssignment(payload);
          updateAssignStatus('Assignment saved to IndexedDB.', 'success');
        }
        activeAssignmentId = null;
        form.reset();
        const workTypeSelect = document.getElementById('workType');
        const weightInput = document.getElementById('weight');
        if (workTypeSelect && weightInput) {
          weightInput.value = calculateWeight(workTypeSelect.value);
        }
        await refreshHistory();
      } catch (error) {
        updateAssignStatus(error.message || 'Unable to save assignment.', 'error');
      }
    });
  }

  if (resetButton && form) {
    resetButton.addEventListener('click', () => {
      form.reset();
      activeAssignmentId = null;
      if (appNoInput) appNoInput.value = '';
      if (appNoField) appNoField.value = '';
      const workTypeSelect = document.getElementById('workType');
      const weightInput = document.getElementById('weight');
      if (workTypeSelect && weightInput) {
        weightInput.value = calculateWeight(workTypeSelect.value);
      }
      updateAssignStatus('Form reset.', 'info');
    });
  }

  if (historySearch) {
    historySearch.addEventListener('input', refreshHistory);
  }

  if (historySort) {
    historySort.addEventListener('change', refreshHistory);
  }

  document.getElementById('assign-history-body')?.addEventListener('click', async (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const assignmentId = target.getAttribute('data-id');

    if (action === 'delete') {
      await deleteAssignment(assignmentId);
      updateAssignStatus('Assignment deleted.', 'warning');
      await refreshHistory();
      return;
    }

    const assignments = await getAssignments();
    const assignment = assignments.find((item) => item.assignmentId === assignmentId);
    if (!assignment) return;

    activeAssignmentId = assignment.assignmentId;
    setFormValues(assignment);
    if (appNoInput) appNoInput.value = assignment.appNo || '';
    if (appNoField) appNoField.value = assignment.appNo || '';
    document.getElementById('weight').value = assignment.weight || calculateWeight(assignment.workType);
    updateAssignStatus('Assignment loaded for editing.', 'info');
  });
}

export async function initializeAssignmentUi() {
  weightRules = await loadWeightRules().catch(() => ({ ...DEFAULT_WEIGHT_RULES }));
  bindWeightRules();
  renderWeightRules();
  setupAssignTab();
  await refreshHistory();
  updateAssignStatus('Assignment engine ready.', 'success');
}
