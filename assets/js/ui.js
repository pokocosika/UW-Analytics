import { searchPolicy } from './policyLookup.js';
import { createAssignment, deleteAssignment, getAssignments, searchAssignment, updateAssignment, DEFAULT_WEIGHT_RULES, loadWeightRules, saveWeightRules } from './assignmentService.js';
import { getSummary, getRemainingCapacity } from './workloadEngine.js';
import { renderWorkloadCharts } from './charts.js';
import { validateAssignment } from './businessRulesEngine.js';
import { exportAssignmentWorkbooks } from './exportEngine.js';
import { escapeHtml } from './assignmentUtils.js';

let activeAssignmentId = null;
let weightRules = { ...DEFAULT_WEIGHT_RULES };
let isSubmitting = false;

function updateAssignStatus(message, variant = 'info') {
  const statusNode = document.getElementById('assign-status');
  if (!statusNode) return;

  statusNode.textContent = message;
  statusNode.dataset.variant = variant;
  showToast(message, variant);
}

function showToast(message, variant = 'info') {
  const existing = document.getElementById('uw-toast-region');
  if (!existing) {
    const container = document.createElement('div');
    container.id = 'uw-toast-region';
    container.className = 'fixed right-4 top-4 z-[200] flex flex-col gap-2';
    document.body.appendChild(container);
  }

  const container = document.getElementById('uw-toast-region');
  const toast = document.createElement('div');
  const toneClass = variant === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : variant === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : variant === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)]';
  toast.className = `min-w-[240px] max-w-[320px] rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur ${toneClass}`;
  toast.innerHTML = `<div class="font-semibold">${escapeHtml(message)}</div>`;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
    if (!container.children.length) {
      container.remove();
    }
  }, 2800);
}

function setBusyState(isBusy, message = '') {
  const form = document.getElementById('assignment-form');
  const submitButton = form?.querySelector('button[type="submit"]');
  const exportButton = document.getElementById('assign-export-btn');
  const resetButton = document.getElementById('assign-reset-btn');
  const historySearch = document.getElementById('assign-history-search');
  const historySort = document.getElementById('assign-history-sort');
  const loadingIndicator = document.getElementById('assign-loading-indicator');

  if (submitButton) {
    submitButton.disabled = isBusy;
    submitButton.classList.toggle('opacity-60', isBusy);
    submitButton.textContent = isBusy ? (message || 'Saving…') : 'Save Assignment';
  }

  if (exportButton) { exportButton.disabled = isBusy; exportButton.classList.toggle('opacity-60', isBusy); }
  if (resetButton) { resetButton.disabled = isBusy; resetButton.classList.toggle('opacity-60', isBusy); }
  if (historySearch) { historySearch.disabled = isBusy; }
  if (historySort) { historySort.disabled = isBusy; }
  if (loadingIndicator) {
    loadingIndicator.classList.toggle('hidden', !isBusy);
    loadingIndicator.classList.toggle('flex', isBusy);
    const label = loadingIndicator.querySelector('span:last-child');
    if (label) {
      label.textContent = isBusy ? (message || 'Working…') : 'Ready';
    }
  }
}

async function handleExportAssignments() {
  try {
    setBusyState(true, 'Exporting…');
    const result = await exportAssignmentWorkbooks();
    updateAssignStatus(`Export completed: ${result.assignmentsCount} assignments exported.`, 'success');
  } catch (error) {
    updateAssignStatus(error.message || 'Unable to export assignments.', 'error');
  } finally {
    setBusyState(false);
  }
}

