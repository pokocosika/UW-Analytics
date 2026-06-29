import { getAllRecords, saveRecord } from './storage.js';

const CAPACITY_CONFIG_URL = './data/capacity.json';
const WORKLOAD_RULES_URL = './data/workloadRules.json';

const DEFAULT_CAPACITY = {
  TS: 1,
  ND: 1,
  PP: 0.5,
  WP: 0.25,
  KK: 1,
  YD: 1,
  TP: 1,
};

const DEFAULT_WORKLOAD_RULES = {
  APS3: 3,
  APS5: 5,
  APS10: 10,
  Medical: 3,
  Claim: 10,
  Memo: 1,
  TSS: 2,
  Voice: 1,
  'F2F': 2,
  'Internet Sale': 2,
  PA: 1,
};

let capacityConfigCache = null;
let workloadRulesCache = null;

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }
  return response.json();
}

async function loadOverrides(key) {
  const records = await getAllRecords('settings');
  const entry = records.find((record) => record.key === key);
  return entry?.value || null;
}

export async function loadCapacityConfig() {
  if (capacityConfigCache) {
    return capacityConfigCache;
  }

  const [defaultConfig, overrides] = await Promise.all([
    loadJson(CAPACITY_CONFIG_URL).catch(() => DEFAULT_CAPACITY),
    loadOverrides('capacityConfig').catch(() => null),
  ]);

  const merged = { ...defaultConfig, ...(overrides || {}) };
  capacityConfigCache = merged;
  return merged;
}

export async function loadWorkloadRules() {
  if (workloadRulesCache) {
    return workloadRulesCache;
  }

  const [defaultRules, overrides] = await Promise.all([
    loadJson(WORKLOAD_RULES_URL).catch(() => DEFAULT_WORKLOAD_RULES),
    loadOverrides('workloadRulesConfig').catch(() => null),
  ]);

  const merged = { ...defaultRules, ...(overrides || {}) };
  workloadRulesCache = merged;
  return merged;
}

export async function saveCapacityConfig(config) {
  capacityConfigCache = config;
  const saved = await saveRecord('settings', { key: 'capacityConfig', value: config });
  return saved;
}

export async function saveWorkloadRulesConfig(rules) {
  workloadRulesCache = rules;
  const saved = await saveRecord('settings', { key: 'workloadRulesConfig', value: rules });
  return saved;
}

function normalizeUw(uw) {
  return String(uw || '').trim().toUpperCase();
}

export async function calculateWeight(workType) {
  const rules = await loadWorkloadRules();
  return Number(rules[workType] || rules[workType.trim()] || 0) || 0;
}

export async function getCurrentWorkload(uw) {
  const assignments = await getAllRecords('assignments');
  const normalizedUw = normalizeUw(uw);
  return assignments
    .filter((assignment) => normalizeUw(assignment.assignedUW) === normalizedUw)
    .reduce((sum, assignment) => sum + Number(assignment.weight || 0), 0);
}

export async function getRemainingCapacity(uw) {
  const config = await loadCapacityConfig();
  const capacity = Number(config[normalizeUw(uw)] || 0);
  const current = await getCurrentWorkload(uw);
  return capacity - current;
}

export async function calculatePercentage(uw) {
  const config = await loadCapacityConfig();
  const capacity = Number(config[normalizeUw(uw)] || 0);
  if (!capacity) return 0;
  const current = await getCurrentWorkload(uw);
  return Math.round((current / capacity) * 100);
}

export async function getSummary() {
  const [config, assignments] = await Promise.all([loadCapacityConfig(), getAllRecords('assignments')]);
  const knownUw = new Set(Object.keys(config || {}).map((key) => normalizeUw(key)));
  assignments.forEach((assignment) => {
    if (assignment.assignedUW) {
      knownUw.add(normalizeUw(assignment.assignedUW));
    }
  });

  const entries = [];
  for (const uw of Array.from(knownUw).sort()) {
    const capacity = Number(config[uw] || 0);
    const currentWeight = assignments
      .filter((assignment) => normalizeUw(assignment.assignedUW) === uw)
      .reduce((sum, assignment) => sum + Number(assignment.weight || 0), 0);
    const remaining = capacity - currentWeight;
    const percentage = capacity ? Math.round((currentWeight / capacity) * 100) : 0;
    let status = 'Normal';
    if (percentage >= 100) status = 'Overload';
    else if (percentage >= 80) status = 'Full';
    else if (percentage >= 50) status = 'Busy';

    entries.push({ uw, capacity, currentWeight, remaining, percentage, status });
  }

  return entries;
}
