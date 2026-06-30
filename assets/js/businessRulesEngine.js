const RULE_FILES = {
  businessRules: 'businessRules.json',
  workTypeRules: 'workTypeRules.json',
  specialRules: 'specialRules.json',
  uwRules: 'uwRules.json',
};

const DEFAULT_BUSINESS_RULES = {
  teleSale: { voiceReviewBy: 'TP', weight: 1 },
  medical: { weight: 3 },
  memo: { weight: 1 },
  tss: { weight: 2 },
  claim: { weight: 10 },
  internetSale: { weight: 1 },
  voice: { weight: 1 },
};

const DEFAULT_WORK_TYPE_RULES = {
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
  'Tele Sale': 1,
};

const DEFAULT_SPECIAL_RULES = {
  teleSale: {
    label: 'Tele Sale',
    keywords: ['Tele Sale', 'tele sale', 'TeleSale'],
    severity: 'warning',
    reason: 'Tele Sale should be reviewed for voice compliance.',
  },
  internetSale: {
    label: 'Internet Sale',
    keywords: ['Internet Sale', 'internet sale'],
    severity: 'warning',
    reason: 'Internet Sale should be checked for digital submission requirements.',
  },
  rabbitSpecialPlan: {
    label: 'Rabbit Special Plan',
    keywords: ['Rabbit Special Plan', 'Rabbit'],
    severity: 'warning',
    reason: 'Rabbit Special Plan requires extra review for special-handling policy cases.',
  },
  voiceFile: {
    label: 'Voice File',
    keywords: ['Voice File', 'Voice'],
    severity: 'warning',
    reason: 'Voice files should be routed to an underwriter that can review voice.',
  },
  manualReview: {
    label: 'Manual Review',
    keywords: ['Manual Review', 'Manual'],
    severity: 'warning',
    reason: 'Manual review is required for this case.',
  },
  priorityCase: {
    label: 'Priority Case',
    keywords: ['Priority', 'Priority Case'],
    severity: 'warning',
    reason: 'Priority case flagged for expedited review.',
  },
};

const DEFAULT_UW_RULES = {
  TS: {
    capacity: 1,
    canReviewVoice: false,
    canMedical: false,
    allowedWork: ['E-App', 'Memo'],
    priority: 'standard',
    availability: 'available',
  },
  ND: {
    capacity: 1,
    canReviewVoice: false,
    canMedical: true,
    allowedWork: ['E-App', 'Memo', 'Medical'],
    priority: 'standard',
    availability: 'available',
  },
  PP: {
    capacity: 0.5,
    canReviewVoice: false,
    canMedical: false,
    allowedWork: ['E-App', 'Memo'],
    priority: 'low',
    availability: 'busy',
  },
  WP: {
    capacity: 0.25,
    canReviewVoice: false,
    canMedical: false,
    allowedWork: ['E-App'],
    priority: 'low',
    availability: 'busy',
  },
  KK: {
    capacity: 1,
    canReviewVoice: true,
    canMedical: true,
    allowedWork: ['E-App', 'Memo', 'Voice', 'Medical'],
    priority: 'standard',
    availability: 'available',
  },
  YD: {
    capacity: 1,
    canReviewVoice: true,
    canMedical: true,
    allowedWork: ['E-App', 'Memo', 'Voice', 'Medical', 'Claim'],
    priority: 'standard',
    availability: 'available',
  },
  TP: {
    capacity: 1,
    canReviewVoice: true,
    canMedical: true,
    allowedWork: ['E-App', 'Memo', 'Voice', 'Medical', 'Claim'],
    priority: 'high',
    availability: 'available',
  },
};

let rulesCache = null;
let rulesPromise = null;

function resolveRulePath(fileName) {
  return new URL(`../../data/rules/${fileName}`, import.meta.url).href;
}

async function loadJson(url) {
  if (typeof window !== 'undefined') {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load ${url}`);
    }
    return response.json();
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(new URL(url).pathname, 'utf8');
    return JSON.parse(content);
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load ${url}`);
  }
  return response.json();
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function findMatchingRule(rules, target) {
  if (!target) return null;
  const normalizedTarget = normalizeKey(target);
  const entries = Object.entries(rules || {});
  const match = entries.find(([ruleKey]) => normalizeKey(ruleKey) === normalizedTarget);
  if (match) {
    return match[1];
  }

  return null;
}

function buildRuleContext(payload = {}) {
  return {
    workType: String(payload.workType || payload.type || '').trim(),
    assignedUW: String(payload.assignedUW || '').trim(),
    plan: String(payload.plan || '').trim(),
    appNo: String(payload.appNo || '').trim(),
    customerName: String(payload.customerName || '').trim(),
  };
}