function renderBusinessRuleStatus(result = null) {
  const container = document.getElementById('business-rule-status');
  if (!container) return;

  if (!result) {
    container.innerHTML = `
      <div class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Business Rule Status</div>
      <div class="mt-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-[11px] text-[var(--text-muted)]">No validation run yet</div>
    `;
    return;
  }

  const appliedRules = (result.appliedRules || []).map((rule) => `<li class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--text-muted)]">${escapeHtml(rule.name)}${rule.weight ? ` · weight ${escapeHtml(rule.weight)}` : ''}</li>`).join('');
  const warnings = (result.warnings || []).map((warning) => `<li class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">${escapeHtml(warning)}</li>`).join('');
  const errors = (result.errors || []).map((error) => `<li class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">${escapeHtml(error)}</li>`).join('');

  const badgeClass = result.status === 'error' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : result.status === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';

  container.innerHTML = `
    <div class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Business Rule Status</div>
    <div class="mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${badgeClass}">${result.status === 'error' ? 'Error' : result.status === 'warning' ? 'Warning' : 'Valid'}</div>
    <p class="mt-2 text-[11px] text-[var(--text-muted)]">${escapeHtml(result.reason || 'No additional guidance.')}</p>
    <div class="mt-3 space-y-2">
      <div>
        <div class="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Applied Rules</div>
        <ul class="mt-1 space-y-1">${appliedRules || '<li class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--text-muted)]">No rules applied.</li>'}</ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Warnings</div>
        <ul class="mt-1 space-y-1">${warnings || '<li class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--text-muted)]">None</li>'}</ul>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Errors</div>
        <ul class="mt-1 space-y-1">${errors || '<li class="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--text-muted)]">None</li>'}</ul>
      </div>
    </div>
  `;
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

async function refreshBusinessRuleStatus(values = null) {
  const formValues = values || getFormValues();
  const businessResult = await validateAssignment({
    ...formValues,
    weight: formValues.weight || undefined,
  }).catch(() => ({
    status: 'warning',
    reason: 'Business rules could not be loaded. Using fallback validation.',
    errors: [],
    warnings: [],
    appliedRules: [],
    calculatedWeight: Number(formValues.weight) || 0,
    allowedUW: [],
  }));

  const requiredErrors = [];
  const requiredWarnings = [];
  const appNo = String(formValues.appNo || '').trim();
  const customerName = String(formValues.customerName || '').trim();
  const workType = String(formValues.workType || '').trim();
  const assignedUW = String(formValues.assignedUW || '').trim().toUpperCase();
  const weight = Number(formValues.weight) || businessResult.calculatedWeight || 0;

  if (!appNo) {
    requiredErrors.push('Application number is required.');
  }
  if (!customerName) {
    requiredErrors.push('Customer name is required.');
  }
  if (!workType) {
    requiredErrors.push('Work type is required.');
  }
  if (!assignedUW) {
    requiredErrors.push('Assigned UW is required.');
  }

  if (!weight) {
    requiredWarnings.push('Weight is empty; the default work-type weight will be used.');
  }

  if (appNo) {
    const assignments = await getAssignments();
    const duplicate = assignments.find((assignment) => {
      if (assignment.assignmentId === activeAssignmentId) return false;
      return String(assignment.appNo || '').trim().toLowerCase() === appNo.toLowerCase();
    });

    if (duplicate) {
      requiredErrors.push(`Duplicate application number ${appNo} already exists.`);
    }
  }

  if (assignedUW) {
    const remainingCapacity = await getRemainingCapacity(assignedUW);
    if (remainingCapacity < weight) {
      requiredErrors.push(`UW ${assignedUW} does not have enough remaining capacity (${remainingCapacity} available, ${weight} required).`);
    } else if (remainingCapacity === 0) {
      requiredWarnings.push(`UW ${assignedUW} is currently at full capacity.`);
    }
  }

  const result = {
    status: requiredErrors.length ? 'error' : businessResult.status === 'error' ? 'error' : businessResult.status === 'warning' || requiredWarnings.length ? 'warning' : 'valid',
    reason: requiredErrors[0] || businessResult.reason || 'Assignment is ready to save.',
    errors: [...(businessResult.errors || []), ...requiredErrors],
    warnings: [...(businessResult.warnings || []), ...requiredWarnings],
    appliedRules: businessResult.appliedRules || [],
    calculatedWeight: weight,
    allowedUW: businessResult.allowedUW || [],
  };

  renderBusinessRuleStatus(result);
  return result;
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

  listNode.innerHTML = assignments.map((assignment) => {
    const policyMeta = [assignment.policyNo ? `Policy No: ${escapeHtml(assignment.policyNo)}` : '', assignment.product ? `Product: ${escapeHtml(assignment.product)}` : ''].filter(Boolean).join(' • ');
    const lastModified = assignment.lastModified ? new Date(assignment.lastModified).toLocaleString() : '';
    return `
      <tr class="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
        <td class="p-3 text-white">${escapeHtml(assignment.appNo || '—')}</td>
        <td class="p-3">
          <div class="font-medium text-white">${escapeHtml(assignment.customerName || '—')}</div>
          ${policyMeta ? `<div class="mt-1 text-[10px] text-[var(--text-muted)]">${escapeHtml(policyMeta)}</div>` : ''}
        </td>
        <td class="p-3">${escapeHtml(assignment.workType || '—')}</td>
        <td class="p-3">${escapeHtml(assignment.weight || 0)}</td>
        <td class="p-3">
          <div>${escapeHtml(assignment.assignedUW || '—')}</div>
          ${assignment.assignedBy ? `<div class="mt-1 text-[10px] text-[var(--text-muted)]">By ${escapeHtml(assignment.assignedBy)}</div>` : ''}
        </td>
        <td class="p-3">${escapeHtml(assignment.batch || '—')}</td>
        <td class="p-3">
          <div>${escapeHtml(assignment.status || 'pending')}</div>
          ${lastModified ? `<div class="mt-1 text-[10px] text-[var(--text-muted)]">${escapeHtml(lastModified)}</div>` : ''}
        </td>
        <td class="p-3 flex gap-2">
          <button data-action="edit" data-id="${escapeHtml(assignment.assignmentId || '')}" class="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-white">Edit</button>
          <button data-action="delete" data-id="${escapeHtml(assignment.assignmentId || '')}" class="rounded-lg border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function refreshHistory() {
  const query = document.getElementById('assign-history-search')?.value || '';
  const sort = document.getElementById('assign-history-sort')?.value || 'newest';
  try {
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
  } catch (error) {
    updateAssignStatus(error.message || 'Unable to refresh assignment history.', 'error');
  }
}

async function refreshWorkloadDashboard() {
  try {
    const summary = await getSummary();
    const body = document.getElementById('workload-summary-body');
    if (body) {
      body.innerHTML = summary.map((item) => `
        <tr class="border-b border-[var(--border)]">
          <td class="p-2 text-white">${escapeHtml(item.uw)}</td>
          <td class="p-2">${escapeHtml(item.capacity)}</td>
          <td class="p-2">${escapeHtml(item.currentWeight)}</td>
          <td class="p-2">${escapeHtml(item.remaining)}</td>
          <td class="p-2">${escapeHtml(item.percentage)}%</td>
          <td class="p-2">${escapeHtml(item.status)}</td>
        </tr>
      `).join('');
    }
    renderWorkloadCharts(summary);
  } catch (error) {
    console.warn('Workload dashboard refresh failed:', error);
  }
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
  const exportButton = document.getElementById('assign-export-btn');

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
    form.addEventListener('input', () => {
      void refreshBusinessRuleStatus();
    });

    form.addEventListener('change', () => {
      void refreshBusinessRuleStatus();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSubmitting) return;
      isSubmitting = true;
      setBusyState(true, activeAssignmentId ? 'Updating…' : 'Saving…');

      try {
        const values = getFormValues();
        const validation = await refreshBusinessRuleStatus(values);
        if (validation.status === 'error') {
          updateAssignStatus(validation.reason || 'Please fix validation issues before saving.', 'error');
          return;
        }

        const now = new Date().toISOString();
        const payload = {
          ...values,
          policyNo: values.policyNo || values.appNo || '',
          product: values.product || values.plan || '',
          assignedDateTime: values.assignedDateTime || (activeAssignmentId ? undefined : now),
          assignedBy: values.assignedBy || 'system',
          lastModified: now,
          weight: Number(values.weight) || validation.calculatedWeight || 0,
          assignmentId: activeAssignmentId || undefined,
        };

        if (activeAssignmentId) {
          await updateAssignment(payload);
          updateAssignStatus(validation.reason || 'Assignment updated.', validation.status === 'warning' ? 'warning' : 'success');
        } else {
          await createAssignment(payload);
          updateAssignStatus(validation.reason || 'Assignment saved.', validation.status === 'warning' ? 'warning' : 'success');
        }
        activeAssignmentId = null;
        form.reset();
        renderBusinessRuleStatus();
        const workTypeSelect = document.getElementById('workType');
        const weightInput = document.getElementById('weight');
        if (workTypeSelect && weightInput) {
          weightInput.value = calculateWeight(workTypeSelect.value);
        }
        await refreshHistory();
        window.refreshDashboardData?.();
      } catch (error) {
        updateAssignStatus(error.message || 'Unable to save assignment.', 'error');
      } finally {
        isSubmitting = false;
        setBusyState(false);
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
      void refreshBusinessRuleStatus();
      updateAssignStatus('Form reset.', 'info');
    });
  }

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      void handleExportAssignments();
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
      try {
        await deleteAssignment(assignmentId);
        updateAssignStatus('Assignment deleted.', 'warning');
        await refreshHistory();
        window.refreshDashboardData?.();
      } catch (error) {
        updateAssignStatus(error.message || 'Unable to delete assignment.', 'error');
      }
      return;
    }

    const assignments = await getAssignments();
    const assignment = assignments.find((item) => item.assignmentId === assignmentId);
    if (!assignment) return;

    activeAssignmentId = assignment.assignmentId;
    setFormValues(assignment);
    if (appNoInput) appNoInput.value = assignment.appNo || '';
    if (appNoField) appNoField.value = assignment.appNo || '';
    const weightInput = document.getElementById('weight');
    if (weightInput) {
      weightInput.value = assignment.weight || calculateWeight(assignment.workType);
    }
    updateAssignStatus('Assignment loaded for editing.', 'info');
    await refreshBusinessRuleStatus(getFormValues());
  });
}

export async function initializeAssignmentUi() {
  try {
    weightRules = await loadWeightRules().catch(() => ({ ...DEFAULT_WEIGHT_RULES }));
    bindWeightRules();
    renderWeightRules();
    renderBusinessRuleStatus();
    setupAssignTab();
    await refreshHistory();
    await refreshBusinessRuleStatus();
    window.refreshDashboardData?.();
    updateAssignStatus('Assignment engine ready.', 'success');
  } catch (error) {
    updateAssignStatus(error.message || 'Assignment UI initialization failed.', 'error');
  }
}