export async function loadRules() {
  if (rulesCache) {
    return rulesCache;
  }

  if (rulesPromise) {
    return rulesPromise;
  }

  rulesPromise = (async () => {
    const [businessRules, workTypeRules, specialRules, uwRules] = await Promise.all([
      loadJson(resolveRulePath(RULE_FILES.businessRules)).catch(() => DEFAULT_BUSINESS_RULES),
      loadJson(resolveRulePath(RULE_FILES.workTypeRules)).catch(() => DEFAULT_WORK_TYPE_RULES),
      loadJson(resolveRulePath(RULE_FILES.specialRules)).catch(() => DEFAULT_SPECIAL_RULES),
      loadJson(resolveRulePath(RULE_FILES.uwRules)).catch(() => DEFAULT_UW_RULES),
    ]);

    rulesCache = {
      businessRules: { ...DEFAULT_BUSINESS_RULES, ...(businessRules || {}) },
      workTypeRules: { ...DEFAULT_WORK_TYPE_RULES, ...(workTypeRules || {}) },
      specialRules: { ...DEFAULT_SPECIAL_RULES, ...(specialRules || {}) },
      uwRules: { ...DEFAULT_UW_RULES, ...(uwRules || {}) },
    };

    return rulesCache;
  })();

  return rulesPromise;
}

export async function getRule(category, key, fallback = null) {
  const rules = await loadRules();
  const source = rules[category] || {};
  if (!key) {
    return source || fallback;
  }

  return findMatchingRule(source, key) || fallback;
}

export async function calculateWeight(payload = {}) {
  const context = buildRuleContext(payload);
  if (!context.workType) {
    return Number(payload.weight) || 0;
  }

  const rules = await loadRules();
  if (payload.weight !== undefined && payload.weight !== null && payload.weight !== '') {
    return Number(payload.weight) || 0;
  }

  const workTypeRule = findMatchingRule(rules.workTypeRules, context.workType);
  if (typeof workTypeRule === 'number') {
    return workTypeRule;
  }

  const businessRule = findMatchingRule(rules.businessRules, context.workType);
  if (businessRule && typeof businessRule.weight === 'number') {
    return businessRule.weight;
  }

  return 0;
}

export async function checkSpecialRule(payload = {}) {
  const context = buildRuleContext(payload);
  const rules = await loadRules();
  const haystack = [context.workType, context.plan, context.appNo, context.customerName].join(' ').toLowerCase();
  const matches = [];

  Object.entries(rules.specialRules || {}).forEach(([key, rule]) => {
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : [rule.keywords];
    const matched = keywords.some((keyword) => normalizeText(keyword) && haystack.includes(normalizeText(keyword)));
    if (matched) {
      matches.push({
        key,
        label: rule.label || key,
        severity: rule.severity || 'warning',
        reason: rule.reason || 'Special rule applied.',
      });
    }
  });

  return matches;
}

export async function getAllowedUW(payload = {}) {
  const context = buildRuleContext(payload);
  const rules = await loadRules();
  const workType = context.workType.toLowerCase();
  const entries = Object.entries(rules.uwRules || {});

  return entries
    .filter(([, config]) => {
      if (!config) return false;

      if (workType.includes('medical') && config.canMedical === false) {
        return false;
      }

      if ((workType.includes('voice') || workType.includes('tele')) && config.canReviewVoice === false) {
        return false;
      }

      return true;
    })
    .map(([uw]) => uw);
}

export async function validateAssignment(payload = {}) {
  const context = buildRuleContext(payload);
  const rules = await loadRules();
  const appliedRules = [];
  const warnings = [];
  const errors = [];

  const computedWeight = await calculateWeight(payload);
  if (context.workType) {
    appliedRules.push({
      type: 'workType',
      name: context.workType,
      weight: computedWeight,
    });
  }

  const matchedBusinessRule = findMatchingRule(rules.businessRules, context.workType);
  if (matchedBusinessRule) {
    appliedRules.push({
      type: 'businessRule',
      name: context.workType,
      weight: matchedBusinessRule.weight || 0,
    });
  }

  const specialMatches = await checkSpecialRule(payload);
  specialMatches.forEach((specialRule) => {
    appliedRules.push({
      type: 'specialRule',
      name: specialRule.label,
      severity: specialRule.severity,
    });

    if (specialRule.severity === 'error') {
      errors.push(specialRule.reason);
    } else {
      warnings.push(specialRule.reason);
    }
  });

  const assignedUw = context.assignedUW;
  if (assignedUw) {
    const allowedUw = await getAllowedUW(payload);
    if (!allowedUw.includes(assignedUw.toUpperCase())) {
      errors.push(`Assigned UW ${assignedUw} is not permitted for this work type.`);
    }
  } else {
    warnings.push('No underwriter selected yet. The assignment will use the first available configured UW.');
  }

  if (context.workType.toLowerCase().includes('medical') && assignedUw && !assignedUw.toUpperCase().includes('ND') && !assignedUw.toUpperCase().includes('TP') && !assignedUw.toUpperCase().includes('YD') && !assignedUw.toUpperCase().includes('KK')) {
    errors.push('Medical work requires a UW that can review medical cases.');
  }

  const status = errors.length ? 'error' : warnings.length ? 'warning' : 'valid';
  const reason = errors.length
    ? errors[0]
    : warnings.length
      ? warnings[0]
      : 'Assignment meets all configured business rules.';

  return {
    status,
    reason,
    errors,
    warnings,
    appliedRules,
    calculatedWeight: computedWeight,
    allowedUW: await getAllowedUW(payload),
  };
}
